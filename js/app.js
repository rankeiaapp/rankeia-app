/* ============================================================
   APP — Controlador Principal
============================================================ */

// Links Kiwify
const KIWIFY_BASICO = "https://pay.kiwify.com.br/4hK6Gmm";
const KIWIFY_PRO    = "https://pay.kiwify.com.br/rBtZOES";

// ──────────────────────────
// Estado do Gerador
// ──────────────────────────
let currentStep       = 1;
let selectedPlatforms = [];
let lastResult        = null;
let lastProductData   = null;
let loadInterval      = null;
let barTimer          = null;

// ──────────────────────────
// Boot
// ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  bindAuthForms();
  bindAccountForm();
});

// ──────────────────────────
// Auth Forms
// ──────────────────────────
function bindAuthForms() {
  document.getElementById('loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPass').value;
    const btn   = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'Entrando...';
    try {
      await login(email, pass);
    } catch(err) {
      toast(friendlyAuthError(err.code), 'error');
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  });

  document.getElementById('registerForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const nome  = document.getElementById('regNome').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass  = document.getElementById('regPass').value;
    const btn   = document.getElementById('registerBtn');
    if (pass.length < 6) { toast('A senha deve ter no mínimo 6 caracteres', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Criando conta...';
    try {
      await register(email, pass, nome);
    } catch(err) {
      toast(friendlyAuthError(err.code), 'error');
      btn.disabled = false; btn.textContent = 'Criar conta';
    }
  });
}

function friendlyAuthError(code) {
  const msgs = {
    'auth/user-not-found':    'E-mail não cadastrado.',
    'auth/wrong-password':    'Senha incorreta.',
    'auth/email-already-in-use': 'E-mail já cadastrado. Faça login.',
    'auth/invalid-email':     'E-mail inválido.',
    'auth/weak-password':     'Senha muito fraca. Use ao menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
  };
  return msgs[code] || 'Erro de autenticação. Tente novamente.';
}

function showLogin()    { showScreen('auth-login');    }
function showRegister() { showScreen('auth-register'); }

async function doLogout() {
  await logout();
  toast('Até logo!', 'info');
}

async function doGoogleLogin() {
  try {
    await loginWithGoogle();
  } catch(err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      toast('Erro ao entrar com Google', 'error');
    }
  }
}

async function doResetPassword() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { toast('Digite seu e-mail primeiro', 'error'); return; }
  try {
    await resetPassword(email);
    toast('E-mail de recuperação enviado!', 'success');
  } catch {
    toast('Erro ao enviar e-mail. Verifique o endereço.', 'error');
  }
}

// ──────────────────────────
// Account / Config
// ──────────────────────────
function bindAccountForm() {
  document.getElementById('apiKeyInput')?.addEventListener('change', () => {});
}

function toggleApiVis() {
  const inp = document.getElementById('apiKeyInput');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key) { toast('Informe a API Key!', 'error'); return; }
  try {
    await updateProfile({ apiKey: key });
    toast('API Key salva com sucesso!', 'success');
  } catch {
    toast('Erro ao salvar. Tente novamente.', 'error');
  }
}

// ──────────────────────────
// Navegação
// ──────────────────────────
function goToGenerateWith(platform) {
  navigateTo('generate');
  resetGenerate();
  if (platform !== 'all') window._preSelect = platform;
}

// ──────────────────────────
// Steps do Gerador
// ──────────────────────────
function updateStepUI() {
  [1,2,3].forEach(i => {
    const s = document.getElementById('step'+i);
    if (!s) return;
    s.classList.remove('active','done');
    if (i < currentStep) s.classList.add('done');
    if (i === currentStep) s.classList.add('active');
    if (i < 3) document.getElementById('line'+i)?.classList.toggle('done', i < currentStep);
  });
}

function goStep1() {
  currentStep = 1;
  showStepContent(1);
  updateStepUI();
}

function goStep2() {
  const prod = document.getElementById('fProduct')?.value.trim();
  if (!prod) { toast('Descreva o produto primeiro!', 'error'); return; }
  currentStep = 2;
  showStepContent(2);
  updateStepUI();
  if (window._preSelect) {
    const card = document.querySelector(`[data-p="${window._preSelect}"]`);
    if (card) togglePlatform(card);
    window._preSelect = null;
  }
}

function showStepContent(n) {
  [1,2,3].forEach(i => {
    const el = document.getElementById('s'+i);
    if (el) el.style.display = i === n ? 'block' : 'none';
  });
}

// ──────────────────────────
// Plataformas
// ──────────────────────────
function togglePlatform(card) {
  const p = card.dataset.p;
  card.classList.toggle('selected');
  if (card.classList.contains('selected')) {
    if (!selectedPlatforms.includes(p)) selectedPlatforms.push(p);
  } else {
    selectedPlatforms = selectedPlatforms.filter(x => x !== p);
  }
  const hasTT = selectedPlatforms.includes('tiktok_shop');
  const ttRow = document.getElementById('tiktokToggleRow');
  if (ttRow) ttRow.style.display = hasTT ? 'flex' : 'none';
  if (!hasTT) document.getElementById('tiktokScriptSw')?.classList.remove('on');
}

// ──────────────────────────
// Gerar Anúncio — com paywall
// ──────────────────────────
async function generateAd() {
  if (!selectedPlatforms.length) { toast('Selecione ao menos uma plataforma!', 'error'); return; }

  // ── PAYWALL: verificar se pode gerar ──
  if (!canGenerate()) {
    showUpgradeModal();
    return;
  }

  const product   = document.getElementById('fProduct')?.value.trim()   || '';
  const category  = document.getElementById('fCategory')?.value.trim()  || '';
  const diff      = document.getElementById('fDiff')?.value.trim()      || '';
  const tiktokSc  = document.getElementById('tiktokScriptSw')?.classList.contains('on')
                    && selectedPlatforms.includes('tiktok_shop');

  lastProductData = { product, category, diff, platforms:[...selectedPlatforms], tiktokSc };

  currentStep = 3;
  showStepContent(3);
  updateStepUI();
  showLoading(true);

  try {
    const result = await gerarAnuncio({ product, category, diff, platforms: selectedPlatforms, tiktokScript: tiktokSc });
    lastResult = result;

    // Incrementar contador de gerações
    await incrementGeracoes();

    showLoading(false);
    renderResult(result, selectedPlatforms, tiktokSc);

    const autoSave = document.getElementById('autoSaveSw')?.classList.contains('on');
    if (autoSave !== false) await doSaveHistory(true);

  } catch(err) {
    showLoading(false);
    clearLoadingAnimations();
    toast(err.message || 'Erro ao gerar. Tente novamente.', 'error');
    currentStep = 2;
    showStepContent(2);
    updateStepUI();
  }
}

function showLoading(show) {
  const ld = document.getElementById('loadingState');
  const rs = document.getElementById('resultState');
  if (!ld || !rs) return;
  if (show) {
    ld.style.display = 'flex';
    rs.style.display = 'none';
    startLoadingAnimations();
  } else {
    clearLoadingAnimations();
  }
}

function startLoadingAnimations() {
  const texts = [
    'Analisando palavras-chave...',
    'Otimizando para o algoritmo...',
    'Montando seu anúncio...',
    'Quase pronto...',
  ];
  let ti = 0;
  const el = document.getElementById('loadText');
  clearInterval(loadInterval);
  loadInterval = setInterval(() => {
    ti = (ti + 1) % texts.length;
    if (el) { el.style.opacity='0'; setTimeout(()=>{ el.textContent=texts[ti]; el.style.opacity='1'; },200); }
  }, 2000);
  animateBar();
}

function clearLoadingAnimations() {
  clearInterval(loadInterval);
  clearTimeout(barTimer);
}

function animateBar() {
  const bar = document.getElementById('loadBar');
  if (!bar) return;
  bar.style.width = '0%';
  let pct = 0;
  function step() {
    const inc = pct < 70 ? 3 : pct < 90 ? 0.5 : 0.08;
    pct = Math.min(pct + inc, 95);
    bar.style.width = pct + '%';
    if (pct < 95) barTimer = setTimeout(step, 200);
  }
  barTimer = setTimeout(step, 200);
}

// ──────────────────────────
// Modal de Upgrade (Paywall)
// ──────────────────────────
function showUpgradeModal(planFocus) {
  const modal = document.getElementById('upgradeModal');
  if (modal) modal.classList.add('open');
}

function closeUpgradeModal() {
  const modal = document.getElementById('upgradeModal');
  if (modal) modal.classList.remove('open');
}

function goToCheckout(plan) {
  const url = plan === 'pro' ? KIWIFY_PRO : KIWIFY_BASICO;
  window.open(url, '_blank');
}

// ──────────────────────────
// Render Resultado
// ──────────────────────────
function renderResult(result, platforms, tiktokSc) {
  const bar = document.getElementById('loadBar');
  if (bar) bar.style.width = '100%';
  setTimeout(() => {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('resultState').style.display = 'block';
  }, 300);

  const container = document.getElementById('resultCards');
  if (!container) return;
  container.innerHTML = '';
  const plats = result.plataformas || {};
  platforms.forEach(pk => {
    const d = plats[pk];
    if (!d) return;
    const cfg = PLATFORMS[pk] || { name:pk, color:'#888', maxTitle:100 };
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = buildResultCard(pk, d, cfg, tiktokSc);
    container.appendChild(card);
  });
}

// ──────────────────────────
// Salvar / Regerar
// ──────────────────────────
async function doSaveHistory(silent = false) {
  if (!lastResult || !lastProductData) return;
  try {
    await saveAnuncio({
      product:   lastProductData.product,
      platforms: lastProductData.platforms,
      result:    lastResult,
    });
    detailCache = {};
    renderRecent();
    if (!silent) toast('Salvo no histórico!', 'success');
  } catch(err) {
    if (!silent) toast('Erro ao salvar: ' + err.message, 'error');
  }
}

function reGenerate() {
  if (!lastProductData) return;
  generateAd();
}

function resetGenerate() {
  currentStep = 1;
  selectedPlatforms = [];
  lastResult = null;
  clearLoadingAnimations();

  const ids = ['fProduct','fCategory','fDiff'];
  ids.forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  document.querySelectorAll('.platform-toggle').forEach(t => t.classList.remove('selected'));
  document.getElementById('tiktokToggleRow')?.style.setProperty('display','none');
  document.getElementById('tiktokScriptSw')?.classList.remove('on');

  showStepContent(1);
  updateStepUI();
}
