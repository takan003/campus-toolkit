"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Settings, defaultSettings } from "@/types/settings";
import Copyright from "@/components/Copyright";

interface SettingCard {
  id: keyof Settings;
  label: string;
  description: string;
  type: "toggle" | "text" | "number" | "select";
  icon: React.ReactNode;
}

const settingCards: SettingCard[] = [
  {
    id: "systemEnabled",
    label: "系統開關",
    description: "啟用或關閉整個系統",
    type: "toggle",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    id: "schoolFullName",
    label: "學校全稱",
    description: "例如：國立高雄科技大學",
    type: "text",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
  },
  {
    id: "schoolShortName",
    label: "學校簡稱",
    description: "例如：高科大",
    type: "text",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    id: "academicYear",
    label: "學年度",
    description: "民國年",
    type: "number",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    id: "semester",
    label: "學期",
    description: "選擇學期",
    type: "select",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    id: "copyrightNotice",
    label: "原創版權宣告",
    description: "顯示版權宣告訊息",
    type: "toggle",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    id: "sponsorAdEnabled",
    label: "贊助廣告開關",
    description: "顯示贊助廣告訊息",
    type: "toggle",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
      </svg>
    ),
  },
  {
    id: "passwordCostFactor",
    label: "密碼雜湊強度",
    description: "數字越大越安全但越慢，建議 10-14",
    type: "number",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const docRef = doc(db, "settings", "system");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSettings(docSnap.data() as Settings);
      }
    } catch (error: unknown) {
      console.error("載入設定失敗:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      setMessage("載入失敗: " + errMsg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const docRef = doc(db, "settings", "system");
      await setDoc(docRef, settings);
      setMessage("設定已儲存！");
    } catch (error: unknown) {
      console.error("儲存設定失敗:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      setMessage("儲存失敗: " + errMsg);
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    router.push("/admin");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">載入中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-white px-4 pt-[20px]">
      {/* 標題區域 */}
      <div className="text-center mb-2">
        <h1 className="text-4xl font-bold mb-2">數位校園工具箱</h1>
        <p className="text-xl text-gray-700">{settings.schoolFullName || "學校名稱"}</p>
        <p className="text-lg text-gray-500">{settings.academicYear} 學年度</p>
      </div>

      {/* 功能標題 */}
      <div className="w-full max-w-2xl mt-4 mb-2 text-center">
        <h2 className="text-2xl font-bold text-gray-800">系統設定</h2>
      </div>

      {/* 返回按鈕 */}
      <div className="w-full max-w-2xl flex justify-end mb-4">
        <button
          onClick={handleBack}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          返回
        </button>
      </div>

      <hr className="w-full max-w-2xl border-gray-300 mb-4" />

      {/* 設定卡片 */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {settingCards.map((card) => (
          <div
            key={card.id}
            className="border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-gray-500">{card.icon}</span>
              <span className="font-medium text-gray-700">{card.label}</span>
            </div>
            <p className="text-sm text-gray-500 mb-3">{card.description}</p>

            {card.type === "toggle" && (
              <button
                onClick={() => setSettings({ ...settings, [card.id]: !settings[card.id] })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings[card.id] ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings[card.id] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            )}

            {card.type === "text" && (
              <input
                type="text"
                value={String(settings[card.id])}
                onChange={(e) => setSettings({ ...settings, [card.id]: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder={card.description}
              />
            )}

            {card.type === "number" && (
              <input
                type="number"
                min={card.id === "passwordCostFactor" ? 10 : undefined}
                max={card.id === "passwordCostFactor" ? 14 : undefined}
                value={Number(settings[card.id])}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (card.id === "passwordCostFactor") {
                    const v = Math.min(14, Math.max(10, value));
                    setSettings({ ...settings, [card.id]: v });
                  } else {
                    setSettings({ ...settings, [card.id]: value });
                  }
                }}
                className="w-full border rounded px-3 py-2"
              />
            )}

            {card.type === "select" && (
              <select
                value={Number(settings[card.id])}
                onChange={(e) => setSettings({ ...settings, [card.id]: Number(e.target.value) })}
                className="w-full border rounded px-3 py-2"
              >
                <option value={1}>第一學期</option>
                <option value={2}>第二學期</option>
              </select>
            )}
          </div>
        ))}
      </div>

      {/* 儲存按鈕 */}
      <div className="w-full max-w-2xl mb-8 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? "儲存中..." : "儲存設定"}
        </button>
        {message && (
          <span className={message.includes("失敗") ? "text-red-500" : "text-green-500"}>
            {message}
          </span>
        )}
      </div>

      <hr className="w-full max-w-2xl border-gray-300 mb-4" />

      {/* 底部返回 */}
      <div className="w-full max-w-2xl mb-8">
        <button
          onClick={handleBack}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          返回
        </button>
      </div>

      {/* 版權宣告 */}
      <div className="w-full max-w-2xl mt-auto">
        <Copyright mode={settings.copyrightNotice ? "啟用" : "關閉"} />
      </div>
    </div>
  );
}
