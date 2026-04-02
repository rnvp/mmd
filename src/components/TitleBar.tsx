import {
  Bold,
  ChevronDown,
  ChevronsUpDown,
  Ellipsis,
  Eye,
  FileCode2,
  FileInput,
  FilePlus2,
  FileText,
  Hash,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  Moon,
  PanelLeft,
  Quote,
  Save,
  Sun,
  X
} from 'lucide-react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ThemeMode, TitleAction, ViewMode } from '../types';
import { Button } from './ui/button';

type TitleBarProps = {
  fileName: string;
  filePath: string | null;
  isDirty: boolean;
  viewMode: ViewMode;
  themeMode: ThemeMode;
  onAction: (action: TitleAction) => void;
  onToggleTheme: () => void;
};

const formatActions: Array<{ action: TitleAction; icon: typeof Hash; label: string }> = [
  { action: 'heading', icon: Hash, label: 'Heading' },
  { action: 'bold', icon: Bold, label: 'Bold' },
  { action: 'italic', icon: Italic, label: 'Italic' },
  { action: 'code', icon: FileCode2, label: 'Inline code' },
  { action: 'codeBlock', icon: FileText, label: 'Code block' },
  { action: 'quote', icon: Quote, label: 'Quote' },
  { action: 'bulletList', icon: List, label: 'Bullet list' },
  { action: 'orderedList', icon: ListOrdered, label: 'Ordered list' },
  { action: 'link', icon: Link2, label: 'Link' },
  { action: 'image', icon: Image, label: 'Image' }
];

export function TitleBar({ fileName, filePath, isDirty, viewMode, themeMode, onAction, onToggleTheme }: TitleBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  function handleMenuAction(action: TitleAction) {
    setMenuOpen(false);
    onAction(action);
  }

  function handleDragAreaMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="button"]')) {
      return;
    }
    void appWindow.startDragging();
  }

  function handleDragAreaDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="button"]')) {
      return;
    }
    void appWindow.toggleMaximize();
  }

  return (
    <header className="relative z-30 flex h-11 items-center gap-2 border-b border-[var(--app-border)] bg-[var(--app-titlebar-bg)] px-3 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--app-accent-border)] bg-[var(--app-accent-bg)] text-[var(--app-accent-text)]">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold tracking-[0.08em] text-[var(--app-text-strong)]">MMD</span>
            <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-pill-bg)] px-2 py-0.5 text-[11px] text-[var(--app-muted)]">
              {isDirty ? 'Unsaved' : 'Saved'}
            </span>
          </div>
          <p className="truncate text-[11px] leading-4 text-[var(--app-muted)]">{filePath ?? fileName}</p>
        </div>
      </div>

      <div
        className="min-w-16 flex-1 self-stretch"
        onMouseDown={handleDragAreaMouseDown}
        onDoubleClick={handleDragAreaDoubleClick}
        title="Drag window"
      />

      <div className="relative z-40 flex items-center gap-1.5">
        <div className="hidden items-center gap-1 rounded-2xl border border-[var(--app-border)] bg-[var(--app-toolbar-bg)] p-1 xl:flex">
          {formatActions.map(({ action, icon: Icon, label }) => (
            <Button key={action} variant="ghost" size="icon" title={label} onClick={() => onAction(action)}>
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-[var(--app-border)] bg-[var(--app-toolbar-bg)] p-1">
          <Button variant="ghost" size="icon" title="Split view" active={viewMode === 'split'} onClick={() => onAction('split')}>
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Editor only" active={viewMode === 'editor'} onClick={() => onAction('editor')}>
            <FileInput className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Preview only" active={viewMode === 'preview'} onClick={() => onAction('preview')}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-[var(--app-border)] bg-[var(--app-toolbar-bg)] p-1">
          <Button variant="ghost" size="icon" title="New" onClick={() => onAction('new')}>
            <FilePlus2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Open" onClick={() => onAction('open')}>
            <FileInput className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Save" onClick={() => onAction('save')}>
            <Save className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="icon"
          title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={onToggleTheme}
        >
          {themeMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div ref={menuRef} className="relative z-50">
          <Button variant="outline" size="sm" title="More" onClick={() => setMenuOpen((value) => !value)}>
            <Ellipsis className="h-4 w-4" />
            More
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>

          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+10px)] z-[90] min-w-56 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-menu-bg)] p-2 shadow-[var(--app-menu-shadow)] backdrop-blur-xl">
              <div className="px-2 pb-2 pt-1 text-[11px] uppercase tracking-[0.22em] text-[var(--app-muted)]">File</div>
              <button className="title-menu-item" onClick={() => handleMenuAction('new')}>
                <FilePlus2 className="h-4 w-4" />
                New document
              </button>
              <button className="title-menu-item" onClick={() => handleMenuAction('open')}>
                <FileInput className="h-4 w-4" />
                Open file
              </button>
              <button className="title-menu-item" onClick={() => handleMenuAction('save')}>
                <Save className="h-4 w-4" />
                Save
              </button>
              <button className="title-menu-item" onClick={() => handleMenuAction('saveAs')}>
                <Save className="h-4 w-4" />
                Save as
              </button>

              <div className="my-2 h-px bg-[var(--app-border)]" />
              <div className="px-2 pb-2 pt-1 text-[11px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Format</div>
              {formatActions.map(({ action, icon: Icon, label }) => (
                <button key={action} className="title-menu-item" onClick={() => handleMenuAction(action)}>
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-0.5">
          <Button className="rounded-lg" variant="ghost" size="icon" title="Minimize" onClick={() => onAction('minimize')}>
            <span className="block h-px w-3 bg-current" />
          </Button>
          <Button className="rounded-lg" variant="ghost" size="icon" title="Maximize" onClick={() => onAction('toggleMaximize')}>
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
          <Button className="rounded-lg" variant="ghost" size="icon" title="Close" onClick={() => onAction('closeWindow')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
