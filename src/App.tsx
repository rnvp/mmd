import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { save as pickSavePath, open as pickOpenPath } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { EditorPane } from './components/EditorPane';
import { PreviewPane } from './components/PreviewPane';
import { TitleBar } from './components/TitleBar';
import { Button } from './components/ui/button';
import type { DocumentState, FilePayload, PendingAction, ThemeMode, TitleAction, ViewMode } from './types';
import { applyMarkdownAction, indentSelection, outdentSelection, type SelectionResult } from './utils/markdown';

const DEFAULT_CONTENT = `# MMD

面向 Markdown、提示词、代码片段与命令文本的桌面编辑器。

## Features

- 默认双栏
- UTF-8 读写
- 适合 Codex 工作流

\`\`\`bash
codex run
\`\`\`
`;

const STORAGE_KEY = 'mmd.ui.preferences.v1';

function createInitialDocument(): DocumentState {
  return {
    filePath: null,
    fileName: 'Untitled.md',
    content: DEFAULT_CONTENT,
    savedContent: DEFAULT_CONTENT,
    isDirty: false,
    viewMode: 'split',
    editorRatio: 0.52
  };
}

function resolvePreferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function loadStoredPreferences() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DocumentState> & { themeMode?: ThemeMode };
    return {
      viewMode:
        parsed.viewMode === 'editor' || parsed.viewMode === 'preview' || parsed.viewMode === 'split'
          ? parsed.viewMode
          : 'split',
      editorRatio: typeof parsed.editorRatio === 'number' ? clampRatio(parsed.editorRatio) : 0.52,
      themeMode: parsed.themeMode === 'light' || parsed.themeMode === 'dark' ? parsed.themeMode : resolvePreferredTheme()
    };
  } catch {
    return null;
  }
}

function fileNameFromPath(path: string | null) {
  if (!path) return 'Untitled.md';
  const parts = path.replaceAll('\\', '/').split('/');
  return parts[parts.length - 1] || 'Untitled.md';
}

function clampRatio(value: number) {
  return Math.min(0.72, Math.max(0.28, value));
}

export default function App() {
  const storedPreferences = loadStoredPreferences();
  const [documentState, setDocumentState] = useState<DocumentState>(() => {
    const initial = createInitialDocument();
    return storedPreferences ? { ...initial, ...storedPreferences } : initial;
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(storedPreferences?.themeMode ?? resolvePreferredTheme());
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [dragActive, setDragActive] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const droppedPathRef = useRef<string | null>(null);
  const syncSourceRef = useRef<'editor' | 'preview' | null>(null);
  const launchFileHandledRef = useRef(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!isDraggingDivider) return;
      const nextRatio = clampRatio(event.clientX / window.innerWidth);
      setDocumentState((prev) => ({ ...prev, editorRatio: nextRatio }));
    };

    const onPointerUp = () => setIsDraggingDivider(false);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDraggingDivider]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSave();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void handleOpen();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        void handleNew();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [documentState.filePath]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!documentState.isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [documentState.isDirty]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        viewMode: documentState.viewMode,
        editorRatio: documentState.editorRatio,
        themeMode
      })
    );
  }, [documentState.editorRatio, documentState.viewMode, themeMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (launchFileHandledRef.current) return;
    launchFileHandledRef.current = true;

    void invoke<string | null>('get_launch_file_path')
      .then((path) => {
        if (!path) return;
        return readTextFile(path);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to read launch file';
        setStatusMessage(message);
      });
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void appWindow.onDragDropEvent((event) => {
      const payload = event.payload;

      if (payload.type === 'enter' || payload.type === 'over') {
        setDragActive(true);
        return;
      }

      if (payload.type === 'leave') {
        setDragActive(false);
        return;
      }

      if (payload.type === 'drop') {
        setDragActive(false);
        const file = payload.paths.find((path) => /\.(md|markdown|txt)$/i.test(path));
        if (!file) {
          setStatusMessage('Only Markdown or text files can be dropped');
          return;
        }
        void requestDroppedFile(file);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [appWindow, documentState.isDirty]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void appWindow
      .onCloseRequested(async (event) => {
        if (!documentState.isDirty) {
          return;
        }
        event.preventDefault();
        if (!disposed) {
          setPendingAction('closeWindow');
          setStatusMessage('Unsaved changes detected');
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [appWindow, documentState.isDirty]);

  const layoutColumns = useMemo(() => {
    if (documentState.viewMode === 'editor') return 'minmax(0,1fr)';
    if (documentState.viewMode === 'preview') return 'minmax(0,1fr)';
    return `${documentState.editorRatio}fr 10px ${1 - documentState.editorRatio}fr`;
  }, [documentState.editorRatio, documentState.viewMode]);

  function updateContent(nextContent: string) {
    setDocumentState((prev) => ({
      ...prev,
      content: nextContent,
      isDirty: nextContent !== prev.savedContent
    }));
  }

  function applySelectionResult(result: SelectionResult) {
    const textarea = textareaRef.current;
    updateContent(result.value);
    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  function syncScroll(source: 'editor' | 'preview') {
    const editor = textareaRef.current;
    const preview = previewRef.current;
    if (!editor || !preview || syncSourceRef.current) return;

    const from = source === 'editor' ? editor : preview;
    const to = source === 'editor' ? preview : editor;
    const fromMax = from.scrollHeight - from.clientHeight;
    const toMax = to.scrollHeight - to.clientHeight;

    if (fromMax <= 0 || toMax <= 0) return;

    syncSourceRef.current = source;
    to.scrollTop = (from.scrollTop / fromMax) * toMax;
    requestAnimationFrame(() => {
      syncSourceRef.current = null;
    });
  }

  async function requestAction(action: PendingAction) {
    if (!action) return;
    if (documentState.isDirty) {
      setPendingAction(action);
      return;
    }
    await runPendingAction(action);
  }

  async function requestDroppedFile(path: string) {
    if (documentState.isDirty) {
      droppedPathRef.current = path;
      setPendingAction('openDrop');
      setStatusMessage(`Pending drop: ${fileNameFromPath(path)}`);
      return;
    }
    await readTextFile(path);
  }

  async function runPendingAction(action: Exclude<PendingAction, null>) {
    if (action === 'new') {
      const next = createInitialDocument();
      setDocumentState(next);
      setStatusMessage('New document');
      return;
    }

    if (action === 'open') {
      const selected = await pickOpenPath({
        multiple: false,
        filters: [
          {
            name: 'Markdown',
            extensions: ['md', 'markdown', 'txt']
          }
        ]
      });
      if (!selected || Array.isArray(selected)) return;
      await readTextFile(selected);
      return;
    }

    if (action === 'openDrop') {
      const path = droppedPathRef.current;
      droppedPathRef.current = null;
      if (!path) return;
      await readTextFile(path);
      return;
    }

    if (action === 'closeWindow') {
      await appWindow.destroy();
    }
  }

  async function resolvePendingAction(decision: 'save' | 'discard' | 'cancel') {
    const action = pendingAction;
    if (!action) return;
    if (decision === 'cancel') {
      droppedPathRef.current = null;
      setPendingAction(null);
      setStatusMessage('Action canceled');
      return;
    }

    if (decision === 'save') {
      const saved = await handleSave();
      if (!saved) {
        setStatusMessage('Save canceled');
        return;
      }
    }

    setPendingAction(null);
    await runPendingAction(action);
  }

  async function readTextFile(path: string) {
    const payload = await invoke<FilePayload>('read_text_file', { path });
    setDocumentState((prev) => ({
      ...prev,
      filePath: payload.path,
      fileName: fileNameFromPath(payload.path),
      content: payload.content,
      savedContent: payload.content,
      isDirty: false
    }));
    setStatusMessage(`Opened ${fileNameFromPath(payload.path)}`);
  }

  async function writeTextFile(path: string) {
    await invoke('write_text_file', { path, content: documentState.content });
    setDocumentState((prev) => ({
      ...prev,
      filePath: path,
      fileName: fileNameFromPath(path),
      savedContent: prev.content,
      isDirty: false
    }));
    setStatusMessage(`Saved ${fileNameFromPath(path)}`);
  }

  async function handleNew() {
    await requestAction('new');
  }

  async function handleOpen() {
    await requestAction('open');
  }

  async function handleSave() {
    if (documentState.filePath) {
      await writeTextFile(documentState.filePath);
      return true;
    }
    return handleSaveAs();
  }

  async function handleSaveAs() {
    const selected = await pickSavePath({
      defaultPath: documentState.fileName,
      filters: [
        {
          name: 'Markdown',
          extensions: ['md', 'markdown', 'txt']
        }
      ]
    });
    if (!selected) return false;
    await writeTextFile(selected);
    return true;
  }

  function handleToggleTheme() {
    setThemeMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      setStatusMessage(`Theme: ${next}`);
      return next;
    });
  }

  function handleFormatting(action: TitleAction) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const result = applyMarkdownAction(action, documentState.content, textarea.selectionStart, textarea.selectionEnd);
    applySelectionResult(result);
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    const { key, ctrlKey, metaKey, shiftKey, currentTarget } = event;
    const commandKey = ctrlKey || metaKey;

    if (key === 'Tab') {
      event.preventDefault();
      const result = shiftKey
        ? outdentSelection(documentState.content, currentTarget.selectionStart, currentTarget.selectionEnd)
        : indentSelection(documentState.content, currentTarget.selectionStart, currentTarget.selectionEnd);
      applySelectionResult(result);
      return;
    }

    if (!commandKey) {
      return;
    }

    const shortcuts: Record<string, TitleAction> = {
      b: 'bold',
      i: 'italic',
      k: 'link',
      e: 'code',
      '1': 'heading'
    };

    const action = shortcuts[key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    handleFormatting(action);
  }

  async function handleAction(action: TitleAction) {
    try {
      switch (action) {
        case 'new':
          await handleNew();
          break;
        case 'open':
          await handleOpen();
          break;
        case 'save':
          await handleSave();
          break;
        case 'saveAs':
          await handleSaveAs();
          break;
        case 'minimize':
          await appWindow.minimize();
          break;
        case 'toggleMaximize':
          await appWindow.toggleMaximize();
          break;
        case 'closeWindow':
          await requestAction('closeWindow');
          break;
        case 'split':
        case 'editor':
        case 'preview':
          setDocumentState((prev) => ({ ...prev, viewMode: action as ViewMode }));
          setStatusMessage(`View mode: ${action}`);
          break;
        default:
          handleFormatting(action);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatusMessage(message);
    }
  }

  return (
    <div className="app-shell relative isolate flex h-screen flex-col text-[var(--app-text)]">
      <TitleBar
        fileName={documentState.fileName}
        filePath={documentState.filePath}
        isDirty={documentState.isDirty}
        viewMode={documentState.viewMode}
        themeMode={themeMode}
        onAction={(action) => void handleAction(action)}
        onToggleTheme={handleToggleTheme}
      />

      <main className="relative z-0 min-h-0 flex-1 px-0 pb-0 pt-0">
        <div
          className="grid h-full min-h-0 gap-0"
          style={{ gridTemplateColumns: layoutColumns }}
        >
          {documentState.viewMode !== 'preview' ? (
            <EditorPane
              content={documentState.content}
              fileName={documentState.fileName}
              textareaRef={textareaRef}
              onChange={updateContent}
              onKeyDown={handleEditorKeyDown}
              onScroll={() => syncScroll('editor')}
            />
          ) : null}

          {documentState.viewMode === 'split' ? (
            <button
              type="button"
              aria-label="Resize panes"
              onPointerDown={() => setIsDraggingDivider(true)}
              className="group mx-auto hidden h-full w-full cursor-col-resize items-center justify-center md:flex"
            >
              <span className="h-20 w-[3px] rounded-full bg-[var(--app-divider)] transition-colors group-hover:bg-[var(--app-divider-hover)]" />
            </button>
          ) : null}

          {documentState.viewMode !== 'editor' ? (
            <PreviewPane
              content={documentState.content}
              previewRef={previewRef}
              onScroll={() => syncScroll('preview')}
            />
          ) : null}
        </div>
      </main>

      <footer className="flex items-center justify-between border-t border-[var(--app-border)] bg-[var(--app-footer-bg)] px-4 py-2 text-xs text-[var(--app-muted)]">
        <div className="flex items-center gap-3">
          <span>{documentState.isDirty ? 'Modified' : 'Synchronized'}</span>
          <span>{documentState.filePath ?? 'Unsaved document'}</span>
          <span>{documentState.content.split('\n').length} lines</span>
        </div>
        <span>{statusMessage} · {documentState.content.length} chars</span>
      </footer>

      {pendingAction ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--app-overlay)] px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[26px] border border-[var(--app-border-strong)] bg-[var(--app-modal-bg)] p-5 shadow-[var(--app-modal-shadow)]">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Unsaved Changes</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--app-text-strong)]">当前文档还没有保存</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--app-muted-soft)]">
              你正在执行
              {pendingAction === 'new'
                ? '新建文档'
                : pendingAction === 'open'
                  ? '打开其他文件'
                  : pendingAction === 'openDrop'
                    ? '拖拽打开文件'
                    : '关闭窗口'}
              。请选择先保存，或直接丢弃当前修改。
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => void resolvePendingAction('cancel')}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => void resolvePendingAction('discard')}>
                Discard
              </Button>
              <Button variant="accent" onClick={() => void resolvePendingAction('save')}>
                Save and Continue
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {dragActive ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[var(--app-drop-overlay)]">
          <div className="rounded-2xl border border-[var(--app-accent-border)] bg-[var(--app-drop-bg)] px-5 py-3 text-sm text-[var(--app-accent-text)] shadow-[var(--app-drop-shadow)]">
            Drop a Markdown file to open
          </div>
        </div>
      ) : null}
    </div>
  );
}
