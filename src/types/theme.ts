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

/**
 * 全域主題 token 白名單（＝ThemeColors 的鍵集合，市集主題契約 PROTOCOL §5.1 的唯一來源）。
 * 主題市集安裝時解析出的 token 鍵必須屬於此清單，值必須通過安全驗證。
 */
export const THEME_COLOR_KEYS = [
  '--bg',
  '--bg2',
  '--t1',
  '--t2',
  '--t3',
  '--bd',
  '--bd2',
  '--card',
  '--sh',
  '--primary',
  '--primary-hover',
  '--primary-text',
  '--primary-text-hover',
  '--primary-block',
  '--danger',
  '--success',
  '--warning',
  '--btn-secondary',
  '--btn-secondary-hover',
  '--btn-secondary-text',
  '--btn-secondary-text-hover',
  '--btn-danger',
  '--btn-danger-hover',
  '--btn-danger-text',
  '--btn-danger-text-hover',
  '--btn-disabled',
  '--btn-disabled-text',
  '--link',
  '--link-hover',
  '--radius',
  '--font-sans',
  '--font-mono',
  '--transition',
] as const satisfies readonly (keyof ThemeColors)[];

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

/** 市集主題最少必須覆寫的 token（身分與可讀性最低集合，契約 §5.1） */
export const REQUIRED_MARKET_THEME_KEYS: readonly ThemeColorKey[] = ['--bg', '--card', '--t1'];

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
