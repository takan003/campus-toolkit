export interface ThemeColors {
  '--bg': string;
  '--bg2': string;
  '--t1': string;
  '--t2': string;
  '--t3': string;
  '--bd': string;
  '--bd2': string;
  '--card': string;
  '--sh': string;
  '--primary': string;
  '--primary-hover': string;
  '--primary-text': string;
  '--primary-text-hover': string;
  '--primary-block': string;
  '--danger': string;
  '--success': string;
  '--warning': string;
  '--btn-secondary': string;
  '--btn-secondary-hover': string;
  '--btn-secondary-text': string;
  '--btn-secondary-text-hover': string;
  '--btn-danger': string;
  '--btn-danger-hover': string;
  '--btn-danger-text': string;
  '--btn-danger-text-hover': string;
  '--btn-disabled': string;
  '--btn-disabled-text': string;
  '--link': string;
  '--link-hover': string;
  '--radius': string;
  '--font-sans': string;
  '--font-mono': string;
  '--transition': string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  preview: string; // 主要背景色，用於預覽
}

export type ThemeId =
  | 'builtin:white'
  | 'builtin:gray'
  | 'builtin:dark'
  | 'builtin:ocean'
  | 'builtin:forest'
  | 'builtin:sepia'
  | 'builtin:highcontrast'
  | 'builtin:pastel'
  | 'builtin:sunset'
  | 'builtin:purple';
