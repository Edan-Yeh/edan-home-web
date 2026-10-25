import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
const URL='https://uwvtcqdsmuldswqbxtjf.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_XfMTL7LnvCoTrJFtgNF0mw_qNxAiwAW';
const client=createClient(URL,PUBLISHABLE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'pkce'}});
const gate=document.getElementById('account-gate'),message=document.getElementById('account-message');
const loginForm=document.getElementById('account-login'),logout=document.getElementById('account-logout');
let authorized=false, busy=false;
function notify(text,error=false){message.textContent=text;message.classList.toggle('account-error',error);}
function lockLocal(){
 if(typeof secret!=='undefined')secret=null;
 if(typeof items!=='undefined')items=[];
 document.getElementById('dashboard').classList.add('hidden');
 document.getElementById('auth-screen').classList.remove('hidden');
 document.getElementById('lock-btn').classList.add('hidden');
 if(typeof refreshAuth==='function')refreshAuth();
}
function deny(text){authorized=false;lockLocal();gate.classList.remove('hidden');logout.classList.add('hidden');notify(text,true);}
function enter(user){
 authorized=true;gate.classList.add('hidden');
 logout.classList.remove('hidden');
 document.getElementById('account-email').textContent=user.email||'已驗證帳號';
 notify('');
}
async function validate(){
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user){authorized=false;gate.classList.remove('hidden');logout.classList.add('hidden');notify('請以 English Coach 既有帳號登入。');return;}
 if(!user.email_confirmed_at){deny('此帳號尚未完成信箱驗證。');return;}
 const {data,error:dbError}=await client.from('home_tracker_access').select('user_id').eq('user_id',user.id).maybeSingle();
 if(dbError){deny('無法確認房屋網站的帳號授權，請稍後再試。');return;}
 if(!data){deny('此帳號尚未獲得 Home Tracker 使用權限。請由管理員授權；不會開放給其他英文平台使用者。');return;}
 enter(user);
}
loginForm.addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;busy=true;
 const btn=loginForm.querySelector('button[type=submit]');btn.disabled=true;
 try{
  const email=loginForm.elements.namedItem('email').value.trim();
  const password=loginForm.elements.namedItem('password').value;
  const {error}=await client.auth.signInWithPassword({email,password});
  loginForm.elements.namedItem('password').value='';
  if(error){notify('登入失敗，請確認信箱、密碼及帳號驗證狀態。',true);return;}
  await validate();
 }catch{notify('登入服務暫時無法連線，請檢查網路後重試。',true)}
 finally{busy=false;btn.disabled=false}
});
logout.addEventListener('click',async()=>{
 lockLocal();gate.classList.remove('hidden');logout.classList.add('hidden');
 const {error}=await client.auth.signOut();
 notify(error?'登出時發生問題，請重試。':'已登出 Home Tracker。',!!error);
});
document.getElementById('account-reset').addEventListener('click',async()=>{
 const email=loginForm.elements.namedItem('email').value.trim();
 if(!email){notify('請先填寫登入 Email，再要求寄送重設連結。',true);return;}
 try{
  const redirectTo=location.origin+location.pathname;
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});
  notify(error?'暫時無法寄送重設連結；請確認 Supabase Redirect URLs 設定。':'如帳號存在，重設密碼信件將寄送至該信箱。',!!error);
 }catch{notify('寄送失敗，請稍後再試。',true)}
});
client.auth.onAuthStateChange((event,session)=>{
 if(event==='SIGNED_OUT'){deny('請登入已授權的帳號。')}
 if(event==='PASSWORD_RECOVERY'){
  const next=prompt('請輸入新的帳號密碼（至少 8 個字元）');
  if(next&&next.length>=8){
   queueMicrotask(async()=>{const {error}=await client.auth.updateUser({password:next});notify(error?'密碼變更失敗。':'密碼已更新，請重新登入。',!!error);});
  }
 }
});
validate().catch(()=>deny('驗證服務暫時無法使用，請重新整理。'));
