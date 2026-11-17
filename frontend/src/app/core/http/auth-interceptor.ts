import {
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthSession } from '../auth/auth-session';
import { AuthTokens } from '../auth/auth-tokens';
import { API_BASE_URL } from '../config/api-config';

const REFRESH_URL = `${API_BASE_URL}/auth/refresh`;
// These calls happen before there is a login, so they get no token and no refresh-on-401.
// (A 401 from login only means a wrong password.)
const PUBLIC_URLS = [`${API_BASE_URL}/auth/signup`, `${API_BASE_URL}/auth/login`, REFRESH_URL];
const LOGIN_PAGE_URL = '/login';

/**
 * Adds the access token to every backend request. If the backend answers 401 (token expired),
 * gets a new access token with the refresh token and repeats the request once.
 * If that fails too, the user is logged out and sent to the login page.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(AuthSession);
  const http = inject(HttpClient);
  const router = inject(Router);

  if (!request.url.startsWith(API_BASE_URL) || PUBLIC_URLS.includes(request.url)) {
    return next(request);
  }

  const logOut = (error: unknown) => {
    session.clear();
    void router.navigateByUrl(LOGIN_PAGE_URL);
    return throwError(() => error);
  };

  return next(withToken(request, session.accessToken())).pipe(
    catchError((error: unknown) => {
      // 1. Anything other than "not logged in" is not our business
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      // 2. No refresh token means there is nothing to try
      const refreshToken = session.refreshToken();
      if (refreshToken === null) return logOut(error);

      // 3. Get a new access token. The refresh error is handled before the retry,
      // so a failing retry is passed on as it is and does not log the user out.
      return http
        .post<Pick<AuthTokens, 'access_token'>>(REFRESH_URL, { refresh_token: refreshToken })
        .pipe(
          catchError(() => logOut(error)),
          switchMap(({ access_token }) => {
            session.saveAccessToken(access_token);
            return next(withToken(request, access_token));
          }),
        );
    }),
  );
};

/** Copy the request with the "Authorization: Bearer ..." header, if there is a token. */
function withToken(
  request: HttpRequest<unknown>,
  accessToken: string | null,
): HttpRequest<unknown> {
  if (accessToken === null) return request;
  return request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } });
}
