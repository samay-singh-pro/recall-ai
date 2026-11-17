import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthShell } from './auth-shell';

@Component({
  imports: [AuthShell],
  template: '<ra-auth-shell><p class="page-content">The form goes here</p></ra-auth-shell>',
})
class TestHost {}

describe('AuthShell', () => {
  it('shows the brand and the pitch next to whatever the page puts inside it', async () => {
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.auth-shell__brand')?.textContent).toContain('Recall AI');
    expect(compiled.querySelector('.auth-shell__headline')?.textContent).toContain(
      'Your second brain',
    );
    expect(compiled.querySelector('.auth-shell__panel .page-content')?.textContent).toContain(
      'The form goes here',
    );
  });
});
