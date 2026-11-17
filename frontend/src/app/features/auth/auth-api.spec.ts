import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthApi } from './auth-api';

const AUTH_RESPONSE = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  user: {
    id: '1',
    name: 'Asha',
    email: 'asha@example.com',
    created_at: '2026-11-11T00:00:00Z',
  },
};

describe('AuthApi', () => {
  let api: AuthApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AuthApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('signs up by posting name, email and password to /auth/signup and returns the tokens and user', () => {
    const details = { name: 'Asha', email: 'asha@example.com', password: 'correct horse' };
    let result: unknown;

    api.signup(details).subscribe((response) => (result = response));
    const request = http.expectOne('/api/v1/auth/signup');
    request.flush(AUTH_RESPONSE);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(details);
    expect(result).toEqual(AUTH_RESPONSE);
  });

  it('logs in by posting the credentials to /auth/login and returns the tokens and user', () => {
    const credentials = { email: 'asha@example.com', password: 'correct horse' };
    let result: unknown;

    api.login(credentials).subscribe((response) => (result = response));
    const request = http.expectOne('/api/v1/auth/login');
    request.flush(AUTH_RESPONSE);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(credentials);
    expect(result).toEqual(AUTH_RESPONSE);
  });
});
