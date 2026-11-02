import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Avatar } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Toolbar } from 'primeng/toolbar';
import { Tooltip } from 'primeng/tooltip';

import { Theme } from '../../core/theme/theme';

// The bar sits on the page background; only a thin bottom line separates it.
const TOOLBAR_TOKENS = {
  root: {
    background: 'transparent',
    borderColor: 'transparent',
    borderRadius: '0',
    padding: '0.75rem 1rem',
  },
};

/**
 * Top bar: a centred slot for the screen's content (e.g. the search bar), theme button and user.
 * Screens put their content between the tags: `<ra-app-header>…</ra-app-header>`.
 */
@Component({
  selector: 'ra-app-header',
  imports: [Avatar, Button, Toolbar, Tooltip],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeader {
  protected readonly theme = inject(Theme);

  readonly userName = input.required<string>();
  readonly menuToggle = output<void>();

  protected readonly toolbarTokens = TOOLBAR_TOKENS;
  protected readonly userInitial = computed(() => this.userName().charAt(0).toUpperCase());
  protected readonly themeIcon = computed(() => (this.theme.isDark() ? 'pi pi-sun' : 'pi pi-moon'));
  protected readonly themeLabel = computed(() =>
    this.theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode',
  );
}
