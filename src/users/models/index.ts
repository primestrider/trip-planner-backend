// users.models.ts
export type UpdateUserModel = {
  password?: string;
  passwordChangedAt?: Date;

  failedLoginAttempts?: number;
  lockUntil?: Date | null;

  lastLoginAt?: Date;
  isActive?: boolean;
  deletedAt?: Date | null;
};
