import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
const SUPABASE_URL='https://uwvtcqdsmuldswqbxtjf.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_XfMTL7LnvCoTrJFtgNF0mw_qNxAiwAW';
// Remove any credentials left in URL by an earlier browser-native GET form submission.
// This cannot reverse historic exposure; affected passwords must be changed.
const currentUrl=new URL(location.href);
if(['password','confirm'].some(name=>currentUrl.searchParams.has(name))){
 for(const key of ['password','confirm','email'])currentUrl.searchParams.delete(key);
 history.replaceState(null,'',currentUrl.pathname+currentUrl.search+currentUrl.hash);
}
const client=createClient(SUPABASE_URL,PUBLISHABLE_KEY,{
 auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'pkce'}
});
const gate=document.getElementById('account-gate');
const message=document.getElementById('account-message');
const loginForm=document.getElementById('account-login');
const signupForm=document.getElementById('account-signup');
const recoveryForm=document.getElementById('account-recovery-form');
const logout=document.getElementById('account-logout');
const uidWrap=document.getElementById('account-uid-wrap');
let authorized=false, busy=false, recovering=false, checkVersion=0;
const redirectUrl=()=>location.origin+location.pathname;
function notify(text,error=false){message.textContent=text;message.classList.toggle('account-error',error)}
function lockLocal(){
 if(typeof secret!=='undefined')secret=null;
 if(typeof items!=='undefined')items=[];
 document.getElementById('dashboard').classList.add('hidden');
 document.getElementById('auth-screen').classList.remove('hidden');
 document.getElementById('lock-btn').classList.add('hidden');
 if(typeof refreshAuth==='function')refreshAuth();
}
function showMode(mode){
 loginForm.classList.toggle('hidden',mode!=='login');
 signupForm.classList.toggle('hidden',mode!=='signup');
 recoveryForm.classList.toggle('hidden',mode!=='recovery');
 document.getElementById('account-show-login').classList.toggle('primary',mode==='login');
 document.getElementById('account-show-signup').classList.toggle('primary',mode==='signup');
 document.querySelector('.account-tabs').classList.toggle('hidden',mode==='recovery');
 document.querySelector('.account-help').classList.toggle('hidden',mode==='recovery');
}
function deny(text){window.homeAuth=null;authorized=false;lockLocal();gate.classList.remove('hidden');logout.classList.add('hidden');notify(text,true)}
function enter(user){
 window.homeAuth={client,userId:user.id,authorized:true};
 uidWrap.classList.add('hidden');authorized=true;gate.classList.add('hidden');
 logout.classList.remove('hidden');
 document.getElementById('account-email').textContent=user.email||'已驗證帳號';
 notify('');
}
async function validate(){
 const version=++checkVersion;
 if(recovering)return;
 uidWrap.classList.add('hidden');
 const {data:{user},error}=await client.auth.getUser();
 if(version!==checkVersion||recovering)return;
 if(error||!user){authorized=false;lockLocal();gate.classList.remove('hidden');logout.classList.add('hidden');notify('請登入已有權限的帳號，或先完成註冊及信箱驗證。');return}
 if(!user.email_confirmed_at){deny('信箱尚未驗證，請檢查 Email 驗證連結。');return}
 const {data,error:dbError}=await client.from('home_tracker_access').select('user_id').eq('user_id',user.id).maybeSingle();
 if(version!==checkVersion||recovering)return;
 if(dbError){deny('無法確認房屋網站授權，請稍後再試。');return}
 if(!data){
  deny('帳號已登入，但未取得 Home Tracker 授權。請將下方 UID 提供管理員審核。');
  document.getElementById('account-uid').textContent=user.id;
  uidWrap.classList.remove('hidden');return;
 }
 enter(user);
}
async function runWithButton(button,work){
 if(busy)return;busy=true;button.disabled=true;
 try{await work()}catch{notify('暫時無法連線到驗證服務，請稍後再試。',true)}
 finally{button.disabled=false;busy=false}
}
document.getElementById('account-copy-uid').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(document.getElementById('account-uid').textContent);notify('UID 已複製，可提供管理員授權。')}
 catch{notify('無法複製，請手動選取 UID。',true)}
});
document.getElementById('account-show-login').addEventListener('click',()=>{showMode('login');notify('');});
document.getElementById('account-show-signup').addEventListener('click',()=>{showMode('signup');notify('新帳號需完成 Email 驗證，並獲管理員授權才能使用房屋網站。')});
loginForm.addEventListener('submit',async e=>{
 e.preventDefault();
 const button=loginForm.querySelector('button[type=submit]');
 await runWithButton(button,async()=>{
  const email=loginForm.elements.namedItem('email').value.trim();
  const password=loginForm.elements.namedItem('password').value;
  const {error}=await client.auth.signInWithPassword({email,password});
  loginForm.elements.namedItem('password').value='';
  if(error){notify('登入失敗，請確認 Email、密碼及驗證狀態。',true);return}
  await validate();
 });
});
signupForm.addEventListener('submit',async e=>{
 e.preventDefault();
 const button=signupForm.querySelector('button[type=submit]');
 await runWithButton(button,async()=>{
  const email=signupForm.elements.namedItem('email').value.trim();
  const password=signupForm.elements.namedItem('password').value;
  const confirm=signupForm.elements.namedItem('confirm').value;
  if(password.length<8||password!==confirm){notify('密碼至少 8 字元，且兩次密碼必須相同。',true);return}
  const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:redirectUrl()}});
  signupForm.elements.namedItem('password').value='';
  signupForm.elements.namedItem('confirm').value='';
  if(error){notify('註冊未完成：'+(error.message||'請稍後再試'),true);return}
  notify('註冊請求已送出。如有收到驗證信，請按信件連結完成驗證，再回來登入。註冊本身不會授予房屋網站權限。');
 });
});
document.getElementById('account-resend').addEventListener('click',async e=>{
 const button=e.currentTarget;
 await runWithButton(button,async()=>{
  const email=(signupForm.classList.contains('hidden')?loginForm:signupForm).elements.namedItem('email').value.trim();
  if(!email){notify('請先在 Email 欄位輸入信箱。',true);return}
  const {error}=await client.auth.resend({type:'signup',email,options:{emailRedirectTo:redirectUrl()}});
  notify(error?'無法重寄驗證信，請稍後再試或確認寄信額度。':'若此帳號需要驗證，系統將寄送驗證信。',!!error);
 });
});
document.getElementById('account-reset').addEventListener('click',async e=>{
 const button=e.currentTarget;
 await runWithButton(button,async()=>{
  const email=(signupForm.classList.contains('hidden')?loginForm:signupForm).elements.namedItem('email').value.trim();
  if(!email){notify('請先在 Email 欄位輸入信箱。',true);return}
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:redirectUrl()});
  notify(error?'重設信件寄送失敗，請確認設定或稍後再試。':'若帳號存在，系統會寄送重設密碼連結。',!!error);
 });
});
document.getElementById('account-update-password').addEventListener('click',async e=>{
 const button=e.currentTarget;
 await runWithButton(button,async()=>{
  if(!recovering){notify('請先透過 Email 重設連結進行密碼修改。',true);return}
  const password=document.getElementById('account-new-password').value;
  const confirm=document.getElementById('account-confirm-password').value;
  if(password.length<8||password!==confirm){notify('新密碼至少 8 字元，且兩次密碼必須一致。',true);return}
  const {error}=await client.auth.updateUser({password});
  if(error){notify('密碼更新失敗：'+(error.message||'請重試'),true);return}
  recovering=false;
  document.getElementById('account-new-password').value='';
  document.getElementById('account-confirm-password').value='';
  await client.auth.signOut();
  showMode('login');
  deny('密碼已更新，請使用新密碼重新登入。');
 });
});
logout.addEventListener('click',async()=>{
 window.homeAuth=null;
 checkVersion++;
 lockLocal();gate.classList.remove('hidden');logout.classList.add('hidden');
 const {error}=await client.auth.signOut();
 notify(error?'登出未完全成功，請重新整理並確認帳號狀態。':'已登出 Home Tracker。',!!error);
});
client.auth.onAuthStateChange((event)=>{
 if(event==='SIGNED_OUT'){checkVersion++;deny('請登入已授權的帳號。')}
 if(event==='PASSWORD_RECOVERY'){
  recovering=true;checkVersion++;
  lockLocal();gate.classList.remove('hidden');logout.classList.add('hidden');
  showMode('recovery');
  notify('已驗證重設連結。請設定新密碼，儲存後重新登入。');
 }
 if(event==='SIGNED_IN'&&!recovering){
  queueMicrotask(()=>{validate().catch(()=>deny('登入驗證失敗，請重新整理。'))});
 }
});
// Only permit submitting credentials after the JavaScript authentication handlers are installed.
for(const form of [loginForm,signupForm])form.querySelector('button[type="submit"]').disabled=false;
showMode('login');
validate().catch(()=>deny('登入驗證暫時無法使用，請重新整理。'));
