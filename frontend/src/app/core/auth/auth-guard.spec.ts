import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { authGuard } from './auth-guard';
import { AuthSession } from './auth-session';

describe('authGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });
  afterAll(() => localStorage.clear());

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  function logIn(): void {
    TestBed.inject(AuthSession).saveLogin(
      { access_token: 'access-1', refresh_token: 'refresh-1' },
      'Asha',
    );
  }

  function redirectTarget(result: unknown): string {
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  it('lets a logged-in user through', () => {
    logIn();

    expect(runGuard()).toBe(true);
  });

  it('sends a logged-out user to the login page', () => {
    expect(redirectTarget(runGuard())).toBe('/login');
  });
});
