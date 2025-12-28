export type CreateUserAccessToken = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type AccessTokenPayload = {
  sub: string;
  username: string;
};

export type RegisterUserResponse = {
  user: {
    id: string;
    username: string;
  };
  accessToken: string;
  refreshToken: string;
};
