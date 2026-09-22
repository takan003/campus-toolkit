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
  options?: { value: string; label: string }[];
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
      { id: "systemName", label: "系統自命名", type: "text", placeholder: "" },
      { id: "schoolFullName", label: "學校全稱", type: "text", placeholder: "" },
      { id: "schoolShortName", label: "學校簡稱", type: "text", placeholder: "" },
      { id: "schoolOtherNames", label: "學校其他別名", type: "text", placeholder: "" },
      { id: "academicYear", label: "學年度", type: "number" },
      { id: "schoolCode", label: "教育部學校代碼", type: "text", placeholder: "" },
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
      { id: "contactPerson", label: "系統承辦人員", type: "text", placeholder: "" },
      { id: "contactEmail", label: "承辦人員電子郵件", type: "email", placeholder: "" },
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
          { value: "true", label: "啟用" },
          { value: "false", label: "停用" },
        ],
      },
      {
        id: "oauthEnabled",
        label: "啟用 Google OAuth",
        type: "select",
        options: [
          { value: "true", label: "啟用" },
          { value: "false", label: "停用" },
        ],
      },
      { id: "oauthClientId", label: "OAuth 用戶端 ID", type: "text", placeholder: "" },
      {
        id: "totpEnabled",
        label: "OAuth 下的 TOTP 狀態",
        type: "select",
        options: [
          { value: "true", label: "啟用" },
          { value: "false", label: "關閉" },
        ],
      },
      {
        id: "workspaceLoginEnabled",
        label: "啟用Workspace同機構帳號登入",
        type: "select",
        options: [
          { value: "true", label: "啟用" },
          { value: "false", label: "停用" },
        ],
      },
      {
        id: "twoFactorEnabled",
        label: "兩階段驗證",
        type: "select",
        options: [
          { value: "true", label: "啟用" },
          { value: "false", label: "停用" },
        ],
      },
      { id: "passwordCostFactor", label: "密碼雜湊迭代次數（千次）", type: "number" },
      { id: "sessionTimeout", label: "閒置逾時（分鐘）", type: "number" },
    ],
  },
  {
    title: "外觀與顯示",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
    fields: [
      {
        id: "copyrightNotice",
        label: "原創版權宣告",
        type: "select",
        options: [
          { value: "true", label: "顯示" },
          { value: "false", label: "隱藏" },
        ],
      },
      {
        id: "sponsorAdEnabled",
        label: "贊助廣告",
        type: "select",
        options: [
          { value: "true", label: "顯示" },
          { value: "false", label: "隱藏" },
        ],
      },
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

  function getFieldValue(id: keyof Settings): string {
    const val = settings[id];
    if (typeof val === "boolean") return val ? "true" : "false";
    return String(val);
  }

  function handleChange(id: keyof Settings, value: string) {
    const booleanFields: (keyof Settings)[] = [
      "systemEnabled", "oauthEnabled", "totpEnabled",
      "workspaceLoginEnabled", "twoFactorEnabled",
      "copyrightNotice", "sponsorAdEnabled",
    ];
    const numberFields: (keyof Settings)[] = [
      "academicYear", "passwordCostFactor", "sessionTimeout",
    ];

    if (booleanFields.includes(id)) {
      setSettings({ ...settings, [id]: value === "true" });
    } else if (numberFields.includes(id)) {
      let numVal = Number(value);
      if (id === "passwordCostFactor") numVal = Math.min(99, Math.max(1, numVal));
      if (id === "sessionTimeout") numVal = Math.max(1, numVal);
      setSettings({ ...settings, [id]: numVal });
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
        <h1 className="text-2xl font-bold text-center mb-6">系統設定</h1>

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

        {message && (
          <div className={`text-center mb-4 ${message.includes("失敗") ? "text-red-500" : "text-green-600"}`}>
            {message}
          </div>
        )}

        <div className="space-y-4">
          {settingGroups.map((group) => (
            <div key={group.title} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gray-600">{group.icon}</span>
                <h2 className="text-lg font-bold">{group.title}</h2>
              </div>

              <div className="space-y-4">
                {group.fields.map((field) => (
                  <div key={field.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-gray-600 sm:w-48 shrink-0">{field.label}</label>
                    {field.type === "select" ? (
                      <select
                        value={getFieldValue(field.id)}
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
