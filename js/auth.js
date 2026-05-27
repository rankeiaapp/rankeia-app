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
