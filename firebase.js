import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, EmailAuthProvider, linkWithCredential, linkWithPopup, sendPasswordResetEmail, signOut, updateProfile
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCTNjOqtdChzQ4iesRH2oGN9H2kE7qz5R4',
  authDomain: 'khiyati-prestige.firebaseapp.com',
  projectId: 'khiyati-prestige',
  storageBucket: 'khiyati-prestige.firebasestorage.app',
  messagingSenderId: '631033193994',
  appId: '1:631033193994:web:da127c2ed7ce58cd0ca1f3'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
let currentUser = null;
let authMode = 'login';
let firstAuthLoad = true;

const authError = (message) => {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = message;
};
const firebaseMessage = (error) => {
  const code = error?.code || '';
  const messages = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/user-not-found': 'No account was found with this email address.',
    'auth/wrong-password': 'The password is incorrect.',
    'auth/email-already-in-use': 'This email address is already in use.',
    'auth/weak-password': 'The password must be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/popup-closed-by-user': 'The Google sign-in window was closed before completion.',
    'auth/popup-blocked': 'The browser blocked the Google sign-in window. Allow pop-ups and try again.',
    'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Authentication.',
    'auth/api-key-not-valid': 'The Firebase Web API key is invalid. Check the project configuration.',
    'auth/invalid-api-key': 'The Firebase Web API key is invalid. Check the project configuration.',
    'auth/configuration-not-found': 'Firebase Authentication is not configured for this project.',
    'auth/admin-restricted-operation': 'This operation is disabled by the Firebase project administrator.',
    'auth/internal-error': 'Firebase returned an internal authentication error. Check the project settings.',
    'auth/network-request-failed': 'No internet connection. Local data will remain available.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.'
  };
  return messages[code] || `Authentication error (${code || 'unknown'}). Check Firebase Authentication settings and try again.`;
};

async function ensureUserDocument(user) {
  const userRef = doc(db, 'users', user.uid, 'appData', 'main');
  try {
    await window.restoreIndexedDbBackup?.(user.uid);
    if (window.hasPendingLocalSync?.(user.uid)) {
      await window.firebaseSyncAppData?.(window.getAppDataSnapshot?.() || {});
      window.firebaseCloudStatus?.('تمت مزامنة تعديلات وضع عدم الاتصال');
      return;
    }
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
      if (window.applyAppDataSnapshot) window.applyAppDataSnapshot(snapshot.data());
    } else {
      const localData = window.getAppDataSnapshot ? window.getAppDataSnapshot() : {};
      await setDoc(userRef, {
        ...localData,
        ownerUid: user.uid,
        schemaVersion: 1,
        updatedAt: serverTimestamp()
      }, { merge: false });
    }
    window.firebaseCloudStatus?.('متصل بالسحابة');
  } catch (error) {
    console.error('Firestore user document error:', error);
    window.firebaseCloudStatus?.('وضع محلي — تعذر مزامنة السحابة');
  }
}

window.firebaseSyncAppData = async (data) => {
  if (!currentUser || !navigator.onLine) return;
  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'appData', 'main'), {
      ...data,
      ownerUid: currentUser.uid,
      schemaVersion: 1,
      updatedAt: serverTimestamp()
    }, { merge: false });
    window.clearLocalSyncPending?.(currentUser.uid);
    await window.clearIndexedDbBackup?.(currentUser.uid);
    window.firebaseCloudStatus?.('تمت المزامنة السحابية');
  } catch (error) {
    console.error('Firestore sync error:', error);
    window.firebaseCloudStatus?.('حُفظت محليًا — ستتم المزامنة لاحقًا');
  }
};

window.submitAuthForm = async (event) => {
  event.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || password.length < 6) return authError('Enter a valid email and a password of at least 6 characters.');
  const submit = document.getElementById('auth-submit');
  submit.disabled = true;
  authError('');
  try {
    if (authMode === 'signup') {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      window.prepareUserLocalData?.(result.user.uid);
      await updateProfile(result.user, { displayName: window.getCurrentUserName?.() || 'خولة' }).catch(() => {});
      await ensureUserDocument(result.user);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    console.error('Firebase authentication error:', error);
    authError(firebaseMessage(error));
  } finally {
    submit.disabled = false;
  }
};

window.toggleAuthMode = () => {
  authMode = authMode === 'login' ? 'signup' : 'login';
  document.querySelector('.auth-title').textContent = authMode === 'login' ? 'Welcome back' : 'Create your account';
  document.querySelector('.auth-subtitle').textContent = authMode === 'login' ? 'Sign in to manage your orders and data securely from any device' : 'Start organizing your sewing workshop and keep your data safe';
  document.getElementById('auth-submit').textContent = authMode === 'login' ? 'Sign in' : 'Create account';
  document.getElementById('auth-mode-toggle').textContent = authMode === 'login' ? 'Create one' : 'Sign in';
  document.getElementById('auth-password').setAttribute('autocomplete', authMode === 'login' ? 'current-password' : 'new-password');
  authError('');
};

window.resetPassword = async (event) => {
  event.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  if (!email) return authError('Enter your email address first to receive a reset link.');
  try {
    await sendPasswordResetEmail(auth, email);
    authError('✅ A password reset link has been sent to your email.');
  } catch (error) { authError(firebaseMessage(error)); }
};

window.loginWithGoogle = async () => {
  authError('');
  try {
    const result = await signInWithPopup(auth, googleProvider);
    window.prepareUserLocalData?.(result.user.uid);
    await ensureUserDocument(result.user);
    if (!result.user.providerData.some(provider => provider.providerId === 'password')) {
      document.getElementById('google-password-modal')?.classList.remove('hidden');
    }
  } catch (error) { authError(firebaseMessage(error)); }
};
window.linkEmailPassword = async (event) => {
  event.preventDefault();
  if (!currentUser) return authError('Please sign in first.');
  const password = document.getElementById('google-account-password-modal')?.value || document.getElementById('google-account-password')?.value || '';
  const confirmation = document.getElementById('google-account-password-confirm-modal')?.value || document.getElementById('google-account-password-confirm')?.value || '';
  if (password.length < 6) return window.showAlert?.('كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.');
  if (password !== confirmation) return window.showAlert?.('كلمتا المرور غير متطابقتين.');
  if (currentUser.providerData.some(provider => provider.providerId === 'password')) {
    return window.showAlert?.('هذا الحساب مرتبط مسبقًا بتسجيل الدخول عبر البريد.');
  }
  try {
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await linkWithCredential(currentUser, credential);
    document.getElementById('google-account-password')?.form?.reset();
    document.getElementById('google-password-panel')?.classList.add('hidden');
    document.getElementById('google-password-modal')?.classList.add('hidden');
    window.showAlert?.('✅ تمت إضافة كلمة المرور. يمكنك الآن الدخول عبر Google أو البريد وكلمة المرور.');
  } catch (error) {
    console.error('Firebase provider linking error:', error);
    window.showAlert?.(firebaseMessage(error));
  }
};

window.linkGoogleProvider = async () => {
  if (!currentUser) return authError('Please sign in first.');
  if (currentUser.providerData.some(provider => provider.providerId === 'google.com')) {
    return window.showAlert?.('هذا الحساب مرتبط مسبقًا بحساب Google.');
  }
  try {
    await linkWithPopup(currentUser, googleProvider);
    document.getElementById('email-google-panel')?.classList.add('hidden');
    window.showAlert?.('✅ تم ربط Google بالحساب. يمكنك الآن استخدام الطريقتين بنفس الحساب.');
  } catch (error) {
    console.error('Firebase Google linking error:', error);
    window.showAlert?.(firebaseMessage(error));
  }
};

window.logoutUser = async () => {
  try { await signOut(auth); } catch (error) { alert('❌ تعذر تسجيل الخروج.'); }
};

document.getElementById('google-sign-in')?.addEventListener('click', window.loginWithGoogle);

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    window.prepareUserLocalData?.(user.uid);
    await ensureUserDocument(user);
    window.handleFirebaseUser?.(user);
  } else {
    window.handleFirebaseSignedOut?.();
  }
});

window.addEventListener('online', () => {
  if (currentUser && window.getAppDataSnapshot) window.firebaseSyncAppData(window.getAppDataSnapshot());
});
