import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthSession } from '../../../core/auth/auth-session';
import { AuthApi } from '../auth-api';
import { SignupPage } from './signup-page';

const DETAILS = { name: 'Asha', email: 'asha@example.com', password: 'correct horse' };
const RESPONSE = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  user: { id: '1', name: 'Asha', email: 'asha@example.com', created_at: '2026-11-11T00:00:00Z' },
};

describe('SignupPage', () => {
  let fixture: ComponentFixture<SignupPage>;
  let compiled: HTMLElement;
  let signup: ReturnType<typeof vi.fn>;
  let saveLogin: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    signup = vi.fn().mockReturnValue(of(RESPONSE));
    saveLogin = vi.fn();
    await TestBed.configureTestingModule({
      imports: [SignupPage],
      providers: [
        provideRouter([]),
        { provide: AuthApi, useValue: { signup } },
        { provide: AuthSession, useValue: { saveLogin } },
      ],
    }).compileComponents();
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(SignupPage);
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

  async function leaveField(selector: string): Promise<void> {
    compiled.querySelector(selector)!.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function fillInValidDetails(): Promise<void> {
    await typeInto('#signup-name', DETAILS.name);
    await typeInto('#signup-email', DETAILS.email);
    await typeInto('#signup-password', DETAILS.password);
  }

  it('shows a heading, a name box, an email box, a password box and the password rule', () => {
    expect(compiled.querySelector('h1')?.textContent).toContain('Create your account');
    expect(compiled.textContent).toContain('Recall AI');
    expect(compiled.querySelector('#signup-name')).not.toBeNull();
    expect(compiled.querySelector('#signup-email')).not.toBeNull();
    expect(compiled.querySelector('#signup-password')).not.toBeNull();
    expect(compiled.textContent).toContain('At least 8 characters.');
  });

  it('stops the name box from taking more than 50 characters', () => {
    expect(compiled.querySelector('#signup-name')?.getAttribute('maxlength')).toBe('50');
  });

  it('links back to the login page', () => {
    const link = compiled.querySelector<HTMLAnchorElement>('a[href="/login"]');

    expect(link?.textContent).toContain('Log in');
  });

  it('asks for a name, an email and a password, and does not call the backend, when the form is empty', async () => {
    await submitForm();

    expect(compiled.textContent).toContain('Enter your name.');
    expect(compiled.textContent).toContain('Enter your email.');
    expect(compiled.textContent).toContain('Choose a password.');
    expect(signup).not.toHaveBeenCalled();
  });

  it('does not accept a name made only of spaces', async () => {
    await typeInto('#signup-name', '   ');
    await typeInto('#signup-email', DETAILS.email);
    await typeInto('#signup-password', DETAILS.password);

    await submitForm();

    expect(compiled.textContent).toContain('Enter your name.');
    expect(signup).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 8 characters', async () => {
    await typeInto('#signup-name', DETAILS.name);
    await typeInto('#signup-email', DETAILS.email);
    await typeInto('#signup-password', 'short');
    await submitForm();

    expect(compiled.textContent).toContain('Use 8 to 128 characters.');
    expect(compiled.textContent).not.toContain('Enter your email.');
    expect(signup).not.toHaveBeenCalled();
  });

  it('does not complain about empty fields just because they were clicked into and left', async () => {
    await leaveField('#signup-name');
    await leaveField('#signup-email');
    await leaveField('#signup-password');

    expect(compiled.textContent).not.toContain('Enter your name.');
    expect(compiled.textContent).not.toContain('Enter your email.');
    expect(compiled.textContent).not.toContain('Choose a password.');
    expect(compiled.textContent).not.toContain('Enter a valid email address.');
  });

  it('flags a badly typed email once the user leaves the field', async () => {
    await typeInto('#signup-email', 'not-an-email');
    await leaveField('#signup-email');

    expect(compiled.textContent).toContain('Enter a valid email address.');
  });

  it('flags a too short password once the user leaves the field', async () => {
    await typeInto('#signup-password', 'short');
    await leaveField('#signup-password');

    expect(compiled.textContent).toContain('Use 8 to 128 characters.');
  });

  it('signs up with one request, remembers the login under the new name and opens the home screen', async () => {
    await fillInValidDetails();
    await submitForm();

    expect(signup).toHaveBeenCalledExactlyOnceWith(DETAILS);
    expect(saveLogin).toHaveBeenCalledWith(RESPONSE, 'Asha');
    expect(navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('shows the backend message and stays on the page when the email is already taken', async () => {
    signup.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { error: { message: 'An account with this email already exists.' } },
          }),
      ),
    );
    await fillInValidDetails();

    await submitForm();

    expect(compiled.textContent).toContain('An account with this email already exists.');
    expect(saveLogin).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('removes the backend message as soon as the user edits a field', async () => {
    signup.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { error: { message: 'An account with this email already exists.' } },
          }),
      ),
    );
    await fillInValidDetails();
    await submitForm();
    expect(compiled.textContent).toContain('An account with this email already exists.');

    await typeInto('#signup-email', 'someone.else@example.com');

    expect(compiled.textContent).not.toContain('An account with this email already exists.');
  });
});
