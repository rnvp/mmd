import type { RefObject } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type PreviewPaneProps = {
  content: string;
  previewRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
};

export function PreviewPane({ content, previewRef, onScroll }: PreviewPaneProps) {
  return (
    <section className="markdown-shell flex h-full min-h-0 flex-col border border-[var(--app-border)] border-l-0 bg-[var(--app-preview-bg)]">
      <div ref={previewRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto px-5 py-5">
        <article className="markdown-body mx-auto max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content || '_Nothing to preview yet._'}
          </ReactMarkdown>
        </article>
      </div>
    </section>
  );
}
