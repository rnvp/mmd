import type { ClipboardEvent as ReactClipboardEvent, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { useLayoutEffect, useRef } from 'react';

type EditorPaneProps = {
  content: string;
  contentVersion: number;
  fileName: string;
  onChange: (value: string) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  onScroll: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

export function EditorPane({ content, contentVersion, fileName, onChange, onKeyDown, onPaste, onScroll, textareaRef }: EditorPaneProps) {
  const lastAppliedVersionRef = useRef<number>(-1);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (lastAppliedVersionRef.current === contentVersion) return;

    textarea.value = content;
    lastAppliedVersionRef.current = contentVersion;
  }, [content, contentVersion, textareaRef]);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col border border-[var(--app-border)] border-r-0 bg-[var(--app-editor-bg)]">
      <textarea
        ref={textareaRef}
        defaultValue={content}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onScroll={onScroll}
        aria-label={fileName}
        className="min-h-0 min-w-0 flex-1 resize-none bg-transparent px-5 py-5 font-[Consolas,Monaco,'Courier_New',monospace] text-[14px] leading-7 text-[var(--app-text)] outline-none placeholder:text-[var(--app-placeholder)]"
        placeholder="# Start writing in Markdown"
      />
    </section>
  );
}
