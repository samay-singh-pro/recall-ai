import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthSession } from './auth-session';

const HOME_URL = '/home';

/** Keeps logged-in users away from the login and sign up pages by sending them home. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return !session.isLoggedIn() || router.parseUrl(HOME_URL);
};
