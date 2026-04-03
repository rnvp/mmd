import type { ComponentProps, RefObject } from 'react';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { dirname, isAbsolute, join, normalize } from '@tauri-apps/api/path';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

type PreviewPaneProps = {
  content: string;
  filePath: string | null;
  previewRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
};

type MarkdownImageProps = ComponentProps<'img'> & {
  documentPath: string | null;
};

function isExternalSource(source: string) {
  return /^(https?:|data:|blob:)/i.test(source);
}

function isFileUrl(source: string) {
  return source.toLowerCase().startsWith('file://');
}

async function resolveLocalImagePath(source: string, documentPath: string | null) {
  if (!source) return null;

  if (isFileUrl(source)) {
    const url = new URL(source);
    return normalize(decodeURIComponent(url.pathname.replace(/^\/+/, '')));
  }

  if (await isAbsolute(source)) {
    return normalize(source);
  }

  if (!documentPath) {
    return null;
  }

  const baseDir = await dirname(documentPath);
  return normalize(await join(baseDir, source));
}

function MarkdownImage({ src, alt = '', documentPath, ...props }: MarkdownImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      if (!src) {
        setResolvedSrc(null);
        return;
      }

      if (isExternalSource(src)) {
        setResolvedSrc(src);
        return;
      }

      try {
        const imagePath = await resolveLocalImagePath(src, documentPath);
        if (!imagePath) {
          setResolvedSrc(null);
          return;
        }
        const dataUrl = await invoke<string>('read_image_data_url', { path: imagePath });
        if (!cancelled) {
          setResolvedSrc(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setResolvedSrc(null);
        }
      }
    }

    void loadImage();

    return () => {
      cancelled = true;
    };
  }, [documentPath, src]);

  if (!resolvedSrc) {
    return (
      <span className="inline-flex rounded-md border border-[var(--app-image-border)] px-2 py-1 text-xs text-[var(--app-muted)]">
        {alt || src || 'Image not found'}
      </span>
    );
  }

  return <img {...props} src={resolvedSrc} alt={alt} />;
}

export function PreviewPane({ content, filePath, previewRef, onScroll }: PreviewPaneProps) {
  return (
    <section className="markdown-shell flex h-full min-h-0 min-w-0 flex-col border border-[var(--app-border)] border-l-0 bg-[var(--app-preview-bg)]">
      <div ref={previewRef} onScroll={onScroll} className="min-h-0 min-w-0 flex-1 overflow-auto px-5 py-5">
        <article className="markdown-body mx-auto min-w-0 max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              img: ({ node: _node, ...imgProps }) => <MarkdownImage {...imgProps} documentPath={filePath} />
            }}
          >
            {content || '_Nothing to preview yet._'}
          </ReactMarkdown>
        </article>
      </div>
    </section>
  );
}
