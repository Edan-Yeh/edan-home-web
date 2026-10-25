'use strict';
/* v1.2 decision features; no network requests, browser-only data. */
const compareSelected = new Set();
const metricDefs = [
  ['ratingTransit','交通便利'],['ratingLight','採光通風'],
  ['ratingLayout','格局實用'],['ratingCondition','屋況整理']
];
const scoreRules = [
  ['預算不超過 2000 萬','price',20, item => Number(item.price)<=2000],
  ['至少兩房','rooms',10, item => Number(item.rooms)>=2],
  ['主建物至少 15 坪','area',15, item => Number(item.area)>=15],
  ['有電梯','elevator',10, item => item.elevator==='yes'],
  ['合法原始格局','layout',10, item => item.layout==='yes'],
  ['無潮濕漏水疑慮','humidity',10, item => item.humidity==='no'],
  ['無明顯噪音','noise',5, item => item.noise==='no']
];
const ratingWeight = 5; // 4 ratings × 5 points = 20; total 100
function getAssessment(item) {
  let points=0,maximum=0;
  const details=[];
  for(const [label,key,weight,accept] of scoreRules){
    const value=item[key];
    const known=value!==undefined&&value!==null&&value!=='';
    const ok=known?accept(item):null;
    if(known){maximum+=weight;if(ok)points+=weight}
    details.push({label,weight,known,ok,earned:ok?weight:0});
  }
  for(const [key,label] of metricDefs){
    const n=Number(item[key]);
    const known=item[key]!==undefined&&item[key]!==''&&Number.isInteger(n)&&n>=1&&n<=5;
    const earned=known?n:0;
    if(known){maximum+=ratingWeight;points+=earned}
    details.push({label,weight:ratingWeight,known,ok:known?true:null,earned});
  }
  return {points,maximum,details,completeness:Math.round(maximum)};
}
const mk=(tag,cls,txt)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(txt!==undefined)node.textContent=txt;return node};
const addLine=(root,title,value)=>{const row=mk('div','info-line'),label=mk('span','muted',title),v=mk('strong','',value||'待確認');row.append(label,v);root.append(row)};
function showDetails(item){
  const dlg=document.getElementById('detail-dialog'),body=document.getElementById('detail-body'),head=document.getElementById('detail-title');head.textContent=item.title;
  body.replaceChildren();
  const evaluation=getAssessment(item);
  const summary=mk('div','detail-summary');
  const result=mk('div','assessment-hero');
  result.append(mk('div','assessment-number',evaluation.points+' / 100'),mk('div','muted','已填條件計分，上限 '+evaluation.maximum+' 分；缺少的資料不加分'));
  summary.append(result);
  const grid=mk('div','info-grid');
  addLine(grid,'總價',item.price?Number(item.price).toLocaleString('zh-TW')+' 萬':'');
  addLine(grid,'主建坪數',item.area?item.area+' 坪':'');
  addLine(grid,'房數',item.rooms?item.rooms+' 房':'');
  addLine(grid,'看屋狀態',labels[item.status]||'待確認');
  addLine(grid,'通勤資訊',item.commute);
  addLine(grid,'更新時間',item.updated?new Date(item.updated).toLocaleString('zh-TW'):'');
  summary.append(grid);body.append(summary);
  const heading=mk('h4','','條件評估與評分明細');body.append(heading);
  const list=mk('div','score-breakdown');
  for(const d of evaluation.details){const line=mk('div','score-row'),name=mk('span','',d.label),val=mk('strong','',d.known?d.earned+' / '+d.weight:'待確認 · +0');line.append(name,val);list.append(line)}
  body.append(list, mk('h4','','看屋備註'));
  body.append(mk('p','full-note',item.note||'尚未填寫看屋備註'));
  if(item.url&&safeUrl(item.url)){const a=mk('a','detail-link','開啟原始物件網址 ↗');a.href=safeUrl(item.url);a.target='_blank';a.rel='noopener noreferrer';body.append(a)}
  document.getElementById('detail-edit').onclick=()=>{dlg.close();openEditor(item)};
  dlg.showModal();
}
function getComparisonItems(){return items.filter(x=>compareSelected.has(x.id)).slice(0,2)}
function renderComparison(){
  const selected=getComparisonItems(),bar=document.getElementById('compare-bar');
  for(const id of [...compareSelected])if(!items.some(x=>x.id===id))compareSelected.delete(id);
  const count=compareSelected.size;
  bar.classList.toggle('hidden',count===0);
  document.getElementById('compare-count').textContent='已選 '+count+' / 2 間房屋';
  document.getElementById('compare-open').disabled=count!==2;
  for(const card of document.querySelectorAll('.property')){
    const record=items.find(x=>x.id===card.dataset.propertyId);if(!record)continue;
    const foot=card.querySelector('.foot');
    if(!foot||foot.querySelector('.detail-btn'))continue;
    const detail=mk('button','btn small detail-btn','詳細資料');
    detail.type='button';detail.onclick=()=>showDetails(record);
    foot.prepend(detail);
    const choose=mk('label','compare-checkbox');
    const check=document.createElement('input');check.type='checkbox';check.checked=compareSelected.has(record.id);
    check.disabled=!check.checked&&count>=2;
    check.onchange=()=>{
      if(check.checked){if(compareSelected.size>=2){check.checked=false;return;}compareSelected.add(record.id)}
      else compareSelected.delete(record.id);
      renderComparison();
    };
    choose.append(check,document.createTextNode(' 加入比較'));
    foot.append(choose);
  }
  for(const card of document.querySelectorAll('.property')){
    const check=card.querySelector('.compare-checkbox input');
    if(!check)continue;
    check.checked=compareSelected.has(card.dataset.propertyId);
    check.disabled=!check.checked&&compareSelected.size>=2;
  }
}
function showComparison(){
  const chosen=getComparisonItems();
  if(chosen.length!==2)return;
  const dlg=document.getElementById('compare-dialog'),body=document.getElementById('compare-body');body.replaceChildren();
  const table=document.createElement('table');table.className='comparison-table';
  const rows=[
    ['房屋名稱',it=>it.title],
    ['決策評分',it=>{const s=getAssessment(it);return s.points+' / 100（已評 '+s.maximum+' 分）'}],
    ['總價',it=>it.price?Number(it.price).toLocaleString('zh-TW')+' 萬':'待確認'],
    ['主建物',it=>it.area?it.area+' 坪':'待確認'],
    ['房數',it=>it.rooms?it.rooms+' 房':'待確認'],
    ['看屋狀態',it=>labels[it.status]||'待確認'],
    ['電梯',it=>it.elevator==='yes'?'有':it.elevator==='no'?'無':'待確認'],
    ['格局',it=>it.layout==='yes'?'確認合法':it.layout==='no'?'有疑慮':'待確認'],
    ['濕氣',it=>it.humidity==='no'?'無明顯問題':it.humidity==='yes'?'有疑慮':'待確認'],
    ['噪音',it=>it.noise==='no'?'無明顯問題':it.noise==='yes'?'有疑慮':'待確認'],
    ['通勤',it=>it.commute||'待確認'],
    ...metricDefs.map(([key,label])=>[label,it=>it[key]?it[key]+' / 5':'未評分']),
    ['備註',it=>it.note||'尚未填寫']
  ];
  for(const [label,fn] of rows){const tr=document.createElement('tr'),th=mk('th','',label);tr.append(th);for(const item of chosen)tr.append(mk('td','',fn(item)));table.append(tr)}
  body.append(table);dlg.showModal();
}
const css=document.createElement('style');css.textContent=`
.compare-bar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;background:#eaf4f0;border:1px solid #b7dcd1;padding:12px 16px;border-radius:13px;margin-bottom:15px}
.compare-checkbox{font-size:12px;color:#426169;display:inline-flex;align-items:center;gap:5px;margin-left:auto}
.compare-checkbox input{accent-color:#127d74;width:17px;height:17px}
.detail-summary{display:grid;gap:18px}.assessment-hero{background:#eaf5f1;border-radius:13px;padding:16px}.assessment-number{font-size:29px;font-weight:800;color:#126f66}
.info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.info-line{display:flex;flex-direction:column;gap:4px;background:#f5f7f7;border-radius:10px;padding:12px;overflow-wrap:anywhere}.info-line strong{font-size:14px}
.score-breakdown{border:1px solid #e2e9e8;border-radius:12px;overflow:hidden}.score-row{display:flex;justify-content:space-between;gap:12px;padding:10px 13px;border-bottom:1px solid #ecf0ef;font-size:13px}.score-row:last-child{border-bottom:0}.score-row strong{white-space:nowrap}
.full-note{white-space:pre-wrap;overflow-wrap:anywhere;color:#536a71;line-height:1.7}.detail-link{color:#147b73}
.extra-ratings{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;padding-top:9px;border-top:1px solid #e5ece9}.extra-ratings h4{grid-column:1/-1;margin:0}.extra-ratings small{grid-column:1/-1;color:#637981}
.wide-dialog{width:min(850px,calc(100% - 24px))}.modal-scroll{padding:18px 24px;max-height:72vh;overflow:auto}.comparison-table{border-collapse:collapse;width:100%;table-layout:fixed}.comparison-table th,.comparison-table td{padding:11px 9px;text-align:left;border-bottom:1px solid #e4ebe9;vertical-align:top;overflow-wrap:anywhere}.comparison-table th{width:26%;color:#637981;font-size:12px}.comparison-table td{width:37%;font-size:13px}
@media(max-width:700px){.extra-ratings,.info-grid{grid-template-columns:1fr}.comparison-table th,.comparison-table td{padding:9px 5px;font-size:12px}.modal-scroll{padding:12px}}
`;document.head.append(css);
function addModal(id,title,wide=false){
 const dlg=document.createElement('dialog');dlg.id=id;if(wide)dlg.className='wide-dialog';
 const header=mk('div','modal-head');header.append(mk('h3','',title));const close=mk('button','btn small','✕');close.onclick=()=>dlg.close();close.setAttribute('aria-label','關閉');header.append(close);
 const body=mk('div','modal-scroll');body.id=id==='detail-dialog'?'detail-body':'compare-body';dlg.append(header,body);
 if(id==='detail-dialog'){const actions=mk('div','modal-actions'),btn=mk('button','btn primary','編輯這間房屋');btn.id='detail-edit';actions.append(btn);dlg.append(actions)}
 document.body.append(dlg);return dlg;
}
addModal('detail-dialog','房屋詳細資料',true);
const detailTitle=document.querySelector('#detail-dialog .modal-head h3');detailTitle.id='detail-title';
addModal('compare-dialog','雙屋比較',true);
const bar=mk('div','compare-bar hidden');bar.id='compare-bar';
bar.append(mk('strong','', '已選 0 / 2 間房屋'));
bar.firstChild.id='compare-count';
const actions=mk('div','actions'),open=mk('button','btn primary small','比較兩間房屋');open.id='compare-open';open.onclick=showComparison;
const clear=mk('button','btn small','清除選擇');clear.onclick=()=>{compareSelected.clear();renderComparison()};
actions.append(open,clear);bar.append(actions);document.getElementById('cards').before(bar);
const fields=mk('section','extra-ratings');fields.append(mk('h4','','主觀評分（選填）'));fields.append(mk('small','','1 分較差，5 分較好；沒有實際評估的項目請保持「尚未評分」，不會自動補分。'));
for(const [key,label] of metricDefs){const outer=mk('label','field',label),sel=document.createElement('select');sel.name=key;
 for(let score=0;score<=5;score++){const opt=document.createElement('option');opt.value=score?String(score):'';opt.textContent=score?score+' 分':'尚未評分';sel.append(opt)}
 outer.append(sel);fields.append(outer)}
document.querySelector('#property-form .form-grid').append(fields);
const oldOpenEditor=openEditor;openEditor=function(item){oldOpenEditor(item);const form=document.getElementById('property-form');for(const [key] of metricDefs)form.elements.namedItem(key).value=item?.[key]||''};
const form=document.getElementById('property-form'),oldSubmit=form.onsubmit;
form.onsubmit=async function(e){
 const submittedUrl=form.elements.namedItem('url').value.trim();
 if(!form.checkValidity()||(submittedUrl&&!safeUrl(submittedUrl))){return oldSubmit.call(form,e)}
 const scores={};for(const [key] of metricDefs)scores[key]=form.elements.namedItem(key).value;
 await oldSubmit.call(form,e);
 const saved=items.find(i=>i.id===editing)||items.find(i=>i.updated===items.map(v=>v.updated).sort().at(-1));
 if(saved){Object.assign(saved,scores);await persist();render()}
};
const oldRender=render;render=function(){oldRender();renderComparison()};

/* Optional starter records from previously shared listing links.
   These are unverified references, NOT live listings or current prices. */
const starterListings=[
 {title:'圓山超值電梯美宅',url:'https://buy.yungching.com.tw/house/7455107'},
 {title:'古亭邊間小資三房',url:'https://buy.yungching.com.tw/house/7014965'}
];
async function loadStarterListings(){
 const missing=starterListings.filter(source=>!items.some(existing=>existing.url&&safeUrl(existing.url)===safeUrl(source.url)));
 if(!missing.length){alert('這兩筆參考物件已在清單內。');return}
 if(!confirm('新增 '+missing.length+' 筆先前討論的房屋連結？資料尚未重新查證；不會填入價格、坪數或假設屋況，也不會刪除現有紀錄。'))return;
 const now=new Date().toISOString();
 for(const ref of missing)items.push({
   id:crypto.randomUUID(),title:ref.title,url:ref.url,
   price:'',area:'',rooms:'',status:'unseen',elevator:'',layout:'',humidity:'',noise:'',
   commute:'',note:'參考物件：尚未確認是否仍在售；價格、坪數、屋況與通勤待現場／來源核實。',
   updated:now
 });
 await persist();render();
}
const starterButton=mk('button','btn','＋ 匯入 2 筆參考物件');
starterButton.id='starter-listings';
starterButton.type='button';
starterButton.onclick=()=>loadStarterListings().catch(()=>alert('儲存失敗，請確認瀏覽器可用儲存空間。'));
document.querySelector('#dashboard .headline .actions').prepend(starterButton);

if(!document.getElementById('dashboard').classList.contains('hidden'))render();
