import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const SUPABASE_URL = 'https://bnnoikfcztusxjhazsir.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6sCyiDfRBH-tX4s-p1ubyQ_0LBECJ-Q';
const ADMIN_EMAIL = 'warmmcat@gmail.com';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (id) => document.getElementById(id);
let session = null;
let quiz = [];
let index = 0;
let answers = [];
let awaitingNext = false;

function show(view) {
  ['homeView','quizView','resultView','adminView'].forEach(id => $(id).classList.toggle('hidden', id !== view));
}

function isAdmin() { return session?.user?.email?.toLowerCase() === ADMIN_EMAIL; }

async function refreshSession() {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  $('authButton').textContent = session ? '登出' : 'Google 登入';
  $('accountName').textContent = session ? session.user.email : '訪客';
  $('accountStatus').textContent = session ? '已登入' : '尚未登入';
  document.querySelector('.account-avatar').textContent = session ? (session.user.email?.[0] || '我').toUpperCase() : '訪';
  $('startButton').textContent = session ? '開始測驗' : '登入後開始測驗';
  $('adminNav').classList.toggle('hidden', !isAdmin());
}

async function toggleAuth() {
  if (session) {
    await supabase.auth.signOut();
    session = null;
    show('homeView');
    await refreshSession();
    return;
  }
  const redirectTo = new URL('./', window.location.href).href;
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) $('accountStatus').textContent = `登入失敗：${error.message}`;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function startQuiz() {
  if (!session) return toggleAuth();
  const { data, error } = await supabase.from('questions').select('id,prompt,correct_answer,explanation').eq('is_active', true);
  if (error || !data?.length) {
    $('accountStatus').textContent = error ? `無法載入題庫：${error.message}` : '題庫目前沒有題目';
    return;
  }
  quiz = shuffle(data).slice(0, Math.min(10, data.length));
  index = 0; answers = []; awaitingNext = false;
  show('quizView'); renderQuestion();
}

function renderQuestion() {
  $('progressText').textContent = `第 ${index + 1} 題／共 ${quiz.length} 題`;
  $('progressBar').max = quiz.length; $('progressBar').value = index + 1;
  $('questionText').textContent = quiz[index].prompt;
  $('answerFeedback').classList.add('hidden');
  document.querySelectorAll('[data-answer]').forEach(button => {
    button.disabled = false;
    button.classList.remove('selected-answer', 'is-correct', 'is-wrong');
  });
}

function answerLabel(value) {
  return value ? '○ 正確' : '× 錯誤';
}

function chooseAnswer(value) {
  if (awaitingNext) return;
  const question = quiz[index];
  const isCorrect = value === question.correct_answer;
  answers.push(isCorrect);
  awaitingNext = true;

  document.querySelectorAll('[data-answer]').forEach(button => {
    const buttonValue = button.dataset.answer === 'true';
    button.disabled = true;
    if (buttonValue === value) button.classList.add('selected-answer');
    if (buttonValue === question.correct_answer) button.classList.add('is-correct');
    else if (buttonValue === value) button.classList.add('is-wrong');
  });

  $('feedbackIcon').textContent = isCorrect ? '✓' : '!';
  $('feedbackResult').textContent = isCorrect ? '答對了！' : '再想一想，這題答錯了';
  $('feedbackAnswer').textContent = `你的答案：${answerLabel(value)}｜正確答案：${answerLabel(question.correct_answer)}`;
  $('feedbackExplanation').textContent = question.explanation || '本題暫無解答說明。';
  $('answerFeedback').className = `answer-feedback ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`;
  $('nextButton').innerHTML = index === quiz.length - 1 ? '查看測驗結果 <span>→</span>' : '下一題 <span>→</span>';
  $('nextButton').focus();
}

async function finishQuiz() {
  const score = answers.filter(Boolean).length;
  const { error } = await supabase.from('quiz_attempts').insert({ user_id: session.user.id, score, max_score: quiz.length });
  $('scoreText').textContent = `${score}／${quiz.length} 分`;
  $('reviewList').replaceChildren(...quiz.map((q, i) => {
    const article = document.createElement('article');
    const title = document.createElement('b');
    title.textContent = `${answers[i] ? '答對' : '答錯'}｜${q.prompt}`;
    const answer = document.createElement('small');
    answer.textContent = `正確答案：${answerLabel(q.correct_answer)}`;
    const p = document.createElement('p'); p.textContent = q.explanation || '本題暫無解答說明。';
    article.append(title, answer, p); return article;
  }));
  if (error) $('scoreText').textContent += '（紀錄儲存失敗）';
  show('resultView');
}

async function nextQuestion() {
  if (!awaitingNext) return;
  awaitingNext = false;
  index += 1;
  if (index < quiz.length) return renderQuestion();
  await finishQuiz();
}

async function openAdmin() {
  if (!isAdmin()) return;
  show('adminView'); $('adminMessage').textContent = '載入中…';
  const [questions, attempts] = await Promise.all([
    supabase.from('questions').select('*').order('position'),
    supabase.from('quiz_attempts').select('id,score,max_score,completed_at,user_id').order('completed_at', { ascending: false }).limit(500)
  ]);
  if (questions.error || attempts.error) {
    $('adminMessage').textContent = `載入失敗：${questions.error?.message || attempts.error?.message}`; return;
  }
  $('adminMessage').textContent = `共 ${questions.data.length} 題；顯示最近 ${attempts.data.length} 筆完成紀錄。`;
  $('questionAdminList').replaceChildren(...questions.data.map(q => {
    const row = document.createElement('div'); row.className = 'admin-row';
    const text = document.createElement('span'); text.textContent = `${q.position}. ${q.prompt}`;
    const button = document.createElement('button'); button.className = 'button'; button.textContent = '修改'; button.onclick = () => editQuestion(q);
    row.append(text, button); return row;
  }));
  $('attemptList').replaceChildren(...attempts.data.map(a => {
    const row = document.createElement('div'); row.className = 'attempt-row';
    row.textContent = `${new Date(a.completed_at).toLocaleString('zh-TW')}｜${a.score}/${a.max_score}`; return row;
  }));
}

function editQuestion(q) {
  $('editId').value = q.id; $('editPrompt').value = q.prompt;
  $('editAnswer').value = String(q.correct_answer); $('editExplanation').value = q.explanation;
  $('editDialog').showModal();
}

async function saveQuestion(event) {
  event.preventDefault();
  const id = Number($('editId').value);
  const update = { prompt: $('editPrompt').value.trim(), correct_answer: $('editAnswer').value === 'true', explanation: $('editExplanation').value.trim() };
  const { error } = await supabase.from('questions').update(update).eq('id', id);
  if (error) { $('adminMessage').textContent = `儲存失敗：${error.message}`; return; }
  $('editDialog').close(); await openAdmin();
}

$('authButton').addEventListener('click', toggleAuth);
$('startButton').addEventListener('click', startQuiz);
$('retryButton').addEventListener('click', startQuiz);
$('nextButton').addEventListener('click', nextQuestion);
$('adminNav').addEventListener('click', openAdmin);
$('closeAdmin').addEventListener('click', () => show('homeView'));
$('studentNav').addEventListener('click', () => show('homeView'));
$('cancelEdit').addEventListener('click', () => $('editDialog').close());
$('editForm').addEventListener('submit', saveQuestion);
document.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => chooseAnswer(button.dataset.answer === 'true')));
supabase.auth.onAuthStateChange((_event, nextSession) => { session = nextSession; refreshSession(); });
await refreshSession();
