# Home Tracker v2.22｜TDX 站牌順序核對

## 目前已部署
- Supabase Edge Function：`home-tdx-stop-check`，JWT 驗證已開啟，只有登入帳號可以呼叫。
- 私人工作台：已具有 `commuteEvidence.segments` 的房屋，展開通勤路線即可按「向 TDX 核實站牌順序」。
- 只傳必要路線、上／下車站與交通類型，不傳私人備註或加密保管庫。
- 服務比對 TDX 官方 `StopOfRoute` 公路客運／市區公車資料，確認指定站牌是否在同一路線、同一方向且**上車站在下車站之前**。
- 設計上**永遠回傳 `timetable_verified:false, qualifies:false`**：站序核對不代表平日有班次，更不能取代完整60分鐘門到門計算。
- 尚未核實、API 異常、缺漏類型或缺憑證一律 fail closed，不推定路線正確。

## 啟用 TDX 正式查核
1. 在 [TDX](https://tdx.transportdata.tw/) 申請會員及 API 憑證 `Client ID`、`Client Secret`。
2. 開啟 [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/uwvtcqdsmuldswqbxtjf/settings/functions)，設定：
   - `TDX_CLIENT_ID`：Client ID
   - `TDX_CLIENT_SECRET`：Client Secret
3. 憑證只放在 Supabase Secrets。**不要放進 GitHub、公開網站、前端 localStorage、排程 Prompt 或本文件**。
4. 設定後，登入私人工作台，展開有路線證據的房屋，使用 TDX 按鈕核實站牌。
5. 若沒設定憑證，伺服器回應 `credentials_required`，網站保留「待驗證」。

## 路線欄位（在 commuteRoute.segments 的每段搭乘公車中）
```json
{
  "mode":"bus",
  "instruction":"搭乘官方已查核的路線",
  "minutes":20,
  "line":"1551",
  "boardStop":"實際站牌名稱",
  "alightStop":"實際站牌名稱",
  "busType":"intercity",
  "city":"",
  "evidenceUrl":"https://tdx.transportdata.tw/api-service/swagger"
}
```
以上為**欄位示意**，不是對 1551 班次、停靠站或時間的事實主張。市區公車請用 `busType:"city"`，`city` 填 `Taipei`／`NewTaipei`／`Keelung`。公路客運用 `busType:"intercity"`。沒有官方佐證時不得填假站名或猜測路線類型。

## TDX 官方 API 與來源
- Token：`https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token`
- 站序：`/api/basic/v2/Bus/StopOfRoute/InterCity/{RouteName}`
- 市區站序：`/api/basic/v2/Bus/StopOfRoute/City/{City}/{RouteName}`
- [TDX 官方 API 說明](https://tdx.transportdata.tw/api-service/swagger)
- [TDX 官方 SampleCode](https://github.com/tdxmotc/SampleCode)

## 還沒完成的部分
目前**還沒有**正式客運班次早上停靠時間核對；沒有取得路線入口地址時也不能準確算到站步行。下一階段要把 TDX 平日站站班表、Google Routes/替代步行查詢及分段候車時間接在同一個驗證流程上，並將結果安全地保存到資料庫。屆時才可能提升到「真正自動驗證」。
