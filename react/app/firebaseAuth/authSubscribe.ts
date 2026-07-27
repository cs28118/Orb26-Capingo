import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';

/** Minimal user shape used across Capingo routes (Firebase User or E2E stub). */
export type AuthUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

function isE2eBypass(): boolean {
  const flag = import.meta.env.VITE_E2E_BYPASS_AUTH;
  return flag === '1' || flag === 'true';
}

export function getE2eStubUser(): AuthUser {
  return {
    uid: String(import.meta.env.VITE_E2E_UID || 'e2e-tester'),
    displayName: String(import.meta.env.VITE_E2E_NAME || 'E2E Tester'),
    email: String(import.meta.env.VITE_E2E_EMAIL || 'e2e@capingo.test'),
    photoURL: null,
  };
}

/**
 * Subscribe to auth state. When VITE_E2E_BYPASS_AUTH=1, immediately yields a stub user
 * so Playwright can exercise signed-in routes without Firebase credentials.
 */
export function subscribeToAuth(callback: (user: AuthUser | null) => void): () => void {
  if (isE2eBypass()) {
    const user = getE2eStubUser();
    const id = window.setTimeout(() => callback(user), 0);
    return () => window.clearTimeout(id);
  }

  return onAuthStateChanged(auth, (user: User | null) => {
    if (!user) {
      callback(null);
      return;
    }
    callback({
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    });
  });
}

export async function signOutCurrentUser(): Promise<void> {
  if (isE2eBypass()) return;
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

export { isE2eBypass };
