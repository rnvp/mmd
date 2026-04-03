import {
  Bold,
  ChevronsUpDown,
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
import { useEffect, useRef, useState } from 'react';
import type { ThemeMode, TitleAction, ViewMode } from '../types';
import { Button } from './ui/button';
import appIcon from '../../src-tauri/icons/icon.png';

type TitleBarProps = {
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

const toolbarGroupClass =
  'flex h-7 items-center gap-0.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-toolbar-bg)] px-0.5';

export function TitleBar({ viewMode, themeMode, onAction, onToggleTheme }: TitleBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  function handleMenuAction(action: TitleAction) {
    setMenuOpen(false);
    onAction(action);
  }

  return (
    <header className="relative z-30 flex h-10 items-center gap-2 border-b border-[var(--app-border)] bg-[var(--app-titlebar-bg)] px-3 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-2">
        <div ref={menuRef} className="relative z-50">
          <button
            type="button"
            title="Open menu"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-[var(--app-accent-border)] bg-[var(--app-accent-bg)] text-[var(--app-accent-text)] transition-colors hover:border-[var(--app-accent-border-hover)] hover:bg-[var(--app-accent-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
          >
            <img src={appIcon} alt="MMD" className="h-5 w-5 select-none object-contain" draggable={false} />
          </button>

          {menuOpen ? (
            <div className="absolute left-0 top-[calc(100%+10px)] z-[90] min-w-56 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-menu-bg)] p-2 shadow-[var(--app-menu-shadow)] backdrop-blur-xl">
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
      </div>

      <div
        data-tauri-drag-region
        className="min-w-16 flex-1 self-stretch"
        title="Drag window"
      />

      <div className="relative z-40 flex items-center gap-1.5">
        <div className={`${toolbarGroupClass} hidden xl:flex`}>
          {formatActions.map(({ action, icon: Icon, label }) => (
            <Button key={action} variant="ghost" size="icon" title={label} onClick={() => onAction(action)}>
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>

        <div className={toolbarGroupClass}>
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

        <div className={toolbarGroupClass}>
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

        <div className="flex items-center gap-0.5">
          <Button className="rounded-md" variant="ghost" size="icon" title="Minimize" onClick={() => onAction('minimize')}>
            <span className="block h-px w-3 bg-current" />
          </Button>
          <Button className="rounded-md" variant="ghost" size="icon" title="Maximize" onClick={() => onAction('toggleMaximize')}>
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
          <Button className="rounded-md" variant="ghost" size="icon" title="Close" onClick={() => onAction('closeWindow')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
