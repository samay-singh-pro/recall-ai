import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Theme } from '../../core/theme/theme';
import { AppHeader } from './app-header';

describe('AppHeader', () => {
  let fixture: ComponentFixture<AppHeader>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppHeader],
    }).compileComponents();

    fixture = TestBed.createComponent(AppHeader);
    fixture.componentRef.setInput('userName', 'samay');
    await fixture.whenStable();
    compiled = fixture.nativeElement as HTMLElement;
  });

  it('shows the user name and their initial', () => {
    expect(compiled.querySelector('.app-header__user-name')?.textContent).toContain('samay');
    expect(compiled.querySelector('p-avatar')?.textContent).toContain('S');
  });

  it('switches the theme from the theme button', async () => {
    const theme = TestBed.inject(Theme);
    const wasDark = theme.isDark();
    const themeButton = compiled.querySelector<HTMLButtonElement>(
      `button[aria-label="${wasDark ? 'Switch to light mode' : 'Switch to dark mode'}"]`,
    )!;

    themeButton.click();
    await fixture.whenStable();

    expect(theme.isDark()).toBe(!wasDark);
  });

  it('asks to open the memories panel when the menu button is pressed', () => {
    const menuToggle = vi.fn();
    fixture.componentInstance.menuToggle.subscribe(menuToggle);

    compiled.querySelector<HTMLButtonElement>('.app-header__menu button')?.click();

    expect(menuToggle).toHaveBeenCalledOnce();
  });
});
