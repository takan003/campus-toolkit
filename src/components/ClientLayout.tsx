"use client";

import { ThemeProvider } from "@/contexts/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";
import IdleTimeout from "@/components/IdleTimeout";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <ThemeToggle />
      <IdleTimeout />
    </ThemeProvider>
  );
}
