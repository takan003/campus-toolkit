"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Theme, ThemeId } from "@/types/theme";
import { builtinThemes, defaultTheme, getThemeById } from "@/lib/themes";
import { listInstalledThemes, readStoredTheme } from "@/lib/theme-store";

const STORAGE_KEY = "campusToolkitTheme";
const FORCED_THEME_KEY = "campusToolkitForcedTheme";

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (id: ThemeId | string) => void;
  forcedTheme: ThemeId | null;
  setForcedTheme: (id: ThemeId | null) => void;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType>({
  currentTheme: defaultTheme,
  setTheme: () => {},
  forcedTheme: null,
  setForcedTheme: () => {},
  availableThemes: builtinThemes,
});

/** 主題解析（協議 §3）：內建主題優先，其後為已安裝的 market:/custom: 主題 */
function resolveTheme(id: string): Theme | null {
  return getThemeById(id) ?? readStoredTheme(id);
}

/** 收集可用主題：內建＋已安裝（安裝資料損毀者自動略過） */
function collectAvailableThemes(): Theme[] {
  const installed: Theme[] = [];
  for (const record of listInstalledThemes()) {
    const theme = readStoredTheme(record.id);
    if (theme) installed.push(theme);
  }
  return [...builtinThemes, ...installed];
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(defaultTheme);
  const [forcedTheme, setForcedThemeState] = useState<ThemeId | null>(null);
  const [availableThemes, setAvailableThemes] = useState<Theme[]>(builtinThemes);

  useEffect(() => {
    // 讀取強制主題（Admin 設定）
    const forced = localStorage.getItem(FORCED_THEME_KEY);
    if (forced) {
      setForcedThemeState(forced as ThemeId);
    }

    setAvailableThemes(collectAvailableThemes());

    // 解析主題優先級：強制 > 帳號 > localStorage > 預設（協議 §3）
    const userTheme = localStorage.getItem("campusUserTheme");
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    const themeId = forced || userTheme || savedTheme || defaultTheme.id;

    const theme = resolveTheme(themeId) ?? defaultTheme;
    setCurrentTheme(theme);
    applyTheme(theme);
  }, []);

  function applyTheme(theme: Theme) {
    const root = document.documentElement;
    // 基底：先套預設主題全量 token，避免切換到部分覆寫主題（如市集主題）時殘留舊值
    for (const [key, value] of Object.entries(defaultTheme.colors)) {
      root.style.setProperty(key, value);
    }
    for (const [key, value] of Object.entries(theme.colors)) {
      root.style.setProperty(key, value);
    }
    root.setAttribute("data-theme", theme.id);
    root.style.colorScheme = isDarkColor(theme.colors["--bg"] ?? "#ffffff") ? "dark" : "light";
  }

  function isDarkColor(hex: string): boolean {
    const c = hex.replace("#", "");
    if (c.length < 6) return false;
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
  }

  function setTheme(id: ThemeId | string) {
    const theme = resolveTheme(id) ?? defaultTheme;
    setCurrentTheme(theme);
    applyTheme(theme);

    // 如果有強制主題，不儲存到 localStorage
    if (!forcedTheme) {
      localStorage.setItem(STORAGE_KEY, theme.id);
    }
  }

  function setForcedTheme(id: ThemeId | null) {
    setForcedThemeState(id);
    if (id) {
      localStorage.setItem(FORCED_THEME_KEY, id);
      const theme = resolveTheme(id) ?? defaultTheme;
      setCurrentTheme(theme);
      applyTheme(theme);
    } else {
      localStorage.removeItem(FORCED_THEME_KEY);
      // 恢復到原本的主題
      const savedTheme = localStorage.getItem(STORAGE_KEY) || defaultTheme.id;
      const theme = resolveTheme(savedTheme) ?? defaultTheme;
      setCurrentTheme(theme);
      applyTheme(theme);
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        setTheme,
        forcedTheme,
        setForcedTheme,
        availableThemes,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
