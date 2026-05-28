/* ============================================================
   DB — Firestore Operations
============================================================ */

let currentUser = null;
let userProfile  = null;

// Chamado quando usuário faz login
async function onUserLoggedIn(user) {
  currentUser = user;
  await loadUserProfile();
  hideAuthScreens();
  showApp();
  refreshHomeUI();
  renderRecent();
  refreshStatsUI();
}

// Chamado quando usuário faz logout
function onUserLoggedOut() {
  currentUser  = null;
  userProfile  = null;
  hideApp();
  showScreen('auth-login');
}

// Carregar perfil do Firestore
async function loadUserProfile() {
  if (!currentUser) return;
  const doc = await firebaseDB.collection('users').doc(currentUser.uid).get();
  if (doc.exists) {
    userProfile = doc.data();
  } else {
    userProfile = {
      nome:        currentUser.displayName || 'Usuário',
      email:       currentUser.email,
      plano:       'free',
      apiKey:      '',
      totalGerado: 0,
      geracoesUsadas: 0,
    };
  }
}

// Atualizar perfil no Firestore
async function updateProfile(data) {
  if (!currentUser) return;
  await firebaseDB.collection('users').doc(currentUser.uid).update(data);
  userProfile = { ...userProfile, ...data };
}

// ──────────────────────────
// Controle de Plano / Paywall
// ──────────────────────────

// Verifica se usuário pode gerar
function canGenerate() {
  if (!userProfile) return false;
  const plano = userProfile.plano || 'free';
  if (plano === 'basico' || plano === 'pro') return true;
  // free: 1 geração grátis
  const usadas = userProfile.geracoesUsadas || 0;
  return usadas < 1;
}

// Retorna o plano atual
function getPlano() {
  return userProfile?.plano || 'free';
}

// Incrementa contador de gerações
async function incrementGeracoes() {
  if (!currentUser) return;
  const novoTotal = (userProfile.totalGerado || 0) + 1;
  const novasUsadas = (userProfile.geracoesUsadas || 0) + 1;
  await firebaseDB.collection('users').doc(currentUser.uid).update({
    totalGerado: firebase.firestore.FieldValue.increment(1),
    geracoesUsadas: firebase.firestore.FieldValue.increment(1),
  });
  userProfile.totalGerado = novoTotal;
  userProfile.geracoesUsadas = novasUsadas;
}

// Salvar anúncio no histórico
async function saveAnuncio(data) {
  if (!currentUser) return;
  const ref = await firebaseDB
    .collection('users').doc(currentUser.uid)
    .collection('historico').add({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  return ref.id;
}

// Buscar histórico
async function getHistorico(plataforma = null, limit = 50) {
  if (!currentUser) return [];
  let query = firebaseDB
    .collection('users').doc(currentUser.uid)
    .collection('historico')
    .orderBy('createdAt', 'desc')
    .limit(limit);

  const snap = await query.get();
  let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (plataforma && plataforma !== 'all') {
    items = items.filter(i => i.platforms && i.platforms.includes(plataforma));
  }
  return items;
}

// Deletar anúncio
async function deleteAnuncio(id) {
  if (!currentUser) return;
  await firebaseDB
    .collection('users').doc(currentUser.uid)
    .collection('historico').doc(id).delete();
}

// Buscar stats
async function getStats() {
  if (!currentUser) return {};
  const weekStart = getWeekStart();
  const snap = await firebaseDB
    .collection('users').doc(currentUser.uid)
    .collection('historico')
    .where('createdAt', '>=', weekStart)
    .get();
  const estaSemana = snap.size;

  const allSnap = await firebaseDB
    .collection('users').doc(currentUser.uid)
    .collection('historico')
    .get();
  const platCount = {};
  allSnap.docs.forEach(d => {
    const data = d.data();
    (data.platforms || []).forEach(p => { platCount[p] = (platCount[p] || 0) + 1; });
  });
  let favPlat = null, maxC = 0;
  Object.entries(platCount).forEach(([p, c]) => { if (c > maxC) { maxC = c; favPlat = p; } });

  return {
    totalGerado:        userProfile?.totalGerado || 0,
    estaSemana,
    plataformaFavorita: favPlat,
    tempoEconomizado:   Math.round((userProfile?.totalGerado || 0) * 0.5),
  };
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return firebase.firestore.Timestamp.fromDate(monday);
}

// Retorna a API key do usuário (perfil Firestore > config.js)
function getUserApiKey() {
  return (userProfile?.apiKey) || ANTHROPIC_API_KEY || '';
}
