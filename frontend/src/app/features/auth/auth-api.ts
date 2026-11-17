import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../core/config/api-config';
import { AuthResponse } from './auth-response';
import { Credentials } from './credentials';
import { SignupRequest } from './signup-request';

/** The only place that calls the backend's /auth endpoints. */
@Injectable({
  providedIn: 'root',
})
export class AuthApi {
  private readonly http = inject(HttpClient);

  /** Create an account; the backend also logs the new user in and returns the tokens. */
  signup(request: SignupRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_BASE_URL}/auth/signup`, request);
  }

  /** Check the email and password and get the tokens and the user. */
  login(credentials: Credentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_BASE_URL}/auth/login`, credentials);
  }
}
