"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Settings, defaultSettings } from "@/types/settings";

interface FormField {
  id: keyof Settings;
  label: string;
  type: "text" | "number" | "select" | "email";
  placeholder?: string;
  options?: { value: number; label: string }[];
}

interface SettingGroup {
  title: string;
  icon: React.ReactNode;
  fields: FormField[];
}

const settingGroups: SettingGroup[] = [
  {
    title: "基本資訊",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
    fields: [
      { id: "systemName", label: "系統自命名", type: "text", placeholder: "例如：數位校園工具箱" },
      { id: "schoolFullName", label: "學校全稱", type: "text", placeholder: "例如：國立花蓮女子高級中學" },
      { id: "schoolShortName", label: "學校簡稱", type: "text", placeholder: "例如：國立花蓮女中" },
      { id: "schoolOtherNames", label: "學校其他別名", type: "text", placeholder: "例如：花蓮女中,花女" },
      { id: "academicYear", label: "學年度", type: "number" },
      { id: "schoolCode", label: "教育部學校代碼", type: "text", placeholder: "例如：150302" },
    ],
  },
  {
    title: "承辦聯絡",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    fields: [
      { id: "contactPerson", label: "系統承辦人員", type: "text", placeholder: "例如：張家誠" },
      { id: "contactEmail", label: "承辦人員電子郵件", type: "email", placeholder: "例如：takan003@gms.hlgs.hlc.edu.tw" },
    ],
  },
  {
    title: "系統管理",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    fields: [
      {
        id: "systemEnabled",
        label: "系統狀態",
        type: "select",
        options: [
          { value: 1, label: "啟用" },
          { value: 0, label: "停用" },
        ],
      },
      {
        id: "oauthEnabled",
        label: "啟用 Google OAuth",
        type: "select",
        options: [
          { value: 1, label: "啟用" },
          { value: 0, label: "停用" },
        ],
      },
      { id: "oauthClientId", label: "OAuth 用戶端 ID", type: "text", placeholder: "Google OAuth Client ID" },
    ],
  },
  {
    title: "進階設定",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    fields: [
      {
        id: "semester",
        label: "學期",
        type: "select",
        options: [
          { value: 1, label: "第一學期" },
          { value: 2, label: "第二學期" },
        ],
      },
      {
        id: "copyrightNotice",
        label: "原創版權宣告",
        type: "select",
        options: [
          { value: 1, label: "啟用" },
          { value: 0, label: "停用" },
        ],
      },
      {
        id: "sponsorAdEnabled",
        label: "贊助廣告",
        type: "select",
        options: [
          { value: 1, label: "啟用" },
          { value: 0, label: "停用" },
        ],
      },
      { id: "passwordCostFactor", label: "密碼雜湊強度 (10-14)", type: "number" },
    ],
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
        const data = docSnap.data() as Settings;
        setSettings({ ...defaultSettings, ...data });
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

  function handleLogout() {
    localStorage.removeItem("user_session");
    router.push("/");
  }

  function handleChange(id: keyof Settings, value: string) {
    if (id === "academicYear" || id === "semester" || id === "passwordCostFactor") {
      let numVal = Number(value);
      if (id === "passwordCostFactor") {
        numVal = Math.min(14, Math.max(10, numVal));
      }
      setSettings({ ...settings, [id]: numVal });
    } else if (id === "systemEnabled" || id === "oauthEnabled" || id === "copyrightNotice" || id === "sponsorAdEnabled") {
      setSettings({ ...settings, [id]: value === "1" });
    } else {
      setSettings({ ...settings, [id]: value });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">載入中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 pt-6">
        {/* 標題 */}
        <h1 className="text-2xl font-bold text-center mb-6">系統設定</h1>

        {/* 操作按鈕 */}
        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "儲存中..." : "儲存設定"}
          </button>
          <button
            onClick={handleBack}
            className="border border-gray-300 bg-white px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            返回功能首頁
          </button>
          <button
            onClick={handleLogout}
            className="border border-gray-300 bg-white px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            登出
          </button>
        </div>

        {/* 訊息 */}
        {message && (
          <div className={`text-center mb-4 ${message.includes("失敗") ? "text-red-500" : "text-green-600"}`}>
            {message}
          </div>
        )}

        {/* 設定分組卡片 */}
        <div className="space-y-4">
          {settingGroups.map((group) => (
            <div key={group.title} className="bg-white border border-gray-200 rounded-xl p-5">
              {/* 分組標題 */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gray-600">{group.icon}</span>
                <h2 className="text-lg font-bold">{group.title}</h2>
              </div>

              {/* 欄位列表 */}
              <div className="space-y-4">
                {group.fields.map((field) => (
                  <div key={field.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-gray-600 sm:w-40 shrink-0">{field.label}</label>
                    {field.type === "select" ? (
                      <select
                        value={settings[field.id] ? "1" : "0"}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white"
                      >
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={String(settings[field.id])}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        min={field.id === "passwordCostFactor" ? 10 : undefined}
                        max={field.id === "passwordCostFactor" ? 14 : undefined}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
