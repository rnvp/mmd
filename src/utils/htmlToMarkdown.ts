import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndownService = new TurndownService({
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  headingStyle: 'atx',
  hr: '---',
  strongDelimiter: '**'
});

turndownService.use(gfm);

turndownService.addRule('preserveLineBreaks', {
  filter: ['br'],
  replacement: () => '  \n'
});

turndownService.addRule('stripEditorArtifacts', {
  filter: (node: Node) =>
    node.nodeType === Node.ELEMENT_NODE &&
    node instanceof HTMLElement &&
    (node.tagName === 'META' || node.tagName === 'STYLE' || node.tagName === 'SCRIPT'),
  replacement: () => ''
});

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
}

export function htmlToMarkdown(html: string) {
  const normalizedHtml = normalizeWhitespace(html).trim();
  if (!normalizedHtml) return '';

  const markdown = turndownService.turndown(normalizedHtml);
  return markdown.replace(/\n{3,}/g, '\n\n').trim();
}
