import { TestBed } from '@angular/core/testing';

import { DARK_MODE_CLASS, Theme } from './theme';

describe('Theme', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(DARK_MODE_CLASS);
  });

  it('starts dark when dark was chosen on a previous visit', () => {
    localStorage.setItem('recall-theme', 'dark');

    const theme = TestBed.inject(Theme);

    expect(theme.isDark()).toBe(true);
  });

  it('switches the page to dark and remembers the choice', () => {
    localStorage.setItem('recall-theme', 'light');
    const theme = TestBed.inject(Theme);

    theme.toggle();
    TestBed.tick();

    expect(document.documentElement.classList.contains(DARK_MODE_CLASS)).toBe(true);
    expect(localStorage.getItem('recall-theme')).toBe('dark');
  });
});
