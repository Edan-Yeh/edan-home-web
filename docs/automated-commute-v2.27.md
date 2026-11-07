# Home Tracker v2.27｜每日全自動通勤規劃架構

## 自動執行流程
1. **每日 09:00** 原 ChatGPT 排程搜尋與更新房屋，來源是 GitHub `data/weekly-listings.json`。
2. **每小時 :17** Supabase 原 `home-public-feed-sync-hourly` 讀取已發布資料並檢查房源。
3. **每小時 :29** Supabase `home-route-queue-preflight-hourly` 自動檢查住宅入口地址及可信查核證據，更新 `public.home_route_queue`；缺入口者留 `needs_entrance`。
4. **每日 09:35（台北時間）** GitHub Actions `.github/workflows/commute-auto.yml` 呼叫 `home-route-auto-worker`。僅在啟用付費開關、設定雙端 Worker Token、Google API 金鑰及有可規劃房源時開始呼叫 Google Routes。
5. Worker 以 Supabase 內部授權呼叫既有 `home-route-planner`，自動產生 Google 早上去程候選方案，再用 TDX 查公車站序；不保存 Google 導航細節，只記錄執行結果和證據尚不完整的狀態。
6. `market.html` 顯示各房屋的地址缺漏、佇列狀態與最近自動查核時間。

## 自動收費安全鎖
- `public.home_route_worker_config.enabled` **預設 false**；未經授權不得調成 true。
- 每天最多 **3 次** Google 規劃請求，每次最多 **2 筆** 房屋；同一入口地址失敗最多再重試 1 次。失敗須等至少 24 小時，避免浪費配額。
- 佇列不存在已核實入口地址時，不可執行付費規劃。
- GitHub workflow 已使用固定 concurrency group，避免 GitHub Actions 同時重複執行。
- Worker 需長度至少 32 字元的獨立密鑰 `HOME_ROUTE_WORKER_TOKEN`。在 **GitHub Actions Secrets** 與 **Supabase Edge Function Secrets** 設定相同值。不要放在 repository、程式碼或 Prompt。
- Google Routes 需 Supabase Secrets：`GOOGLE_MAPS_ROUTES_API_KEY`；TDX 進一步查官方站序則需 `TDX_CLIENT_ID`、`TDX_CLIENT_SECRET`。請先在 Google Cloud 啟用 Routes API、Billing、配額與預算告警。

## 啟用前必要操作
1. 核實每間房的實際住宅出入口地址，以及可公開查證來源與日期；JSON 可以選用 `entrance.address`、`entrance.evidenceUrl`、`entrance.verifiedAt`，但不可猜測。
2. 登入 [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/uwvtcqdsmuldswqbxtjf/settings/functions) 設定上述 Token、Google 和 TDX 金鑰。
3. 到 [GitHub Actions Secrets](https://github.com/Edan-Yeh/edan-home-web/settings/secrets/actions) 加入同名 `HOME_ROUTE_WORKER_TOKEN`，值必須與 Supabase 相同。
4. 在 Supabase SQL Editor，**只有在確認 Google 計費及上限、也同意每日自動付費查詢後**，手動執行：
   ```sql
   update public.home_route_worker_config
   set enabled=true, updated_at=now()
   where id=1;
   ```
5. 可從 GitHub Actions 手動 `Run workflow` 驗收。若無密鑰、無地址、無 API 金鑰或 `enabled=false`，應顯示跳過，不產生付費請求。

## 執行狀態
- `needs_entrance`：缺實際住家入口或證據
- `ready`：資料達格式預檢門檻、等待 API
- `processing`：正在呼叫規劃 API
- `route_found_unverified`：產生路線候選，但尚未獨立證明平日指定站班次及 60 分鐘完整去程
- `no_route`：Google 未回傳指定時段的可解析路線
- `api_unavailable`、`error`：查詢未成功，24 小時後最多重試一次
- `paused`：系統設定或額度問題

## 重要界線
- **目前這是已部署的自動排程與安全閘門，不代表已成功啟用付費路線查詢**。尚需 Google、TDX 與 Worker Token 的正式設定及端到端查詢驗收。
- Google 預估行程、TDX 站序及即時 ETA 不能單獨證明平日固定站牌停靠與門到門 60 分鐘。要升級為正式合格，仍須有可靠上班時段班次／候車／步行／轉乘的完整佐證。
- 只看早上上班去程，終點固定元大證券基隆孝二分公司入口，回程不列硬條件。
- 已人工排除的萬美大廈不得重新納入。
- Google 路線結果不永久保留在公開或私人資料庫，以遵守地圖資料使用限制；若要再次查看細節，須在登入網站重新取得最新路線。
