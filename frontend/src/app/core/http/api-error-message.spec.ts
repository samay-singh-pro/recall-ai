import { HttpErrorResponse } from '@angular/common/http';

import { getApiErrorMessage } from './api-error-message';

describe('getApiErrorMessage', () => {
  it("uses the message from the backend's error shape", () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: { error: { code: 'email_already_registered', message: 'Email already exists.' } },
    });

    expect(getApiErrorMessage(error)).toBe('Email already exists.');
  });

  it('says the server cannot be reached when there was no response', () => {
    const error = new HttpErrorResponse({ status: 0 });

    expect(getApiErrorMessage(error)).toContain("Can't reach the server");
  });

  it.each([
    ['an error body in another shape', new HttpErrorResponse({ status: 500, error: 'oops' })],
    ['an empty error body', new HttpErrorResponse({ status: 500, error: null })],
    ['something that is not an HTTP error', new Error('boom')],
  ])('falls back to a general message for %s', (_description, error) => {
    expect(getApiErrorMessage(error)).toBe('Something went wrong. Please try again.');
  });
});
