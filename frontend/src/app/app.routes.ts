import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth-guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    canActivate: [authGuard],
    loadChildren: () => import('./features/home/home.routes').then((m) => m.HOME_ROUTES),
  },
  // Login and sign up live side by side at the top level: /login and /signup.
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  // Until a not-found page exists, unknown paths land on the main screen.
  { path: '**', redirectTo: 'home' },
];
