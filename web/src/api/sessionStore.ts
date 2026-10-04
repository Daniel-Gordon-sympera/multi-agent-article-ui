/**
 * A tiny framework-free store that `fetchJson` consults for the CSRF token and notifies when
 * the backend says the session is gone (`401 not_authenticated`) or a password change is
 * required (`403 password_change_required`). `SessionProvider` wires it to React state.
 */

type Listener = () => void;

interface SessionStoreState {
  csrfToken: string | null;
}

const state: SessionStoreState = { csrfToken: null };
const signedOutListeners = new Set<Listener>();
const passwordChangeListeners = new Set<Listener>();

export const sessionStore = {
  getCsrfToken(): string | null {
    return state.csrfToken;
  },
  setCsrfToken(token: string | null): void {
    state.csrfToken = token;
  },
  /** Called by the client on `401 not_authenticated`. */
  signedOut(): void {
    state.csrfToken = null;
    for (const listener of signedOutListeners) listener();
  },
  /** Called by the client on `403 password_change_required`. */
  passwordChangeRequired(): void {
    for (const listener of passwordChangeListeners) listener();
  },
  onSignedOut(listener: Listener): () => void {
    signedOutListeners.add(listener);
    return () => signedOutListeners.delete(listener);
  },
  onPasswordChangeRequired(listener: Listener): () => void {
    passwordChangeListeners.add(listener);
    return () => passwordChangeListeners.delete(listener);
  },
  /** Test helper. */
  reset(): void {
    state.csrfToken = null;
    signedOutListeners.clear();
    passwordChangeListeners.clear();
  },
};
