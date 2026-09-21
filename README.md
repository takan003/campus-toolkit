# 數位校園工具箱

整合校園資訊、選課、公告、社團等功能的綜合性校園工具平台。

## 技術架構

- **前端框架**: Next.js 14+（App Router）
- **開發語言**: TypeScript
- **樣式方案**: Tailwind CSS
- **認證服務**: Firebase Authentication
- **資料庫**: Cloud Firestore
- **檔案儲存**: Firebase Cloud Storage
- **部署平台**: Vercel

## 快速開始

```bash
# 安裝依賴
npm install

# 設定環境變數
cp .env.example .env.local
# 編輯 .env.local 填入 Firebase 設定

# 啟動開發伺服器
npm run dev
```

## 專案結構

```
數位校園共享站/
├── public/              # 靜態資源
├── src/
│   ├── app/             # Next.js App Router
│   ├── components/      # 可重用元件
│   ├── lib/             # 工具函式與設定
│   ├── hooks/           # 自訂 React Hooks
│   ├── contexts/        # React Context
│   ├── types/           # TypeScript 型別定義
│   └── styles/          # 全局樣式
├── middleware.ts         # Next.js 中間件
└── package.json
```
