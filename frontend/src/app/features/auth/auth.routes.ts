import { Routes } from '@angular/router';

import { guestGuard } from '../../core/auth/guest-guard';
import { LoginPage } from './login-page/login-page';
import { SignupPage } from './signup-page/signup-page';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: LoginPage, canActivate: [guestGuard], title: 'Log in · Recall AI' },
  {
    path: 'signup',
    component: SignupPage,
    canActivate: [guestGuard],
    title: 'Sign up · Recall AI',
  },
];
