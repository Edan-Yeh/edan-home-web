# Home Tracker v2.28｜多房仲搜尋、每日發布驗收、發現率與研究分流

## 房仲來源
來源設定：`data/source-registry.json`。
既有永慶、591；新增信義房屋、住商不動產、樂屋網、台灣房屋等**研究搜尋來源**。新增來源必須取得真實原始單戶頁、核對合法原始兩房、電梯、主建至少 15 坪、屋況、早上赴基隆孝二分公司完整門到門時間等證據。來源清單加入不代表單戶已驗證。不要虛構單戶網址。

## 研究／合格分流
`data/research-listings.json`：研究發現（真實原始單戶頁 URL、來源、查核日期、待驗原因），可以記錄尚未核實通勤的房源及明確排除原因；人工排除不可重回正式推薦。
`data/weekly-listings.json`：維持既有房屋觀察資訊及來源時間，不等同「正式合格」。研究物件不得因價格和坪數符合就自動成為合格。
「正式合格」需有全部硬條件的完整證據，尤其平日早上從住宅實際入口到基隆市仁愛區孝二路86之5號入口，包含步行、候車、轉乘的實際可行交通，全部≤60分鐘。不查回程。

## 每日搜尋報告格式
`data/weekly-listings.json` 原本 `schema_version:1`、`generated_at`、`status:published`、`properties` 保留，新增選用 `discovery`：
```json
{
 "search_completed_at":"2026-11-10T09:00:00+08:00",
 "sources_checked":[
  {"id":"yungching","status":"checked","found":2},
  {"id":"591","status":"blocked","found":null}
 ],
 "counts":{"discovered":2,"duplicates":0,"research":2,"excluded":0,"formal_qualified":0},
 "source_breakdown":{"yungching":2},
 "exclusion_reasons":{"通勤資料尚未核實":2}
}
```
**以上只是格式示意，不是當日真實搜尋成果**。必須當天逐筆核實來源、統計與原因，才可將實際 `search_completed_at` 寫入；查不到的數字必須用 `null` 或省略，不能裝作0。重複刊登要有同戶身份證據才能算重複，不能只靠案名猜測。

## 三種驗收不可混為一談
1. 搜尋完成：必須有 `discovery.search_completed_at` 與實際來源紀錄；沒有就顯示未回報。
2. GitHub 發布完成：必須回寫 `data/weekly-listings.json` 並有當日 `generated_at`。發布不代表每筆在售狀態有當天查證。
3. Supabase 同步完成：版本與數量一致、時序正確。DB 每小時 :17 同步，新增的 `home_internal.check_publication()` 每小時 :47 記錄搜尋、發布、同步分別狀態於 `public.home_publication_audit`。

已回報的 `discovery` 數據由 `home_internal.refresh_feed()` 讀取到 `public.home_daily_discovery`，7 天記錄於公開 `market.html` 展示，45天內的發布審計也保存在資料庫。舊版沒有每日統計元資料的日子顯示「未回報」，絕對不補假0。

## 安全與相容性
- `home_daily_discovery`、`home_publication_audit` 為可公開閱讀但不能由匿名使用者改寫的資料表，RLS 已啟用；不存私人備註、帳密或 UID。
- 既有兩間房屋可維持公開研究觀察，仍需驗證住宅出入口和通勤。
- 擴充來源目前優先走獨立研究清單；如要把其他房仲單戶正式納入 Supabase 公開主清單，應先核對單戶 URL 格式再調整白名單，避免放寬網站來源驗證。
- 原每日房源排程 09:00 仍為唯一搜尋排程，沒有新建重複搜尋排程；新增的是每小時 :47 的發布審計。
