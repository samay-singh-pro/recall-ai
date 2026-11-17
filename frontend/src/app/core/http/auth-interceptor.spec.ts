import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthSession } from '../auth/auth-session';
import { authInterceptor } from './auth-interceptor';

const MEMORIES_URL = '/api/v1/memories';
const REFRESH_URL = '/api/v1/auth/refresh';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: AuthSession;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
  });
  afterEach(() => backend.verify());
  afterAll(() => localStorage.clear());

  function logIn(): void {
    session.saveLogin({ access_token: 'access-1', refresh_token: 'refresh-1' }, 'Asha');
  }

  it('adds the access token to backend requests', () => {
    logIn();

    http.get(MEMORIES_URL).subscribe();

    const request = backend.expectOne(MEMORIES_URL);
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush([]);
  });

  it('does not send the token to other websites', () => {
    logIn();

    http.get('https://example.com/data').subscribe();

    const request = backend.expectOne('https://example.com/data');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('does not add a token, or try to refresh, on login', () => {
    logIn();
    let status = 0;

    http.post('/api/v1/auth/login', {}).subscribe({ error: (error) => (status = error.status) });

    const request = backend.expectOne('/api/v1/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
    expect(session.isLoggedIn()).toBe(true);
  });

  it('on a 401, gets a new access token and repeats the request with it', () => {
    logIn();
    let result: unknown;

    http.get(MEMORIES_URL).subscribe((body) => (result = body));
    backend.expectOne(MEMORIES_URL).flush({}, { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.expectOne(REFRESH_URL);
    expect(refresh.request.body).toEqual({ refresh_token: 'refresh-1' });
    refresh.flush({ access_token: 'access-2' });

    const retry = backend.expectOne(MEMORIES_URL);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ items: [] });
    expect(result).toEqual({ items: [] });
    expect(session.accessToken()).toBe('access-2');
    expect(session.refreshToken()).toBe('refresh-1');
  });

  it('logs the user out and goes to the login page when the refresh fails', () => {
    logIn();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    let status = 0;

    http.get(MEMORIES_URL).subscribe({ error: (error) => (status = error.status) });
    backend.expectOne(MEMORIES_URL).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(REFRESH_URL).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(session.isLoggedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('keeps the user logged in when the repeated request fails for another reason', () => {
    logIn();
    let status = 0;

    http.get(MEMORIES_URL).subscribe({ error: (error) => (status = error.status) });
    backend.expectOne(MEMORIES_URL).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(REFRESH_URL).flush({ access_token: 'access-2' });
    backend.expectOne(MEMORIES_URL).flush({}, { status: 404, statusText: 'Not Found' });

    expect(status).toBe(404);
    expect(session.isLoggedIn()).toBe(true);
  });

  it('passes other errors on without trying to refresh', () => {
    logIn();
    let status = 0;

    http.get(MEMORIES_URL).subscribe({ error: (error) => (status = error.status) });
    backend.expectOne(MEMORIES_URL).flush({}, { status: 500, statusText: 'Server Error' });

    expect(status).toBe(500);
    backend.expectNone(REFRESH_URL);
  });
});
