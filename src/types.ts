export type ViewMode = 'split' | 'editor' | 'preview';
export type ThemeMode = 'light' | 'dark';

export type DocumentState = {
  filePath: string | null;
  fileName: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  viewMode: ViewMode;
  editorRatio: number;
};

export type FilePayload = {
  path: string;
  content: string;
};

export type TitleAction =
  | 'new'
  | 'open'
  | 'save'
  | 'saveAs'
  | 'minimize'
  | 'toggleMaximize'
  | 'closeWindow'
  | 'split'
  | 'editor'
  | 'preview'
  | 'heading'
  | 'bold'
  | 'italic'
  | 'code'
  | 'codeBlock'
  | 'quote'
  | 'bulletList'
  | 'orderedList'
  | 'link'
  | 'image';

export type PendingAction = 'new' | 'open' | 'openDrop' | 'closeWindow' | null;
