/** What is sent to create an account (mirrors the backend's SignupRequest). */
export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}
