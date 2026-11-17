import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthSession } from './auth-session';

const LOGIN_URL = '/login';

/** Lets logged-in users through; everyone else is sent to the login page. */
export const authGuard: CanActivateFn = () => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return session.isLoggedIn() || router.parseUrl(LOGIN_URL);
};
