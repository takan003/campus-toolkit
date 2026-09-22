"use client";

import { useEffect, useRef, useState } from "react";

export default function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="欄位說明"
        aria-expanded={open}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setOpen(false);
        }}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full cursor-help shrink-0"
        style={{
          border: "1px solid var(--bd2)",
          color: "var(--t3)",
          background: "var(--bg2)",
        }}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 17h.01"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute left-0 top-full mt-1.5 z-50 w-56 p-3 rounded-lg border border-themed bg-card text-t2 text-xs leading-relaxed shadow-lg animate-fade-in"
          style={{ boxShadow: "var(--sh)" }}
        >
          <span
            className="absolute -top-1 left-3 w-2 h-2 rotate-45 border-t border-l border-themed"
            style={{ backgroundColor: "var(--card)" }}
          />
          {text}
        </div>
      )}
    </span>
  );
}
