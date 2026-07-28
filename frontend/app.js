import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const MOCK_DREAMS = [
  {
    id: 'seed-1',
    text: '我在一座没有尽头的蓝色地铁站等车，广播反复念我的名字，站台广告牌却播放着我小时候的卧室。',
    emotion: '诡异',
    isPublic: true,
    author: '匿名 07',
    createdAt: '2026-07-07',
    userId: null
  },
  {
    id: 'seed-2',
    text: '雨后的窄巷里有一台红色自动售货机，里面卖的不是饮料，而是一瓶瓶封好的黄昏。发光的猫坐在机器顶部。',
    emotion: '科幻',
    isPublic: true,
    author: '匿名 19',
    createdAt: '2026-07-08',
    userId: null
  },
  {
    id: 'seed-3',
    text: '我和朋友在云层上开了一家早餐店，煎蛋会慢慢升空，顾客全是穿睡衣的星星。',
    emotion: '喜悦',
    isPublic: true,
    author: '匿名 33',
    createdAt: '2026-07-09',
    userId: null
  },
  {
    id: 'seed-4',
    text: '办公室漂浮在土星环旁边，所有电脑屏幕都变成星图，老板让我在宇宙日落前交一份不存在的报表。',
    emotion: '焦虑',
    isPublic: false,
    author: '我',
    createdAt: '2026-07-10',
    userId: 'mock-user'
  },
  {
    id: 'seed-5',
    text: '一座图书馆建在黑色海面上，每翻开一本书，远处就亮起一座灯塔，像有人在替我回忆。',
    emotion: '诡异',
    isPublic: true,
    author: '匿名 51',
    createdAt: '2026-07-11',
    userId: null
  }
];

const SUPABASE_URL = (window.DEJAVU_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (window.DEJAVU_SUPABASE_ANON_KEY || '').trim();
const HAS_SUPABASE_CONFIG = Boolean(
  SUPABASE_URL
    && SUPABASE_ANON_KEY
    && !SUPABASE_URL.includes('your-project-ref')
    && !SUPABASE_ANON_KEY.includes('your-anon-key')
);

const supabase = HAS_SUPABASE_CONFIG
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    })
  : null;

const dreams = [...MOCK_DREAMS];

const state = {
  activeView: 'journal',
  squareFilter: '全部',
  squareMode: 'public',
  selectedEmotion: '喜悦',
  emotions: ['喜悦', '焦虑', '诡异', '科幻'],
  session: null,
  user: null,
  pendingAuthEmail: '',
  nextOtpSendAt: 0,
  isLoadingDreams: false
};

const emotionMeta = {
  '喜悦': { icon: 'fa-regular fa-face-smile' },
  '焦虑': { icon: 'fa-solid fa-bolt' },
  '诡异': { icon: 'fa-solid fa-eye' },
  '科幻': { icon: 'fa-solid fa-rocket' },
  default: { icon: 'fa-solid fa-tag' }
};

const dom = {
  nav: document.querySelector('#mainNav'),
  routeButtons: document.querySelectorAll('[data-route]'),
  navButtons: document.querySelectorAll('.nav-button'),
  views: document.querySelectorAll('[data-view]'),
  dreamForm: document.querySelector('#dreamForm'),
  dreamText: document.querySelector('#dreamText'),
  charCount: document.querySelector('#charCount'),
  publicSwitch: document.querySelector('#publicSwitch'),
  emotionTrigger: document.querySelector('#emotionTrigger'),
  emotionMenu: document.querySelector('#emotionMenu'),
  emotionIcon: document.querySelector('#emotionIcon'),
  emotionList: document.querySelector('#emotionList'),
  customEmotionInput: document.querySelector('#customEmotionInput'),
  addEmotionButton: document.querySelector('#addEmotionButton'),
  searchForm: document.querySelector('#searchForm'),
  searchText: document.querySelector('#searchText'),
  searchResults: document.querySelector('#searchResults'),
  resultBrief: document.querySelector('#resultBrief'),
  squareModes: document.querySelector('#squareModes'),
  squareFilters: document.querySelector('#squareFilters'),
  squareList: document.querySelector('#squareList'),
  detailModal: document.querySelector('#detailModal'),
  modalMeta: document.querySelector('#modalMeta'),
  modalText: document.querySelector('#modalText'),
  modalFoot: document.querySelector('#modalFoot'),
  closeModal: document.querySelector('#closeModal'),
  template: document.querySelector('#dreamCardTemplate'),
  toast: document.querySelector('#toast'),
  vignette: document.querySelector('#softVignette'),
  accountButton: document.querySelector('#accountButton'),
  accountLabel: document.querySelector('#accountLabel'),
  authModal: document.querySelector('#authModal'),
  authClose: document.querySelector('#authClose'),
  authSetupPanel: document.querySelector('#authSetupPanel'),
  authLoginPanel: document.querySelector('#authLoginPanel'),
  authSignedInPanel: document.querySelector('#authSignedInPanel'),
  authForm: document.querySelector('#authForm'),
  authEmail: document.querySelector('#authEmail'),
  authOtp: document.querySelector('#authOtp'),
  authSubmit: document.querySelector('#authSubmit'),
  authSubmitLabel: document.querySelector('#authSubmitLabel'),
  authBackButton: document.querySelector('#authBackButton'),
  authMessage: document.querySelector('#authMessage'),
  authUser: document.querySelector('#authUser'),
  signOutButton: document.querySelector('#signOutButton')
};

syncViewportHeight();
init();

function syncViewportHeight() {
  const viewport = window.visualViewport;

  const updateHeight = () => {
    const height = viewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--viewport-height', `${Math.round(height)}px`);
  };

  updateHeight();
  window.addEventListener('resize', updateHeight, { passive: true });
  window.addEventListener('orientationchange', updateHeight, { passive: true });
  viewport?.addEventListener('resize', updateHeight, { passive: true });
  viewport?.addEventListener('scroll', updateHeight, { passive: true });
}

async function init() {
  bindEvents();
  syncEmotionCatalog();
  renderEmotionMenu();
  renderSquareFilters();
  renderAll();
  renderEmptySearch();
  startLofiBackground();
  renderAuthState();

  if (!supabase) {
    openAuthModal();
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showToast('登录状态读取失败');
    console.warn(error);
  }

  setSession(data?.session || null);
  await loadDreamsFromSupabase();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    setSession(session);
    await loadDreamsFromSupabase();
  });
}

function bindEvents() {
  dom.routeButtons.forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.route));
  });

  dom.dreamText.addEventListener('input', updateCharCount);
  dom.dreamForm.addEventListener('submit', handleDreamSubmit);
  dom.emotionTrigger.addEventListener('click', toggleEmotionMenu);
  dom.addEmotionButton.addEventListener('click', addCustomEmotion);
  dom.customEmotionInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCustomEmotion();
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.emotion-picker')) {
      closeEmotionMenu();
    }
  });

  dom.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch();
  });

  document.querySelectorAll('.quick-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      dom.searchText.value = chip.dataset.query;
      runSearch();
    });
  });

  dom.squareFilters.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-filter]');
    if (!chip) return;
    state.squareFilter = chip.dataset.filter;
    dom.squareFilters.querySelectorAll('[data-filter]').forEach((item) => {
      item.classList.toggle('active', item === chip);
    });
    renderSquare();
  });

  dom.squareModes.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-square-mode]');
    if (!chip) return;
    state.squareMode = chip.dataset.squareMode;
    dom.squareModes.querySelectorAll('[data-square-mode]').forEach((item) => {
      item.classList.toggle('active', item === chip);
    });
    renderSquare();
  });

  dom.closeModal.addEventListener('click', closeDetail);
  dom.detailModal.addEventListener('click', (event) => {
    if (event.target === dom.detailModal) closeDetail();
  });

  dom.accountButton.addEventListener('click', openAuthModal);
  dom.authClose.addEventListener('click', closeAuthModal);
  dom.authModal.addEventListener('click', (event) => {
    if (event.target === dom.authModal) closeAuthModal();
  });
  dom.authForm.addEventListener('submit', handleAuthSubmit);
  dom.authBackButton.addEventListener('click', resetAuthForm);
  dom.signOutButton.addEventListener('click', signOut);

  document.addEventListener('mousemove', (event) => {
    dom.vignette.style.setProperty('--mx', `${event.clientX}px`);
    dom.vignette.style.setProperty('--my', `${event.clientY}px`);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeEmotionMenu();
      closeDetail();
      closeAuthModal();
    }
  });

  document.addEventListener('pointermove', updateCardGlow);
}

function setView(viewName) {
  state.activeView = viewName;
  dom.nav.dataset.active = viewName;
  dom.navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.route === viewName);
  });
  dom.views.forEach((view) => {
    view.classList.toggle('active', view.dataset.view === viewName);
  });
}

function setSession(session) {
  state.session = session;
  state.user = session?.user || null;
  renderAuthState();
}

function renderAuthState() {
  const signedIn = Boolean(state.user);

  dom.accountLabel.textContent = signedIn ? getEmailName(state.user.email) : (HAS_SUPABASE_CONFIG ? '登录' : '配置');
  dom.accountButton.querySelector('i').className = signedIn ? 'fa-regular fa-circle-check' : 'fa-regular fa-user';

  dom.authSetupPanel.classList.toggle('hidden', HAS_SUPABASE_CONFIG);
  dom.authLoginPanel.classList.toggle('hidden', !HAS_SUPABASE_CONFIG || signedIn);
  dom.authSignedInPanel.classList.toggle('hidden', !HAS_SUPABASE_CONFIG || !signedIn);

  if (signedIn) {
    dom.authUser.textContent = state.user.email || '已登录';
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  if (!supabase) {
    setAuthMessage('先在 frontend/config.js 填入 Supabase 配置。', true);
    return;
  }

  const email = dom.authEmail.value.trim();
  if (!email) return;

  if (state.pendingAuthEmail) {
    await verifyEmailOtp(email);
    return;
  }

  await sendEmailOtp(email);
}

async function sendEmailOtp(email) {
  const waitSeconds = Math.ceil((state.nextOtpSendAt - Date.now()) / 1000);
  if (waitSeconds > 0) {
    setAuthMessage(`发送太频繁了，${waitSeconds} 秒后再试。`, true);
    return;
  }

  dom.authSubmit.disabled = true;
  setAuthMessage('正在发送验证码...');

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true
    }
  });

  dom.authSubmit.disabled = false;

  if (error) {
    state.nextOtpSendAt = Date.now() + 60_000;
    console.warn('Supabase OTP send failed:', error);
    setAuthMessage(formatAuthError(error, 'send'), true);
    return;
  }

  state.nextOtpSendAt = Date.now() + 60_000;
  state.pendingAuthEmail = email;
  dom.authEmail.disabled = true;
  dom.authOtp.classList.remove('hidden');
  dom.authOtp.required = true;
  dom.authOtp.value = '';
  dom.authOtp.focus();
  dom.authSubmitLabel.textContent = '验证并登录';
  dom.authBackButton.classList.remove('hidden');
  setAuthMessage('验证码已经发到邮箱。复制 6 位数字填在这里。若邮件只有链接，请把 Supabase 邮件模板改成 Token。');
}

async function verifyEmailOtp(email) {
  const token = dom.authOtp.value.trim().replace(/\s+/g, '');
  if (token.length < 6) {
    setAuthMessage('请输入 6 位验证码。', true);
    dom.authOtp.focus();
    return;
  }

  dom.authSubmit.disabled = true;
  setAuthMessage('正在验证...');

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email'
  });

  dom.authSubmit.disabled = false;

  if (error) {
    console.warn('Supabase OTP verify failed:', error);
    setAuthMessage(formatAuthError(error, 'verify'), true);
    return;
  }

  setSession(data?.session || null);
  resetAuthForm();
  closeAuthModal();
  showToast('已登录');
  await loadDreamsFromSupabase();
}

function resetAuthForm() {
  state.pendingAuthEmail = '';
  dom.authEmail.disabled = false;
  dom.authOtp.value = '';
  dom.authOtp.required = false;
  dom.authOtp.classList.add('hidden');
  dom.authSubmit.disabled = false;
  dom.authSubmitLabel.textContent = '发送邮箱验证码';
  dom.authBackButton.classList.add('hidden');
  setAuthMessage('');
}

async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    showToast('退出失败');
    return;
  }
  setSession(null);
  resetAuthForm();
  closeAuthModal();
  showToast('已退出');
}

function formatAuthError(error, action) {
  const rawMessage = getErrorMessage(error);
  const normalized = rawMessage.toLowerCase();

  if (/rate limit|over_email_send_rate_limit|too many|email rate/i.test(rawMessage)) {
    return '验证码发送太频繁。先等一会儿；如果一直出现，需要在 Supabase 配置自定义 SMTP。';
  }

  if (action === 'send' && /smtp|mail|email|send|provider|relay|resend|535|550|554/i.test(rawMessage)) {
    return '验证码邮件发送失败。请检查 Supabase SMTP 配置、Resend API Key 和 bluer.site 的 DNS 验证状态。';
  }

  if (action === 'verify' && /expired|invalid|token|otp/i.test(rawMessage)) {
    return '验证码不正确或已过期，请重新发送。';
  }

  if (rawMessage && rawMessage !== '{}' && normalized !== '[object object]' && !normalized.includes('undefined')) {
    return rawMessage;
  }

  return action === 'send'
    ? '验证码发送失败。常见原因是 SMTP 还没配置好、Resend 域名仍在 Pending，或 Supabase 邮件限流尚未恢复。'
    : '验证码验证失败，请确认邮箱和 6 位验证码是否正确。';
}

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error.trim();

  const candidates = [
    error.message,
    error.error_description,
    error.error,
    error.name,
    error.code,
    error.status ? `HTTP ${error.status}` : ''
  ];

  const directMessage = candidates.find((item) => typeof item === 'string' && item.trim());
  if (directMessage) return directMessage.trim();

  try {
    return JSON.stringify(error);
  } catch (_jsonError) {
    return '';
  }
}

function setAuthMessage(message, isError = false) {
  dom.authMessage.textContent = message;
  dom.authMessage.classList.toggle('error', isError);
}

function openAuthModal() {
  dom.authModal.classList.add('open');
  dom.authModal.setAttribute('aria-hidden', 'false');
}

function closeAuthModal() {
  dom.authModal.classList.remove('open');
  dom.authModal.setAttribute('aria-hidden', 'true');
}

function toggleEmotionMenu() {
  const isOpen = dom.emotionMenu.classList.toggle('open');
  dom.emotionTrigger.setAttribute('aria-expanded', String(isOpen));
}

function closeEmotionMenu() {
  dom.emotionMenu.classList.remove('open');
  dom.emotionTrigger.setAttribute('aria-expanded', 'false');
}

function setEmotion(emotion) {
  state.selectedEmotion = emotion;
  const meta = getEmotionMeta(emotion);
  dom.emotionIcon.className = meta.icon;
  dom.emotionTrigger.setAttribute('aria-label', `当前标签：${emotion}`);
  dom.emotionList.querySelectorAll('.emotion-item').forEach((item) => {
    const active = item.dataset.emotion === emotion;
    item.classList.toggle('active', active);
    item.querySelector('.fa-check').classList.toggle('opacity-0', !active);
  });
}

function syncEmotionCatalog() {
  dreams.forEach((dream) => {
    if (!state.emotions.includes(dream.emotion)) {
      state.emotions.push(dream.emotion);
    }
  });
}

function getEmotionMeta(emotion) {
  return emotionMeta[emotion] || emotionMeta.default;
}

function renderEmotionMenu() {
  dom.emotionList.innerHTML = '';
  state.emotions.forEach((emotion) => {
    const meta = getEmotionMeta(emotion);
    const item = document.createElement('button');
    item.className = `emotion-item${emotion === state.selectedEmotion ? ' active' : ''}`;
    item.type = 'button';
    item.dataset.emotion = emotion;
    item.innerHTML = `
      <span><i class="${meta.icon} mr-2"></i>${escapeHtml(emotion)}</span>
      <i class="fa-solid fa-check text-[11px]${emotion === state.selectedEmotion ? '' : ' opacity-0'}"></i>
    `;
    item.addEventListener('click', () => {
      setEmotion(emotion);
      closeEmotionMenu();
    });
    dom.emotionList.appendChild(item);
  });
  setEmotion(state.selectedEmotion);
}

function addCustomEmotion() {
  const emotion = dom.customEmotionInput.value.trim().slice(0, 8);
  if (!emotion) {
    dom.customEmotionInput.focus();
    return;
  }

  if (!state.emotions.includes(emotion)) {
    state.emotions.push(emotion);
  }

  dom.customEmotionInput.value = '';
  renderEmotionMenu();
  renderSquareFilters();
  setEmotion(emotion);
  showToast('已添加标签');
}

function handleDreamSubmit(event) {
  event.preventDefault();
  if (dom.dreamForm.classList.contains('tearing')) return;

  const text = dom.dreamText.value.trim();
  const emotion = state.selectedEmotion;
  const isPublic = dom.publicSwitch.checked;

  if (text.length < 8) {
    showToast('再多写一点');
    dom.dreamText.focus();
    return;
  }

  if (!supabase) {
    openAuthModal();
    showToast('先连接 Supabase');
    return;
  }

  if (!state.user) {
    openAuthModal();
    showToast('登录后才能保存');
    return;
  }

  closeEmotionMenu();
  dom.dreamForm.classList.remove('fresh-note');
  dom.dreamForm.classList.add('tearing');

  window.setTimeout(async () => {
    try {
      const savedDream = await saveDreamToSupabase({ text, emotion, isPublic });
      dreams.unshift(savedDream);

      dom.dreamText.value = '';
      dom.publicSwitch.checked = false;
      updateCharCount();
      renderAll();

      dom.dreamForm.classList.remove('tearing');
      dom.dreamForm.classList.add('fresh-note');
      window.setTimeout(() => dom.dreamForm.classList.remove('fresh-note'), 520);
      showToast(isPublic ? '已保存并公开' : '已保存');
    } catch (error) {
      console.warn(error);
      dom.dreamForm.classList.remove('tearing');
      showToast('保存失败，请检查数据库策略');
    }
  }, 780);
}

function updateCharCount() {
  dom.charCount.textContent = dom.dreamText.value.trim().length;
}

function renderAll() {
  syncEmotionCatalog();
  renderSquareFilters();
  renderSquare();
}

async function loadDreamsFromSupabase() {
  if (!supabase || state.isLoadingDreams) return;

  state.isLoadingDreams = true;
  const { data, error } = await supabase
    .from('dreams')
    .select('id,text,emotion,is_public,author,created_at,user_id')
    .order('created_at', { ascending: false })
    .limit(120);

  state.isLoadingDreams = false;

  if (error) {
    console.warn(error);
    showToast('读取失败，请检查 RLS 策略');
    return;
  }

  replaceDreams((data || []).map(rowToDream));
  renderAll();
  if (dom.searchText.value.trim()) {
    runSearch();
  }
}

async function saveDreamToSupabase(dream) {
  const row = {
    text: dream.text,
    emotion: dream.emotion,
    is_public: dream.isPublic,
    author: state.user.email || '我',
    user_id: state.user.id
  };

  const { data, error } = await supabase
    .from('dreams')
    .insert(row)
    .select('id,text,emotion,is_public,author,created_at,user_id')
    .single();

  if (error) {
    throw error;
  }

  return rowToDream(data);
}

function rowToDream(row) {
  return {
    id: String(row.id),
    text: row.text,
    emotion: row.emotion || '喜悦',
    isPublic: Boolean(row.is_public),
    author: row.author || '匿名',
    createdAt: String(row.created_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    userId: row.user_id || null
  };
}

function replaceDreams(nextDreams) {
  dreams.splice(0, dreams.length, ...nextDreams);
}

function renderSquareFilters() {
  const filters = ['全部', ...state.emotions];
  if (!filters.includes(state.squareFilter)) {
    state.squareFilter = '全部';
  }

  dom.squareFilters.innerHTML = filters.map((filter) => {
    const active = filter === state.squareFilter ? ' active' : '';
    return `<button class="filter-chip${active}" type="button" data-filter="${escapeHtml(filter)}">${escapeHtml(filter)}</button>`;
  }).join('');
}

function renderSquare() {
  const publicDreams = dreams.filter((dream) => dream.isPublic);
  const ownDreams = state.user
    ? dreams.filter((dream) => dream.userId === state.user.id)
    : [];
  const sourceDreams = state.squareMode === 'history' ? ownDreams : publicDreams;
  const visibleDreams = state.squareFilter === '全部'
    ? sourceDreams
    : sourceDreams.filter((dream) => dream.emotion === state.squareFilter);

  dom.squareList.innerHTML = '';

  if (!visibleDreams.length) {
    const message = state.squareMode === 'history'
      ? (state.user ? '历史里暂时没有这个分类。' : '登录后查看自己的历史梦境。')
      : '公开大厅暂时没有这个分类。';
    dom.squareList.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${message}</div>`;
    return;
  }

  visibleDreams.forEach((dream) => {
    dom.squareList.appendChild(createDreamCard(dream, {
      mode: state.squareMode === 'history' ? 'history' : 'square'
    }));
  });
}

function createDreamCard(dream, options = {}) {
  const node = dom.template.content.firstElementChild.cloneNode(true);
  const meta = getEmotionMeta(dream.emotion);
  const badge = node.querySelector('.emotion-badge');

  badge.innerHTML = `<i class="${meta.icon}"></i>${escapeHtml(dream.emotion)}`;
  node.querySelector('.dream-date').textContent = formatDate(dream.createdAt);
  node.querySelector('.dream-text').textContent = dream.text;
  node.querySelector('.dream-author').textContent = displayAuthor(dream, options.mode);
  node.querySelector('.dream-visibility').innerHTML = dream.isPublic
    ? '<i class="fa-solid fa-eye"></i>'
    : '<i class="fa-solid fa-lock"></i>';

  if (options.mode === 'history') {
    node.style.minHeight = 'auto';
  }

  node.addEventListener('click', () => openDetail(dream, options.mode));
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') openDetail(dream, options.mode);
  });

  return node;
}

function renderEmptySearch() {
  dom.resultBrief.textContent = '待检索';
  dom.searchResults.innerHTML = `
    <div class="empty-state">
      <div>
        <i class="fa-solid fa-compact-disc mb-4 text-2xl text-stone-600"></i>
        <div>输入一个片段。</div>
      </div>
    </div>
  `;
}

function runSearch() {
  const query = dom.searchText.value.trim();

  if (query.length < 4) {
    dom.resultBrief.textContent = '线索过短';
    dom.searchResults.innerHTML = '<div class="empty-state">场景还不够完整。</div>';
    return;
  }

  const results = searchDreams(query);

  dom.resultBrief.textContent = results[0] ? `最高 ${results[0].score}%` : '无结果';
  renderSearchResults(results);
}

function searchDreams(query) {
  const searchPool = state.user
    ? dreams.filter((dream) => dream.isPublic || dream.userId === state.user.id)
    : dreams.filter((dream) => dream.isPublic);

  return searchPool
    .map((dream) => ({ dream, ...scoreDream(query, dream) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function scoreDream(query, dream) {
  const queryTokens = tokenize(query);
  const dreamTokens = tokenize(dream.text);
  const dreamSet = new Set(dreamTokens);
  const overlap = [...new Set(queryTokens.filter((token) => dreamSet.has(token)))];
  const sceneBonus = getSceneBonus(query, dream.text);
  const base = overlap.length / Math.max(queryTokens.length, 1);
  const density = overlap.length / Math.max(new Set([...queryTokens, ...dreamTokens]).size, 1);
  const score = Math.min(96, Math.round(base * 72 + density * 42 + sceneBonus));

  return { score, overlap: overlap.slice(0, 5) };
}

function tokenize(text) {
  const stopWords = new Set(['一个', '一座', '一种', '然后', '里面', '还有', '觉得', '以前', '刚才', '自己', '所有', '不是', '这个', '那个']);
  const normalized = text
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）,.!?;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const latinTokens = normalized.match(/[a-z0-9]+/g) || [];
  const chineseText = normalized.replace(/[^\u4e00-\u9fa5]/g, '');
  const grams = [];

  for (let i = 0; i < chineseText.length - 1; i += 1) {
    grams.push(chineseText.slice(i, i + 2));
  }

  return [...latinTokens, ...grams].filter((token) => token.length > 1 && !stopWords.has(token));
}

function getSceneBonus(query, text) {
  const sceneWords = ['地铁', '雨', '巷', '猫', '红色', '办公室', '太空', '星图', '海', '图书馆', '灯塔', '广告牌', '广播', '小时候', '房间'];
  return sceneWords.reduce((sum, word) => query.includes(word) && text.includes(word) ? sum + 4 : sum, 0);
}

function renderSearchResults(results) {
  dom.searchResults.innerHTML = '';

  if (!results.length) {
    dom.searchResults.innerHTML = '<div class="empty-state">没有匹配到相似梦境。</div>';
    return;
  }

  results.forEach((result) => {
    const { dream, score, overlap } = result;
    const meta = getEmotionMeta(dream.emotion);
    const card = document.createElement('article');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="score">
        <strong>${score}%</strong>
        <span>match</span>
      </div>
      <div>
        <div class="meta-row">
          <span class="emotion-badge"><i class="${meta.icon}"></i>${escapeHtml(dream.emotion)}</span>
          <span class="text-xs text-stone-500">${formatDate(dream.createdAt)}</span>
        </div>
        <p class="card-text">${escapeHtml(dream.text)}</p>
        <div class="keyword-row">
          ${overlap.length ? overlap.map((word) => `<span class="keyword">#${escapeHtml(word)}</span>`).join('') : '<span class="text-xs text-stone-500">弱相似</span>'}
        </div>
      </div>
      <div class="match-bar"><div class="match-fill" style="--score-width:${score}%"></div></div>
    `;
    card.addEventListener('click', () => openDetail(dream));
    dom.searchResults.appendChild(card);
  });
}

function openDetail(dream, mode = 'square') {
  const meta = getEmotionMeta(dream.emotion);
  dom.modalMeta.innerHTML = `
    <span class="emotion-badge"><i class="${meta.icon}"></i>${escapeHtml(dream.emotion)}</span>
    <span class="text-xs text-stone-500">${formatDate(dream.createdAt)}</span>
  `;
  dom.modalText.textContent = dream.text;
  dom.modalFoot.textContent = `${displayAuthor(dream, mode)} · ${dream.isPublic ? '匿名公开' : '仅自己可见'}`;
  dom.detailModal.classList.add('open');
  dom.detailModal.setAttribute('aria-hidden', 'false');
}

function closeDetail() {
  dom.detailModal.classList.remove('open');
  dom.detailModal.setAttribute('aria-hidden', 'true');
}

function displayAuthor(dream, mode = 'square') {
  if (state.user && dream.userId === state.user.id) {
    return '我';
  }

  if (mode === 'square' || dream.isPublic) {
    return '匿名';
  }

  return dream.author || '匿名';
}

function getEmailName(email = '') {
  return email.split('@')[0] || '我';
}

function showToast(message) {
  dom.toast.innerHTML = `<i class="fa-solid fa-circle-check"></i>${escapeHtml(message)}`;
  dom.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => dom.toast.classList.remove('show'), 1800);
}

function updateCardGlow(event) {
  const card = event.target.closest('.dream-card, .result-card');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--card-x', `${event.clientX - rect.left}px`);
  card.style.setProperty('--card-y', `${event.clientY - rect.top}px`);
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function startLofiBackground() {
  const canvas = document.querySelector('#lofiCanvas');
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;
  const pointer = { x: 0, y: 0, active: false };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.visualViewport?.height || window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawRibbon(index, time) {
    const yBase = height * (0.2 + index * 0.115);
    const phase = time * (0.00018 + index * 0.000018) + index * 0.7;
    const amplitude = 22 + index * 4;
    const pull = pointer.active ? Math.max(0, 1 - Math.abs(pointer.y - yBase) / 420) : 0;

    ctx.beginPath();
    for (let x = -80; x <= width + 80; x += 22) {
      const pointerWave = pull * Math.sin((x - pointer.x) * 0.012) * 14;
      const y = yBase
        + Math.sin(x * 0.006 + phase) * amplitude
        + Math.cos(x * 0.012 - phase * 1.6) * 10
        + pointerWave;
      if (x === -80) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(56,50,42,0)');
    gradient.addColorStop(0.24, `rgba(56,50,42,${0.035 + index * 0.004})`);
    gradient.addColorStop(0.58, `rgba(128,115,98,${0.04 + index * 0.004})`);
    gradient.addColorStop(1, 'rgba(56,50,42,0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function drawDust(time) {
    ctx.fillStyle = 'rgba(56,50,42,0.18)';
    for (let i = 0; i < 34; i += 1) {
      const x = (Math.sin(time * 0.00008 + i * 34.7) * 0.5 + 0.5) * width;
      const y = (Math.cos(time * 0.00007 + i * 19.1) * 0.5 + 0.5) * height;
      ctx.globalAlpha = 0.035 + (i % 4) * 0.01;
      ctx.fillRect(x, y, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
  }

  function tick(time) {
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 8; i += 1) {
      drawRibbon(i, time);
    }
    drawDust(time);
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  });
  window.addEventListener('pointerleave', () => {
    pointer.active = false;
  });

  resize();
  requestAnimationFrame(tick);
}
