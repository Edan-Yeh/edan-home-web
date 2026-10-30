# Home Tracker v2.20｜早上上班通勤證據格式

目的地一律為 **元大證券基隆孝二分公司入口**，基隆市仁愛區孝二路86之5號。

## 判定
- 只評估平日早上 07:00–09:00 出發的去程，不檢查回程。
- 40 分鐘內理想；41–60 分鐘可接受；超過 60 分鐘排除。
- 沒有足夠路線、站牌及班次證據，標為 **待驗證**；不能視為正式合格候選。
- 從住家入口算到分公司入口：步行＋候車＋各段交通＋轉乘步行與候車＋最後步行。
- 每段分鐘數總和必須等於總分鐘數，不能猜測交通班次或站牌。

## JSON v1 可選欄位：commuteRoute
```json
{
  "origin": "經查核的住宅出入口地址",
  "destination": "基隆市仁愛區孝二路86之5號",
  "departureAt": "YYYY-MM-DDT07:30:00+08:00",
  "checkedAt": "YYYY-MM-DD",
  "totalMinutes": 45,
  "sourceUrl": "https://對應的路線資料來源",
  "segments": [
    {"mode":"walk","instruction":"從住宅入口走到已核實的站牌","minutes":5},
    {"mode":"wait","instruction":"在該站等候已核對的平日班次","minutes":8},
    {"mode":"bus","instruction":"搭已確認的客運班次往基隆","minutes":22,"line":"班車路線名稱","boardStop":"上車站牌","alightStop":"下車站牌","evidenceUrl":"https://官方路線或班次證據"},
    {"mode":"walk","instruction":"走到分公司入口","minutes":10}
  ]
}
```
**以上是格式範例，不代表有這條真實路線或班次。禁止將範例直接作為正式房源資料。**

## 證據來源
- [交通部 TDX 公車與軌道資料 API](https://tdx.transportdata.tw/api-service/swagger) — 查站牌、路線與平日班次，正式 API 需要 TDX 憑證。
- [Google Maps Routes API 公共運輸](https://developers.google.com/maps/documentation/routes/transit-route) — 可提供步行和分段公共運輸，但需授權 API 金鑰及可能產生費用。
- 客運業者及臺鐵官方時刻表可作為補充。

## 安全與驗證層級
資料庫函數 `home_internal.commute_route_status` 會檢查完整路線欄位、分段時間加總和來源連結。結果只代表 **documented（路線資料已填且格式完整）**，並不表示已經以官方 API 獨立核實站牌存在、班次停靠或尖峰延誤。正式合格需進一步取得交通來源的實際比對結果。

新資料沒有 commuteRoute 時，資料庫保持 `pending`，網站顯示「早上通勤待驗證」。人工排除與私人備註不得因每日排程覆寫。
