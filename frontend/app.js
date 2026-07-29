const MOCK_DREAMS = [
  {
    id: 'seed-1',
    text: '我在一座没有尽头的蓝色地铁站等车，广播反复念我的名字，站台广告牌却播放着我小时候的卧室。',
    emotion: '诡异',
    isPublic: true,
    author: '匿名 07',
    createdAt: '2026-07-07T04:19:00+08:00',
    userId: null
  },
  {
    id: 'seed-2',
    text: '雨后的窄巷里有一台红色自动售货机，里面卖的不是饮料，而是一瓶瓶封好的黄昏。发光的猫坐在机器顶部。',
    emotion: '科幻',
    isPublic: true,
    author: '匿名 19',
    createdAt: '2026-07-08T09:34:00+08:00',
    userId: null
  },
  {
    id: 'seed-3',
    text: '我和朋友在云层上开了一家早餐店，煎蛋会慢慢升空，顾客全是穿睡衣的星星。',
    emotion: '喜悦',
    isPublic: true,
    author: '匿名 33',
    createdAt: '2026-07-09T23:07:00+08:00',
    userId: null
  },
  {
    id: 'seed-4',
    text: '办公室漂浮在土星环旁边，所有电脑屏幕都变成星图，老板让我在宇宙日落前交一份不存在的报表。',
    emotion: '焦虑',
    isPublic: false,
    author: '我',
    createdAt: '2026-07-10T01:57:00+08:00',
    userId: 'mock-user'
  },
  {
    id: 'seed-5',
    text: '一座图书馆建在黑色海面上，每翻开一本书，远处就亮起一座灯塔，像有人在替我回忆。',
    emotion: '诡异',
    isPublic: true,
    author: '匿名 51',
    createdAt: '2026-07-11T03:19:00+08:00',
    userId: null
  }
];

const MIN_DREAM_LENGTH = 5;
const VISIBLE_EMOTION_LIMIT = 4;
const PROFILE_HANDLE_PATTERN = /^[a-z0-9_]{3,18}$/;
const PROFILE_AVATAR_MAX_BYTES = 3 * 1024 * 1024;
const PROFILE_AVATAR_SIZE = 320;
const BASE_EMOTIONS = ['喜悦', '焦虑', '诡异', '科幻', '平静', '怀旧', '迷失', '浪漫', '荒诞', '清醒'];
const ROUTES = {
  journal: '/',
  search: '/search/',
  square: '/square/',
  profile: '/profile/'
};
const ROUTE_TITLES = {
  journal: 'Déjà vu',
  search: 'Déjà vu · 检索',
  square: 'Déjà vu · 大厅',
  profile: 'Déjà vu · 个人资料'
};
const pageCache = new Map();
let routeRequestId = 0;
const viewMemory = {
  journal: {
    text: '',
    isPublic: false
  },
  search: {
    query: ''
  }
};

const SUPABASE_URL = (window.DEJAVU_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (window.DEJAVU_SUPABASE_ANON_KEY || '').trim();
const HAS_SUPABASE_CONFIG = Boolean(
  SUPABASE_URL
    && SUPABASE_ANON_KEY
    && !SUPABASE_URL.includes('your-project-ref')
    && !SUPABASE_ANON_KEY.includes('your-anon-key')
);

let supabase = null;

const dreams = HAS_SUPABASE_CONFIG ? [] : [...MOCK_DREAMS];

const state = {
  activeView: getInitialView(),
  squareFilter: '全部',
  squareMode: 'public',
  selectedEmotion: '喜悦',
  emotions: [...BASE_EMOTIONS],
  showAllEmotions: false,
  session: null,
  user: null,
  pendingAuthEmail: '',
  nextOtpSendAt: 0,
  isLoadingDreams: false,
  dreamLoadError: '',
  authClientError: '',
  profile: null,
  accountEmail: ''
};

const emotionMeta = {
  '喜悦': { icon: 'fa-regular fa-face-smile' },
  '焦虑': { icon: 'fa-solid fa-bolt' },
  '诡异': { icon: 'fa-solid fa-eye' },
  '科幻': { icon: 'fa-solid fa-rocket' },
  '平静': { icon: 'fa-regular fa-moon' },
  '怀旧': { icon: 'fa-solid fa-clock-rotate-left' },
  '迷失': { icon: 'fa-regular fa-compass' },
  '浪漫': { icon: 'fa-regular fa-heart' },
  '荒诞': { icon: 'fa-solid fa-wand-magic-sparkles' },
  '清醒': { icon: 'fa-regular fa-lightbulb' },
  default: { icon: 'fa-solid fa-tag' }
};

const dom = {
  main: document.querySelector('main'),
  nav: document.querySelector('#mainNav'),
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
  emotionMoreButton: document.querySelector('#emotionMoreButton'),
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
  signOutButton: document.querySelector('#signOutButton'),
  profileForm: document.querySelector('#profileForm'),
  profileHandle: document.querySelector('#profileHandle'),
  profileDisplayName: document.querySelector('#profileDisplayName'),
  profileSignature: document.querySelector('#profileSignature'),
  profileEmail: document.querySelector('#profileEmail'),
  profileAvatarInput: document.querySelector('#profileAvatarInput'),
  profileAvatarPreview: document.querySelector('#profileAvatarPreview'),
  profilePreviewName: document.querySelector('#profilePreviewName'),
  profilePreviewHandle: document.querySelector('#profilePreviewHandle'),
  profilePreviewSignature: document.querySelector('#profilePreviewSignature'),
  profileMessage: document.querySelector('#profileMessage'),
  profileSaveButton: document.querySelector('#profileSaveButton'),
  profileSignOutButton: document.querySelector('#profileSignOutButton'),
  profileLoginButton: document.querySelector('#profileLoginButton'),
  profileSignedInPanel: document.querySelector('#profileSignedInPanel'),
  profileGuestPanel: document.querySelector('#profileGuestPanel')
};

function refreshDom() {
  Object.assign(dom, {
    main: document.querySelector('main'),
    nav: document.querySelector('#mainNav'),
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
    emotionMoreButton: document.querySelector('#emotionMoreButton'),
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
    signOutButton: document.querySelector('#signOutButton'),
    profileForm: document.querySelector('#profileForm'),
    profileHandle: document.querySelector('#profileHandle'),
    profileDisplayName: document.querySelector('#profileDisplayName'),
    profileSignature: document.querySelector('#profileSignature'),
    profileEmail: document.querySelector('#profileEmail'),
    profileAvatarInput: document.querySelector('#profileAvatarInput'),
    profileAvatarPreview: document.querySelector('#profileAvatarPreview'),
    profilePreviewName: document.querySelector('#profilePreviewName'),
    profilePreviewHandle: document.querySelector('#profilePreviewHandle'),
    profilePreviewSignature: document.querySelector('#profilePreviewSignature'),
    profileMessage: document.querySelector('#profileMessage'),
    profileSaveButton: document.querySelector('#profileSaveButton'),
    profileSignOutButton: document.querySelector('#profileSignOutButton'),
    profileLoginButton: document.querySelector('#profileLoginButton'),
    profileSignedInPanel: document.querySelector('#profileSignedInPanel'),
    profileGuestPanel: document.querySelector('#profileGuestPanel')
  });
}

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
  setView(state.activeView);
  renderCurrentPage();
  pageCache.set(state.activeView, dom.main?.innerHTML || '');
  window.history.replaceState({ view: state.activeView }, '', ROUTES[state.activeView]);
  startLofiBackground();
  renderAuthState();

  if (!HAS_SUPABASE_CONFIG) {
    openAuthModal();
    return;
  }

  const initialDreamsLoad = loadDreamsFromSupabase();
  await initSupabaseClient();

  if (!supabase) {
    await initialDreamsLoad;
    renderAuthState();
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showToast('登录状态读取失败');
    console.warn(error);
  }

  setSession(data?.session || null);
  await ensureCurrentProfile();
  await initialDreamsLoad;
  if (state.user) {
    await loadDreamsFromSupabase();
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    setSession(session);
    await ensureCurrentProfile();
    await loadDreamsFromSupabase();
  });
}

async function initSupabaseClient() {
  if (!HAS_SUPABASE_CONFIG || supabase) return supabase;

  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    });
    state.authClientError = '';
  } catch (error) {
    console.warn('Supabase SDK load failed:', error);
    state.authClientError = '登录模块加载失败，但大厅仍会读取公开梦。';
    showToast('登录模块加载失败');
  }

  return supabase;
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const routeLink = event.target.closest('a[data-route]');
    if (shouldHandleRouteClick(event, routeLink)) {
      event.preventDefault();
      navigateTo(routeLink.dataset.route);
      return;
    }

    if (!event.target.closest('.emotion-picker')) {
      closeEmotionMenu();
    }
  });

  document.addEventListener('pointerover', (event) => {
    const routeLink = event.target.closest('a[data-route]');
    if (routeLink) preloadRoute(routeLink.dataset.route);
  });

  dom.closeModal?.addEventListener('click', closeDetail);
  dom.detailModal?.addEventListener('click', (event) => {
    if (event.target === dom.detailModal) closeDetail();
  });

  dom.accountButton?.addEventListener('click', handleAccountButtonClick);
  dom.authClose?.addEventListener('click', closeAuthModal);
  dom.authModal?.addEventListener('click', (event) => {
    if (event.target === dom.authModal) closeAuthModal();
  });
  dom.authForm?.addEventListener('submit', handleAuthSubmit);
  dom.authBackButton?.addEventListener('click', resetAuthForm);
  dom.signOutButton?.addEventListener('click', signOut);

  document.addEventListener('mousemove', (event) => {
    if (!dom.vignette) return;
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
  window.addEventListener('popstate', () => {
    navigateTo(getInitialView(), { updateHistory: false });
  });

  bindPageEvents();
}

function bindPageEvents() {
  dom.dreamText?.addEventListener('input', updateCharCount);
  dom.dreamForm?.addEventListener('submit', handleDreamSubmit);
  dom.emotionTrigger?.addEventListener('click', toggleEmotionMenu);
  dom.emotionMoreButton?.addEventListener('click', toggleEmotionExpansion);

  dom.searchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch();
  });

  document.querySelectorAll('.quick-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      dom.searchText.value = chip.dataset.query;
      runSearch();
    });
  });

  dom.squareFilters?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-filter]');
    if (!chip) return;
    state.squareFilter = chip.dataset.filter;
    dom.squareFilters.querySelectorAll('[data-filter]').forEach((item) => {
      item.classList.toggle('active', item === chip);
    });
    renderSquare();
  });

  dom.squareModes?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-square-mode]');
    if (!chip) return;
    state.squareMode = chip.dataset.squareMode;
    dom.squareModes.querySelectorAll('[data-square-mode]').forEach((item) => {
      item.classList.toggle('active', item === chip);
    });
    renderSquare();
  });

  dom.profileForm?.addEventListener('submit', handleProfileSubmit);
  dom.profileAvatarInput?.addEventListener('change', handleAvatarInputChange);
  dom.profileHandle?.addEventListener('input', updateProfilePreviewFromForm);
  dom.profileDisplayName?.addEventListener('input', updateProfilePreviewFromForm);
  dom.profileSignature?.addEventListener('input', updateProfilePreviewFromForm);
  dom.profileSignOutButton?.addEventListener('click', signOut);
  dom.profileLoginButton?.addEventListener('click', openAuthModal);
}

function setView(viewName) {
  state.activeView = viewName;
  if (dom.nav) {
    dom.nav.dataset.active = viewName;
  }
  dom.navButtons.forEach((button) => {
    const isActive = button.dataset.route === viewName;
    button.classList.toggle('active', isActive);
    if (isActive) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });
  dom.views.forEach((view) => {
    view.classList.toggle('active', view.dataset.view === viewName);
  });
}

function getInitialView() {
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (path.endsWith('/search')) return 'search';
  if (path.endsWith('/square')) return 'square';
  if (path.endsWith('/profile')) return 'profile';
  return 'journal';
}

function shouldHandleRouteClick(event, routeLink) {
  if (!routeLink || !ROUTES[routeLink.dataset.route]) return false;
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (routeLink.target && routeLink.target !== '_self') return false;

  const url = new URL(routeLink.href, window.location.href);
  return url.origin === window.location.origin;
}

async function navigateTo(viewName, options = {}) {
  if (!ROUTES[viewName]) return;

  const updateHistory = options.updateHistory !== false;
  const routePath = ROUTES[viewName];

  if (viewName === state.activeView && dom.views[0]?.dataset.view === viewName) {
    setView(viewName);
    if (updateHistory && window.location.pathname !== routePath) {
      window.history.pushState({ view: viewName }, '', routePath);
    }
    return;
  }

  try {
    saveCurrentViewState();
    const requestId = ++routeRequestId;
    const nextMainHtml = await getRouteMain(viewName);
    if (requestId !== routeRequestId) return;

    const swapPage = () => {
      if (!dom.main) {
        window.location.href = routePath;
        return;
      }

      dom.main.innerHTML = nextMainHtml;
      refreshDom();
      bindPageEvents();
      setView(viewName);
      renderCurrentPage();
      document.title = ROUTE_TITLES[viewName] || 'Déjà vu';
      closeEmotionMenu();
      closeDetail();
    };

    if (document.startViewTransition) {
      await document.startViewTransition(swapPage).finished;
    } else {
      dom.main?.classList.add('route-fading');
      swapPage();
      requestAnimationFrame(() => dom.main?.classList.remove('route-fading'));
    }

    if (updateHistory && window.location.pathname !== routePath) {
      window.history.pushState({ view: viewName }, '', routePath);
    }
  } catch (error) {
    console.warn('Soft navigation failed:', error);
    window.location.href = routePath;
  }
}

async function preloadRoute(viewName) {
  if (!ROUTES[viewName] || pageCache.has(viewName)) return;
  try {
    await getRouteMain(viewName);
  } catch (error) {
    console.warn('Route preload failed:', error);
  }
}

async function getRouteMain(viewName) {
  if (pageCache.has(viewName)) {
    return pageCache.get(viewName);
  }

  const response = await fetch(ROUTES[viewName], {
    headers: {
      'X-Requested-With': 'dejavu-soft-route'
    }
  });
  if (!response.ok) {
    throw new Error(`Route ${viewName} returned ${response.status}`);
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const main = doc.querySelector('main');
  if (!main) {
    throw new Error(`Route ${viewName} has no main content`);
  }

  const mainHtml = main.innerHTML;
  pageCache.set(viewName, mainHtml);
  return mainHtml;
}

function renderCurrentPage() {
  syncEmotionCatalog();

  if (state.activeView === 'journal') {
    renderEmotionMenu();
    restoreCurrentViewState();
    updateCharCount();
    return;
  }

  if (state.activeView === 'search') {
    renderEmptySearch();
    restoreCurrentViewState();
    return;
  }

  if (state.activeView === 'square') {
    renderSquareFilters();
    renderSquare();
    return;
  }

  if (state.activeView === 'profile') {
    renderProfilePage();
  }
}

function saveCurrentViewState() {
  if (state.activeView === 'journal') {
    viewMemory.journal.text = dom.dreamText?.value || '';
    viewMemory.journal.isPublic = Boolean(dom.publicSwitch?.checked);
    return;
  }

  if (state.activeView === 'search') {
    viewMemory.search.query = dom.searchText?.value || '';
  }
}

function restoreCurrentViewState() {
  if (state.activeView === 'journal') {
    if (dom.dreamText) {
      dom.dreamText.value = viewMemory.journal.text;
    }
    if (dom.publicSwitch) {
      dom.publicSwitch.checked = viewMemory.journal.isPublic;
    }
    setEmotion(state.selectedEmotion);
    return;
  }

  if (state.activeView === 'search' && dom.searchText) {
    dom.searchText.value = viewMemory.search.query;
    if (viewMemory.search.query.trim()) {
      runSearch();
    }
  }
}

function handleAccountButtonClick() {
  if (!state.user) {
    openAuthModal();
    return;
  }

  navigateTo('profile');
}

function setSession(session) {
  state.session = session;
  state.user = session?.user || null;
  state.profile = null;
  state.accountEmail = '';
  renderAuthState();
}

function renderAuthState() {
  const signedIn = Boolean(state.user);
  const accountName = signedIn
    ? (getCurrentDisplayName() || formatPublicHandle(getCurrentPublicHandle()))
    : (HAS_SUPABASE_CONFIG ? '登录' : '配置');
  const accountAvatar = signedIn ? getCurrentAvatarUrl() : '';

  if (dom.accountLabel) {
    dom.accountLabel.textContent = accountName;
  }

  const accountIcon = dom.accountButton?.querySelector('i');
  if (accountIcon) {
    if (accountAvatar) {
      accountIcon.className = 'account-bubble-avatar';
      renderAvatarElement(accountIcon, accountAvatar, accountName);
    } else {
      accountIcon.removeAttribute('style');
      accountIcon.className = signedIn ? 'fa-regular fa-circle-check' : 'fa-regular fa-user';
      accountIcon.textContent = '';
    }
  }

  dom.authSetupPanel?.classList.toggle('hidden', HAS_SUPABASE_CONFIG);
  dom.authLoginPanel?.classList.toggle('hidden', !HAS_SUPABASE_CONFIG || signedIn);
  dom.authSignedInPanel?.classList.toggle('hidden', !HAS_SUPABASE_CONFIG || !signedIn);

  if (signedIn && dom.authUser) {
    dom.authUser.textContent = accountName;
  }
}

async function ensureCurrentProfile() {
  if (!supabase || !state.user) {
    state.profile = null;
    renderAuthState();
    return null;
  }

  const fallbackHandle = generatePublicHandle(state.user.id || state.user.email);
  const { data: existingProfile, error: readError } = await supabase
    .from('profiles')
    .select('user_id,public_handle,display_name,avatar_url,signature')
    .eq('user_id', state.user.id)
    .maybeSingle();

  if (readError) {
    console.warn('Profile read failed:', readError);
    state.profile = createFallbackProfile(fallbackHandle);
    renderAuthState();
    renderProfilePage();
    return state.profile;
  }

  if (existingProfile) {
    state.profile = rowToProfile(existingProfile, fallbackHandle);
    await ensureCurrentAccountEmail();
    renderAuthState();
    renderProfilePage();

    return state.profile;
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      user_id: state.user.id,
      public_handle: fallbackHandle
    })
    .select('user_id,public_handle,display_name,avatar_url,signature')
    .single();

  if (error) {
    console.warn('Profile create failed:', error);
    state.profile = createFallbackProfile(fallbackHandle);
    renderAuthState();
    renderProfilePage();
    return state.profile;
  }

  state.profile = rowToProfile(data, fallbackHandle);
  await ensureCurrentAccountEmail();
  renderAuthState();
  renderProfilePage();
  return state.profile;
}

async function ensureCurrentAccountEmail() {
  const email = getCurrentAuthEmail();
  if (!supabase || !state.user || !email) return;

  const { data: existingAccount, error: readError } = await supabase
    .from('user_accounts')
    .select('user_id,email')
    .eq('user_id', state.user.id)
    .maybeSingle();

  if (readError) {
    console.warn('User account read failed:', readError);
    state.accountEmail = email;
    return;
  }

  if (existingAccount) {
    state.accountEmail = existingAccount.email || email;
    return;
  }

  const { error } = await supabase
    .from('user_accounts')
    .insert({
      user_id: state.user.id,
      email
    });

  if (error) {
    console.warn('User account create failed:', error);
    return;
  }

  state.accountEmail = email;
}

function rowToProfile(row, fallbackHandle) {
  return {
    userId: row?.user_id || state.user?.id || '',
    publicHandle: normalizeProfileHandle(row?.public_handle) || normalizeProfileHandle(fallbackHandle),
    displayName: String(row?.display_name || '').trim(),
    avatarUrl: getSafeAvatarUrl(row?.avatar_url),
    signature: String(row?.signature || '').trim()
  };
}

function createFallbackProfile(publicHandle) {
  return {
    userId: state.user?.id || '',
    publicHandle: normalizeProfileHandle(publicHandle),
    displayName: '',
    avatarUrl: '',
    signature: ''
  };
}

function renderProfilePage() {
  if (!dom.profileSignedInPanel && !dom.profileGuestPanel) return;

  const signedIn = Boolean(state.user);
  dom.profileSignedInPanel?.classList.toggle('hidden', !signedIn);
  dom.profileGuestPanel?.classList.toggle('hidden', signedIn);

  if (!signedIn) {
    setProfileMessage('');
    return;
  }

  const fallbackProfile = createFallbackProfile(generatePublicHandle(state.user.id || state.user.email));
  const profile = state.profile || fallbackProfile;
  const publicHandle = normalizeProfileHandle(profile.publicHandle || fallbackProfile.publicHandle);
  const displayName = String(profile.displayName || '').trim();
  const signature = String(profile.signature || '').trim();
  const accountName = displayName || '未命名';

  if (dom.profileHandle) dom.profileHandle.value = publicHandle;
  if (dom.profileDisplayName) dom.profileDisplayName.value = displayName;
  if (dom.profileSignature) dom.profileSignature.value = signature;
  if (dom.profileEmail) dom.profileEmail.value = getCurrentAuthEmail() || '未绑定';

  renderAvatarElement(dom.profileAvatarPreview, getSafeAvatarUrl(profile.avatarUrl), getProfileInitial(accountName || publicHandle));
  if (dom.profilePreviewName) dom.profilePreviewName.textContent = accountName;
  if (dom.profilePreviewHandle) dom.profilePreviewHandle.textContent = formatPublicHandle(publicHandle);
  if (dom.profilePreviewSignature) {
    dom.profilePreviewSignature.textContent = signature || '还没有签名';
  }
}

function updateProfilePreviewFromForm() {
  if (!dom.profileSignedInPanel || !state.user) return;

  const publicHandle = normalizeProfileHandle(dom.profileHandle?.value || getCurrentPublicHandle());
  const displayName = String(dom.profileDisplayName?.value || '').trim();
  const signature = String(dom.profileSignature?.value || '').trim();
  const accountName = displayName || '未命名';

  if (dom.profilePreviewName) dom.profilePreviewName.textContent = accountName;
  if (dom.profilePreviewHandle) dom.profilePreviewHandle.textContent = formatPublicHandle(publicHandle || getCurrentPublicHandle());
  if (dom.profilePreviewSignature) dom.profilePreviewSignature.textContent = signature || '还没有签名';
  renderAvatarElement(dom.profileAvatarPreview, state.profile?.avatarUrl, getProfileInitial(accountName || publicHandle));
}

async function handleProfileSubmit(event) {
  event.preventDefault();

  if (!supabase) {
    openAuthModal();
    setProfileMessage('先在 frontend/config.js 填入 Supabase 配置。', true);
    return;
  }

  if (!state.user) {
    openAuthModal();
    showToast('登录后编辑资料');
    return;
  }

  const publicHandle = normalizeProfileHandle(dom.profileHandle?.value);
  const displayName = String(dom.profileDisplayName?.value || '').trim().slice(0, 24);
  const signature = String(dom.profileSignature?.value || '').trim().slice(0, 80);
  const avatarUrl = getSafeAvatarUrl(state.profile?.avatarUrl);

  if (!PROFILE_HANDLE_PATTERN.test(publicHandle)) {
    setProfileMessage('ID 需要是 3-18 位小写英文、数字或下划线。', true);
    dom.profileHandle?.focus();
    return;
  }

  dom.profileSaveButton.disabled = true;
  setProfileMessage('正在保存...');

  try {
    const isDuplicated = await isProfileHandleDuplicated(publicHandle);
    if (isDuplicated) {
      setProfileMessage('这个 ID 已经被使用了，换一个吧。', true);
      dom.profileHandle?.focus();
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        public_handle: publicHandle,
        display_name: displayName || null,
        avatar_url: avatarUrl || null,
        signature: signature || null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', state.user.id)
      .select('user_id,public_handle,display_name,avatar_url,signature')
      .single();

    if (error) throw error;

    state.profile = rowToProfile(data, publicHandle);
    dreams.forEach((dream) => {
      if (dream.userId === state.user.id) {
        dream.publicHandle = state.profile.publicHandle;
        dream.displayName = state.profile.displayName;
        dream.avatarUrl = state.profile.avatarUrl;
      }
    });

    renderAuthState();
    renderProfilePage();
    renderAll();
    setProfileMessage('已保存');
    showToast('资料已更新');
  } catch (error) {
    console.warn('Profile save failed:', error);
    setProfileMessage(
      isUniqueHandleError(error) ? '这个 ID 已经被使用了，换一个吧。' : '保存失败，请检查数据库迁移是否已执行。',
      true
    );
  } finally {
    dom.profileSaveButton.disabled = false;
  }
}

async function isProfileHandleDuplicated(publicHandle) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('public_handle', publicHandle)
    .neq('user_id', state.user.id)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function handleAvatarInputChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    setProfileMessage('请选择图片文件。', true);
    event.target.value = '';
    return;
  }

  if (file.size > PROFILE_AVATAR_MAX_BYTES) {
    setProfileMessage('头像图片不能超过 3MB。', true);
    event.target.value = '';
    return;
  }

  try {
    const avatarUrl = await createAvatarDataUrl(file);
    state.profile = {
      ...(state.profile || createFallbackProfile(generatePublicHandle(state.user?.id || state.user?.email))),
      avatarUrl
    };
    renderAvatarElement(dom.profileAvatarPreview, avatarUrl, getProfileInitial(getCurrentDisplayName() || getCurrentPublicHandle()));
    setProfileMessage('头像已预览，保存后生效。');
  } catch (error) {
    console.warn('Avatar preview failed:', error);
    setProfileMessage('头像读取失败，请换一张图片。', true);
  } finally {
    event.target.value = '';
  }
}

async function createAvatarDataUrl(file) {
  const sourceUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement('canvas');
  const size = PROFILE_AVATAR_SIZE;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context unavailable');
  }
  const side = Math.min(image.width, image.height);
  const sx = Math.max(0, (image.width - side) / 2);
  const sy = Math.max(0, (image.height - side) / 2);
  context.drawImage(image, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.86);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', reject);
    reader.readAsDataURL(file);
  });
}

function loadImage(sourceUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.src = sourceUrl;
  });
}

function setProfileMessage(message, isError = false) {
  if (!dom.profileMessage) return;
  dom.profileMessage.textContent = message;
  dom.profileMessage.classList.toggle('error', isError);
}

function isUniqueHandleError(error) {
  const message = getErrorMessage(error);
  return /duplicate|unique|23505|profiles_public_handle/i.test(message);
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  if (!supabase) {
    await initSupabaseClient();
    if (!supabase) {
      setAuthMessage(HAS_SUPABASE_CONFIG ? '登录模块加载失败，请稍后重试。' : '先在 frontend/config.js 填入 Supabase 配置。', true);
      return;
    }
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
  setAuthMessage('验证码已发送到邮箱。请复制邮件里的 8 位数字验证码填在这里，验证码通常几分钟内有效。');
}

async function verifyEmailOtp(email) {
  const token = dom.authOtp.value.trim().replace(/\s+/g, '');
  if (!/^\d{8}$/.test(token)) {
    setAuthMessage('请输入 8 位数字验证码。', true);
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
  await ensureCurrentProfile();
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
  if (state.activeView === 'profile') {
    navigateTo('journal');
  }
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
    : '验证码验证失败，请确认邮箱和 8 位验证码是否正确。';
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
  if (!dom.authMessage) return;
  dom.authMessage.textContent = message;
  dom.authMessage.classList.toggle('error', isError);
}

function openAuthModal() {
  if (!dom.authModal) return;
  dom.authModal.classList.add('open');
  dom.authModal.setAttribute('aria-hidden', 'false');
  if (state.authClientError) {
    setAuthMessage(state.authClientError, true);
    initSupabaseClient().then(() => {
      if (!state.authClientError) setAuthMessage('');
    });
  }
}

function closeAuthModal() {
  if (!dom.authModal) return;
  dom.authModal.classList.remove('open');
  dom.authModal.setAttribute('aria-hidden', 'true');
}

function toggleEmotionMenu() {
  if (!dom.emotionMenu || !dom.emotionTrigger) return;
  const isOpen = dom.emotionMenu.classList.toggle('open');
  dom.emotionTrigger.setAttribute('aria-expanded', String(isOpen));
}

function closeEmotionMenu() {
  if (!dom.emotionMenu || !dom.emotionTrigger) return;
  dom.emotionMenu.classList.remove('open');
  dom.emotionTrigger.setAttribute('aria-expanded', 'false');
}

function setEmotion(emotion) {
  state.selectedEmotion = emotion;
  const meta = getEmotionMeta(emotion);
  if (dom.emotionIcon) {
    dom.emotionIcon.className = meta.icon;
  }
  dom.emotionTrigger?.setAttribute('aria-label', `当前标签：${emotion}`);
  dom.emotionList?.querySelectorAll('.emotion-item').forEach((item) => {
    const active = item.dataset.emotion === emotion;
    item.classList.toggle('active', active);
    item.querySelector('.fa-check').classList.toggle('opacity-0', !active);
  });
}

function syncEmotionCatalog() {
  state.emotions = [...BASE_EMOTIONS];
}

function getEmotionMeta(emotion) {
  return emotionMeta[emotion] || emotionMeta.default;
}

function renderEmotionMenu() {
  if (!dom.emotionList) return;
  dom.emotionList.innerHTML = '';

  state.emotions.forEach((emotion, index) => {
    const meta = getEmotionMeta(emotion);
    const item = document.createElement('button');
    item.className = [
      'emotion-item',
      emotion === state.selectedEmotion ? 'active' : '',
      index >= VISIBLE_EMOTION_LIMIT ? 'is-extra' : ''
    ].filter(Boolean).join(' ');
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

  applyEmotionExpansion();
  setEmotion(state.selectedEmotion);
}

function applyEmotionExpansion() {
  const hasMore = state.emotions.length > VISIBLE_EMOTION_LIMIT;
  dom.emotionMenu?.classList.toggle('expanded', state.showAllEmotions);

  if (!dom.emotionMoreButton) return;

  dom.emotionMoreButton.hidden = !hasMore;
  dom.emotionMoreButton.setAttribute('aria-expanded', String(state.showAllEmotions));
  dom.emotionMoreButton.innerHTML = state.showAllEmotions
    ? '<i class="fa-solid fa-chevron-up"></i><span>收起</span>'
    : '<i class="fa-solid fa-chevron-down"></i><span>更多标签</span>';
}

function toggleEmotionExpansion(event) {
  event?.preventDefault();
  event?.stopPropagation();
  state.showAllEmotions = !state.showAllEmotions;
  applyEmotionExpansion();
}

function handleDreamSubmit(event) {
  event.preventDefault();
  if (dom.dreamForm.classList.contains('tearing')) return;

  const text = dom.dreamText.value.trim();
  const emotion = state.selectedEmotion;
  const isPublic = dom.publicSwitch.checked;

  if (text.length < MIN_DREAM_LENGTH) {
    showToast(`至少写 ${MIN_DREAM_LENGTH} 个字`);
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
      viewMemory.journal.text = '';
      viewMemory.journal.isPublic = false;
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
  if (!dom.charCount || !dom.dreamText) return;
  dom.charCount.textContent = dom.dreamText.value.trim().length;
}

function renderAll() {
  syncEmotionCatalog();
  renderSquareFilters();
  renderSquare();
}

async function loadDreamsFromSupabase() {
  if (!HAS_SUPABASE_CONFIG || state.isLoadingDreams) return;

  state.isLoadingDreams = true;
  state.dreamLoadError = '';
  renderSquare();

  let rows = null;
  try {
    rows = await fetchDreamRows();
  } catch (error) {
    console.warn('Dreams read failed:', error);
    state.dreamLoadError = getErrorMessage(error) || '数据库读取失败';
    showToast('读取失败，请检查网络或 RLS 策略');
  } finally {
    state.isLoadingDreams = false;
  }

  if (!rows) {
    replaceDreams([]);
    renderAll();
    return;
  }

  replaceDreams(rows.map((row) => rowToDream(row)));
  renderAll();
  if (dom.searchText?.value.trim()) {
    runSearch();
  }

  hydrateDreamProfiles(rows);
}

async function fetchDreamRows() {
  const publicRows = await fetchDreamRowsViaRest();

  if (!state.user || !supabase) {
    return publicRows;
  }

  const { data, error } = await supabase
    .from('dreams')
    .select('id,text,emotion,is_public,author,created_at,user_id')
    .order('created_at', { ascending: false })
    .limit(120);

  if (!error && (data || []).length) {
    return mergeDreamRows(publicRows, data || []);
  }

  if (error) {
    console.warn('Supabase client dream read failed:', error);
  }

  return publicRows;
}

async function fetchDreamRowsViaRest() {
  const params = new URLSearchParams({
    select: 'id,text,emotion,is_public,author,created_at,user_id',
    order: 'created_at.desc',
    limit: '120'
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/dreams?${params.toString()}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`REST dream read failed: ${response.status}`);
  }

  return response.json();
}

function mergeDreamRows(...rowGroups) {
  const merged = new Map();
  rowGroups.flat().forEach((row) => {
    if (row?.id) {
      merged.set(String(row.id), row);
    }
  });

  return [...merged.values()].sort((a, b) => {
    return parseDreamDate(b.created_at).getTime() - parseDreamDate(a.created_at).getTime();
  });
}

async function hydrateDreamProfiles(rows) {
  try {
    const profileHandles = await loadProfileHandles(rows);
    if (!profileHandles.size) return;

    dreams.forEach((dream) => {
      const profile = dream.userId ? profileHandles.get(dream.userId) : null;
      if (!profile) return;
      dream.publicHandle = profile.publicHandle || dream.publicHandle;
      dream.displayName = profile.displayName || '';
      dream.avatarUrl = profile.avatarUrl || '';
    });
    renderAll();
  } catch (error) {
    console.warn('Profile hydrate failed:', error);
  }
}

async function loadProfileHandles(rows) {
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  if (!supabase || !userIds.length) return new Map();

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,public_handle,display_name,avatar_url')
    .in('user_id', userIds);

  if (error) {
    console.warn('Profile handles read failed:', error);
    return new Map();
  }

  return new Map((data || []).map((profile) => [
    profile.user_id,
    {
      publicHandle: profile.public_handle,
      displayName: String(profile.display_name || '').trim(),
      avatarUrl: getSafeAvatarUrl(profile.avatar_url)
    }
  ]));
}

async function saveDreamToSupabase(dream) {
  if (!state.profile) {
    await ensureCurrentProfile();
  }

  const row = {
    text: dream.text,
    emotion: dream.emotion,
    is_public: dream.isPublic,
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

  return rowToDream(data, new Map([[state.user.id, {
    publicHandle: getCurrentPublicHandle(),
    displayName: getCurrentDisplayName(),
    avatarUrl: getCurrentAvatarUrl()
  }]]));
}

function rowToDream(row, profileHandles = new Map()) {
  const userId = row.user_id || null;
  const profile = userId ? profileHandles.get(userId) : null;
  const profileData = profile && typeof profile === 'object' ? profile : null;
  const profileHandle = typeof profile === 'string' ? profile : profileData?.publicHandle;

  return {
    id: String(row.id),
    text: row.text,
    emotion: row.emotion || '喜悦',
    isPublic: Boolean(row.is_public),
    author: normalizeDreamAuthor(row.author, userId || row.id || row.created_at),
    publicHandle: profileHandle || '',
    displayName: profileData?.displayName || '',
    avatarUrl: profileData?.avatarUrl || '',
    createdAt: String(row.created_at || '') || new Date().toISOString(),
    userId
  };
}

function replaceDreams(nextDreams) {
  dreams.splice(0, dreams.length, ...nextDreams);
}

function renderSquareFilters() {
  if (!dom.squareFilters) return;
  const filters = ['全部', ...state.emotions, ...getStoredEmotions()];
  if (!filters.includes(state.squareFilter)) {
    state.squareFilter = '全部';
  }

  dom.squareFilters.innerHTML = filters.map((filter) => {
    const active = filter === state.squareFilter ? ' active' : '';
    return `<button class="filter-chip${active}" type="button" data-filter="${escapeHtml(filter)}">${escapeHtml(filter)}</button>`;
  }).join('');
}

function getStoredEmotions() {
  return [...new Set(dreams.map((dream) => dream.emotion).filter(Boolean))]
    .filter((emotion) => !state.emotions.includes(emotion));
}

function renderSquare() {
  if (!dom.squareList) return;

  if (state.isLoadingDreams && !dreams.length) {
    dom.squareList.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">正在读取梦境大厅...</div>';
    return;
  }

  if (state.dreamLoadError && !dreams.length) {
    dom.squareList.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        数据库读取失败。<br>
        <span class="text-xs text-stone-500">${escapeHtml(state.dreamLoadError)}</span>
      </div>
    `;
    return;
  }

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
  const profile = getDreamProfile(dream, options.mode);
  const badge = node.querySelector('.emotion-badge');
  const avatar = node.querySelector('.dream-avatar');

  badge.innerHTML = `<i class="${meta.icon}"></i>${escapeHtml(dream.emotion)}`;
  renderAvatarElement(avatar, profile.avatarUrl, profile.avatar);
  avatar.style.setProperty('--avatar-hue', profile.hue);
  node.querySelector('.dream-author').textContent = profile.name;
  node.querySelector('.dream-handle').textContent = profile.handle;
  node.querySelector('.dream-date').innerHTML = formatDreamTimestampHtml(dream.createdAt);
  node.querySelector('.dream-text').textContent = dream.text;

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
  if (!dom.resultBrief || !dom.searchResults) return;
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
  if (!dom.searchText || !dom.resultBrief || !dom.searchResults) return;
  const query = dom.searchText.value.trim();

  if (!query) {
    renderEmptySearch();
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
  if (!dom.modalMeta || !dom.modalText || !dom.modalFoot || !dom.detailModal) return;
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
  if (!dom.detailModal) return;
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

function getDreamProfile(dream, mode = 'square') {
  const isMine = state.user && dream.userId === state.user.id;
  const ownDisplayName = getCurrentDisplayName();
  const dreamDisplayName = String(dream.displayName || '').trim();
  const authorName = isMine
    ? (ownDisplayName || '我')
    : (dreamDisplayName || (mode === 'square' || dream.isPublic ? `匿名 ${getDreamNumber(dream)}` : displayAuthor(dream, mode)));
  const handleBase = isMine
    ? (dream.publicHandle || getCurrentPublicHandle())
    : (dream.publicHandle || getSafeAuthorHandle(dream));
  const handle = formatPublicHandle(handleBase);
  const avatarUrl = isMine ? getCurrentAvatarUrl() : getSafeAvatarUrl(dream.avatarUrl);

  return {
    name: authorName,
    handle,
    avatar: getProfileInitial(authorName || handle),
    avatarUrl,
    hue: String(getHashNumber(`${dream.id}${dream.createdAt}`) % 360)
  };
}

function getDreamInitial(name) {
  const text = String(name || 'U').trim();
  return /[a-z0-9]/i.test(text[0]) ? text[0].toUpperCase() : text[0];
}

function isAnonymousAuthor(author) {
  return !author || String(author).trim().startsWith('匿名');
}

function normalizeDreamAuthor(author, fallbackSeed) {
  const value = String(author || '').trim();
  if (!value) return '匿名';
  return isEmailLike(value) ? generatePublicHandle(fallbackSeed || value) : value;
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function getCurrentPublicHandle() {
  return state.profile?.publicHandle || generatePublicHandle(state.user?.id || state.user?.email || 'guest');
}

function getCurrentDisplayName() {
  return String(state.profile?.displayName || '').trim();
}

function getCurrentAvatarUrl() {
  return getSafeAvatarUrl(state.profile?.avatarUrl);
}

function getCurrentAuthEmail() {
  return String(state.accountEmail || state.user?.email || state.pendingAuthEmail || '').trim();
}

function getSafeAuthorHandle(dream) {
  const author = String(dream.author || '').trim();
  if (author && !isAnonymousAuthor(author) && !isEmailLike(author)) {
    return author;
  }
  return generatePublicHandle(dream.userId || dream.id || dream.createdAt || dream.text);
}

function formatPublicHandle(handle) {
  return `@${normalizeProfileHandle(handle || 'unique00').slice(0, 18) || 'unique00'}`;
}

function normalizeProfileHandle(handle) {
  return String(handle || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 18);
}

function generatePublicHandle(seed) {
  const text = String(seed || '').trim().toLowerCase();
  const uuidStem = text.replaceAll('-', '').match(/^[a-f0-9]{10,}/)?.[0].slice(0, 10);
  if (uuidStem) return `unique${uuidStem}`;
  return `unique${String((getHashNumber(text) % 900000) + 100000).padStart(6, '0')}`;
}

function getProfileInitial(name) {
  const text = String(name || 'U').trim();
  if (!text) return 'U';
  return /[a-z0-9]/i.test(text[0]) ? text[0].toUpperCase() : text[0];
}

function getSafeAvatarUrl(value) {
  const url = String(value || '').trim();
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url)) return url;
  if (/^https:\/\/[^\s"'<>]+$/i.test(url)) return url;
  return '';
}

function renderAvatarElement(element, avatarUrl, fallbackText) {
  if (!element) return;

  const safeUrl = getSafeAvatarUrl(avatarUrl);
  if (safeUrl) {
    element.textContent = '';
    element.classList.add('has-image');
    element.style.backgroundImage = `url("${safeUrl.replace(/["\\]/g, '')}")`;
    return;
  }

  element.classList.remove('has-image', 'account-bubble-avatar');
  element.style.removeProperty('background-image');
  element.textContent = getProfileInitial(fallbackText);
}

function getDreamNumber(dream) {
  const source = String(dream.id || dream.createdAt || dream.text);
  return String((getHashNumber(source) % 90) + 10).padStart(2, '0');
}

function getHashNumber(text) {
  return [...String(text)].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 7);
}

function showToast(message) {
  if (!dom.toast) return;
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
  const date = parseDreamDate(dateString);
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatDreamTimestampHtml(dateString) {
  const date = parseDreamDate(dateString);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `<span class="date-latin">${hours}:${minutes} • ${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}</span><span class="date-weekday"> ${weekdays[date.getDay()]}</span>`;
}

function parseDreamDate(dateString) {
  const raw = String(dateString || '').trim();
  const value = raw.includes('T') ? raw : `${raw || new Date().toISOString().slice(0, 10)}T00:00:00`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
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
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
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
