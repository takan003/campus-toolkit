# 數位校園GAS站 — CSS 主題細緻化規劃書

> 作者：張家誠
> 文件版本：0.1（草案）
> 日期：115.08.15
> 授權：MIT License
> 狀態：規劃中（核心決策已定案，待實作）

---

## 一、背景與動機

### 1.1 現況問題

目前 CSS 主題的選擇紀錄存放於瀏覽器的 `localStorage`（key：`gasThemeActive`），這導致：

| 情境 | 結果 |
|------|------|
| 使用者在 A 電腦選「純潔白」 | 只有 A 電腦的瀏覽器記得 |
| 使用者在 B 電腦開啟程式 | 回到系統預設主題，需重新選擇 |
| 使用者清除瀏覽器快取 | 主題設定整組消失 |
| Chrome 帳號同步 | **不包含 localStorage**，換電腦仍不同步 |

主題偏好「跟瀏覽器走」而非「跟使用者走」，跨裝置體驗不一致。

### 1.2 討論結論（定案）

經討論後採用**混合架構**：

> **「帳號欄位」為唯一事實來源（source of truth）＋「localStorage」為快取與未登入後備**

- 登入後：以帳號的 `CSS主題ID` 欄位為準 → 任何電腦開啟都是同一主題
- 未登入 / 公開頁面（登入頁、主題管理、主題創作）：沿用 localStorage → 系統預設
- 切換主題時：即時寫 localStorage（立即生效）＋ 防抖回寫試算表（跨裝置一致）
- **登入後同步快取（方案 B，115.08.16 定案）**：session 頁初始化時，若帳號主題（`userTheme`）有值且非強制，**同步寫入 `localStorage.gasThemeActive`** → 登出後登入頁仍顯示帳號主題，消除「登出跳回預設」的視覺跳變（見 §8.1-8）

---

## 二、決策摘要（已定案）

| # | 決策 | 內容 |
|---|------|------|
| 1 | **混合架構** | 帳號欄位為準 + localStorage 快取 + 系統預設後備 |
| 2 | **Admin 強制主題** | 主程式與模組的「設定」工作表各設一個 `CSS主題ID` 欄位 |
| 3 | **用戶自訂主題** | 成員名冊 3 種身分工作表各設一個 `CSS主題ID` 欄位 |
| 4 | **模組強制贏** | 模組自己的強制主題優先於主程式強制主題 |
| 5 | **傳遞協議不變** | token 仍帶主程式「已解析完成」的主題 ID，模組在其上疊加自己的解析層 |
| 6 | **模組可切換主題** | 開放模組內主題切換，寫回模組自己名冊（第二階段再同步回主程式） |
| 7 | **主題本體倉庫** | 第一階段採**方案 A**：帳號/強制欄位只收 `builtin:`／`market:`，市集為唯一本體倉庫；第二階段再評估個人主題庫（方案 B/C，見 §10） |
| 8 | **短網址人/機分工** | 短網址給「人」用（分享、QR Code、文宣），「機器對機器」一律真網址；自有 PHP 短網址需修改轉址程式才能帶參數（見 §11） |
| 9 | **市集網址固定常數** | 市集網址固定為 `https://p-tu.cc/gasTheme`，寫死在程式（不設「主題市集網址」工作表欄位）；人機同路徑式取回 |
| 10 | **方案 B-lite（第二階段）** | 個人「安裝清單」伺服器化：名冊新增 `已安裝主題清單` 欄位（JSON 陣列，只收 `market:`），主題本體仍由市集取回；模組共用同一張名冊直接讀寫（見 §10.6） |
| 11 | **登入頁主題一致性（方案 B）** | session 頁初始化時將帳號主題同步寫入 `localStorage.gasThemeActive`（僅非強制時），登出後登入頁仍顯示帳號主題，消除跳變（見 §8.1-8） |

---

## 三、優先級解析規則（核心）

### 3.1 主程式內部解析順序

```
主程式強制（設定工作表 CSS主題ID）
  > 使用者帳號主題欄位（成員名冊 CSS主題ID）
  > localStorage（gasThemeActive，未登入或無欄位時的快取）
  > 主程式系統預設（設定工作表 系統預設主題）
```

### 3.2 模組內部解析順序

```
模組強制（模組設定工作表 CSS主題ID）          ← 模組強制贏（決策 #4）
  > 主程式強制（token 帶的主程式強制主題）
  > 使用者帳號主題欄位（模組成員名冊 CSS主題ID）
  > token 帶的主程式使用者主題（主程式已解析的用戶主題）
  > localStorage（gasThemeActive）
  > 模組系統預設
```

### 3.3 解析原則

- **越靠近使用者端優先**：模組的設定比主程式更特定，故模組強制置頂
- **強制主題絕對化**：一旦強制（有值），用戶自訂與 localStorage 全部失效
- **空值即不介入**：所有 `CSS主題ID` 欄位一律「空值 = 不強制 / 不套用」

---

## 四、資料欄位規範

### 4.1 設定工作表「CSS主題ID」（Admin 強制主題）

> ✅ **已完成**：主程式與模組的「設定」工作表已手動新增此欄位

| 欄位 | 位置 | 型態 | 說明 |
|------|------|------|------|
| `CSS主題ID` | 主程式「設定」工作表 | 文字 | 空值 = 不強制；有值 = 全體強制套用此主題，用戶自訂失效 |
| `CSS主題ID` | 模組「設定」工作表 | 文字 | 同上，但只影響該模組（模組強制贏） |

範例值：`builtin:dark`、`custom:xxxx-xxxx`、`market:xxxx-xxxx`

> 沿用既有慣例：列順序不固定，以 A 欄標題文字比對為準（`getDataR('設定')`）。

### 4.2 成員名冊 3 種身分工作表「CSS主題ID」（用戶自訂主題）

> ✅ **已完成**：主程式成員名冊的 3 種身分工作表（學生/教職員/管理員）已手動新增此欄位

| 欄位 | 位置 | 型態 | 說明 |
|------|------|------|------|
| `CSS主題ID` | 成員名冊「學生」工作表 | 文字 | 空值 = 不套用；有值 = 該學生帳號套用此主題 |
| `CSS主題ID` | 成員名冊「教職員」工作表 | 文字 | 同上 |
| `CSS主題ID` | 成員名冊「管理員」工作表 | 文字 | 同上 |

> 模組若有自己的名冊（如自主學習模組的「學生」「教師」「管理員」工作表），同規則比對「CSS主題ID」欄位（**尚未新增，待模組開發時一併建立**）。

### 4.3 主題 ID 格式（沿用既有協議）

| 前綴 | 來源 | 可否移除 |
|------|------|---------|
| `builtin:` | 系統內建（8 套） | 不可 |
| `market:{uuid}` | 主題市集下載 | 可 |
| `custom:{uuid}` | 用戶自訂 / 創作工具 | 可 |

---

## 五、主程式 ↔ 模組傳遞協議（Q1 結論）

### 5.1 協議不變，解析層疊

token 傳遞機制**維持現行方案 B**（`?token=xxx`），**不做結構性改變**：

```
主程式登入後 → 解析出自己的最終主題（已含 強制 > 帳號欄位 > ...）
     │
     ▼
token payload 帶「主程式已解析的主題 ID」（新增一欄 themeId）
     │
     ▼
模組 doGet → 在自己的解析層疊上（§3.2）套用
     ├─ 模組強制 → 蓋過一切
     ├─ 模組名冊欄位 → 蓋過 token 帶的主程式主題
     └─ 否則 → 採用 token 帶的主程式已解析主題
```

### 5.2 模組為何可讀帳號欄位

主程式與每個模組是**各自獨立的 GAS 專案、各自的試算表、各自的會員名冊**。因此：

- 模組讀的帳號主題欄位 = **模組自己名冊**的 `CSS主題ID`，不是主程式的
- 主程式的主題以 token 傳遞；模組的帳號欄位提供模組內部的個人化覆蓋

### 5.3 生效時機

| 來源 | 生效時機 |
|------|---------|
| 模組強制（設定欄位） | 模組每次頁面載入（伺服端注入） |
| 主程式強制（token） | 每次從主程式進入模組（token 驗證時） |
| 模組名冊欄位 | 模組每次頁面載入（伺服端讀取名冊） |
| 主程式名冊欄位 | 主程式每次頁面載入 + 簽發 token 時帶入 |

---

## 六、模組內主題切換（Q2 結論）

### 6.1 決策：開放模組內切換

模組的 `theme.html` 已內建「主題」切換抽屜（`toggleThemeDrawer`），目前未開放。規劃開放，切換邏輯與主程式一致。

### 6.2 切換後寫回目標（分階段）

| 階段 | 內容 | 說明 |
|------|------|------|
| **第一階段** | 模組切換 → 寫回**模組自己名冊**的 `CSS主題ID` | 該模組內跨裝置一致；成本低、無副作用 |
| **第二階段（已實作）** | 模組切換 → 額外呼叫主程式更新主程式名冊欄位 | 模組已知主程式部署網址（token 帶），做到「改一處、全生態一致」；主程式提供公開 `theme_sync` 端點（§9 問題 1 已解，見 §11） |

### 6.3 與強制主題的關係

- 模組或主程式有強制主題時：切換抽屜依現行機制隱藏（`openThemeDrawer` 已有 `_forcedTheme` 判斷）
- 強制解除（欄位清空）後：恢復可切換

---

## 七、每模組各強制不同主題（Q3 結論）

### 7.1 天然支援

每個模組是獨立專案、有自己的「設定」試算表，因此**每個模組可以各自強制不同主題**：

```
主程式「設定」CSS主題ID = builtin:ocean   → 主程式全體 + token 預設傳遞
模組 A「設定」CSS主題ID = builtin:dark    → 模組 A 強制深色（蓋過主程式）
模組 B「設定」CSS主題ID = custom:xxx      → 模組 B 強制自訂主題
模組 C「設定」CSS主題ID = （空）          → 模組 C 不強制，沿用主程式解析結果
```

### 7.2 管理哲學

> **決策 #4：模組強制贏**（越靠近使用者端越優先）
>
> 模組強制 > 主程式強制 > 用戶自訂。模組更特定、更貼近該業務情境，故其強制優先於主程式全域強制。

---

## 八、實作規劃

### 8.1 主程式異動清單

| # | 檔案 | 變更 |
|---|------|------|
| 1 | `theme.html` | 初始化判斷順序改為：強制（`forcedTheme`）→ 帳號（`userTheme`）→ localStorage → 系統預設 |
| 2 | `auth.js` | session payload 擴充帶 `themeId`（登入時從名冊 `CSS主題ID` 欄位讀取） |
| 3 | `main.js` | 各頁面渲染前注入 `tpl.userTheme`（每頁重讀名冊 `CSS主題ID` 為準，其次 session token；admin 強制優先） |
| 4 | `main.js` | `_signModuleUrls()` token payload 增加 `themeId`（主程式已解析主題；doGet 時以重讀的名冊值為準，避免 session 內 token 過期值） |
| 5 | `main.js` | 新增 `updateUserTheme(themeId)`（google.script.run 回寫名冊 `CSS主題ID`） |
| 6 | `theme.html` | `applyTheme()` 內加**防抖**呼叫 `updateUserTheme`（僅登入時、僅非強制時） |
| 7 | ~~`theme_manager.html` / `theme_create.html` 套用帳號主題~~ | **已結案（115.08.16）**：此項源自先前說明但未講清楚——實指**主題市集（市集）**的公開頁。市集規劃書 §2.3 定案：市集公開頁 `userTheme` 恆空、維持 localStorage 為準，無需實作 |
| 8 | `theme.html` | **初始化同步 localStorage（方案 B，115.08.16 定案）**：解析出 `tid` 後，若 `userTheme` 有值且非強制 → `localStorage.setItem('gasThemeActive', userTheme)`（登出後登入頁顯示帳號主題） |

### 8.2 模組異動清單（第一階段）

| # | 檔案 | 變更 |
|---|------|------|
| 1 | `theme.html` | 同上 8.1-1、8.1-6（模組版） |
| 2 | `main.js` | 解析 §3.2 優先級：模組強制 → token themeId → 模組名冊欄位 → localStorage → 預設 |
| 3 | `main.js` | 新增 `updateUserTheme(themeId)`（寫回模組自己名冊） |
| 4 | `auth.js` | 登入 session 帶模組名冊的 `themeId`（模組若有自己的登入） |

### 8.3 強制主題注入方式

- 強制主題目前以樣板變數 `forcedTheme` 注入 → 新增同樣注入 `userTheme`
- `theme.html` 初始化順序（修改後）：

```javascript
var tid = forced || userTheme || localStorage.getItem('gasThemeActive') || def;
```

### 8.4 短網址架構真相與轉址程式修改 ✅ 已完成 115.08.15

#### 8.4.1 實際架構（測試驗證）

```
p-tu.cc/gas?theme=ooxx
  ↓ 轉發層（Squarespace 式，保留路徑、丟棄 query！）
php-pie.net/tinyurl/dir/gas      ← query 到此已消失，PHP 永遠拿不到
  ↓ dir/gas/index.php（建立短碼時複製的 index-tinyurl.php）
資料庫查 code=gas → 轉向存檔目標
```

- **每個短碼 = 一個資料夾**：`dir/{code}/index.php` 是 `dir/index-tinyurl.php` 的複製品（`shorten.php:67-74` 建立時 `copy()`）
- **轉發層丟棄 query string**（測試1 證實：`?theme=ooxx` 沒到 PHP，但仍成功導到目標）→ **query 式短網址在此架構下不可能**，只能走路徑式
- 轉發目標基址 = `https://php-pie.net/tinyurl/dir`（測試2 的加倍路徑 `tinyurl/dir/tinyurl/dir/gas` 證實）
- 本地副本只有 `dir/HLGS/` 一個短碼資料夾，伺服器端才有全部

#### 8.4.2 樣板修改內容（`dir/index-tinyurl.php` 與 `dir/HLGS/index.php` 已同步修改）

① code 查詢前 `strtok($code, '?')` 剝離 query（保護直接訪問 php-pie.net 帶 query 的情況）
② 轉址前附加 `$_SERVER['QUERY_STRING']`（同上，僅直接訪問時才可能有）
③ **附加 code 之後的額外路徑**（如 `p-tu.cc/gas/ooxx` 的 `/ooxx`）到目標網址——**路徑式短網址的核心**

```php
if ($scheme === 'http' || $scheme === 'https') {
    //附加使用者訪問時帶的 ?參數 到目標網址
    if (!empty($_SERVER['QUERY_STRING'])) {
        $sep = (strpos($target, '?') !== false) ? '&' : '?';
        $target .= $sep . $_SERVER['QUERY_STRING'];
    }
    //附加 code 之後的額外路徑（如 p-tu.cc/gas/ooxx 的 /ooxx）到目標網址
    $extra = array_slice($dir, 4);
    $extra = array_filter($extra, function ($seg) { return $seg !== '' && $seg !== '.' && $seg !== '..'; });
    if ($extra) {
        $target = rtrim($target, '/') . '/' . implode('/', $extra);
    }
    header("Location: " . $target);
    exit;
}
```

#### 8.4.3 ✅ 已完成 115.08.15（伺服器端設定，實測通過）

① **樣板傳播**：樣板修改**不影響既有短碼**——舊短碼的 `dir/{code}/index.php` 仍是舊副本。需在伺服器端把新樣板複製到所有既有短碼資料夾（一次即可；之後 `shorten.php` 建立新短碼自動用新樣板）：

```bash
# 在伺服器 tinyurl 專案資料夾執行
for d in dir/*/; do cp dir/index-tinyurl.php "$d/index.php"; done
```

② **根 .htaccess 轉寫規則**（已加入本地 `PHP-Pie\.htaccess`，需上傳）：`DirectoryIndex` 只對資料夾本身生效，`dir/gas/ooxx` 這類更深路徑不會執行 `dir/gas/index.php`（會 404 → catch-all → 主頁）。需在 webroot `.htaccess` 的 catch-all **之前**加：

```apache
# 短網址路徑式：dir/CODE/額外路徑 → 內部轉送到該短碼的 index.php（REQUEST_URI 不變，轉址程式 $dir[4] 可讀取額外路徑）
RewriteRule ^tinyurl/dir/([^/]+)/.+$ tinyurl/dir/$1/index.php [L]
```

> 放在 webroot 層是必要的：catch-all 在 webroot 就先攔截，子資料夾的 `.htaccess` 沒有機會接手。

#### 8.4.4 市集路徑式短網址設計

- **市集網址為固定常數**（寫死在主程式，不進設定工作表）：`MARKET_URL = "https://p-tu.cc/gasTheme"`（決策 #9）
- 市集入口短碼只需**一個**（`gasTheme`）：`p-tu.cc/gasTheme/ooxx` → `php-pie.net/tinyurl/dir/gasTheme/ooxx` → `dir/gasTheme/index.php` 查 code → 目標 = 市集 exec 網址 + `/ooxx` → **GAS `doGet` 收到 `e.pathInfo = "gasTheme/ooxx"`**，解析主題 ID 與動作
- **人機同路**：`UrlFetchApp.fetch(MARKET_URL + "/" + themeId)` 會沿 302 轉發鏈追蹤（路徑全程保留），市集 doGet 照樣收到 pathInfo——機器取回不需另用真網址
- 舊資料零影響：不碰資料庫；無路徑訪問行為與原本完全相同

```php
if ($scheme === 'http' || $scheme === 'https') {
    // 把使用者訪問時帶的 ?參數 附加到目標網址後面
    if (!empty($_SERVER['QUERY_STRING'])) {
        $sep = (strpos($target, '?') !== false) ? '&' : '?';
        $target .= $sep . $_SERVER['QUERY_STRING'];
    }
    header("Location: " . $target);
    exit;
}
```

```php
// 可選：在 explode 之後取出 code 後面的額外路徑一併帶過去
$path_extra = implode('/', array_slice($dir, 4));
if ($path_extra !== '') {
    $target = rtrim($target, '/') . '/' . $path_extra;
}
```

---

## 九、開放問題

1. **模組同步主程式（第二階段）**：模組切主題回寫主程式名冊欄位時，主程式需要暴露一個「僅限模組 TOKEN_SECRET 簽章可呼叫」的端點，安全性如何設計？ → **已實作**：主程式 doPost 公開端點 `page=theme_sync`（`{token, themeId}`），驗證 HMAC 簽章（session token 或模組 token 皆可）+ 主題 ID 格式白名單（`builtin:`／`market:`，長度 ≤100）+ 每帳號 10 秒頻率限制（CacheService），回應 JSON。模組側 `syncThemeToMain()` 由伺服端 UrlFetchApp POST 呼叫（見模組規格書 §8-1.6.1）。
2. **管理員身分的帳號欄位**：管理員同時是「管理員」身分，其帳號主題欄位是否也套用？還是管理員一律看主程式強制或系統預設？
3. **效能**：每次頁面載入多一次名冊讀取（伺服端），以 GAS 的讀取成本是否可接受？是否需要 CacheService 快取名冊欄位？
4. **主題市集整合**：`market:` 來源的主題若被設為強制或帳號欄位，市集主題下架後的行為？（沿用既有機制：無快取資料時 fallback）
5. **多角色使用者**：同一人同時是「教職員」與「管理員」時（身分工作表不同），以哪個身分的 `CSS主題ID` 為準？（建議：依登入身分判定）
6. **模組是否開放帳號欄位**：若模組名冊與主程式名冊是同一批人（教甄系統等），是否直接沿用主程式名冊的欄位（透過 token）而不再需要模組名冊欄位？（初期維持各自獨立）
7. **短網址帶參數的點擊紀錄**：PHP 轉址程式修改後，訪問 `p-tu.cc/.../gasTheme?id=ooxx` 的 `record` 表仍只記 code（`gasTheme`），是否需要連參數一起紀錄？

---

## 十、主題本體（JSON）存取方式

### 10.1 核心問題

帳號欄位與強制欄位存的只是「ID」，**主題本體（JSON）目前只存在使用者瀏覽器的 localStorage**（`gasTheme_{id}`）。ID 換到另一台電腦，本體卻不在——這就是跨電腦主題不一致的根源。

### 10.2 關鍵洞察：ID 前綴 = 本體可取得性

| 前綴 | 本體位置 | 換電腦後 |
|------|----------|----------|
| `builtin:` | 主程式/模組 CSS 內建 | ✅ 永遠可取得 |
| `market:` | 市集（主題市集）試算表 | ✅ 可隨時取回 |
| `custom:` | 創作者瀏覽器 localStorage | ❌ 只有那台電腦有 |
| `imported:` | 導入者瀏覽器 localStorage | ❌ 只有那台電腦有 |

→ **帳號欄位該收什麼前綴，取決於「伺服器能不能隨時取回本體」。**

### 10.3 三個方案

| 方案 | 內容 | 優點 | 缺點 |
|------|------|------|------|
| **A（第一階段）** | 帳號/強制欄位只允許 `builtin:`／`market:`；`custom:` 不進欄位，本體只在創作者裝置 | 欄位永不失效、零開發量、市集即唯一倉庫 | 用戶自己做的主題無法跨電腦套用（要上架市集才行） |
| **B** | 主程式新增「個人主題庫」（試算表存 JSON） | 用戶主題可跨電腦 | 新頁面、權限、體積控管 |
| **C** | 混合：B 為主，localStorage 為快取 | 離線也可用 | 開發量最大 |

### 10.4 定案（決策 #7）

- **第一階段採方案 A**：欄位（含強制）只收 `builtin:`／`market:`，市集為唯一主題本體倉庫
- **強制欄位與帳號欄位的前綴規則一致適用**
- **可行性已確認**：GAS 伺服器可用 `UrlFetchApp.fetch()` 向市集取回主題 JSON；主程式 `appsscript.json` 已含 `script.external_request` 權限（第 12 行），無需再改權限
- B/C 列為第二階段再評估；**115.08.16 已定案方案 B-lite（§10.6）**——僅「個人安裝清單」伺服器化，主題本體仍由市集取回

### 10.5 取回流程（圖書館比喻）

市集 = 圖書館；主程式伺服器 = 管家，憑 ID 代領；瀏覽器 localStorage = 借回來的副本

```
市集網址 = 固定常數（寫死在程式，不設工作表欄位）：https://p-tu.cc/gasTheme
  → 帳號欄位存 market:xxxx
  → 主程式伺服器 UrlFetchApp.fetch(市集網址 + "/" + 主題ID)   ← 路徑式，query 不會被轉發層丟棄
  → 主題 JSON 傳回瀏覽器 → localStorage 快取
  → 下次直接套用快取，不用再連市集
```

### 10.6 方案 B-lite 定案（115.08.16）：個人安裝清單伺服器化

> **定位**：方案 B 的輕量化——不做「個人主題本體庫」，只把「裝了哪些主題」的**清單**伺服器化。主題本體維持方案 A 規則（`market:` 由市集取回），跨裝置/跨程式時清單跟人走、本體隨時補得上。

#### 10.6.1 欄位設計

| 項目 | 內容 |
|------|------|
| 工作表 | 主程式成員名冊 3 種身分工作表（學生/教職員/管理員）各一欄 |
| 欄位名稱 | `已安裝主題清單`（A 欄標題文字比對，與 `CSS主題ID` 同規則） |
| 型態 | 文字 |
| 格式 | JSON 陣列字串：`[{"id":"market:xxx","name":"暗紫夜行","installedAt":1755000000000}]` |
| 空值 | = 空清單（不介入） |
| 容量 | 單格上限 50,000 字元，每筆約 100 字元 → **約 400 筆以上**；實務（10~30 套）無壓力 |

> 格式與瀏覽器 `localStorage.gasThemeInstalled` **完全一致**（`[{id, name, installedAt}]`），前端合併邏輯零轉換。

#### 10.6.2 前綴規則（沿用方案 A）

- 清單**只收 `market:`**：`builtin:` 不需記錄；`custom:`／`imported:` 本體不在伺服器端、跨裝置無法取回，**不進清單**
- 驗證同 `CSS主題ID` 白名單（格式 + 長度 ≤100）

#### 10.6.3 讀取

- 登入使用者：伺服端每頁重讀名冊（同 `_freshUserTheme` 模式）→ 清單隨樣板注入
- 抽屜 / 主題管理頁：**伺服端清單 + localStorage 合併**（未登入 / 離線以 localStorage 為準）
- **模組**：共用同一張成員名冊試算表，直接讀同一欄 → **安裝清單全生態一致**（不需 token 同步機制）

#### 10.6.4 寫回

- 安裝 / 卸載時防抖回寫（同 `updateUserTheme` 800ms 模式；僅登入時）
- 主程式寫主程式名冊；模組安裝/卸載寫**同一張共用名冊**（模組 8/15 起已能直接讀寫該名冊）
- 與強制主題無關：安裝清單任何登入使用者皆可寫回（強制只影響「啟用」）

#### 10.6.5 與 `CSS主題ID` 的分工

| 欄位 | 角色 | 狀態 |
|------|------|------|
| `CSS主題ID` | 現在用哪個（啟用） | 已實作 |
| `已安裝主題清單` | 裝了哪些（收藏） | 本節定案，第二階段實作 |

- 兩者獨立：啟用的主題不一定在清單（強制主題）；清單中的主題不一定啟用

#### 10.6.6 限制與副作用

- 多裝置同時增刪 → last-write-wins（後寫覆蓋）；單人單帳號影響極小，可接受
- 不儲存本體：`market:` 本體仍由既有 `_fetchMarketTheme` 自動取回（快取機制不變）
- 欄位僅回傳前端 `JSON.parse`、不插入 HTML → 無 XSS 風險
- **欄位可先手動建立**（空值無副作用），程式實作列第二階段

#### 10.6.7 異動清單（第二階段，暫列）

| # | 檔案 | 變更 |
|---|------|------|
| 1 | 名冊試算表 | 3 身分工作表手動新增 `已安裝主題清單` 欄位 |
| 2 | 主程式 `main.js` | `updateInstalledThemes(list)`（google.script.run 回寫，白名單驗證）＋每頁重讀注入 |
| 3 | 主程式 `theme.html` | `installTheme`／`uninstallTheme` 後防抖回寫（僅登入時）；初始化合併伺服端清單 |
| 4 | 主程式 `theme_manager.html` | 清單來源改為伺服端 + localStorage 合併 |
| 5 | 模組 | 共用名冊欄位讀寫（寫同一張名冊，無需同步機制） |

### 10.7 來源標籤與用戶說明（115.08.16 定案）

> **動機**：用戶最常困惑的是「為什麼自訂主題換電腦就沒了」。定案以**來源標籤**在清單上直接區分四種來源，並在**三處關鍵位置**提供說明，不四處重複貼文。

#### 10.7.1 來源標籤（主題清單每筆顯示）

| 標籤 | 對應前綴 | 用戶認知 |
|------|---------|---------|
| 內建 | `builtin:` | 系統固定 8 套，永遠有 |
| 市集 | `market:` | 換電腦也會自動取回 |
| 自訂 | `custom:` | 只有這台瀏覽器有，需下載備份 |
| 匯入 | `imported:` | 同自訂，只有這台瀏覽器有 |

- 顯示位置：主題管理頁已安裝清單、抽屜選單（主程式與模組 `theme.html`）**每一筆**加小徽章（如灰色圓角小字標籤）
- 對應 §10.2「前綴 = 本體可取得性」——標籤就是讓用戶看到這張表的結論

#### 10.7.2 關鍵說明文案（三處）

| # | 位置 | 文案 |
|---|------|------|
| 1 | 創作工具 `theme_create.html`（下載/安裝按鈕旁） | 「自訂主題只存在於目前瀏覽器，換電腦不會自動帶過去。請下載 JSON 保存備份；想在任何裝置使用，請投稿到主題市集。」 |
| 2 | 市集投稿頁 `submit.html` | 「投稿後主題將重新簽發市集 ID（`market:`），之後在任何裝置套用都會自動從市集取回。」 |
| 3 | 主題管理頁 `theme_manager.html` | 可收合的「主題來源說明」小節，用 §10.7.1 表格講四類來源差異 |

#### 10.7.3 實作位置（暫列）

| # | 檔案 | 變更 |
|---|------|------|
| 1 | 主程式 `theme_manager.html` | 已安裝清單每筆加來源徽章 + 收合式「主題來源說明」 |
| 2 | 主程式 `theme.html`（抽屜） | 清單每筆加來源徽章 |
| 3 | 主程式 `theme_create.html` | 下載/安裝按鈕旁加說明 |
| 4 | 市集 `theme_detail.html`／`submit.html` | 來源徽章 + 重新簽發說明 |
| 5 | 模組 `theme.html`（抽屜） | 清單每筆加來源徽章（與主程式一致） |

---

## 十一、短網址與對外連結策略

### 11.1 人/機分工原則

| 用途 | 網址 |
|------|------|
| 給「人」用（分享、QR Code、文宣） | 短網址（`p-tu.cc`） |
| 機器對機器（主程式伺服器取回主題、一鍵安裝回寫） | 真網址（`script.google.com/.../exec`） |

### 11.2 GAS 支援路徑讀取（`e.pathInfo`）

- GAS Web App 官方支援 `e.pathInfo` = `/exec` 之後的路徑
- 短網址帶參數的「路徑式」方案：`p-tu.cc/.../gasTheme/ooxx` → `e.pathInfo = "gasTheme/ooxx"`，免 query string 困擾
- 轉址 type 建議 302

### 11.3 自有短網址服務現況（PHP-Pie tinyurl）

- 位置：`G:\我的雲端硬碟\workshop\開發區\PHP-Pie\tinyurl`（webroot 為 `G:\我的雲端硬碟\workshop\開發區\PHP-Pie`，根 `.htaccess` 有 catch-all 轉寫到 `/index.php`）
- **架構**：`p-tu.cc/CODE` → 轉發層（保留路徑、**丟棄 query**）→ `php-pie.net/tinyurl/dir/CODE` → `dir/CODE/index.php`（建立短碼時 `copy` 自 `index-tinyurl.php`）→ 查 DB 轉向（完整分析見 §8.4.1）
- **重要結論**：query 在轉發層就被丟棄，PHP 永遠收不到 → **query 式短網址不可能，路徑式（配 `e.pathInfo`）是唯一可行解**
- DB：MySQL（`url`、`record` 表）；含 GeoLite2 地理紀錄、toolbar、點擊紀錄

### 11.4 網址策略總結

| 場景 | 網址形式 |
|------|----------|
| 人逛市集首頁 | 短網址（無參數）`p-tu.cc/gasTheme`（匿名可用） |
| 人看特定主題 | 短網址 + 路徑式（`p-tu.cc/gasTheme/ooxx`，配 `e.pathInfo`）；⚠️ **僅限已登入 Google 的瀏覽器**（匿名存取 `/exec` 帶路徑會被導向登入頁，8/16 實測） |
| 機器一鍵安裝 / 伺服器取回 | **真網址 + query**：`{exec}?api=theme&id={ID}`（決策 #8 原案回歸；`MARKET_URL` 常數 = 部署 `/exec` 真網址，8/16 定案） |

> **8/16 重大修正**：pathInfo 路徑式在匿名存取下被 Google 導向登入頁（curl 實測 + Google 社群官方確認「pathInfo 不可用於生產匿名存取」），而自有短網址轉發層會丟棄 query——**兩條短網址機器路線皆死**；機器契約回歸決策 #8「機器對機器用真網址」+ query 參數（`?api=theme&id=`）。消費程式 `fetchRemoteThemeJson` 已改 `MARKET_URL + '?api=theme&id=' + encodeURIComponent(id)`（主程式 @246 / 模組 @49）。

---

## 十二、相關文件

| 文件 | 關係 |
|------|------|
| `模組程式開發架構與規格書.md` | 本協議已寫入該書（模組開發者共同遵守） |
| `數位校園GAS站主題市集/主題市集規劃書.md` | 主題市集（`market:` 來源） |
| `主程式開發架構與規格書.md` | 主程式總體架構 |

---

## 附錄 A：討論紀錄

### 115.08.15 討論（本文件）

- [x] 確認現況：主題紀錄在 localStorage，跨電腦不一致
- [x] 定案混合架構：帳號欄位為準 + localStorage 快取 + 系統預設後備
- [x] 定案「設定」工作表 `CSS主題ID` 欄位（admin 強制，空值不強制）——**工作表中已手動新增**
- [x] 定案成員名冊 3 身分工作表 `CSS主題ID` 欄位（用戶自訂，空值不套用）——**工作表中已手動新增**
- [x] 定案優先級：模組強制 > 主程式強制 > 用戶自訂 > localStorage > 系統預設
- [x] 定案「模組強制贏」管理哲學
- [x] 定案 token 協議不變，token 帶主程式已解析主題
- [x] 定案開放模組內主題切換（第一階段寫回模組名冊）
- [x] 定案每模組可各自強制不同主題（天然支援）
- [x] 本協議同步寫入 `模組程式開發架構與規格書.md`，供模組開發者共同遵守

### 115.08.15 下午討論（主題本體存取 + 短網址）

- [x] 定案**方案 A**（決策 #7）：帳號/強制欄位只收 `builtin:`／`market:`，市集為唯一本體倉庫；B/C（個人主題庫）列第二階段
- [x] 確認 GAS 伺服端取回可行性：`UrlFetchApp`，主程式 `appsscript.json` 已含 `script.external_request` 權限，免改權限
- [x] 定案**短網址人/機分工**（決策 #8）：短網址給人（分享/QR Code/文宣），機器對機器一律真網址
- [x] 確認 GAS 官方支援 `e.pathInfo`（`/exec` 後路徑可讀），短網址可用「路徑式」帶參數（302）
- [x] 發現自有 PHP 短網址（`PHP-Pie\tinyurl\dir\index-tinyurl.php`）轉址只帶存檔原網址，**query/額外路徑不會帶過去** → 修改方案寫入 §8.4，✅ 已完成（兩支檔案同步修改：剝離 code 的 query + 附加 `QUERY_STRING`）

### 115.08.15 晚間討論（短網址架構真相，實測驗證）

- [x] **實測證實架構**：`p-tu.cc/gas?theme=ooxx` 可轉向但 query 被丟；`p-tu.cc/tinyurl/dir/gas` 產生加倍路徑 → 確認轉發層（Squarespace 式）基址 = `php-pie.net/tinyurl/dir`，**保留路徑、丟棄 query**（§8.4.1）
- [x] **重大結論**：query 到不了 PHP → **query 式短網址在此架構下不可能**，路徑式（配 `e.pathInfo`）是唯一可行解
- [x] 確認使用者原始設計：每個短碼一個資料夾 `dir/{code}/index.php`（`shorten.php` 建立時 `copy` 自樣板）→ **樣板修改不影響既有短碼**，需伺服器端重複製（§8.4.3）
- [x] 樣板 `index-tinyurl.php` 與 `dir/HLGS/index.php` 已加入額外路徑轉傳（③ 附加 `$dir[4+]` 到目標）
- [x] 待辦①（伺服器端）：所有短碼資料夾 `index.php` 更新 + 根 `.htaccess` 轉寫規則上傳 → **實測通過**：`p-tu.cc/gas/ooxx` → `script.google.com/.../exec/ooxx`（`e.pathInfo="gas/ooxx"`）；**新增短碼亦實測通過**（`shorten.php` 自動複製新版樣板）
- [x] **含冒號的主題 ID 實測通過**：`p-tu.cc/gas/custom:bed5d50c-62ee-416e-b3df-40f80aca7671` → `.../exec/custom:bed5d50c-...`（`:` 在 URL 路徑為合法字元 RFC 3986，免編碼；禁區字元僅 `?`/`#`/`/`，ID 格式已排除）
- [x] 待辦②：`main.js` 實作 `fetchRemoteThemeJson`、市集 `doGet` 分流——**8/16 已完成**：機器契約改 `?api=theme&id=`（真網址），市集部署 v6 實測 200；pathInfo 路由僅保留供已登入瀏覽器（見 §11.4 修正）

### 115.08.16 討論（市集部署 + pathInfo 契約修正）

- [x] 市集（主題市集）試算表 + 綁定腳本建立（clasp create --type sheets），骨架部署 v1→v6：bootstrap 自動建 6 張工作表 + 內建範例主題 `market:test-0001`；公開端點實測：`?api=themes`（列表）、`?api=theme&id=`（純主題 JSON，200）、首頁（匿名 HTML）
- [x] **實測證實：匿名存取 `/exec` 帶路徑 → Google 強制導向登入頁**（curl 302 → accounts.google.com；Google 社群官方確認 pathInfo 不可用於生產匿名存取）
- [x] **定案取回契約**：機器一律真網址 + `?api=theme&id=`；主程式 `MARKET_URL`（main.js:1433）與模組（main.js:84）已改部署 `/exec` 真網址並部署（@246 / @49）；短網址僅供人瀏覽市集首頁
- [x] 市集端實作記錄：`serveThemeJson` 不存在/下架拋 Error（GAS 回 500）；日期欄位被 Sheets 轉 Date（`cellStr`）；工作表初始化競態安全（try/recheck）

### 115.08.15 實作與驗證紀錄（主程式精緻化 + 模組同步）

- [x] 主程式精緻化實作完成（部署 @229→@233）：`auth.js` sessionSign/sessionVerify 帶 `themeId`（向後相容）；`theme.html` 初始化改 `強制 > 帳號 > localStorage > 系統預設`＋全域注入；5 個 session 頁 head 注入 `GAS_USER_THEME/FORCED/DEFAULT`；登入四流程帶主題；`updateUserTheme` 防抖回寫名冊；`fetchRemoteThemeJson`（MARKET_URL 固定常數）
- [x] doGet 每頁**重讀名冊**為準（`_freshUserTheme`），session 內即時反映帳號欄位變更
- [x] `_signModuleUrls` 產生模組 token 時 cp.themeId 用重讀值（避免登入快照過期值）
- [x] 模組同步主程式實作（決策 #6 第二階段）：主程式公開端點 `doPost page=theme_sync`（簽章驗證＋格式白名單＋10 秒頻率限制）；模組 `updateUserTheme`＋`syncThemeToMain`（部署 自主學習 @39）
- [x] **實測通過**：登入後選擇主題正確寫入用戶 `CSS主題ID`；主程式→模組主題成功傳遞；模組內切換主題 → 回寫主程式名冊 → 切回主程式立即套用
- [x] **模組讀同一張獨立「成員名冊」試算表**（部署 主程式 @234、模組 @40）：主程式簽模組 token 時附帶「成員名冊雲端連結」，模組 `openById` 直接讀寫名冊 `CSS主題ID`（不再讀模組主試算表業務工作表）；模組「主題管理」超連結修正（改 JS 動態組 URL、跳脫問題移除，導向主程式公開頁 theme_manager，模組 @41）——**實測通過**
- [x] **修復主程式全域注入順序 bug**（部署 @240）：5 個 session 頁的 `GAS_USER_THEME/FORCED/DEFAULT` 注入原本在 `include('theme')` **之後**——theme.html 初始化 IIFE 先執行、全域永遠 undefined → 主程式 session 頁長期退化以 localStorage 為準、名冊欄位與強制主題形同虛設（模組 index.html 順序正確故不受影響）；已將注入移到 include 之前。**實測：主程式↔模組雙向主題傳遞全部通過**
- [ ] 剩餘：市集程式（主題市集）開發；~~`theme_manager/theme_create` 套用帳號主題（公開頁，暫維持 localStorage）~~ **已結案（115.08.16）**：此待辦實指市集公開頁，市集維持 localStorage 為準、`userTheme` 恆空，無需實作（見 §8.1-7）

### 115.08.16 討論（方案 B-lite 定案）

- [x] 討論「安裝清單」一致性：啟用主題（`CSS主題ID`）已全生態一致；安裝清單（`gasThemeInstalled`）是各網域各自的 localStorage，主程式與模組互不相通、換電腦也不跟
- [x] 定案**方案 B-lite**（§10.6）：名冊新增 `已安裝主題清單` 欄位（JSON 陣列字串，只收 `market:`，格式同 `gasThemeInstalled`），個人安裝清單伺服器化——**主程式、模組共用同一張名冊直接讀寫，安裝清單全生態一致**（不需 token 同步）
- [x] 容量評估：單格 50,000 字元、每筆約 100 字元 → 約 400 筆以上；實務 10~30 套無壓力；極端爆量再改「每主題一列」獨立工作表
- [x] 定案分工：`CSS主題ID`（啟用，已實作）與 `已安裝主題清單`（收藏，第二階段）兩欄獨立、互不影響
- [x] **已實作（115.08.16，主程式 @247 / 模組 @50）**：名冊 3 身分工作表已手動新增 `已安裝主題清單` 欄位；主程式 `main.js` 新增 `_readInstalledThemes`／`_writeInstalledThemesRow`／`updateInstalledThemes`（白名單只收 `market:`、上限 400 筆、單格 50,000 字元、10 秒防抖限流），doGet 與 OAuth callback 每頁重讀注入；5 個 session 頁注入 `window.GAS_INSTALLED_THEMES`；`theme.html` 初始化伺服端清單 + localStorage 合併（保留 custom:/imported: 本機筆）、install/uninstall 後 800ms 防抖回寫 market: 清單；模組同規則共用同一張名冊（§10.6.7 #1~#3、#5 完成）
- [x] **已實作（115.08.16，主程式 @250 / 模組 @52）**：① 粉紅泡泡/夕陽橙上架市集主題庫（`market:pinkbubble`／`market:sunset`，市集 utils.js `seedSampleThemesIfMissing` 缺則補、不覆寫，市集部署 @13，`api=themes` 驗證已上架）——原 theme_manager 寫死的 `EXAMPLE_THEMES` 陣列與「自訂主題」區塊已刪除，改為市集橫幅卡（方案 A「市集為唯一主題本體倉庫」正式落實）；② 市集取回快取雙層：瀏覽器 localStorage（首取後永久）+ 主程式/模組 CacheService 伺服端（`market_json_{id}`，TTL 6 小時）——每瀏覽器每主題首次調取 1 次，之後全數命中快取，市集 API 免費配額無壓力
- [ ] 待辦（市集平台完成後）：實測 `market:` 安裝/卸載跨裝置清單一致性；§10.6.7 #4 theme_manager 清單來源維持 localStorage（公開頁無 session，無法注入伺服端清單；session 頁抽屜已合併）

### 115.08.16 晚間討論（登入頁主題一致性）

- [x] 釐清「公開頁套用帳號主題」待辦：源自先前說明但未講清楚——實指**主題市集**（公開免登入、投稿才需登入）。市集規劃書 §2.3 已定案：市集公開頁 `userTheme` 恆空、維持 localStorage 為準 → **結案，無需實作**（§8.1-7）
- [x] 發現「登出後跳回預設」的真相：theme.html 初始化（:124）只 `setAttribute`、**不寫 localStorage**；帳號主題是伺服端注入、localStorage 從未被同步 → 登入頁（`forced || localStorage || default`）顯示預設 white，與帳號主題（black）跳變
- [x] 定案**方案 B**（§8.1-8）：session 頁初始化時，若 `userTheme` 有值且非強制 → 同步寫入 `localStorage.gasThemeActive`；登出後登入頁顯示帳號主題，消除跳變。**限制**：強制主題時不寫入（避免殘留強制值）；帳號無主題（空值）不覆寫（保留瀏覽器記憶）；共用電腦殘留前一使用者主題於登入頁——可接受（方案 A 已接受 localStorage 為快取）
- [x] **已實作（115.08.16）**：theme.html 初始化同步（§8.1-8）——主程式與模組的 theme.html 皆在 `tid` 解析後加 `if (userTheme && !forced) localStorage.setItem('gasThemeActive', userTheme)`；公開頁 `userTheme` 恆空 → 不作用，強制時不寫入，帳號空值不覆寫。待部署後實測「登入 black → 登出 → 登入頁仍 black」

### 115.08.16 討論（來源標籤與用戶說明）

- [x] 討論用戶困惑：`custom:`／`imported:` 本體只在創作者瀏覽器，伺服器取不到（§10.2），需讓用戶一眼看懂「內建/市集/自訂/匯入」的差別
- [x] 定案**來源標籤**（§10.7.1）：主題管理頁與抽屜清單每筆加來源徽章（內建/市集/自訂/匯入）
- [x] 定案**三處關鍵說明**（§10.7.2）：theme_create 按鈕旁（本機限定 + 投稿市集管道）、市集投稿頁（重新簽發 `market:`）、theme_manager 收合式說明
- [x] 定案**不另開「模組主題協議規格書」**：維持既有分工——`CSS主題細緻化規劃書.md` = 完整規劃（單一事實來源）；`模組程式開發架構與規格書.md` §8-1 = 模組開發者必須遵守的協議摘要；來源標籤屬 UI 規範寫入本規劃書 §10.7，模組規格書補一行引用
- [ ] 待辦：來源徽章與說明實作（§10.7.3）；模組規格書 §8-1 補「來源標籤一致」引用