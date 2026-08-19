import type { ClipboardEvent as ReactClipboardEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { save as pickSavePath, open as pickOpenPath } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { EditorPane } from './components/EditorPane';
import { PreviewPane } from './components/PreviewPane';
import { TitleBar } from './components/TitleBar';
import { Button } from './components/ui/button';
import type {
  DocumentState,
  FileChangedPayload,
  FilePayload,
  InsertableImage,
  PendingAction,
  ThemeMode,
  TitleAction,
  ViewMode
} from './types';
import { htmlToMarkdownFromClipboard } from './utils/htmlToMarkdown';
import { applyMarkdownAction, indentSelection, outdentSelection, type SelectionResult } from './utils/markdown';

const DEFAULT_CONTENT = '';

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

function normalizeFileIdentity(path: string | null) {
  return path ? path.replaceAll('\\', '/').toLowerCase() : null;
}

function clampRatio(value: number) {
  return Math.min(0.72, Math.max(0.28, value));
}

function escapeMarkdownAltText(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[[\]\\]/g, '\\$&') || 'image';
}

function insertMarkdownImage(value: string, start: number, end: number, relativePath: string, fileName: string): SelectionResult {
  const altText = escapeMarkdownAltText(fileName);
  const markdown = `![${altText}](${relativePath})`;
  return {
    value: `${value.slice(0, start)}${markdown}${value.slice(end)}`,
    replaceStart: start,
    replaceEnd: end,
    replacementText: markdown,
    selectionStart: start + markdown.length,
    selectionEnd: start + markdown.length
  };
}

type ImagePickerItem = InsertableImage & {
  previewSrc: string | null;
};

export default function App() {
  const storedPreferences = loadStoredPreferences();
  const [documentState, setDocumentState] = useState<DocumentState>(() => {
    const initial = createInitialDocument();
    return storedPreferences ? { ...initial, ...storedPreferences } : initial;
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(storedPreferences?.themeMode ?? resolvePreferredTheme());
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [fileSyncNotice, setFileSyncNotice] = useState<string | null>(null);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [dragActive, setDragActive] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerLoading, setImagePickerLoading] = useState(false);
  const [imagePickerItems, setImagePickerItems] = useState<ImagePickerItem[]>([]);
  const [editorContentVersion, setEditorContentVersion] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const droppedPathRef = useRef<string | null>(null);
  const syncSourceRef = useRef<'editor' | 'preview' | null>(null);
  const launchFileHandledRef = useRef(false);
  const documentStateRef = useRef(documentState);
  const externalReloadTimerRef = useRef<number | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const fileSyncNoticeTimerRef = useRef<number | null>(null);
  const lastLocalWriteRef = useRef<{ path: string; at: number } | null>(null);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    documentStateRef.current = documentState;
  }, [documentState]);

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
      if (event.defaultPrevented || event.isComposing) return;

      const commandKey = event.ctrlKey || event.metaKey;
      if (!commandKey) return;

      const key = event.key.toLowerCase();

      if (key === 's') {
        event.preventDefault();
        if (event.shiftKey) {
          void handleSaveAs();
          return;
        }
        void handleSave();
        return;
      }

      if (event.shiftKey) return;

      if (key === 'o') {
        event.preventDefault();
        void handleOpen();
        return;
      }

      if (key === 'n') {
        event.preventDefault();
        void handleNew();
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [documentState.filePath, documentState.content]);

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
    const watchedPath = documentState.filePath;
    setFileSyncNotice(null);

    void invoke('watch_text_file', { path: watchedPath }).catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to watch file changes';
      setStatusMessage(message);
    });

    return () => {
      if (externalReloadTimerRef.current !== null) {
        window.clearTimeout(externalReloadTimerRef.current);
        externalReloadTimerRef.current = null;
      }
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (fileSyncNoticeTimerRef.current !== null) {
        window.clearTimeout(fileSyncNoticeTimerRef.current);
        fileSyncNoticeTimerRef.current = null;
      }
    };
  }, [documentState.filePath]);

  useEffect(() => {
    const watchedPath = documentState.filePath;
    if (!watchedPath) {
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    let disposed = false;
    let isChecking = false;

    const checkExternalFileChange = async () => {
      if (disposed || isChecking) return;

      const current = documentStateRef.current;
      if (normalizeFileIdentity(current.filePath) !== normalizeFileIdentity(watchedPath)) return;

      const lastLocalWrite = lastLocalWriteRef.current;
      if (
        lastLocalWrite &&
        normalizeFileIdentity(lastLocalWrite.path) === normalizeFileIdentity(watchedPath) &&
        Date.now() - lastLocalWrite.at < 1200
      ) {
        return;
      }

      isChecking = true;

      try {
        const payload = await invoke<FilePayload>('read_text_file', { path: watchedPath });
        if (disposed) return;
        if (normalizeFileIdentity(documentStateRef.current.filePath) !== normalizeFileIdentity(payload.path)) return;

        const latest = documentStateRef.current;
        if (payload.content === latest.savedContent) {
          return;
        }

        if (latest.isDirty) {
          showFileSyncNotice('File changed on disk. Local unsaved edits were kept.');
          setStatusMessage(`External update detected for ${fileNameFromPath(payload.path)}`);
          return;
        }

        replaceDocument((prev) => ({
          ...prev,
          filePath: payload.path,
          fileName: fileNameFromPath(payload.path),
          content: payload.content,
          savedContent: payload.content,
          isDirty: false
        }));
        showFileSyncNotice(`Synced from disk: ${fileNameFromPath(payload.path)}`);
        setStatusMessage(`Reloaded ${fileNameFromPath(payload.path)} after external change`);
      } catch {
        // Ignore transient read errors while the other editor is still writing the file.
      } finally {
        isChecking = false;
      }
    };

    pollingIntervalRef.current = window.setInterval(() => {
      void checkExternalFileChange();
    }, 1200);

    return () => {
      disposed = true;
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [documentState.filePath]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const handleExternalFileChange = async (path: string) => {
      const current = documentStateRef.current;
      if (normalizeFileIdentity(current.filePath) !== normalizeFileIdentity(path)) return;

      if (current.isDirty) {
        showFileSyncNotice('File changed on disk. Local unsaved edits were kept.');
        setStatusMessage(`External update detected for ${fileNameFromPath(path)}`);
        return;
      }

      const lastLocalWrite = lastLocalWriteRef.current;
      if (
        lastLocalWrite &&
        normalizeFileIdentity(lastLocalWrite.path) === normalizeFileIdentity(path) &&
        Date.now() - lastLocalWrite.at < 1200
      ) {
        return;
      }

      try {
        const payload = await invoke<FilePayload>('read_text_file', { path });
        if (normalizeFileIdentity(documentStateRef.current.filePath) !== normalizeFileIdentity(payload.path)) return;

        replaceDocument((prev) => ({
          ...prev,
          filePath: payload.path,
          fileName: fileNameFromPath(payload.path),
          content: payload.content,
          savedContent: payload.content,
          isDirty: false
        }));
        showFileSyncNotice(`Synced from disk: ${fileNameFromPath(payload.path)}`);
        setStatusMessage(`Reloaded ${fileNameFromPath(payload.path)} after external change`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to sync external changes';
        showFileSyncNotice(`File changed on disk, but sync failed: ${message}`);
        setStatusMessage(message);
      }
    };

    void listen<FileChangedPayload>('mmd://file-changed', (event) => {
      const path = event.payload.path;
      if (externalReloadTimerRef.current !== null) {
        window.clearTimeout(externalReloadTimerRef.current);
      }
      externalReloadTimerRef.current = window.setTimeout(() => {
        externalReloadTimerRef.current = null;
        void handleExternalFileChange(path);
      }, 180);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (externalReloadTimerRef.current !== null) {
        window.clearTimeout(externalReloadTimerRef.current);
        externalReloadTimerRef.current = null;
      }
      unlisten?.();
    };
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

  function applyTextareaEdit(
    textarea: HTMLTextAreaElement,
    replacementText: string,
    replaceStart: number,
    replaceEnd: number,
    selectionStart: number,
    selectionEnd: number
  ) {
    textarea.focus();
    textarea.setSelectionRange(replaceStart, replaceEnd);

    const insertedByCommand = document.execCommand('insertText', false, replacementText);
    if (!insertedByCommand) {
      textarea.setRangeText(replacementText, replaceStart, replaceEnd, 'end');
    }

    textarea.setSelectionRange(selectionStart, selectionEnd);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function updateContent(nextContent: string) {
    setDocumentState((prev) => ({
      ...prev,
      content: nextContent,
      isDirty: nextContent !== prev.savedContent
    }));
  }

  function replaceDocument(nextState: DocumentState | ((prev: DocumentState) => DocumentState)) {
    setDocumentState(nextState);
    setEditorContentVersion((prev) => prev + 1);
  }

  function showFileSyncNotice(message: string) {
    if (fileSyncNoticeTimerRef.current !== null) {
      window.clearTimeout(fileSyncNoticeTimerRef.current);
    }

    setFileSyncNotice(message);
    fileSyncNoticeTimerRef.current = window.setTimeout(() => {
      setFileSyncNotice((current) => (current === message ? null : current));
      fileSyncNoticeTimerRef.current = null;
    }, 1000);
  }

  function applySelectionResult(result: SelectionResult) {
    const textarea = textareaRef.current;
    if (!textarea) {
      updateContent(result.value);
      return;
    }

    applyTextareaEdit(
      textarea,
      result.replacementText,
      result.replaceStart,
      result.replaceEnd,
      result.selectionStart,
      result.selectionEnd
    );
  }

  function insertAtSelection(text: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      const nextValue = `${documentState.content}${text}`;
      updateContent(nextValue);
      return;
    }

    const { selectionStart, selectionEnd } = textarea;
    const nextCursor = selectionStart + text.length;
    applyTextareaEdit(textarea, text, selectionStart, selectionEnd, nextCursor, nextCursor);
  }

  function insertImageAtSelection(relativePath: string, fileName: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const result = insertMarkdownImage(
      documentState.content,
      textarea.selectionStart,
      textarea.selectionEnd,
      relativePath,
      fileName
    );

    applySelectionResult(result);
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
      replaceDocument(next);
      setFileSyncNotice(null);
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
    replaceDocument((prev) => ({
      ...prev,
      filePath: payload.path,
      fileName: fileNameFromPath(payload.path),
      content: payload.content,
      savedContent: payload.content,
      isDirty: false
    }));
    setFileSyncNotice(null);
    setStatusMessage(`Opened ${fileNameFromPath(payload.path)}`);
  }

  async function writeTextFile(path: string) {
    await invoke('write_text_file', { path, content: documentState.content });
    lastLocalWriteRef.current = { path, at: Date.now() };
    setDocumentState((prev) => ({
      ...prev,
      filePath: path,
      fileName: fileNameFromPath(path),
      savedContent: prev.content,
      isDirty: false
    }));
    setFileSyncNotice(null);
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

  async function openImagePicker() {
    if (imagePickerOpen) {
      setImagePickerOpen(false);
      return;
    }

    if (!documentState.filePath) {
      setStatusMessage('Save the document before inserting local images');
      return;
    }

    setImagePickerOpen(true);
    setImagePickerLoading(true);

    try {
      const images = await invoke<InsertableImage[]>('list_insertable_images', { documentPath: documentState.filePath });
      const items = await Promise.all(
        images.map(async (image) => {
          try {
            const previewSrc = await invoke<string>('read_image_data_url', { path: image.absolutePath });
            return { ...image, previewSrc };
          } catch {
            return { ...image, previewSrc: null };
          }
        })
      );

      setImagePickerItems(items);
      setStatusMessage(items.length > 0 ? `Loaded ${items.length} images` : 'No images found in the document folder');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load images';
      setImagePickerItems([]);
      setStatusMessage(message);
    } finally {
      setImagePickerLoading(false);
    }
  }

  function handleImageSelect(relativePath: string, fileName: string) {
    insertImageAtSelection(relativePath, fileName);
    setImagePickerOpen(false);
    setStatusMessage(`Inserted ${relativePath}`);
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
      '1': 'heading',
      '7': 'orderedList',
      '8': 'bulletList',
      '/': 'quote',
      b: 'bold',
      e: 'code',
      g: 'image',
      i: 'italic',
      k: 'link',
      '`': 'codeBlock'
    };

    const action = shortcuts[key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    handleFormatting(action);
  }

  function handleEditorPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const html = event.clipboardData.getData('text/html');
    if (!html) return;

    const plainText = event.clipboardData.getData('text/plain');
    const markdown = htmlToMarkdownFromClipboard(html, plainText);
    if (!markdown) return;

    event.preventDefault();
    insertAtSelection(markdown);
    setStatusMessage('Pasted rich text as Markdown');
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
        case 'image':
          await openImagePicker();
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
        viewMode={documentState.viewMode}
        themeMode={themeMode}
        imagePickerOpen={imagePickerOpen}
        imagePickerLoading={imagePickerLoading}
        imagePickerItems={imagePickerItems}
        onAction={(action) => void handleAction(action)}
        onCloseImagePicker={() => setImagePickerOpen(false)}
        onSelectImage={(relativePath, fileName) => handleImageSelect(relativePath, fileName)}
        onToggleTheme={handleToggleTheme}
      />

      <main className="relative z-0 min-h-0 flex-1 px-0 pb-0 pt-0">
        <div
          className="grid h-full min-h-0 min-w-0 gap-0"
          style={{ gridTemplateColumns: layoutColumns }}
        >
          {documentState.viewMode !== 'preview' ? (
            <EditorPane
              content={documentState.content}
              contentVersion={editorContentVersion}
              fileName={documentState.fileName}
              textareaRef={textareaRef}
              onChange={updateContent}
              onKeyDown={handleEditorKeyDown}
              onPaste={handleEditorPaste}
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
              filePath={documentState.filePath}
              previewRef={previewRef}
              onScroll={() => syncScroll('preview')}
              themeMode={themeMode}
            />
          ) : null}
        </div>
      </main>

      <footer className="border-t border-[var(--app-border)] bg-[var(--app-footer-bg)] px-4 py-2 text-xs text-[var(--app-muted)]">
        <div className="flex items-center justify-between gap-3 overflow-hidden">
          <div className="flex min-w-0 items-center gap-3 overflow-hidden">
            <span>{documentState.isDirty ? 'Unsaved' : 'Saved'}</span>
            <span>{documentState.content.length} chars</span>
            <span>{documentState.content.split('\n').length} lines</span>
            {fileSyncNotice ? <span className="truncate text-[var(--app-muted-soft)]">{fileSyncNotice}</span> : null}
          </div>
          <span className="truncate text-right">{statusMessage}</span>
        </div>
      </footer>

      {pendingAction ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--app-overlay)] px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[26px] border border-[var(--app-border-strong)] bg-[var(--app-modal-bg)] p-5 shadow-[var(--app-modal-shadow)]">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Unsaved Changes</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--app-text-strong)]">This document has unsaved changes</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--app-muted-soft)]">
              You are about to
              {pendingAction === 'new'
                ? ' create a new document'
                : pendingAction === 'open'
                  ? ' open another file'
                  : pendingAction === 'openDrop'
                    ? ' open a dropped file'
                    : ' close the window'}
              . Save first, or discard the current changes.
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
