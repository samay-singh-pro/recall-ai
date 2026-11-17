import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthSession } from '../../../core/auth/auth-session';
import { AuthApi } from '../auth-api';
import { LoginPage } from './login-page';

const RESPONSE = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  user: { id: '1', name: 'Asha', email: 'asha@example.com', created_at: '2026-11-11T00:00:00Z' },
};

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let compiled: HTMLElement;
  let login: ReturnType<typeof vi.fn>;
  let saveLogin: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    login = vi.fn().mockReturnValue(of(RESPONSE));
    saveLogin = vi.fn();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthApi, useValue: { login } },
        { provide: AuthSession, useValue: { saveLogin } },
      ],
    }).compileComponents();
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
    compiled = fixture.nativeElement as HTMLElement;
  });

  async function submitForm(): Promise<void> {
    compiled.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  async function typeInto(selector: string, value: string): Promise<void> {
    const input = compiled.querySelector<HTMLInputElement>(selector);
    input!.value = value;
    input!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function fillInValidDetails(): Promise<void> {
    await typeInto('#login-email', 'asha@example.com');
    await typeInto('#login-password', 'correct horse');
  }

  it('shows the app name, an email box and a password box', () => {
    expect(compiled.querySelector('h1')?.textContent).toContain('Welcome back');
    expect(compiled.textContent).toContain('Recall AI');
    expect(compiled.querySelector('#login-email')).not.toBeNull();
    expect(compiled.querySelector('#login-password')).not.toBeNull();
  });

  it('links to the sign up page', () => {
    const link = compiled.querySelector<HTMLAnchorElement>('a[href="/signup"]');

    expect(link?.textContent).toContain('Create an account');
  });

  it('shows no errors before the user has tried anything', () => {
    expect(compiled.textContent).not.toContain('Enter your email.');
    expect(compiled.textContent).not.toContain('Enter your password.');
  });

  it('asks for the email and password, and does not call the backend, when the form is empty', async () => {
    await submitForm();

    expect(compiled.textContent).toContain('Enter your email.');
    expect(compiled.textContent).toContain('Enter your password.');
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects an email address that is not an email', async () => {
    await typeInto('#login-email', 'not-an-email');
    await submitForm();

    expect(compiled.textContent).toContain('Enter a valid email address.');
    expect(compiled.textContent).not.toContain('Enter your email.');
    expect(login).not.toHaveBeenCalled();
  });

  it('logs in with the typed details, remembers the login under the returned name and opens the home screen', async () => {
    await fillInValidDetails();
    await submitForm();

    expect(login).toHaveBeenCalledWith({ email: 'asha@example.com', password: 'correct horse' });
    expect(saveLogin).toHaveBeenCalledWith(RESPONSE, 'Asha');
    expect(navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('shows the backend message and stays on the page when the login is refused', async () => {
    login.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { error: { message: 'The email or password is wrong.' } },
          }),
      ),
    );
    await fillInValidDetails();

    await submitForm();

    expect(compiled.textContent).toContain('The email or password is wrong.');
    expect(saveLogin).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  async function leaveField(selector: string): Promise<void> {
    compiled.querySelector(selector)!.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  it('does not complain about an empty field just because it was clicked into and left', async () => {
    await leaveField('#login-email');
    await leaveField('#login-password');

    expect(compiled.textContent).not.toContain('Enter your email.');
    expect(compiled.textContent).not.toContain('Enter a valid email address.');
    expect(compiled.textContent).not.toContain('Enter your password.');
  });

  it('flags a badly typed email once the user leaves the field', async () => {
    await typeInto('#login-email', 'not-an-email');
    await leaveField('#login-email');

    expect(compiled.textContent).toContain('Enter a valid email address.');
  });

  it('removes the backend message as soon as the user edits a field', async () => {
    login.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { error: { message: 'The email or password is wrong.' } },
          }),
      ),
    );
    await fillInValidDetails();
    await submitForm();
    expect(compiled.textContent).toContain('The email or password is wrong.');

    await typeInto('#login-password', 'another try');

    expect(compiled.textContent).not.toContain('The email or password is wrong.');
  });
});
