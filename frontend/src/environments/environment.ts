// Production build. Same-address deployment: a reverse proxy forwards /api to the backend.
// For a separate API host, change this to its full URL (e.g. https://api.example.com/api/v1).
export const environment = {
  apiBaseUrl: '/api/v1',
};
