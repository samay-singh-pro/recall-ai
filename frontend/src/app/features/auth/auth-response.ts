import { AuthTokens } from '../../core/auth/auth-tokens';
import { User } from './user';

/** What signup and login return: the two tokens and who they belong to (mirrors AuthResponse). */
export interface AuthResponse extends AuthTokens {
  user: User;
}
