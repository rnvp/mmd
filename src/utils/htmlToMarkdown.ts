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

function detectCodeLanguage(document: Document) {
  const languageSource = Array.from(document.querySelectorAll('[class]'))
    .map((element) => element.getAttribute('class') ?? '')
    .join(' ');

  const match = languageSource.match(/(?:language|lang)[-_: ]([a-z0-9#+.-]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function looksLikeCodeHtml(document: Document) {
  if (document.querySelector('pre, code')) {
    return true;
  }

  const classSource = Array.from(document.querySelectorAll('[class]'))
    .map((element) => element.getAttribute('class') ?? '')
    .join(' ')
    .toLowerCase();

  return /(highlight|code|syntax|prism|token|monaco|hljs|language-)/.test(classSource);
}

export function htmlToMarkdownFromClipboard(html: string, plainText: string) {
  const normalizedHtml = normalizeWhitespace(html).trim();
  if (!normalizedHtml) return '';

  const parser = new DOMParser();
  const document = parser.parseFromString(normalizedHtml, 'text/html');

  if (looksLikeCodeHtml(document)) {
    const normalizedText = normalizeWhitespace(plainText).replace(/\n+$/, '');
    if (!normalizedText.trim()) return '';

    const language = detectCodeLanguage(document);
    if (normalizedText.includes('\n')) {
      return `\`\`\`${language ?? ''}\n${normalizedText}\n\`\`\``;
    }

    return `\`${normalizedText}\``;
  }

  const markdown = turndownService.turndown(normalizedHtml);
  return markdown.replace(/\n{3,}/g, '\n\n').trim();
}

export function htmlToMarkdown(html: string) {
  const normalizedHtml = normalizeWhitespace(html).trim();
  if (!normalizedHtml) return '';

  const markdown = turndownService.turndown(normalizedHtml);
  return markdown.replace(/\n{3,}/g, '\n\n').trim();
}
