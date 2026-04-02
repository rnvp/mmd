import type { TitleAction } from '../types';

export type SelectionResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function lineBounds(value: string, start: number, end: number) {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  return { lineStart, lineEnd };
}

function mapSelectedLines(
  value: string,
  start: number,
  end: number,
  mapper: (line: string, index: number) => string
): SelectionResult {
  const { lineStart, lineEnd } = lineBounds(value, start, end);
  const segment = value.slice(lineStart, lineEnd);
  const lines = segment.split('\n');
  const mapped = lines.map(mapper).join('\n');
  const nextValue = `${value.slice(0, lineStart)}${mapped}${value.slice(lineEnd)}`;
  return {
    value: nextValue,
    selectionStart: lineStart,
    selectionEnd: lineStart + mapped.length
  };
}

function wrapSelection(
  value: string,
  start: number,
  end: number,
  prefix: string,
  suffix = prefix,
  fallback = 'text'
): SelectionResult {
  const selected = value.slice(start, end) || fallback;
  const replaced = `${prefix}${selected}${suffix}`;
  return {
    value: `${value.slice(0, start)}${replaced}${value.slice(end)}`,
    selectionStart: start + prefix.length,
    selectionEnd: start + prefix.length + selected.length
  };
}

function insertBlock(
  value: string,
  start: number,
  end: number,
  block: string,
  cursorOffset: number
): SelectionResult {
  return {
    value: `${value.slice(0, start)}${block}${value.slice(end)}`,
    selectionStart: start + cursorOffset,
    selectionEnd: start + cursorOffset
  };
}

export function applyMarkdownAction(
  action: TitleAction,
  value: string,
  start: number,
  end: number
): SelectionResult {
  switch (action) {
    case 'heading':
      return mapSelectedLines(value, start, end, (line) => (line.startsWith('# ') ? line : `# ${line || 'Heading'}`));
    case 'bold':
      return wrapSelection(value, start, end, '**', '**', 'bold text');
    case 'italic':
      return wrapSelection(value, start, end, '_', '_', 'italic text');
    case 'code':
      return wrapSelection(value, start, end, '`', '`', 'code');
    case 'codeBlock':
      return insertBlock(value, start, end, `\`\`\`\n${value.slice(start, end) || 'code'}\n\`\`\``, 4);
    case 'quote':
      return mapSelectedLines(value, start, end, (line) => `> ${line || 'Quote'}`);
    case 'bulletList':
      return mapSelectedLines(value, start, end, (line) => `- ${line || 'List item'}`);
    case 'orderedList':
      return mapSelectedLines(value, start, end, (_line, index) => `${index + 1}. ${_line || 'List item'}`);
    case 'link':
      return wrapSelection(value, start, end, '[', '](https://example.com)', 'link text');
    case 'image':
      return insertBlock(value, start, end, '![alt text](./image.png)', 2);
    default:
      return { value, selectionStart: start, selectionEnd: end };
  }
}

export function indentSelection(value: string, start: number, end: number): SelectionResult {
  const hasRange = start !== end;
  if (!hasRange) {
    return {
      value: `${value.slice(0, start)}  ${value.slice(end)}`,
      selectionStart: start + 2,
      selectionEnd: start + 2
    };
  }

  return mapSelectedLines(value, start, end, (line) => `  ${line}`);
}

export function outdentSelection(value: string, start: number, end: number): SelectionResult {
  const hasRange = start !== end;
  if (!hasRange) {
    const before = value.slice(Math.max(0, start - 2), start);
    const removeCount = before === '  ' ? 2 : before.endsWith('\t') ? 1 : 0;
    return {
      value: `${value.slice(0, start - removeCount)}${value.slice(end)}`,
      selectionStart: start - removeCount,
      selectionEnd: start - removeCount
    };
  }

  return mapSelectedLines(value, start, end, (line) => {
    if (line.startsWith('  ')) return line.slice(2);
    if (line.startsWith('\t')) return line.slice(1);
    return line;
  });
}
