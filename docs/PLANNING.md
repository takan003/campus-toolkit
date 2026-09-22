# 數位校園工具箱 - CSS主題與資安機制規劃

## 一、CSS 主題系統

### 現況分析
- 使用 Tailwind CSS v4
- 顏色、字體、間距硬編碼在各元件
- 無法支援主題切換

### 建議架構

```
src/
├── styles/
│   ├── globals.css          # 全局樣式 + CSS 變數定義
│   └── themes/
│       ├── light.css        # 亮色主題變數
│       └── dark.css         # 深色主題變數
├── contexts/
│   └── ThemeContext.tsx      # 主題 Context Provider
└── components/
    └── ThemeToggle.tsx       # 主題切換按鈕
```

### CSS 變數規劃

```css
:root {
  /* 主要顏色 */
  --color-primary: #000000;
  --color-primary-hover: #1f2937;
  --color-secondary: #6b7280;
  
  /* 背景顏色 */
  --color-bg: #ffffff;
  --color-bg-card: #ffffff;
  --color-bg-hover: #f9fafb;
  
  /* 文字顏色 */
  --color-text: #171717;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;
  
  /* 邊框顏色 */
  --color-border: #e5e7eb;
  --color-border-hover: #d1d5db;
  
  /* 功能顏色 */
  --color-success: #22c55e;
  --color-error: #ef4444;
  --color-warning: #f59e0b;
  
  /* 間距 */
  --spacing-page: 20px;
  --spacing-card: 20px;
  --max-width-content: 672px;
  
  /* 圓角 */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

---

## 二、資安機制

### 現況問題
- Session 使用 localStorage（容易被 XSS 攻擊）
- 沒有 CSRF 保護
- 沒有 API 速率限制
- 沒有輸入驗證/清理
- OAuth/TOTP 功能尚未實現
- 沒有 HTTP 安全標頭

### 分階段實施計畫

#### 階段一：立即實施（高優先）

| 項目 | 說明 | 實作方式 |
|------|------|----------|
| HttpOnly Cookie | 替代 localStorage 儲存 session | 設置 `Set-Cookie` with `HttpOnly`, `Secure`, `SameSite=Strict` |
| CSRF Token | 防止跨站請求偽造 | 使用 `csrf-token` header + 驗證 |
| 輸入驗證 | 防止注入攻擊 | 使用 `zod` 或 `joi` 驗證所有 API 輸入 |
| API 速率限制 | 防止暴力破解 | 使用 `rate-limiter-flexible` 或 Redis |

#### 階段二：一個月內實施（中優先）

| 項目 | 說明 |
|------|------|
| JWT + Refresh Token | 實作完整的 token 機制 |
| CSP 標頭 | Content Security Policy 防止 XSS |
| 安全標頭 | X-Frame-Options, X-Content-Type-Options 等 |
| Session 過期 | 伺服器端 session 管理 |

#### 階段三：三個月內實施（低優先）

| 項目 | 說明 |
|------|------|
| Google OAuth | 整合 Google 登入 |
| TOTP 二階段驗證 | 使用 `otpauth` 套件 |
| 審計日誌 | 記錄所有重要操作 |
| IP 白名單 | 限制管理員登入來源 |

---

## 三、建議實施順序

```
第 1 週：CSS 主題系統
├── 定義 CSS 變數
├── 建立 ThemeContext
├── 重構現有元件使用變數
└── 新增主題切換功能

第 2 週：資安基礎
├── 替換 localStorage 為 HttpOnly Cookie
├── 新增 CSRF 保護
├── 新增輸入驗證（zod）
└── 新增 API 速率限制

第 3-4 週：資安加強
├── 實作 JWT + Refresh Token
├── 新增安全標頭
├── 實作 CSP
└── 測試與調整
```

---

## 四、待確認事項

1. **深色模式**：是否需要支援深色模式切換？
2. **Session 策略**：使用 HttpOnly Cookie 還是保持 localStorage？
3. **驗證套件**：輸入驗證要使用 zod、joi 還是 yup？
4. **部署平台**：是否使用 Vercel？（影響安全標頭設定）
