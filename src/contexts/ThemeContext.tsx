"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Theme, ThemeId } from "@/types/theme";
import { builtinThemes, defaultTheme, getThemeById } from "@/lib/themes";

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(defaultTheme);
  const [forcedTheme, setForcedThemeState] = useState<ThemeId | null>(null);

  useEffect(() => {
    // 讀取強制主題（Admin 設定）
    const forced = localStorage.getItem(FORCED_THEME_KEY);
    if (forced) {
      setForcedThemeState(forced as ThemeId);
    }

    // 解析主題優先級：強制 > 帳號 > localStorage > 預設
    const userTheme = localStorage.getItem("campusUserTheme");
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    const themeId = forced || userTheme || savedTheme || defaultTheme.id;

    const theme = getThemeById(themeId) || defaultTheme;
    setCurrentTheme(theme);
    applyTheme(theme);
  }, []);

  function applyTheme(theme: Theme) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.colors)) {
      root.style.setProperty(key, value);
    }
    root.setAttribute("data-theme", theme.id);
  }

  function setTheme(id: ThemeId | string) {
    const theme = getThemeById(id) || defaultTheme;
    setCurrentTheme(theme);
    applyTheme(theme);

    // 如果有強制主題，不儲存到 localStorage
    if (!forcedTheme) {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }

  function setForcedTheme(id: ThemeId | null) {
    setForcedThemeState(id);
    if (id) {
      localStorage.setItem(FORCED_THEME_KEY, id);
      const theme = getThemeById(id) || defaultTheme;
      setCurrentTheme(theme);
      applyTheme(theme);
    } else {
      localStorage.removeItem(FORCED_THEME_KEY);
      // 恢復到原本的主題
      const savedTheme = localStorage.getItem(STORAGE_KEY) || defaultTheme.id;
      const theme = getThemeById(savedTheme) || defaultTheme;
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
        availableThemes: builtinThemes,
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
