/* Encrypted vault cloud synchronization. The server never receives plaintext notes or passwords. */
(()=>{
 const KEY='edan-home-vault-v1';
 const status=()=>document.getElementById('cloud-status');
 const display=(s,error=false)=>{const el=status();if(el){el.textContent=s;el.style.color=error?'#a6473b':'#226c61'}};
 let currentVersion=null, remoteCopy=null, syncedCipher=null, suspended=false,queue=Promise.resolve();
 const context=()=>{const auth=window.homeAuth;if(!auth?.authorized||!auth.userId)throw Error('尚未授權帳號');return auth};
 async function fetchRemote(){
  const {client,userId}=context();
  const {data,error}=await client.from('home_tracker_vaults').select('vault,version').eq('user_id',userId).maybeSingle();
  if(error)throw Error('無法取得雲端資料：'+error.message);
  return data||null;
 }
 const serialized=v=>JSON.stringify(v);
 function checkEnvelope(v){
  return v&&v.v===1&&typeof v.salt==='string'&&typeof v.iv==='string'&&typeof v.data==='string';
 }
 async function decryptPassword(ciphertext,password){
  const envelope=JSON.parse(ciphertext);
  if(!checkEnvelope(envelope))throw Error('雲端加密格式錯誤');
  const salt=Uint8Array.from(atob(envelope.salt),c=>c.charCodeAt(0));
  const iv=Uint8Array.from(atob(envelope.iv),c=>c.charCodeAt(0));
  const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['decrypt']);
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,Uint8Array.from(atob(envelope.data),c=>c.charCodeAt(0)));
  const rows=JSON.parse(new TextDecoder().decode(decrypted));
  if(!Array.isArray(rows)||!rows.every(row=>row&&typeof row.id==='string'&&typeof row.title==='string'&&typeof row.note==='string'))throw Error('雲端房屋資料格式不符');
  return rows;
 }
 async function prepareUnlock(password,hasLocal){
  if(!window.homeAuth?.authorized)return null;
  try{
   display('正在檢查雲端房屋資料…');
   const remote=await fetchRemote();
   if(!remote){
    currentVersion=null;remoteCopy=null;syncedCipher=null;
    display('雲端尚無資料，解鎖後會建立加密備份');
    return null;
   }
   currentVersion=remote.version;
   remoteCopy=serialized(remote.vault);
   if(!checkEnvelope(remote.vault))throw Error('雲端密文格式錯誤');
   const local=localStorage.getItem(KEY);
   if(local===remoteCopy){syncedCipher=local;display('本機與雲端已同步');return null;}
   // Confirm password can open remote before touching local data.
   await decryptPassword(remoteCopy,password);
   if(!hasLocal||confirm('偵測到本機與雲端房屋資料不同。\n按「確定」使用雲端版本（原本本機資料將保留至本次確認前，建議先備份）。\n按「取消」保留目前本機資料，不覆蓋雲端。')){
    // Keeping a one-time recovery copy is local-only (encrypted), never plaintext.
    if(local)sessionStorage.setItem('edan-home-pre-sync-recovery',local);
    localStorage.setItem(KEY,remoteCopy);
    syncedCipher=remoteCopy;
    display('已載入雲端加密資料');
    return remoteCopy;
   }
   syncedCipher=remoteCopy;
   display('保留本機版本；雲端未更動。使用「上傳本機」可明確覆蓋雲端。',true);
   suspended=true;
   return null;
  }catch(e){
   display('同步暫時無法使用：'+e.message,true);
   if(!hasLocal)throw e;
   suspended=true;
   return null;
  }
 }
 async function uploadCipher(cipher,force=false){
  const {client,userId}=context();
  const remote=await fetchRemote();
  if(remote){
   if(!force && currentVersion!==null && remote.version!==currentVersion)throw Error('雲端版本已由其他裝置修改，已停止上傳，避免覆蓋。');
   if(!force && currentVersion===null)throw Error('雲端已有資料，不能直接覆蓋。');
   const {data,error}=await client.from('home_tracker_vaults').update({vault:JSON.parse(cipher),version:remote.version+1,updated_at:new Date().toISOString()})
    .eq('user_id',userId).eq('version',remote.version).select('version').maybeSingle();
   if(error||!data)throw Error('上傳未成功，可能發生版本衝突。');
   currentVersion=data.version;
  }else{
   const {data,error}=await client.from('home_tracker_vaults').insert({user_id:userId,vault:JSON.parse(cipher)}).select('version').single();
   if(error||!data)throw Error('無法建立加密備份（可能有另一台裝置先上傳）。');
   currentVersion=data.version;
  }
  syncedCipher=cipher;remoteCopy=cipher;suspended=false;
  display('加密雲端備份已同步');
 }
 async function afterPersist(){
  if(!window.homeAuth?.authorized||suspended)return;
  const cipher=localStorage.getItem(KEY);
  queue=queue.catch(()=>{}).then(async()=>{
   if(!cipher||cipher===syncedCipher)return;
   try{display('正在同步加密資料…');await uploadCipher(cipher)}
   catch(e){suspended=true;display(e.message+'；請勿清除本機資料。',true)}
  });
  return queue;
 }
 async function afterUnlock(){
  if(!window.homeAuth?.authorized||suspended)return;
  const local=localStorage.getItem(KEY);
  // Never seed an empty vault into the cloud; an existing desktop may still hold real data.
  if(local&&!currentVersion&&Array.isArray(window.homeVaultRows?.())&&window.homeVaultRows().length>0)await afterPersist();
 }
 async function pushExplicit(){
  if(!window.homeAuth?.authorized)return alert('請先登入');
  if(!window.secretAccessible?.())return alert('請先解鎖本機房屋資料');
  if(!confirm('即將把本機加密房屋資料上傳。\n如果其他裝置有較新紀錄，可能被覆蓋。請先匯出 JSON 備份。確定繼續？'))return;
  try{await uploadCipher(localStorage.getItem(KEY),true);alert('本機加密資料已上傳。其他裝置重新解鎖後可取得。')}
  catch(e){display('上傳失敗：'+e.message,true);alert('上傳失敗：'+e.message)}
 }
 async function pullExplicit(){
  if(!window.homeAuth?.authorized)return alert('請先登入');
  if(!confirm('將切換為雲端版房屋資料。未同步的本機修改會被替換，建議先匯出備份。繼續？'))return;
  try{
   const remote=await fetchRemote();
   if(!remote)return alert('雲端尚無資料');
   sessionStorage.setItem('edan-home-pre-sync-recovery',localStorage.getItem(KEY)||'');
   localStorage.setItem(KEY,serialized(remote.vault));currentVersion=remote.version;remoteCopy=serialized(remote.vault);syncedCipher=remoteCopy;suspended=false;
   display('已下載雲端密文；請使用原本的資料密碼解鎖');
   if(typeof window.lockLocalVault==='function')window.lockLocalVault();
   else location.reload();
  }catch(e){display('下載失敗：'+e.message,true)}
 }
 window.homeCloud={prepareUnlock,afterUnlock,afterPersist,pushExplicit,pullExplicit};
})();
