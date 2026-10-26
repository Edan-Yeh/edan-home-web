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
const priorityChecks=[
 ['price','總價','先向仲介確認目前開價'],
 ['area','主建物坪數','確認權狀主建物，不含附屬建物'],
 ['rooms','房數','確認實際及合法房間數'],
 ['elevator','電梯','確認大樓有無電梯'],
 ['layout','合法格局','確認有無二次施工或違規隔間'],
 ['humidity','漏水／潮濕','確認壁癌、管線滲漏及潮濕'],
 ['noise','噪音','確認道路、鄰戶和樓上噪音'],
 ['commuteMinutes','基隆通勤分鐘數','記錄尖峰至元大證券基隆孝二分公司入口的門到門分鐘數']
];
function missingChecks(item){
 return priorityChecks.filter(([key])=>item[key]===null||item[key]===undefined||String(item[key]).trim()==='');
}
function editFromDialog(item,dialog){
 dialog.close();
 openEditor(item);
}
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
  result.append(mk('div','assessment-number',evaluation.maximum===0?'尚無評分':evaluation.points+' / 100'),mk('div','muted',evaluation.maximum===0?'尚未填寫評分條件；請先編輯房屋資料':'已確認的評分權重 '+evaluation.maximum+' / 100；待確認項目不加分'));
  summary.append(result);
  const grid=mk('div','info-grid');
  addLine(grid,'總價',item.price?Number(item.price).toLocaleString('zh-TW')+' 萬':'');
  addLine(grid,'主建坪數',item.area?item.area+' 坪':'');
  addLine(grid,'房數',item.rooms?item.rooms+' 房':'');
  addLine(grid,'看屋狀態',labels[item.status]||'待確認');
  addLine(grid,'通勤起點',item.commuteOrigin);addLine(grid,'基隆尖峰門到門',commuteLabel(item));addLine(grid,'時間來源',commuteSourceName(item));addLine(grid,'通勤查核日期',item.commuteVerifiedAt);addLine(grid,'與通勤基準比較',baselineComparison(item));addLine(grid,'通勤資訊',item.commute);
  addLine(grid,'更新時間',item.updated?new Date(item.updated).toLocaleString('zh-TW'):'');
  summary.append(grid);body.append(summary);
  const heading=mk('h4','','條件評估與評分明細');body.append(heading);
  const list=mk('div','score-breakdown');
  for(const d of evaluation.details){const line=mk('div','score-row'),name=mk('span','',d.label),val=mk('strong','',d.known?d.earned+' / '+d.weight:'待確認');line.append(name,val);list.append(line)}
  const missing=missingChecks(item);
  const checklist=mk('section','missing-box');
  checklist.append(mk('h4','','待補資料（'+missing.length+' 項）'));
  if(missing.length){
    const ul=mk('ul','missing-list');
    missing.forEach(([,label,tip])=>{const li=mk('li','');li.append(mk('strong','',label+'：'),document.createTextNode(tip));ul.append(li)});
    checklist.append(ul);
    const jump=mk('button','btn primary small','立即補齊');
    jump.onclick=()=>editFromDialog(item,dlg);
    checklist.append(jump);
  }else checklist.append(mk('p','muted','基本條件已填妥，可進一步確認物件真實性。'));
  body.append(checklist);
  body.append(list, mk('h4','','看屋備註'));
  body.append(mk('p','full-note',item.note||'尚未填寫看屋備註'));
  const travel=commuteRouteUrl(item);
  if(travel){const anchor=mk('a','detail-link','查詢基隆大眾運輸路線 ↗');anchor.href=travel;anchor.target='_blank';anchor.rel='noopener noreferrer';body.append(anchor)}
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
  const dlg=document.getElementById('compare-dialog'),body=document.getElementById('compare-body');
  body.replaceChildren();
  const assessment=chosen.map(getAssessment);
  const summary=mk('div','compare-summary');
  chosen.forEach((home,index)=>{
    const panel=mk('section','compare-home');
    panel.append(mk('h4','',home.title));
    const known=assessment[index].details.filter(d=>d.known).length;
    const score=assessment[index].maximum===0?'尚無評分':assessment[index].points+' / 100';
    panel.append(mk('strong','compare-home-score',score));
    panel.append(mk('div','muted','已確認 '+known+' / '+assessment[index].details.length+' 項評估條件'));
    const meter=mk('div','compare-meter');
    const filled=mk('span','');
    filled.style.width=(100*known/assessment[index].details.length)+'%';
    meter.append(filled);panel.append(meter);
    const pending=missingChecks(home);
    const pendingText=mk('div','muted','待補 '+pending.length+' 項基本資料');
    panel.append(pendingText);
    const editBtn=mk('button','btn small','編輯這間');
    editBtn.type='button';
    editBtn.onclick=()=>editFromDialog(home,dlg);
    panel.append(editBtn);
    summary.append(panel);
  });
  body.append(summary);
  const guidance=mk('p','muted','分數只計入已填條件。待確認不代表不符合，也不能直接據此排名。');
  const pendingBox=mk('details','missing-box');
  const combinedMissing=chosen.map(item=>({item,missing:missingChecks(item)}));
  const missingTotal=combinedMissing.reduce((sum,x)=>sum+x.missing.length,0);
  const pendingTitle=mk('summary','', '待補資料清單 · '+missingTotal+' 項（點擊展開）');
  pendingBox.append(pendingTitle);
  for(const {item,missing} of combinedMissing){
    const part=mk('section','pending-home');
    part.append(mk('strong','',item.title+' · '+missing.length+' 項'));
    if(missing.length){
      const list=mk('ul','missing-list');
      for(const [,label,tip] of missing)list.append(mk('li','',label+'：'+tip));
      part.append(list);
    }else part.append(mk('p','muted','基本評估欄位已填妥'));
    pendingBox.append(part);
  }
  body.append(pendingBox);
  body.append(guidance);
  const controls=mk('div','comparison-controls');
  const filterLabel=mk('label','difference-toggle');
  const filter=document.createElement('input');
  filter.type='checkbox';filter.id='diff-only';
  filterLabel.append(filter,document.createTextNode(' 只顯示差異'));
  const counter=mk('span','muted');
  controls.append(filterLabel,counter);body.append(controls);
  const groups=[
    {title:'價格與空間',rows:[
      ['總價',it=>it.price!==''&&it.price!=null?Number(it.price).toLocaleString('zh-TW')+' 萬':null],
      ['主建坪數',it=>it.area!==''&&it.area!=null?it.area+' 坪':null],
      ['房數',it=>it.rooms!==''&&it.rooms!=null?it.rooms+' 房':null]
    ]},
    {title:'格局與屋況',rows:[
      ['看屋狀態',it=>labels[it.status]||null],
      ['電梯',it=>it.elevator==='yes'?'有':it.elevator==='no'?'無':null],
      ['原始合法格局',it=>it.layout==='yes'?'確認合法':it.layout==='no'?'有疑慮':null],
      ['漏水／潮濕',it=>it.humidity==='no'?'無明顯問題':it.humidity==='yes'?'有疑慮':null],
      ['噪音',it=>it.noise==='no'?'無明顯問題':it.noise==='yes'?'有疑慮':null]
    ]},
    {title:'基隆通勤',rows:[
      ['通勤起點',it=>it.commuteOrigin||null],
      ['尖峰門到門（分鐘）',it=>it.commuteMinutes?it.commuteMinutes+' 分鐘':null],
      ['來源',it=>it.commuteSource?commuteSourceName(it):null],
      ['查核日期',it=>it.commuteVerifiedAt||null],
      ['相對南京三民／行天宮基準',it=>knownCommute(it)===null?null:baselineComparison(it)],
      ['交通方式',it=>({rail:'臺鐵＋轉乘',bus:'國道客運＋轉乘',mixed:'捷運＋臺鐵／客運',other:'其他大眾運輸'}[it.commuteMode]||null)],
      ['交通與通勤備註',it=>it.commute?.trim()||null]
    ]},
    {title:'主觀評價與決策',rows:[
      ...metricDefs.map(([key,label])=>[label,it=>it[key]?it[key]+' / 5':null]),
      ['看屋筆記',it=>it.note?.trim()||null]
    ]}
  ];
  const container=mk('div','compare-groups');body.append(container);
  function refresh(){
    container.replaceChildren();
    let visible=0,differences=0,incomplete=0;
    for(const group of groups){
      const section=mk('section','compare-group'),title=mk('h4','',group.title),table=document.createElement('table');
      table.className='comparison-table';
      let groupVisible=0;
      for(const [label,fn] of group.rows){
        const values=chosen.map(fn);
        const bothKnown=values.every(v=>v!==null&&v!==undefined&&v!=='');
        const differ=bothKnown&&values[0]!==values[1];
        const needsData=!bothKnown;
        if(differ)differences++;
        if(needsData)incomplete++;
        if(filter.checked&&!differ)continue;
        const tr=document.createElement('tr');
        if(differ)tr.className='has-difference';
        if(needsData)tr.className='needs-data';
        tr.append(mk('th','',label));
        values.forEach(value=>{
          const missing=value===null||value===undefined||value==='';
          tr.append(mk('td',missing?'missing-value':'',missing?'待確認':String(value)));
        });
        table.append(tr);
        groupVisible++;visible++;
      }
      if(groupVisible){section.append(title,table);container.append(section)}
    }
    counter.textContent=filter.checked?'已顯示 '+visible+' 項確定差異':'已確認差異 '+differences+' 項 · 待補資料 '+incomplete+' 項';
    if(!visible){
      const msg=mk('div','comparison-empty','目前沒有兩間都已確認且結果不同的欄位。請先補入價格、坪數及屋況等資料。');
      container.append(msg);
    }
  }
  filter.onchange=refresh;
  refresh();
  dlg.showModal();
}
const css=document.createElement('style');css.textContent=`
.form-grid{display:block!important;padding:0!important}
.form-section,.extra-ratings{display:block!important;padding:16px 24px;border-bottom:1px solid #e5ece9}
.form-section h4,.extra-ratings h4{font-size:15px;margin:0 0 13px;color:#24444a}
.form-section-grid,.extra-ratings{--cols:2}
.form-section-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.form-section-grid .wide{grid-column:1/-1}
.form-section-grid label{min-width:0}
.extra-ratings{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.extra-ratings h4,.extra-ratings small{grid-column:1/-1}
.editor-completion{padding:14px 24px;background:#f1f7f4;display:grid;grid-template-columns:1fr auto;gap:7px 12px;font-size:13px}
.editor-completion strong{color:#176e65}
.editor-meter{grid-column:1/-1;height:7px;background:#d9e7df;overflow:hidden;border-radius:20px}
.editor-meter span{display:block;height:100%;background:#18867a;transition:width .2s}
.editor-missing{grid-column:1/-1;color:#637872;line-height:1.6}
.editor-dirty{grid-column:1/-1;color:#a3663f;font-weight:650}
@media(max-width:650px){.form-section-grid,.extra-ratings{grid-template-columns:1fr!important}.form-section,.extra-ratings{padding:15px 17px}}

.missing-box{background:#fafbf9;border:1px solid #dfeae3;border-radius:12px;padding:15px;margin:14px 0}
.missing-box h4{margin:0 0 10px}.missing-box summary{cursor:pointer;font-weight:700;color:#356b60}
.missing-list{margin:10px 0;padding-left:20px;line-height:1.85;color:#4f6963;font-size:13px}
.pending-home{margin-top:14px;padding-top:12px;border-top:1px solid #e2eae4}
.compare-home .btn{margin-top:11px}

.compare-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px}
.compare-home{background:#f2f7f5;padding:15px;border-radius:13px;min-width:0}
.compare-home h4{margin:0 0 10px;overflow-wrap:anywhere;font-size:15px}
.compare-home-score{display:block;font-size:23px;color:#167c74;margin-bottom:5px}
.compare-meter{height:7px;border-radius:10px;background:#d9e5e0;overflow:hidden;margin-top:10px}
.compare-meter span{display:block;height:100%;background:#167d74}
.comparison-controls{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:16px 0;flex-wrap:wrap}
.difference-toggle{font-size:14px;font-weight:650;display:flex;align-items:center;gap:7px}
.difference-toggle input{accent-color:#127d74;width:17px;height:17px}
.compare-groups{display:grid;gap:18px}
.compare-group{border:1px solid #e1e9e6;border-radius:12px;overflow:hidden}
.compare-group h4{margin:0;padding:12px 14px;background:#f1f6f4;font-size:15px}
.compare-group .comparison-table{margin:0}
.compare-group .has-difference{background:#e9f6f1}
.compare-group .needs-data{background:#fdfcf9}
.compare-group .missing-value{color:#a27a49}
.comparison-empty{padding:22px;border:1px dashed #c7d6cf;border-radius:12px;color:#647c75;font-size:14px}

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

/* v1.6 editor UX. Do not store plaintext draft in browser storage. */
const editorDialog=document.getElementById('editor');
const editorForm=document.getElementById('property-form');
const formGrid=editorForm.querySelector('.form-grid');
const formSection=(title,fields)=>{
  const section=mk('section','form-section');
  section.append(mk('h4','',title));
  const inner=mk('div','form-section-grid');
  for(const name of fields){
    const control=editorForm.elements.namedItem(name);
    const label=control?.closest('label');
    if(label)inner.append(label);
  }
  section.append(inner);return section;
};
const groupDefinitions=[
 ['基本資訊',['title','price','area','rooms','listingStatus','status','url']],
 ['格局與屋況',['elevator','layout','humidity','noise']],
 ['交通與通勤',['commuteOrigin','commuteMinutes','commuteMode','commuteSource','commuteVerifiedAt','commute']],
 ['看屋備註',['note']]
];
const originalRatings=document.querySelector('.extra-ratings');
const sectionNodes=groupDefinitions.map(([title,names])=>formSection(title,names));
if(originalRatings) sectionNodes.push(originalRatings);
formGrid.replaceChildren(...sectionNodes);
const completionBanner=mk('div','editor-completion');
completionBanner.setAttribute('aria-live','polite');
formGrid.before(completionBanner);
const completionText=mk('span','','資料完整度');
const completionTrack=mk('div','editor-meter');
const completionFill=mk('span','');
completionTrack.append(completionFill);
const completionInfo=mk('strong','','0 / 8');
const missingText=mk('div','editor-missing','');
completionBanner.append(completionText,completionInfo,completionTrack,missingText);
function updateEditorCompletion(){
  const formObj={};
  for(const [key] of priorityChecks)formObj[key]=editorForm.elements.namedItem(key)?.value||'';
  const missing=missingChecks(formObj);
  const filled=priorityChecks.length-missing.length;
  completionInfo.textContent=filled+' / '+priorityChecks.length+' 項';
  completionFill.style.width=(filled/priorityChecks.length*100)+'%';
  missingText.textContent=missing.length?'待補：'+missing.map(([,label])=>label).join('、'):'基本評估資料已填齊（仍需核對來源）';
}
const dirtyHint=mk('span','editor-dirty','');
completionBanner.append(dirtyHint);
let editorDirty=false;
const previousOpenEditor=openEditor;
openEditor=function(item){
 previousOpenEditor(item);
 editorDirty=false;
 dirtyHint.textContent='';
 updateEditorCompletion();
};
editorForm.addEventListener('input',()=>{
 editorDirty=true;
 dirtyHint.textContent='● 尚未儲存的修改';
 updateEditorCompletion();
});
editorForm.addEventListener('change',()=>{
 editorDirty=true;
 dirtyHint.textContent='● 尚未儲存的修改';
 updateEditorCompletion();
});
function confirmDiscard(){
 return !editorDirty||confirm('尚有未儲存的修改，確定放棄嗎？');
}
for(const id of ['close-modal','cancel-modal']){
 document.getElementById(id).addEventListener('click',event=>{
  if(!confirmDiscard()){event.preventDefault();event.stopImmediatePropagation();}
 },true);
}
editorDialog.addEventListener('cancel',event=>{
 if(!confirmDiscard())event.preventDefault();
});
editorDialog.addEventListener('close',()=>{
 editorDirty=false;
 dirtyHint.textContent='';
});

const oldRender=render;render=function(){oldRender();renderComparison()};

if(!document.getElementById('dashboard').classList.contains('hidden'))render();
