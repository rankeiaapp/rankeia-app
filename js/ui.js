/* ============================================================
   UI — Helpers, Toast, Render
============================================================ */

// ──────────────────────────
// Escape HTML
// ──────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

// ──────────────────────────
// Toast
// ──────────────────────────
function toast(msg, type = 'info') {
  const wrap = document.getElementById('toastWrap');
  const el   = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success:'✓', error:'✕', info:'ℹ', warning:'⚠' };
  el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ'}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

// ──────────────────────────
// Navegação de telas
// ──────────────────────────
let activeScreen = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) { el.classList.add('active'); el.scrollTop = 0; }
  activeScreen = id;
}

function showApp() {
  document.getElementById('appShell').style.display = 'flex';
  document.getElementById('authShell').style.display = 'none';
  showScreen('home');
  updateNavActive('home');
}

function hideApp() {
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('authShell').style.display = 'flex';
}

function showAuthScreens() {
  document.getElementById('authShell').style.display = 'flex';
}

function hideAuthScreens() {
  document.getElementById('authShell').style.display = 'none';
}

function navigateTo(screen) {
  showScreen(screen);
  updateNavActive(screen);
  if (screen === 'history')  { renderHistoryScreen(); }
  if (screen === 'account')  { renderAccountScreen(); }
  if (screen === 'home')     { renderRecent(); refreshHomeUI(); }
  if (screen === 'generate') { /* já gerenciado pelo stepper */ }
}

function updateNavActive(screen) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = document.getElementById('nav-' + screen);
  if (nav) nav.classList.add('active');
}

// ──────────────────────────
// Home UI
// ──────────────────────────
function refreshHomeUI() {
  if (!userProfile) return;
  const nome = userProfile.nome || currentUser?.displayName || 'Usuário';
  const ini  = getInitials(nome);
  setEl('homeAvatar', ini);
  setEl('homeGreeting', `Olá, ${nome.split(' ')[0]} 👋`);
  setEl('homeTotal', userProfile.totalGerado || 0);
}

// ──────────────────────────
// Account UI
// ──────────────────────────
async function renderAccountScreen() {
  if (!userProfile) return;
  const nome = userProfile.nome || 'Usuário';
  const ini  = getInitials(nome);
  setEl('acctAvatar', ini);
  setEl('acctName',   nome);
  setEl('acctEmail',  currentUser?.email || '');

  const inp = document.getElementById('apiKeyInput');
  if (inp) inp.value = userProfile.apiKey || '';

  const stats = await getStats();
  const total = stats.totalGerado || 0;
  const pct   = Math.min((total / 30) * 100, 100);
  setEl('planLabel', `${total}/30 anúncios este mês`);
  const bar = document.getElementById('usageBar');
  if (bar) bar.style.width = pct + '%';
  refreshStatsUI(stats);
}

async function refreshStatsUI(stats) {
  if (!stats) stats = await getStats();
  setEl('stTotal', stats.totalGerado || 0);
  setEl('stWeek',  stats.estaSemana  || 0);
  setEl('stFav',   stats.plataformaFavorita ? (PLATFORMS[stats.plataformaFavorita]?.name || '—') : '—');
  setEl('stTime',  (stats.tempoEconomizado || 0) + 'h');
}

// ──────────────────────────
// Histórico
// ──────────────────────────
let histFilter = 'all';

async function renderHistoryScreen() {
  const list = await getHistorico(histFilter === 'all' ? null : histFilter);
  const el   = document.getElementById('historyList');
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `<div class="empty-full">
      <img src="mascote-rank-trofeu.png" alt="Nenhum anuncio ainda" class="mascote-historico">
      <p>Nenhum anuncio salvo ainda</p>
      <button class="btn-primary" style="width:auto;padding:10px 22px;font-size:13px;margin-top:12px;" onclick="navigateTo('generate');resetGenerate();">
        Gerar primeiro anuncio
      </button>
    </div>`;
    return;
  }

  el.innerHTML = list.map(item => {
    const chips = (item.platforms || []).map(p => {
      const c = PLATFORMS[p];
      return `<span class="plat-chip" style="background:${c?.color}22;color:${c?.color};border:1px solid ${c?.color}44;">${c?.name||p}</span>`;
    }).join('');
    const fp   = (item.platforms || [])[0];
    const fdp  = item.result?.plataformas?.[fp];
    const prev = fdp?.titulo || 'Sem título';
    const dt   = item.createdAt?.toDate
      ? item.createdAt.toDate().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
      : '—';
    return `
      <div class="history-card">
        <div class="hc-top">
          <div class="hc-product">${esc(item.product)}</div>
          <div class="hc-date">${dt}</div>
        </div>
        <div class="hc-platforms">${chips}</div>
        <div class="hc-preview">${esc(prev)}</div>
        <div class="hc-actions">
          <button class="hc-btn primary" onclick="openDetail('${item.id}')">Ver completo</button>
          <button class="hc-btn"         onclick="copyItem('${item.id}')">Copiar</button>
          <button class="hc-btn danger"  onclick="removeItem('${item.id}')">Deletar</button>
        </div>
      </div>`;
  }).join('');
}

async function renderRecent() {
  const list = await getHistorico(null, 3);
  const el   = document.getElementById('recentList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="card"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
        <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/>
      </svg><p>Seus anúncios aparecem aqui</p>
    </div></div>`;
    return;
  }
  el.innerHTML = list.map(item => {
    const fp  = (item.platforms||[])[0];
    const cfg = PLATFORMS[fp]||{};
    const fdp = item.result?.plataformas?.[fp];
    return `<div class="recent-item" onclick="openDetail('${item.id}')">
      <div class="recent-dot" style="background:${cfg.color||'#888'}"></div>
      <div class="recent-info">
        <div class="recent-name">${esc(item.product)}</div>
        <div class="recent-prev">${esc(fdp?.titulo||'Sem título')}</div>
      </div>
      <div class="recent-plat">${cfg.name||''}</div>
    </div>`;
  }).join('');
}

// ──────────────────────────
// Detalhe do histórico
// ──────────────────────────
let detailCache = {};

async function openDetail(id) {
  let item = detailCache[id];
  if (!item) {
    const list = await getHistorico();
    item = list.find(h => h.id === id);
    if (item) detailCache[id] = item;
  }
  if (!item) return;
  setEl('detailTitle', item.product);
  const body = document.getElementById('detailBody');
  body.innerHTML = '';
  (item.platforms||[]).forEach(pk => {
    const d   = item.result?.plataformas?.[pk];
    if (!d) return;
    const cfg = PLATFORMS[pk]||{name:pk,color:'#888',maxTitle:100};
    const div = document.createElement('div');
    div.className = 'result-card';
    div.style.marginBottom = '16px';
    div.innerHTML = buildResultCard(pk, d, cfg, false);
    body.appendChild(div);
  });
  document.getElementById('detailOverlay').classList.add('open');
}

function closeDetail() {
  document.getElementById('detailOverlay').classList.remove('open');
}

async function removeItem(id) {
  await deleteAnuncio(id);
  detailCache = {};
  renderHistoryScreen();
  renderRecent();
  toast('Anúncio removido', 'info');
}

async function copyItem(id) {
  const list = await getHistorico();
  const item = list.find(h => h.id === id);
  if (!item) return;
  const fp = (item.platforms||[])[0];
  const d  = item.result?.plataformas?.[fp];
  if (!d) return;
  const txt = [d.titulo, d.descricao, d.tags ? 'Tags: '+d.tags.join(', '):''].filter(Boolean).join('\n\n');
  navigator.clipboard.writeText(txt).then(() => toast('Copiado!','success'));
}

function setFilter(el, f) {
  histFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderHistoryScreen();
}

// ──────────────────────────
// Resultado da geração
// ──────────────────────────
function buildResultCard(pk, d, cfg, tiktokSc) {
  let html = `
    <div class="result-card-header">
      <div class="rp-dot" style="background:${cfg.color}"></div>
      <div class="rp-name">${cfg.name}</div>
      <div class="seo-badge">SEO otimizado</div>
    </div>`;

  if (d.titulo) {
    const len = d.titulo.length, max = cfg.maxTitle;
    const pct = len/max;
    const cls = pct<0.8?'green':pct<0.95?'yellow':'red';
    html += `<div class="result-section">
      <div class="rs-label">TÍTULO OTIMIZADO</div>
      <div class="rs-row">
        <div class="rs-text" id="t_${pk}">${esc(d.titulo)}</div>
        ${mkCopyBtn('t_'+pk)}
      </div>
      <div class="char-count ${cls}">${len}/${max} caracteres</div>
    </div>`;
  }
  if (d.descricao) {
    html += `<div class="result-section">
      <div class="rs-label">DESCRIÇÃO</div>
      <div class="rs-row">
        <div class="rs-text" id="d_${pk}">${esc(d.descricao).replace(/\n/g,'<br>')}</div>
        ${mkCopyBtn('d_'+pk)}
      </div>
    </div>`;
  }
  if (d.tags && d.tags.length) {
    const chips = d.tags.map(t=>`<div class="tag-chip" onclick="copyTag('${esc(t).replace(/'/g,"\\'")}',this)">${esc(t)}</div>`).join('');
    html += `<div class="result-section">
      <div class="rs-label">PALAVRAS-CHAVE</div>
      <div class="tags-wrap">${chips}</div>
    </div>`;
  }
  if (pk==='tiktok_shop' && tiktokSc && d.script_15s) {
    const s = d.script_15s;
    html += `<div class="result-section">
      <div class="rs-label">SCRIPT 15s</div>
      <div class="script-cue"><div class="script-label">HOOK (0-3s)</div><div class="script-text">${esc(s.hook||'')}</div></div>
      <div class="script-cue"><div class="script-label">PRODUTO (3-10s)</div><div class="script-text">${esc(s.produto||'')}</div></div>
      <div class="script-cue"><div class="script-label">CTA (10-15s)</div><div class="script-text">${esc(s.cta||'')}</div></div>
    </div>`;
  }
  return html;
}

function mkCopyBtn(id) {
  return `<div class="copy-btn" onclick="doCopy('${id}',this)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg></div>`;
}

function doCopy(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    }, 2000);
    toast('Copiado!','success');
  });
}

function copyTag(text, el) {
  navigator.clipboard.writeText(text).then(() => {
    el.style.background='rgba(0,212,170,0.2)';
    el.style.borderColor='rgba(0,212,170,0.4)';
    el.style.color='var(--success)';
    setTimeout(()=>{ el.style.background=''; el.style.borderColor=''; el.style.color=''; }, 1500);
    toast('Tag copiada!','success');
  });
}

// ──────────────────────────
// Util
// ──────────────────────────
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function getInitials(nome) {
  return (nome||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
}
