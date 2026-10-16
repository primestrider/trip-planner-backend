// users.models.ts
export type UpdateUserModel = {
  password?: string;
  passwordChangedAt?: Date;

  failedLoginAttempts?: number;
  lockUntil?: Date | null;

  lastLoginAt?: Date;
  isActive?: boolean;
  deletedAt?: Date | null;

  name?: string | null;
  avatarId?: number | null;
};

export type AvatarResponse = {
  id: number;
  url: string;
};

/**
 * Public profile of the authenticated user
 */
export type UserProfileResponse = {
  id: string;
  username: string;
  name: string | null;
  role: string;
  avatar: AvatarResponse | null;
  lastLoginAt: Date | null;
  createdAt: Date;
};
