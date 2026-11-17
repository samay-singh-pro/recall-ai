import { HttpErrorResponse } from '@angular/common/http';

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';
const OFFLINE_MESSAGE = "Can't reach the server. Check your connection and try again.";

// The backend's one error shape: {"error": {"code": "...", "message": "..."}}.
interface ApiErrorBody {
  error?: { message?: string };
}

/** Turn a failed request into a sentence for the user, using the backend's own message if it sent one. */
export function getApiErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return FALLBACK_MESSAGE;
  if (error.status === 0) return OFFLINE_MESSAGE;

  const body = error.error as ApiErrorBody | null;
  return body?.error?.message ?? FALLBACK_MESSAGE;
}
