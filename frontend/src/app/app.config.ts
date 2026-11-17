import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { authInterceptor } from './core/http/auth-interceptor';
import { APP_PRESET } from './core/theme/app-preset';
import { DARK_MODE_CLASS } from './core/theme/theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Route params such as :memoryId arrive as component inputs.
    provideRouter(routes, withComponentInputBinding()),
    // Every backend request goes through authInterceptor (adds the token, refreshes on 401).
    provideHttpClient(withInterceptors([authInterceptor])),
    // One app-wide PrimeNG theme; colours come from theme tokens.
    providePrimeNG({
      theme: { preset: APP_PRESET, options: { darkModeSelector: `.${DARK_MODE_CLASS}` } },
    }),
  ],
};
