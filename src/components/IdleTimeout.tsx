"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { defaultSettings } from "@/types/settings";
import { getSession, logout as clearSession } from "@/lib/session";

const WARNING_SECONDS = 30;
const TICK_MS = 1000;
const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

export default function IdleTimeout() {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [remaining, setRemaining] = useState(WARNING_SECONDS);
  const [timeoutMinutes, setTimeoutMinutes] = useState(defaultSettings.sessionTimeout);
  const lastActivityRef = useRef(Date.now());
  const warnedRef = useRef(false);
  const hadSessionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, "settings", "system"));
        if (cancelled || !snap.exists()) return;
        const data = snap.data();
        const value = Number(data.sessionTimeout);
        if (Number.isFinite(value) && value >= 1) {
          setTimeoutMinutes(value);
        }
      } catch (error) {
        console.error("載入閒置逾時設定失敗:", error);
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const resetIdle = useCallback(() => {
    lastActivityRef.current = Date.now();
    warnedRef.current = false;
    setShowWarning(false);
    setRemaining(WARNING_SECONDS);
  }, []);

  const logout = useCallback(() => {
    void clearSession();
    warnedRef.current = false;
    hadSessionRef.current = false;
    setShowWarning(false);
    router.push("/");
  }, [router]);

  useEffect(() => {
    function handleActivity() {
      if (warnedRef.current) return;
      if (!getSession()) return;
      lastActivityRef.current = Date.now();
    }

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    const timer = window.setInterval(() => {
      const session = getSession();

      if (!session) {
        if (hadSessionRef.current) {
          hadSessionRef.current = false;
          warnedRef.current = false;
          setShowWarning(false);
        }
        return;
      }

      if (!hadSessionRef.current) {
        hadSessionRef.current = true;
        lastActivityRef.current = Date.now();
        warnedRef.current = false;
        setShowWarning(false);
        return;
      }

      const timeoutMs = timeoutMinutes * 60 * 1000;
      const remainMs = timeoutMs - (Date.now() - lastActivityRef.current);

      if (remainMs <= 0) {
        void clearSession();
        hadSessionRef.current = false;
        warnedRef.current = false;
        setShowWarning(false);
        router.push("/");
        return;
      }

      const remainSec = Math.ceil(remainMs / 1000);

      if (remainSec <= WARNING_SECONDS) {
        warnedRef.current = true;
        setRemaining(remainSec);
        setShowWarning(true);
      }
    }, TICK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      window.clearInterval(timer);
    };
  }, [router, timeoutMinutes]);

  if (!showWarning) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
    >
      <div
        className="bg-card border border-themed rounded-2xl p-8 text-center space-y-4 shadow-lg animate-fade-in w-full max-w-md"
        style={{ boxShadow: "var(--sh)" }}
      >
        <div className="flex justify-center">
          <svg
            className="w-12 h-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            style={{ color: "var(--warning)" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div>
          <p id="idle-timeout-title" className="text-lg font-semibold text-t1 mb-2">
            即將自動登出
          </p>
          <p className="text-sm text-t2">
            您已閒置一段時間，將於{" "}
            <span className="font-bold text-t1">{remaining}</span> 秒後自動登出系統。
          </p>
          <p className="text-xs text-t3 mt-2">
            選擇「繼續使用」將以目前設定的閒置逾時參數重新計算時間。
          </p>
        </div>

        <div className="flex gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={resetIdle}
            className="btn-primary rounded-lg px-6 py-2 text-sm font-medium cursor-pointer"
          >
            繼續使用
          </button>
          <button
            type="button"
            onClick={logout}
            className="btn-danger rounded-lg px-6 py-2 text-sm font-medium cursor-pointer"
          >
            登出系統
          </button>
        </div>
      </div>
    </div>
  );
}
