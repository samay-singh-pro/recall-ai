/** An account as the backend describes it (mirrors UserResponse); never includes the password. */
export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}
