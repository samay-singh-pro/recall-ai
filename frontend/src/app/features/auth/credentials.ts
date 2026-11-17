/** Email and password sent to sign up or log in (mirrors the backend's SignupRequest and LoginRequest). */
export interface Credentials {
  email: string;
  password: string;
}
