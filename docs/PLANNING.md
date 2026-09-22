# 數位校園工具箱 — CSS 主題與資安機制規劃

> 參考文件：`CSS主題細緻化規劃書.md`、`主程式資安機制規格書.md`、`模組程式資安機制規格書.md`
> 日期：2026-09-22
> 狀態：規劃中

---

## 一、CSS 主題系統

### 1.1 架構設計（比照 GAS 站混合架構）

採用**混合架構**：帳號欄位為唯一事實來源 + localStorage 為快取與未登入後備

```
解析順序（優先級由高到低）：
1. Admin 強制主題（系統設定 CSS主題ID 欄位）
2. 使用者帳號主題欄位（成員名冊 CSS主題ID）
3. localStorage 快取
4. 系統預設主題
```

### 1.2 主題 ID 格式

| 前綴 | 來源 | 說明 |
|------|------|------|
| `builtin:` | 系統內建 | 不可移除 |
| `market:{uuid}` | 主題市集 | 可下載/移除 |
| `custom:{uuid}` | 用戶自訂 | 本機限定 |

### 1.3 資料欄位規劃

| 欄位 | 位置 | 型態 | 說明 |
|------|------|------|------|
| `cssThemeId` | settings (系統設定) | string | Admin 強制主題，空值=不強制 |
| `cssThemeId` | users (用戶資料) | string | 用戶自訂主題 |
| `installedThemes` | users (用戶資料) | string | 已安裝主題清單 (JSON 陣列) |

### 1.4 主題本體存取

```
主題本體儲存位置：
├── builtin: → 系統 CSS 內建（永遠可取得）
├── market: → 市集 API（可隨時取回）
└── custom: → localStorage（僅本機）
```

### 1.5 實作規劃

#### 階段一：基礎主題系統

| 項目 | 說明 |
|------|------|
| CSS 變數定義 | 建立主題色彩、字體、間距變數 |
| ThemeContext | React Context 管理主題狀態 |
| localStorage 快取 | 未登入時的主題快取 |
| 內建主題 | 提供 3-5 套內建主題 |

#### 階段二：帳號同步

| 項目 | 說明 |
|------|------|
| 用戶主題欄位 | Firestore users 新增 cssThemeId |
| 登入同步 | 登入時讀取帳號主題，同步 localStorage |
| 切換回寫 | 切換主題時寫回 Firestore |

#### 階段三：主題市集（可選）

| 項目 | 說明 |
|------|------|
| 市集 API | 提供主題列表/下載端點 |
| 安裝清單 | 用戶已安裝主題記錄 |
| 主題上架 | 自訂主題上傳審核流程 |

---

## 二、資安機制

### 2.1 驗證（Authentication）

#### 2.1.1 帳密驗證

| 項目 | 規格 |
|------|------|
| 密碼雜湊 | PBKDF2-HMAC-SHA256 |
| Salt | 隨機產生 |
| Iteration | 可設定（設定工作表），預設 5000 |
| Pepper | 環境變數 `PASSWORD_PEPPER`，無則自動產生 |
| 複雜度 | >=8 字元，含 a-z、A-Z、0-9 |
| 儲存格式 | `pbkdf2$salt$iter:hex` |

#### 2.1.2 Email OTP（第二階段）

| 項目 | 規格 |
|------|------|
| 產生 | 6 位數 100000-999999 |
| 有效期 | 600 秒 |
| 節流 | 同一 email 120 秒內僅能請求一次 |

#### 2.1.3 TOTP（第二階段）

| 項目 | 規格 |
|------|------|
| 演算 | RFC6238 HMAC-SHA1 |
| Window | T±1 |
| 防重放 | 90 秒內不可重複使用 |
| QR 產生 | 前端本地產生（qrcode.js） |

#### 2.1.4 Google OAuth（第二階段）

| 項目 | 規格 |
|------|------|
| State 保護 | nonce + Cache 600s |
| Scope | email profile |
| 密鑰 | 環境變數 `OAUTH_CLIENT_SECRET` |

### 2.2 工作階段（Session）

#### 2.2.1 Token 格式

```
結構：b64url(payload).b64url(HMAC-SHA256)
Payload：email|role|themeId|exp|tokenVersion|jti
簽章：HMAC-SHA256(TOKEN_SECRET)
```

#### 2.2.2 Token 種類

| 種類 | 有效期 | 用途 |
|------|--------|------|
| Session Token | 7200 秒 | 登入後主要憑證 |
| Module Token | 300 秒 | 模組導向用 |
| Password Reset | 1800 秒 | 密碼重設連結 |

#### 2.2.3 撤銷機制

| 情境 | 方式 |
|------|------|
| 閒置逾時/登出 | `revoked_{sha256(token)}` Cache 7200s |
| 登出/改密 | `revoked_jti_{jti}` Cache 7200s |
| 改密/重設 | `tokenVersion` +1 持久失效 |

### 2.3 暴力防護

| 機制 | 說明 |
|------|------|
| Cache 快速 | `login_fail_{role}_{account}` 900s |
| 持久欄 | `failedAttempts` / `lockedUntil` |
| 門檻 | 5 次失敗鎖 15 分鐘 |
| 回傳訊息 | 統一「帳號或密碼錯誤」防止列舉 |

### 2.4 閒置逾時

| 項目 | 說明 |
|------|------|
| 參數 | `sessionTimeout`（分鐘） |
| 前端監聽 | mousedown/mousemove/keydown/touchstart/scroll |
| 警告 | 60 秒倒數 |
| 動作 | 逾時後清除 session 導回登入頁 |

### 2.5 CSRF 防護

| 項目 | 說明 |
|------|------|
| 機制 | nonce 一次性驗證 |
| 儲存 | Cache 600s |
| 套用 | 所有表單提交 |

### 2.6 XSS 防護

| 項目 | 說明 |
|------|------|
| 輸出跳脫 | 所有使用者可控輸出 |
| 模板注入 | 使用 `JSON.stringify` |
| CSP 標頭 | 限制可執行腳本來源 |

### 2.7 審計日誌

| 項目 | 說明 |
|------|------|
| 記錄位置 | Firestore activityLog |
| 必須記錄 | 登入/登出/失敗/鎖定/設定變更 |
| 欄位 | userId, action, timestamp, ip, details |

---

## 三、Firestore 資料結構

### 3.1 settings (系統設定)

```typescript
interface Settings {
  // 基本資訊
  systemEnabled: boolean;
  systemName: string;
  schoolFullName: string;
  schoolShortName: string;
  schoolOtherNames: string;
  academicYear: number;
  schoolCode: string;
  
  // 承辦聯絡
  contactPerson: string;
  contactEmail: string;
  
  // 系統管理
  oauthEnabled: boolean;
  oauthClientId: string;
  totpEnabled: boolean;
  workspaceLoginEnabled: boolean;
  twoFactorEnabled: boolean;
  passwordCostFactor: number;  // PBKDF2 迭代次數（千次）
  sessionTimeout: number;      // 閒置逾時（分鐘）
  cssThemeId: string;          // Admin 強制主題
  
  // 外觀與顯示
  copyrightNotice: boolean;
  sponsorAdEnabled: boolean;
}
```

### 3.2 users (用戶資料)

```typescript
interface User {
  uid: string;
  email: string;
  account: string;
  displayName: string;
  passwordHash: string;        // pbkdf2$salt$iter:hex
  role: 'student' | 'staff' | 'admin';
  
  // 安全欄位
  failedAttempts: number;
  lockedUntil: number;
  tokenVersion: number;
  lastLogin: number;
  loginCount: number;
  
  // 主題欄位
  cssThemeId: string;          // 用戶自訂主題
  installedThemes: string;     // JSON 陣列 [{id, name, installedAt}]
  
  // TOTP（第二階段）
  totpSecret?: string;
  totpEnabled: boolean;
}
```

### 3.3 activityLog (審計日誌)

```typescript
interface ActivityLog {
  id: string;
  userId: string;
  action: string;      // login, logout, login_failed, settings_change, etc.
  timestamp: number;
  ip?: string;
  details?: string;
}
```

---

## 四、API 端點規劃

### 4.1 認證 API

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/auth/login` | POST | 帳密登入 |
| `/api/auth/logout` | POST | 登出（撤銷 token） |
| `/api/auth/refresh` | POST | 刷新 token |
| `/api/auth/reset-password` | POST | 重設密碼（一次性連結） |

### 4.2 管理 API

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/admin` | GET/PUT | 系統設定 CRUD |
| `/api/admin/users` | GET | 用戶列表 |
| `/api/admin/users/[id]` | PUT | 更新用戶 |
| `/api/admin/activity` | GET | 審計日誌 |

### 4.3 主題 API（第二階段）

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/theme/current` | GET | 取得當前主題 |
| `/api/theme/switch` | POST | 切換主題 |
| `/api/theme/market` | GET | 市集主題列表 |
| `/api/theme/install` | POST | 安裝市集主題 |

---

## 五、實施順序

### 第一週：CSS 主題基礎
- [ ] 定義 CSS 變數（色彩、字體、間距）
- [ ] 建立 ThemeContext Provider
- [ ] 實作主題切換 UI
- [ ] 提供 3 套內建主題（亮色、深色、護眼）

### 第二週：資安基礎
- [ ] 密碼改用 PBKDF2-HMAC-SHA256
- [ ] 實作 HttpOnly Cookie Session
- [ ] 新增 CSRF 保護
- [ ] 新增 API 速率限制

### 第三週：Session 管理
- [ ] 實作 Token 簽發與驗證
- [ ] 實作 Token 撤銷機制
- [ ] 實作閒置逾時
- [ ] 實作登入鎖定

### 第四週：資安加強
- [ ] 新增安全標頭（CSP、X-Frame-Options 等）
- [ ] 實作審計日誌
- [ ] 密碼重設功能
- [ ] 測試與調整

### 第五週（可選）：進階功能
- [ ] TOTP 二階段驗證
- [ ] Google OAuth 整合
- [ ] 主題市集 API

---

## 六、待確認事項

1. **部署平台**：Vercel？影響安全標頭設定
2. **深色模式**：是否需要支援切換？
3. **主題市集**：第一階段是否需要？
4. **TOTP/OAuth**：是否列為必備功能？
