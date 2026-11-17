import { TestBed } from '@angular/core/testing';

import { AuthSession } from './auth-session';

const STORAGE_KEY = 'recall.auth.session';
const TOKENS = { access_token: 'access-1', refresh_token: 'refresh-1' };

describe('AuthSession', () => {
  beforeEach(() => localStorage.clear());
  afterAll(() => localStorage.clear());

  it('starts logged out, as "Guest", when nothing was saved', () => {
    const session = TestBed.inject(AuthSession);

    expect(session.isLoggedIn()).toBe(false);
    expect(session.accessToken()).toBeNull();
    expect(session.displayName()).toBe('Guest');
  });

  it('is logged in under the given name after saving a login, and keeps it in localStorage', () => {
    const session = TestBed.inject(AuthSession);

    session.saveLogin(TOKENS, 'Samay');

    expect(session.isLoggedIn()).toBe(true);
    expect(session.accessToken()).toBe('access-1');
    expect(session.displayName()).toBe('Samay');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ ...TOKENS, name: 'Samay' });
  });

  it('keeps only the tokens and the name, even if given a larger object', () => {
    const session = TestBed.inject(AuthSession);
    const response = { ...TOKENS, user: { id: '1', email: 'samay@example.com' } };

    session.saveLogin(response, 'Samay');

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ ...TOKENS, name: 'Samay' });
  });

  it('swaps in a new access token and keeps the refresh token and the name', () => {
    const session = TestBed.inject(AuthSession);
    session.saveLogin(TOKENS, 'Samay');

    session.saveAccessToken('access-2');

    expect(session.accessToken()).toBe('access-2');
    expect(session.refreshToken()).toBe('refresh-1');
    expect(session.displayName()).toBe('Samay');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      access_token: 'access-2',
      refresh_token: 'refresh-1',
      name: 'Samay',
    });
  });

  it('ignores a new access token when nobody is logged in', () => {
    const session = TestBed.inject(AuthSession);

    session.saveAccessToken('access-2');

    expect(session.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('is still logged in after a page refresh, because it reads the saved login', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...TOKENS, name: 'Samay' }));

    const session = TestBed.inject(AuthSession);

    expect(session.isLoggedIn()).toBe(true);
    expect(session.accessToken()).toBe('access-1');
    expect(session.displayName()).toBe('Samay');
  });

  it('forgets everything when cleared', () => {
    const session = TestBed.inject(AuthSession);
    session.saveLogin(TOKENS, 'Samay');

    session.clear();

    expect(session.isLoggedIn()).toBe(false);
    expect(session.accessToken()).toBeNull();
    expect(session.displayName()).toBe('Guest');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it.each([
    ['text that is not JSON', 'not json'],
    ['a login with a missing field', JSON.stringify({ access_token: 'only-one' })],
    ['an older login saved without a name', JSON.stringify({ ...TOKENS, email: 'a@b.com' })],
  ])('treats %s in storage as logged out', (_description, stored) => {
    localStorage.setItem(STORAGE_KEY, stored);

    const session = TestBed.inject(AuthSession);

    expect(session.isLoggedIn()).toBe(false);
  });
});
