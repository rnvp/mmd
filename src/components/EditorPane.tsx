import type { ClipboardEvent as ReactClipboardEvent, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';

type EditorPaneProps = {
  content: string;
  fileName: string;
  onChange: (value: string) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  onScroll: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

export function EditorPane({ content, fileName, onChange, onKeyDown, onPaste, onScroll, textareaRef }: EditorPaneProps) {
  return (
    <section className="flex h-full min-h-0 flex-col border border-[var(--app-border)] border-r-0 bg-[var(--app-editor-bg)]">
      <textarea
        ref={textareaRef}
        value={content}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onScroll={onScroll}
        aria-label={fileName}
        className="min-h-0 flex-1 resize-none bg-transparent px-5 py-5 font-[Consolas,Monaco,'Courier_New',monospace] text-[14px] leading-7 text-[var(--app-text)] outline-none placeholder:text-[var(--app-placeholder)]"
        placeholder="# Start writing in Markdown"
      />
    </section>
  );
}
