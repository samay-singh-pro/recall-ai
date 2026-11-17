/** The two tokens the backend returns at login (mirrors TokenResponse). */
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}
