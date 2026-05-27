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
      plano:       'starter',
      apiKey:      '',
      totalGerado: 0,
    };
  }
}

// Atualizar perfil no Firestore
async function updateProfile(data) {
  if (!currentUser) return;
  await firebaseDB.collection('users').doc(currentUser.uid).update(data);
  userProfile = { ...userProfile, ...data };
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
  // Incrementar contador
  await firebaseDB.collection('users').doc(currentUser.uid).update({
    totalGerado: firebase.firestore.FieldValue.increment(1),
  });
  userProfile.totalGerado = (userProfile.totalGerado || 0) + 1;
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
  // Stats da semana atual
  const weekStart = getWeekStart();
  const snap = await firebaseDB
    .collection('users').doc(currentUser.uid)
    .collection('historico')
    .where('createdAt', '>=', weekStart)
    .get();
  const estaSemana = snap.size;

  // Plataforma favorita
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
