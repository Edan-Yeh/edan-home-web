# Home Tracker v2.26｜每日房源入口地址自動預檢

## 已完成
- Supabase `home_internal.route_preflight(address,evidence_url,verified_at)`：檢查住宅出入口地址、公開可核對來源、90天內查證日期是否具備。
- 每次原本的 `home_internal.refresh_feed()`（既有 Supabase 每小時第17分同步）會將每筆公開房源分成 `needs_entrance`、`needs_evidence`、`ready_for_api`，並寫入 `route_blockers`。不需增加或修改計費型 API 排程。
- 公開 `market.html` 每間房顯示預檢狀態與具體缺漏原因。
- 原每日09:00 ChatGPT 搜尋排程要求核實住宅實際入口，有可靠證據才加 `entrance` 欄位。
- 缺失來源時一律維持通勤待驗證，不能視為符合60分鐘硬條件。

## 公開 JSON 可選欄位
```json
"entrance": {
  "address": "臺北市已核實的住宅出入口門牌",
  "evidenceUrl": "https://經查證的正式來源網址",
  "verifiedAt": "YYYY-MM-DD"
}
```
這只是**格式範例**，沒有真實證據不可填入。地址和來源比對目前仍屬前置資料檢查，不代表完成街景或現場入口勘驗。

## 尚未實現
- Google Routes／TDX 金鑰的正式端到端驗收。
- 不經人操作、自動大量呼叫可能產生費用的 Google Routes API（需先確認有效金鑰、付費額度及錯誤停損）。
- 自動確定各站早上固定班次、轉乘時間可靠及門到門60分鐘符合；沒有獨立證據一律 `pending`。
- 手機瀏覽器的實機驗收。
