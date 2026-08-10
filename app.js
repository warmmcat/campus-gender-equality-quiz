import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const SUPABASE_URL = 'https://bnnoikfcztusxjhazsir.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6sCyiDfRBH-tX4s-p1ubyQ_0LBECJ-Q';
const ADMIN_EMAIL = 'warmmcat@gmail.com';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
let session=null, quiz=[], index=0, answers=[], awaitingNext=false;
let allQuestions=[], monthlyAttempts=[], quizQuestionCount=10;

function show(view){ ['homeView','quizView','resultView','adminView'].forEach(id=>$(id).classList.toggle('hidden',id!==view)); }
function isAdmin(){ return session?.user?.email?.toLowerCase()===ADMIN_EMAIL; }
function setAdminMessage(message,type=''){ $('adminMessage').textContent=message; $('adminMessage').className=`status ${type}`; }
function escapeCsv(value){ const s=String(value??''); return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s; }
function localDate(date){ return new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Taipei'}).format(new Date(date)); }

async function refreshSession(){
  const {data}=await supabase.auth.getSession(); session=data.session;
  $('authButton').textContent=session?'登出':'Google 登入';
  $('accountName').textContent=session?session.user.email:'訪客';
  $('accountStatus').textContent=session?'已登入':'尚未登入';
  document.querySelector('.account-avatar').textContent=session?(session.user.email?.[0]||'我').toUpperCase():'訪';
  $('startButton').textContent=session?'開始測驗':'登入後開始測驗';
  $('adminNav').classList.toggle('hidden',!isAdmin());
}
async function toggleAuth(){
  if(session){ await supabase.auth.signOut(); session=null; show('homeView'); return refreshSession(); }
  const redirectTo=new URL('./',window.location.href).href;
  const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
  if(error) $('accountStatus').textContent=`登入失敗：${error.message}`;
}
function shuffle(items){ const copy=[...items]; for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];} return copy; }

async function loadQuizSettings(){
  const {data}=await supabase.from('site_settings').select('value').eq('key','quiz').maybeSingle();
  quizQuestionCount=Math.max(1,Number(data?.value?.questionCount)||10);
  const note=document.querySelector('.hero-actions>span');
  if(note) note.textContent=`${quizQuestionCount} 題 · 每次隨機抽題 · 作答後立即看解析`;
}
async function startQuiz(){
  if(!session) return toggleAuth();
  await loadQuizSettings();
  const {data,error}=await supabase.from('questions').select('id,prompt,correct_answer,explanation').eq('is_active',true);
  if(error||!data?.length){ $('accountStatus').textContent=error?`無法載入題庫：${error.message}`:'題庫目前沒有題目'; return; }
  quiz=shuffle(data).slice(0,Math.min(quizQuestionCount,data.length)); index=0; answers=[]; awaitingNext=false; show('quizView'); renderQuestion();
}
function renderQuestion(){
  $('progressText').textContent=`第 ${index+1} 題／共 ${quiz.length} 題`;
  $('progressBar').max=quiz.length; $('progressBar').value=index+1; $('questionText').textContent=quiz[index].prompt;
  $('answerFeedback').classList.add('hidden');
  document.querySelectorAll('[data-answer]').forEach(b=>{b.disabled=false;b.classList.remove('selected-answer','is-correct','is-wrong');});
}
const answerLabel=value=>value?'○ 正確':'× 錯誤';
function chooseAnswer(value){
  if(awaitingNext)return; const q=quiz[index], correct=value===q.correct_answer; answers.push(correct); awaitingNext=true;
  document.querySelectorAll('[data-answer]').forEach(b=>{const v=b.dataset.answer==='true';b.disabled=true;if(v===value)b.classList.add('selected-answer');if(v===q.correct_answer)b.classList.add('is-correct');else if(v===value)b.classList.add('is-wrong');});
  $('feedbackIcon').textContent=correct?'✓':'!'; $('feedbackResult').textContent=correct?'答對了！':'再想一想，這題答錯了';
  $('feedbackAnswer').textContent=`你的答案：${answerLabel(value)}｜正確答案：${answerLabel(q.correct_answer)}`;
  $('feedbackExplanation').textContent=q.explanation||'本題暫無解答說明。';
  $('answerFeedback').className=`answer-feedback ${correct?'feedback-correct':'feedback-wrong'}`;
  $('nextButton').innerHTML=index===quiz.length-1?'查看測驗結果 <span>→</span>':'下一題 <span>→</span>'; $('nextButton').focus();
}
async function finishQuiz(){
  const score=answers.filter(Boolean).length;
  const {error}=await supabase.from('quiz_attempts').insert({user_id:session.user.id,user_email:session.user.email.toLowerCase(),score,max_score:quiz.length});
  $('scoreText').textContent=`${score}／${quiz.length} 分`;
  $('reviewList').replaceChildren(...quiz.map((q,i)=>{const a=document.createElement('article'),b=document.createElement('b'),s=document.createElement('small'),p=document.createElement('p');b.textContent=`${answers[i]?'答對':'答錯'}｜${q.prompt}`;s.textContent=`正確答案：${answerLabel(q.correct_answer)}`;p.textContent=q.explanation||'本題暫無解答說明。';a.append(b,s,p);return a;}));
  if(error)$('scoreText').textContent+='（紀錄儲存失敗）'; show('resultView');
}
async function nextQuestion(){ if(!awaitingNext)return; awaitingNext=false; index++; if(index<quiz.length)return renderQuestion(); await finishQuiz(); }

function monthBounds(value){
  const [year,month]=value.split('-').map(Number);
  const start=new Date(Date.UTC(year,month-1,1)-8*3600000);
  const end=new Date(Date.UTC(year,month,1)-8*3600000);
  return {start:start.toISOString(),end:end.toISOString()};
}
function shiftMonth(delta){
  const [year,month]=$('recordMonth').value.split('-').map(Number); const d=new Date(year,month-1+delta,1);
  $('recordMonth').value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; loadAttempts();
}
async function loadAttempts(){
  const {start,end}=monthBounds($('recordMonth').value);
  const {data,error}=await supabase.from('quiz_attempts').select('id,score,max_score,completed_at,user_id,user_email').gte('completed_at',start).lt('completed_at',end).order('completed_at',{ascending:false});
  if(error){setAdminMessage(`紀錄載入失敗：${error.message}`,'error');return;}
  monthlyAttempts=data||[];
  $('attemptList').replaceChildren(...monthlyAttempts.map(a=>{const tr=document.createElement('tr');const pct=a.max_score?Math.round(a.score/a.max_score*100):0;[localDate(a.completed_at),a.user_email||`舊紀錄（${a.user_id.slice(0,8)}…）`,`${a.score}/${a.max_score}`,`${pct}%`].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});return tr;}));
  const average=monthlyAttempts.length?Math.round(monthlyAttempts.reduce((n,a)=>n+(a.max_score?a.score/a.max_score*100:0),0)/monthlyAttempts.length):0;
  $('recordSummary').textContent=`共 ${monthlyAttempts.length} 筆 · 平均正確率 ${average}%`;
  if(!monthlyAttempts.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.className='empty-cell';td.textContent='這個月份尚無作答紀錄';tr.append(td);$('attemptList').append(tr);}
}
function exportAttempts(){
  if(!monthlyAttempts.length){setAdminMessage('本月沒有可匯出的作答紀錄。','error');return;}
  const rows=[['完成時間（臺灣）','Google 帳號','使用者ID','得分','總題數','正確率'],...monthlyAttempts.map(a=>[localDate(a.completed_at),a.user_email||'',a.user_id,a.score,a.max_score,`${Math.round(a.score/a.max_score*100)}%`])];
  const csv='\ufeff'+rows.map(r=>r.map(escapeCsv).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); const a=document.createElement('a');a.href=url;a.download=`作答紀錄_${$('recordMonth').value}.csv`;a.click();URL.revokeObjectURL(url);
}
function renderQuestions(){
  const term=$('questionSearch').value.trim().toLowerCase(),status=$('questionStatus').value;
  const filtered=allQuestions.filter(q=>(status==='all'||(status==='active')===q.is_active)&&(!term||q.prompt.toLowerCase().includes(term)||(q.explanation||'').toLowerCase().includes(term)));
  $('questionSummary').textContent=`顯示 ${filtered.length}／${allQuestions.length} 題`;
  $('questionAdminList').replaceChildren(...filtered.map(q=>{const row=document.createElement('article');row.className=`question-admin-row ${q.is_active?'':'inactive'}`;
    const num=document.createElement('b');num.className='question-number';num.textContent=q.position;
    const copy=document.createElement('div');copy.className='question-copy';const title=document.createElement('strong');title.textContent=q.prompt;const meta=document.createElement('small');meta.textContent=`${answerLabel(q.correct_answer)} · ${q.is_active?'已啟用':'已停用'}`;const exp=document.createElement('p');exp.textContent=q.explanation||'尚無解答說明';copy.append(title,meta,exp);
    const actions=document.createElement('div');actions.className='row-actions';const edit=document.createElement('button');edit.className='button';edit.textContent='修改';edit.onclick=()=>editQuestion(q);const del=document.createElement('button');del.className='button danger';del.textContent='刪除';del.onclick=()=>deleteQuestion(q);actions.append(edit,del);row.append(num,copy,actions);return row;}));
  if(!filtered.length){const p=document.createElement('p');p.className='empty-cell';p.textContent='沒有符合條件的題目';$('questionAdminList').append(p);}
}
async function loadQuestions(){
  const {data,error}=await supabase.from('questions').select('*').order('position');
  if(error){setAdminMessage(`題庫載入失敗：${error.message}`,'error');return;} allQuestions=data||[];renderQuestions();
}
async function openAdmin(){
  if(!isAdmin())return; show('adminView');setAdminMessage('載入管理資料中…');
  const now=new Date();$('recordMonth').value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const {data,error}=await supabase.from('site_settings').select('value').eq('key','quiz').maybeSingle();
  if(error){setAdminMessage(`設定載入失敗：${error.message}`,'error');return;}
  $('questionCount').value=Number(data?.value?.questionCount)||10;
  await Promise.all([loadQuestions(),loadAttempts()]);setAdminMessage('管理資料已更新。','success');
}
async function saveSettings(e){
  e.preventDefault();const count=Number($('questionCount').value);const active=allQuestions.filter(q=>q.is_active).length;
  if(!Number.isInteger(count)||count<1||count>active){setAdminMessage(`題數請設定為 1 到 ${active}。`,'error');return;}
  const value={title:'大專性平知識大會考',questionCount:count};
  const {error}=await supabase.from('site_settings').upsert({key:'quiz',value,updated_at:new Date().toISOString()});
  if(error){setAdminMessage(`設定儲存失敗：${error.message}`,'error');return;}quizQuestionCount=count;await loadQuizSettings();setAdminMessage(`已設定每次隨機抽取 ${count} 題。`,'success');
}
function editQuestion(q=null){
  $('editDialogTitle').textContent=q?'修改題目':'新增題目';$('editId').value=q?.id||'';$('editPrompt').value=q?.prompt||'';$('editPosition').value=q?.position||(allQuestions.length?Math.max(...allQuestions.map(x=>x.position))+1:1);$('editAnswer').value=String(q?.correct_answer??true);$('editExplanation').value=q?.explanation||'';$('editActive').checked=q?.is_active??true;$('editDialog').showModal();
}
async function saveQuestion(e){
  e.preventDefault();const payload={position:Number($('editPosition').value),prompt:$('editPrompt').value.trim(),correct_answer:$('editAnswer').value==='true',explanation:$('editExplanation').value.trim(),is_active:$('editActive').checked,updated_at:new Date().toISOString()};
  const id=$('editId').value;let result;
  if(id)result=await supabase.from('questions').update(payload).eq('id',Number(id));
  else{const maxId=allQuestions.reduce((m,q)=>Math.max(m,Number(q.id)),0);result=await supabase.from('questions').insert({...payload,id:maxId+1});}
  if(result.error){setAdminMessage(`題目儲存失敗：${result.error.message}`,'error');return;}$('editDialog').close();await loadQuestions();setAdminMessage(id?'題目已更新。':'題目已新增。','success');
}
async function deleteQuestion(q){
  if(!confirm(`確定刪除第 ${q.position} 題？此動作無法復原。`))return;
  const {error}=await supabase.from('questions').delete().eq('id',q.id);if(error){setAdminMessage(`刪除失敗：${error.message}`,'error');return;}await loadQuestions();setAdminMessage('題目已刪除。','success');
}
function parseBoolean(value){
  const s=String(value??'').trim().toLowerCase();
  if(['true','1','○','o','yes','正確','對'].includes(s))return true;
  if(['false','0','×','x','no','錯誤','錯'].includes(s))return false;
  throw new Error(`無法辨識答案「${value}」`);
}
function field(row,names){for(const name of names){if(row[name]!==undefined&&row[name]!==null&&String(row[name]).trim()!=='')return row[name];}return '';}
async function importQuestions(){
  const file=$('questionFile').files[0];if(!file){setAdminMessage('請先選擇 Excel 或 CSV 檔案。','error');return;}
  try{
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=workbook.Sheets[workbook.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
    if(!rows.length)throw new Error('檔案中沒有資料');
    const startPosition=$('importMode').value==='append'&&allQuestions.length?Math.max(...allQuestions.map(q=>q.position))+1:1;
    const baseId=allQuestions.reduce((m,q)=>Math.max(m,Number(q.id)),0);
    const items=rows.map((row,i)=>({id:baseId+i+1,position:Number(field(row,['排序','順序','position']))||startPosition+i,prompt:String(field(row,['題目','題幹','prompt','question'])).trim(),correct_answer:parseBoolean(field(row,['答案','正確答案','correct_answer','answer'])),explanation:String(field(row,['解答說明','解析','說明','explanation'])).trim(),is_active:String(field(row,['啟用','is_active'])).trim()===''?true:parseBoolean(field(row,['啟用','is_active']))}));
    if(items.some(x=>!x.prompt))throw new Error('至少一列缺少題目內容');
    if($('importMode').value==='replace'){if(!confirm(`確定以檔案中的 ${items.length} 題取代目前全部 ${allQuestions.length} 題？此動作無法復原。`))return;const del=await supabase.from('questions').delete().gte('id',0);if(del.error)throw del.error;}
    const {error}=await supabase.from('questions').insert(items);if(error)throw error;await loadQuestions();$('questionFile').value='';setAdminMessage(`已成功匯入 ${items.length} 題。`,'success');
  }catch(error){setAdminMessage(`匯入失敗：${error.message}`,'error');}
}

$('authButton').addEventListener('click',toggleAuth);$('startButton').addEventListener('click',startQuiz);$('retryButton').addEventListener('click',startQuiz);$('nextButton').addEventListener('click',nextQuestion);
$('adminNav').addEventListener('click',openAdmin);$('closeAdmin').addEventListener('click',()=>show('homeView'));$('studentNav').addEventListener('click',()=>show('homeView'));
$('settingsForm').addEventListener('submit',saveSettings);$('recordMonth').addEventListener('change',loadAttempts);$('previousMonth').addEventListener('click',()=>shiftMonth(-1));$('nextMonth').addEventListener('click',()=>shiftMonth(1));$('exportCsv').addEventListener('click',exportAttempts);
$('questionSearch').addEventListener('input',renderQuestions);$('questionStatus').addEventListener('change',renderQuestions);$('addQuestion').addEventListener('click',()=>editQuestion());$('importQuestions').addEventListener('click',importQuestions);
$('cancelEdit').addEventListener('click',()=>$('editDialog').close());$('editForm').addEventListener('submit',saveQuestion);
document.querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>chooseAnswer(b.dataset.answer==='true')));
supabase.auth.onAuthStateChange((_event,next)=>{session=next;refreshSession();});await refreshSession();await loadQuizSettings();
