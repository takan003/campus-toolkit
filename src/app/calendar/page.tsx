import Link from "next/link";
import { listPublicCalendarEvents } from "@/lib/calendar";
import { readSystemDoc } from "@/lib/settings-server";
import { defaultSettings, type Settings } from "@/types/settings";
import AdSense from "@/components/AdSense";
import Copyright from "@/components/Copyright";
import HomepageCornerWrench from "@/components/HomepageCornerWrench";
import HomepageCornerChangE from "@/components/HomepageCornerChangE";
import HomepageCornerExam from "@/components/HomepageCornerExam";

export const dynamic = "force-dynamic";

/** 行程日期標籤：全天＝日期；定時＝日期＋時間（比照顯示元件） */
function dateLabel(item: { startAt: number; allDayDate?: string }): string {
  const d = new Date(item.startAt);
  if (item.allDayDate) return d.toLocaleDateString("zh-TW");
  return d.toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 公開行事曆（未登入可瀏覽）：顯示閱讀權限「無」的公開行程。
 * 版面骨架比照登入首頁（標題區、裝飾角、廣告與版權機制）。
 * 入口：登入頁行事曆區塊的入口圖示（新視窗）；各身分登入後走各自的行事曆專頁。
 */
export default async function PublicCalendarPage() {
  const items = await listPublicCalendarEvents(20);
  const raw = await readSystemDoc();
  const settings = { ...defaultSettings, ...(raw ?? {}) } as Settings;

  return (
    <div className="min-h-screen flex flex-col items-center bg-page px-4 pt-[20px]">
      <HomepageCornerWrench />
      <HomepageCornerChangE />
      <HomepageCornerExam />

      {/* 標題區域（比照登入首頁） */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2">數位校園工具箱</h1>
        <p className="text-xl text-t2">{settings.schoolFullName || "學校名稱"}</p>
        <p className="text-lg text-t3">
          {settings.academicYear} 學年度 第{settings.semester}學期
        </p>
      </div>

      <hr className="w-full max-w-md border-themed mb-6" />

      <div className="w-full max-w-md mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-t1">行事曆</h2>
          <Link href="/" className="text-sm text-primary hover:underline shrink-0">
            返回首頁 ›
          </Link>
        </div>
        <p className="text-sm text-t3 mb-2">公開行程一覽。</p>

        {items.length === 0 ? (
          <div className="border border-themed rounded-lg bg-card p-6 text-center text-t3">
            目前沒有公開行程
          </div>
        ) : (
          <div className="border border-themed rounded-lg bg-card p-4">
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-1.5 text-sm border-b border-themed pb-1.5 last:border-0 last:pb-0"
                >
                  {item.important && (
                    <span className="text-primary shrink-0" aria-hidden="true">
                      ★
                      <span className="sr-only">重要</span>
                    </span>
                  )}
                  <span className="shrink-0 text-t2">{dateLabel(item)}</span>
                  <span className="shrink-0 text-t2">｜</span>
                  <a
                    href={`/calendar/${item.id}`}
                    className="inline-flex min-w-0 flex-1 items-center font-medium text-t1 hover:text-primary"
                  >
                    <span className="truncate">{item.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 廣告區域（比照登入首頁：系統設定開關控制） */}
      {settings.sponsorAdEnabled && (
        <div className="w-full max-w-md mt-8">
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
