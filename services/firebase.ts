import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithCustomToken, Unsubscribe, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../config/firebase';

let app: FirebaseApp | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    // Minimal config required for custom token sign-in.
    const cfg = {
      apiKey: FIREBASE_CONFIG.webApiKey,
      projectId: FIREBASE_CONFIG.projectId,
      appId: FIREBASE_CONFIG.appId,
      authDomain: `${FIREBASE_CONFIG.projectId}.firebaseapp.com`, // typical default; backend issues custom token
      storageBucket: FIREBASE_CONFIG.storageBucket,
    };
    // Avoid duplicate init in Expo fast refresh
    app = getApps().length ? getApps()[0]! : initializeApp(cfg);
  }
  return app!;
}

export function getAuthInstance() { return getAuth(getFirebaseApp()); }
export function getDb() { return getFirestore(getFirebaseApp()); }

export async function firebaseSignInWithCustomToken(token: string): Promise<User> {
  const auth = getAuthInstance();
  const cred = await signInWithCustomToken(auth, token);
  return cred.user;
}

export async function firebaseIdTokenFromGoogleIdToken(googleIdToken: string): Promise<string> {
  const auth = getAuthInstance();
  const credential = GoogleAuthProvider.credential(String(googleIdToken));
  const signedIn = await signInWithCredential(auth, credential);
  return signedIn.user.getIdToken();
}

export function onFirebaseUser(cb: (user: User | null) => void): Unsubscribe {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, cb);
}

// TODO: Add optional persistence config if needed (React Native default is ReactNativeAsyncStorage persistence now in modular SDK).
