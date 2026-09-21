"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Settings, defaultSettings } from "@/types/settings";

export default function SettingsPage() {
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

  if (loading) {
    return <div className="p-8">載入中...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">系統設定</h1>

      <div className="space-y-6">
        {/* 系統開關 */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <label className="font-medium">系統開關</label>
            <p className="text-sm text-gray-500">啟用或關閉整個系統</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, systemEnabled: !settings.systemEnabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.systemEnabled ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.systemEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* 學校全稱 */}
        <div className="border-b pb-4">
          <label className="font-medium block mb-1">學校全稱</label>
          <input
            type="text"
            value={settings.schoolFullName}
            onChange={(e) => setSettings({ ...settings, schoolFullName: e.target.value })}
            className="w-full border rounded px-3 py-2"
            placeholder="例如：國立高雄科技大學"
          />
        </div>

        {/* 學校簡稱 */}
        <div className="border-b pb-4">
          <label className="font-medium block mb-1">學校簡稱</label>
          <input
            type="text"
            value={settings.schoolShortName}
            onChange={(e) => setSettings({ ...settings, schoolShortName: e.target.value })}
            className="w-full border rounded px-3 py-2"
            placeholder="例如：高科大"
          />
        </div>

        {/* 學年度 */}
        <div className="border-b pb-4">
          <label className="font-medium block mb-1">學年度</label>
          <input
            type="number"
            value={settings.academicYear}
            onChange={(e) => setSettings({ ...settings, academicYear: Number(e.target.value) })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {/* 學期 */}
        <div className="border-b pb-4">
          <label className="font-medium block mb-1">學期</label>
          <select
            value={settings.semester}
            onChange={(e) => setSettings({ ...settings, semester: Number(e.target.value) })}
            className="w-full border rounded px-3 py-2"
          >
            <option value={1}>第一學期</option>
            <option value={2}>第二學期</option>
          </select>
        </div>

        {/* 原創版權宣告 */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <label className="font-medium">原創版權宣告</label>
            <p className="text-sm text-gray-500">顯示版權宣告訊息</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, copyrightNotice: !settings.copyrightNotice })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.copyrightNotice ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.copyrightNotice ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* 贊助廣告開關 */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <label className="font-medium">贊助廣告開關</label>
            <p className="text-sm text-gray-500">顯示贊助廣告訊息</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, sponsorAdEnabled: !settings.sponsorAdEnabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.sponsorAdEnabled ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.sponsorAdEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* 密碼雜湊強度 */}
        <div className="border-b pb-4">
          <label className="font-medium block mb-1">密碼雜湊強度（bcrypt cost factor）</label>
          <p className="text-sm text-gray-500 mb-2">數字越大越安全但越慢，建議 10-14，最高 14</p>
          <input
            type="number"
            min={10}
            max={14}
            value={settings.passwordCostFactor}
            onChange={(e) => {
              const v = Math.min(14, Math.max(10, Number(e.target.value)));
              setSettings({ ...settings, passwordCostFactor: v });
            }}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* 儲存按鈕 */}
      <div className="mt-8 flex items-center gap-4">
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
    </div>
  );
}
