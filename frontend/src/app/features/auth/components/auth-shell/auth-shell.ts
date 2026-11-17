import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The frame shared by the login and sign up pages: a branded panel beside the form.
 * The page's form goes between the tags: `<ra-auth-shell>…</ra-auth-shell>`.
 */
@Component({
  selector: 'ra-auth-shell',
  templateUrl: './auth-shell.html',
  styleUrl: './auth-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthShell {}
