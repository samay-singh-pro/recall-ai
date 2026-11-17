import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';

import { AuthSession } from '../../../core/auth/auth-session';
import { getApiErrorMessage } from '../../../core/http/api-error-message';
import { AuthApi } from '../auth-api';
import { AuthShell } from '../components/auth-shell/auth-shell';

const HOME_URL = '/home';
// Must match the backend's rules (SignupRequest).
const NAME_MAX_LENGTH = 50;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/** The sign up screen: email and a new password. */
@Component({
  selector: 'ra-signup-page',
  imports: [ReactiveFormsModule, RouterLink, AuthShell, Button, InputText, Message, Password],
  templateUrl: './signup-page.html',
  styleUrl: './signup-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupPage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authApi = inject(AuthApi);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly nameMaxLength = NAME_MAX_LENGTH;
  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  protected readonly form = this.formBuilder.group({
    // The pattern rejects a name made only of spaces.
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    email: ['', [Validators.required, Validators.email]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(PASSWORD_MAX_LENGTH),
      ],
    ],
  });
  protected readonly name = this.form.controls.name;
  protected readonly email = this.form.controls.email;
  protected readonly password = this.form.controls.password;

  protected readonly hasSubmitted = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    // The backend's message is about the details just sent, so it goes away once they are edited.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.errorMessage.set(null));
  }

  /** Create the account, which also logs the user in, then open the home screen. */
  protected submit(): void {
    // 1. Check the form; from now on every problem is shown
    this.hasSubmitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // 2. Sign up (the backend logs the new user in), remember the login and move on
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.authApi
      .signup(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.session.saveLogin(response, response.user.name);
          void this.router.navigateByUrl(HOME_URL);
        },
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(getApiErrorMessage(error));
        },
      });
  }

  /** Show a "wrong format" message once something was typed and left, or after pressing the button. */
  protected showFormatError(control: AbstractControl): boolean {
    return this.hasSubmitted() || (control.dirty && control.touched);
  }
}
