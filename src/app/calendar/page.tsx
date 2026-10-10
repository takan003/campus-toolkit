import Link from "next/link";
import { listPublicCalendarEvents } from "@/lib/calendar";
import { clipText } from "@/types/announcements";

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
 * 入口：登入頁行事曆區塊的入口圖示／翻頁盡頭箭頭；各身分登入後走各自的行事曆專頁。
 */
export default async function PublicCalendarPage() {
  const items = await listPublicCalendarEvents(20);

  return (
    <main className="min-h-screen bg-page">
      <div className="content-width max-w-3xl mx-auto py-8 px-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-t1">行事曆</h1>
          <Link href="/" className="text-sm text-primary hover:underline shrink-0">
            返回首頁 ›
          </Link>
        </div>
        <p className="text-sm text-t3">公開行程一覽（未登入亦可瀏覽；需登入之行程請於登入後查看）。</p>

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
                    <span className="truncate">{clipText(item.title, 25)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
