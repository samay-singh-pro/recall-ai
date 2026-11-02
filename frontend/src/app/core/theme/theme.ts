import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

/** CSS class that switches PrimeNG to dark colours; must match `darkModeSelector` in app.config. */
export const DARK_MODE_CLASS = 'app-dark';
const STORAGE_KEY = 'recall-theme';

/** Holds the light/dark choice, applies it to the page and remembers it across visits. */
@Injectable({
  providedIn: 'root',
})
export class Theme {
  private readonly document = inject(DOCUMENT);

  readonly isDark = signal(this.loadInitialChoice());

  constructor() {
    effect(() => {
      const isDark = this.isDark();
      this.document.documentElement.classList.toggle(DARK_MODE_CLASS, isDark);
      this.saveChoice(isDark);
    });
  }

  /** Switch between light and dark. */
  toggle(): void {
    this.isDark.update((isDark) => !isDark);
  }

  // A saved choice wins; otherwise follow the operating system setting.
  private loadInitialChoice(): boolean {
    const saved = this.readStorage();
    if (saved) return saved === 'dark';
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  // Storage can be blocked (private windows), so failures are ignored.
  private readStorage(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private saveChoice(isDark: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Not remembering the choice is acceptable.
    }
  }
}
