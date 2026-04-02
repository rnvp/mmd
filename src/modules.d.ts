declare module 'turndown' {
  type Rule = {
    filter: string[] | ((node: Node) => boolean);
    replacement: (content: string, node: Node) => string;
  };

  type Options = {
    bulletListMarker?: '-' | '*' | '+';
    codeBlockStyle?: 'indented' | 'fenced';
    emDelimiter?: '_' | '*';
    headingStyle?: 'setext' | 'atx';
    hr?: string;
    strongDelimiter?: '**' | '__';
  };

  export default class TurndownService {
    constructor(options?: Options);
    addRule(key: string, rule: Rule): void;
    turndown(input: string | Node): string;
    use(plugin: unknown): void;
  }
}

declare module 'turndown-plugin-gfm' {
  export const gfm: unknown;
}
