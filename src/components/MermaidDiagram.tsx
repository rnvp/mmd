import { useEffect, useId, useState } from 'react';
import type { ThemeMode } from '../types';

type MermaidDiagramProps = {
  source: string;
  themeMode: ThemeMode;
};

type RenderState =
  | { status: 'loading' }
  | { status: 'ready'; svg: string }
  | { status: 'error'; message: string };

let renderSequence = 0;
let mermaidPromise: Promise<(typeof import('mermaid'))['default']> | null = null;

function loadMermaid() {
  mermaidPromise ??= import('mermaid').then((module) => module.default);
  return mermaidPromise;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.split('\n')[0] : 'Unable to render this diagram.';
}

export function MermaidDiagram({ source, themeMode }: MermaidDiagramProps) {
  const componentId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [renderState, setRenderState] = useState<RenderState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setRenderState({ status: 'loading' });
      const renderId = `mmd-mermaid-${componentId}-${renderSequence++}`;

      try {
        const mermaid = await loadMermaid();
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          suppressErrorRendering: true,
          theme: themeMode === 'dark' ? 'dark' : 'default',
          flowchart: { useMaxWidth: true }
        });

        const { svg } = await mermaid.render(renderId, source);
        if (!cancelled) {
          setRenderState({ status: 'ready', svg });
        }
      } catch (error) {
        if (!cancelled) {
          setRenderState({ status: 'error', message: getErrorMessage(error) });
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [componentId, source, themeMode]);

  if (renderState.status === 'error') {
    return (
      <div className="mermaid-error" role="alert">
        <strong>Diagram error</strong>
        <span>{renderState.message}</span>
      </div>
    );
  }

  if (renderState.status === 'loading') {
    return <div className="mermaid-loading">Rendering diagram...</div>;
  }

  return (
    <div
      className="mermaid-diagram"
      role="img"
      aria-label="Mermaid diagram"
      dangerouslySetInnerHTML={{ __html: renderState.svg }}
    />
  );
}
