import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { guestGuard } from './guest-guard';
import { AuthSession } from './auth-session';

describe('guestGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });
  afterAll(() => localStorage.clear());

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
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

  it('lets a logged-out visitor through', () => {
    expect(runGuard()).toBe(true);
  });

  it('sends a logged-in user to the home screen', () => {
    logIn();

    expect(redirectTarget(runGuard())).toBe('/home');
  });
});
