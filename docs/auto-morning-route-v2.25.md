# Home Tracker v2.25 自動路線產生與驗證

已部署 Supabase Edge Function `home-route-planner`（JWT + `home_tracker_access` 授權、Edge Function Secrets）。
私人網站的每張房屋卡片有「自動產生早上去基隆路線」，需要先確認房屋實際入口地址，避免把社區或捷運站當住家。

## 環境與啟用
- 在 [Google Maps Platform](https://console.cloud.google.com/google/maps-apis/overview) 啟用 **Routes API** 並設定 API 計費、配額與金鑰限制。
- 將金鑰設定在 [Supabase Secrets](https://supabase.com/dashboard/project/uwvtcqdsmuldswqbxtjf/settings/functions)，名稱為 `GOOGLE_MAPS_ROUTES_API_KEY`。
- 如要 TDX 官方公車站序交叉核對，還需在 Supabase Secrets 設 `TDX_CLIENT_ID`、`TDX_CLIENT_SECRET`。
- 嚴禁把任何金鑰放在 GitHub、公開網頁、看屋備註或排程 Prompt；缺金鑰時系統會拒絕編造路線。

## 使用者流程
1. 登入私人 Home Tracker，選擇房屋按「自動產生早上去基隆路線」。
2. 確認可定位的住宅**出入口**地址，不接受只有建物名稱或旁邊捷運站代替。
3. 系統自動選擇下一個平日台灣時間 07:30 出發，請求 Google Routes API 的 TRANSIT 多路線資料。
4. 查看步行、候車、搭車和上下車站以及總預估時間；若有公車，嘗試 TDX 站牌順序比對。
5. 產生結果均為「預估待驗證」，不會直接通過 60 分鐘硬條件。只有已確認實際早班班次、候車、步行和轉乘證據的資料才可做正式合格判斷。

## 注意
- 目的地固定元大證券基隆孝二分公司入口（基隆市仁愛區孝二路86之5號），**只看早上上班去程，不查回程**。
- 全程 40 分鐘內理想，41–60 分鐘可接受，>60分鐘不符；沒有可靠班次和出入口資料一律待驗證。
- Google 與 TDX 結果可能是不同時間點的資訊；TDX 官方站序不等於當天指定站牌有班次，預估不能視為實測。
- Google 路線候選內容只暫存在目前開啟的瀏覽器頁面，不寫回加密保管庫或 GitHub，避免累積過期交通資訊並降低第三方內容儲存風險。
- 現有排程維持每天09:00搜尋房屋；路線 API 目前是已授權使用者在房屋卡片觸發，不是每天為每筆房屋自動呼叫雲端收費 API。
- 目前**未完成帶正式 Google Routes 及 TDX 金鑰的實際路線端到端驗收**。

## 供驗收測試
- 已確認台北市住宅入口地址，按鈕能取得路線並逐段展示。
- 沒有 Google API 金鑰，畫面顯示待設定，不產生虛假路線。
- 沒有 TDX 憑證，仍可查看 Google 預估，但公車站序不可視為獨立核實。
- 刷新頁面後暫存路線消失，私人的原始看屋紀錄與備註不受影響。
