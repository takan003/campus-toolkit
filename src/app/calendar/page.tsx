import { listPublicCalendarEventsInRange } from "@/lib/calendar";
import { readSystemDoc } from "@/lib/settings-server";
import { defaultSettings, type Settings } from "@/types/settings";
import AdSense from "@/components/AdSense";
import Copyright from "@/components/Copyright";
import PublicCalendarView from "@/components/PublicCalendarView";

export const dynamic = "force-dynamic";

/** 本月區間（伺服器預載給月模式，避免首次渲染空窗） */
function currentMonthRange(): { from: number; to: number } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from: from.getTime(), to: to.getTime() - 1 };
}

/**
 * 公開行事曆（未登入可瀏覽）：4 模式（月／週／日／清單，預設月）。
 * 版面骨架比照登入首頁（標題區、裝飾角、廣告與版權機制）；顯示區隨瀏覽器寬度響應。
 * 入口：登入頁行事曆區塊的入口圖示（新視窗）；各身分登入後走各自的行事曆專頁。
 */
export default async function PublicCalendarPage() {
  const range = currentMonthRange();
  const initialItems = await listPublicCalendarEventsInRange(range.from, range.to);
  const raw = await readSystemDoc();
  const settings = { ...defaultSettings, ...(raw ?? {}) } as Settings;

  return (
    <div className="min-h-screen flex flex-col items-center bg-page px-3 sm:px-4 pt-[20px]">
      {/* 標題區域 */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2">數位校園工具箱</h1>
        <p className="text-xl text-t2">{settings.schoolFullName || "學校名稱"}</p>
        <p className="text-lg text-t3">
          {settings.academicYear} 學年度 第{settings.semester}學期
        </p>
      </div>

      {/* 行事曆顯示區：隨瀏覽器寬度響應（無固定最大寬） */}
      <div className="w-full mb-8">
        <h2 className="text-lg font-bold text-t1 mb-2">行事曆</h2>
        <PublicCalendarView initialItems={initialItems} initialFrom={range.from} />
      </div>

      {/* 廣告區域（比照登入首頁：系統設定開關控制） */}
      {settings.sponsorAdEnabled && (
        <div className="w-full max-w-md mt-4">
          <AdSense />
        </div>
      )}

      {/* 版權宣告（比照登入首頁：系統設定開關控制） */}
      <div className="w-full max-w-md mt-8">
        <Copyright mode={settings.copyrightNotice ? "啟用" : "關閉"} />
      </div>
    </div>
  );
}
