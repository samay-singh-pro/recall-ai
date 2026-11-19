import { Injectable, computed, signal } from '@angular/core';

import { AuthTokens } from './auth-tokens';

const STORAGE_KEY = 'recall.auth.session';
const FALLBACK_NAME = 'Guest';

// What is kept between visits: the tokens, plus the user's name so the app can greet them.
interface StoredLogin extends AuthTokens {
  name: string;
}

/**
 * Who is logged in: the only place that holds the login tokens.
 * They are kept in localStorage so a page refresh does not log you out.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthSession {
  private readonly login = signal<StoredLogin | null>(readStoredLogin());

  readonly isLoggedIn = computed(() => this.login() !== null);
  /** The name the user gave at signup; "Guest" when logged out. */
  readonly displayName = computed(() => this.login()?.name ?? FALLBACK_NAME);

  /** The access token to send with requests, or null when logged out. */
  accessToken(): string | null {
    return this.login()?.access_token ?? null;
  }

  /** The refresh token, used to get a new access token, or null when logged out. */
  refreshToken(): string | null {
    return this.login()?.refresh_token ?? null;
  }

  /** Remember a fresh login, in memory and in the browser's storage. */
  saveLogin(tokens: AuthTokens, name: string): void {
    // Only the tokens and the name are kept, even if the caller passes a larger object.
    this.store({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      name,
    });
  }

  /** Swap in a new access token after a refresh; the user stays logged in under the same name. */
  saveAccessToken(accessToken: string): void {
    const login = this.login();
    if (login === null) return;
    this.store({ ...login, access_token: accessToken });
  }

  /** Forget the login, which logs the user out. */
  clear(): void {
    this.login.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing was stored, so nothing to remove.
    }
  }

  /** Keep a login in memory and in the browser's storage. */
  private store(login: StoredLogin): void {
    this.login.set(login);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(login));
    } catch {
      // Storage can be blocked (e.g. private windows); the login still works until the tab closes.
    }
  }
}

/** Read the login saved by an earlier visit; anything missing or damaged counts as logged out. */
function readStoredLogin(): StoredLogin | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return null;

    const parsed = JSON.parse(stored) as Partial<StoredLogin>;
    const isComplete =
      typeof parsed.access_token === 'string' &&
      typeof parsed.refresh_token === 'string' &&
      typeof parsed.name === 'string';
    return isComplete ? (parsed as StoredLogin) : null;
  } catch {
    return null;
  }
}
