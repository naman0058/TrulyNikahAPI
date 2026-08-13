import config from '../config';
import { signUserToken, userTokenVersion } from '../lib/jwt';

export type IssuedAccessToken = {
  token: string;
  token_type: 'Bearer';
  expires_in: number;
};

export function issueAccessTokenForUser(user: {
  id: bigint;
  email: string;
  api_token_version: number;
}): IssuedAccessToken {
  return {
    token: signUserToken(user.id, user.email, userTokenVersion(user)),
    token_type: 'Bearer',
    expires_in: config.jwt.expiresInSeconds,
  };
}
