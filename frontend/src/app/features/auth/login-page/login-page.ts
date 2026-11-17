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

/** The login screen: email and password. */
@Component({
  selector: 'ra-login-page',
  imports: [ReactiveFormsModule, RouterLink, AuthShell, Button, InputText, Message, Password],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authApi = inject(AuthApi);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Login only asks for a password, not a length: the signup rules are not repeated here.
  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  protected readonly email = this.form.controls.email;
  protected readonly password = this.form.controls.password;

  protected readonly hasSubmitted = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    // The backend's message is about the details just sent, so it goes away once they are edited.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.errorMessage.set(null));
  }

  /** Log in with the typed email and password, then open the home screen. */
  protected submit(): void {
    // 1. Check the form; from now on every problem is shown
    this.hasSubmitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // 2. Send it, then remember the tokens and move on
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.authApi
      .login(this.form.getRawValue())
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
