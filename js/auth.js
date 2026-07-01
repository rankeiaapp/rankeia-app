/* ============================================================
   AUTH — Firebase Authentication
============================================================ */

let firebaseApp, firebaseAuth, firebaseDB;

// Inicializa Firebase
function initFirebase() {
  firebaseApp  = firebase.initializeApp(FIREBASE_CONFIG);
  firebaseAuth = firebase.auth();
  firebaseDB   = firebase.firestore();

  // Listener de estado de autenticação
  firebaseAuth.onAuthStateChanged(user => {
    if (user) {
      onUserLoggedIn(user);
    } else {
      onUserLoggedOut();
    }
  });
}

// Login com email/senha
async function login(email, password) {
  const res = await firebaseAuth.signInWithEmailAndPassword(email, password);
  return res.user;
}

// Cadastro
async function register(email, password, nome) {
  const res = await firebaseAuth.createUserWithEmailAndPassword(email, password);
  await res.user.updateProfile({ displayName: nome });
  // Criar perfil no Firestore
  await firebaseDB.collection('users').doc(res.user.uid).set({
    nome,
    email,
    plano: 'starter',
    apiKey: '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    totalGerado: 0,
  });
  return res.user;
}

// Logout
async function logout() {
  await firebaseAuth.signOut();
}

// Recuperar senha
async function resetPassword(email) {
  await firebaseAuth.sendPasswordResetEmail(email);
}

// Google Sign-In
async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const res = await firebaseAuth.signInWithPopup(provider);
  // Criar perfil se for novo usuário
  const doc = await firebaseDB.collection('users').doc(res.user.uid).get();
  if (!doc.exists) {
    await firebaseDB.collection('users').doc(res.user.uid).set({
      nome:       res.user.displayName || 'Usuário',
      email:      res.user.email,
      plano:      'starter',
      apiKey:     '',
      createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
      totalGerado: 0,
    });
  }
  return res.user;
}
// ============================================================
//  EXCLUIR CONTA — função para adicionar ao auth.js
//  Apaga o histórico, o perfil no Firestore e a conta no Auth
// ============================================================

async function excluirConta() {
  if (!currentUser) {
    toast('Você precisa estar logado.', 'error');
    return;
  }

  // Confirmação dupla — ação irreversível
  const confirma = confirm(
    'Tem certeza que deseja excluir sua conta?\n\n' +
    'Isso apaga permanentemente:\n' +
    '• Seu perfil\n' +
    '• Todo o seu histórico de anúncios\n\n' +
    'Esta ação não pode ser desfeita.'
  );
  if (!confirma) return;

  try {
    const uid = currentUser.uid;

    // 1. Apagar todos os documentos do histórico
    const histSnap = await firebaseDB
      .collection('users').doc(uid)
      .collection('historico').get();

    const batch = firebaseDB.batch();
    histSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // 2. Apagar o documento do perfil
    await firebaseDB.collection('users').doc(uid).delete();

    // 3. Apagar a conta do Firebase Auth
    await currentUser.delete();

    toast('Sua conta foi excluída.', 'info');
    // O onAuthStateChanged vai detectar o logout e voltar para a tela de login

  } catch (err) {
    // Firebase exige login recente para deletar a conta de Auth
    if (err.code === 'auth/requires-recent-login') {
      toast('Por segurança, faça login novamente antes de excluir a conta.', 'error');
      await logout();
    } else {
      toast('Erro ao excluir conta. Tente novamente.', 'error');
    }
  }
}
