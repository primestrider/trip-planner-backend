/*
  Warnings:

  - A unique constraint covering the columns `[userId,deviceId]` on the table `user_access_tokens` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `user_access_tokens` DROP FOREIGN KEY `user_access_tokens_userId_fkey`;

-- DropIndex
DROP INDEX `user_access_tokens_userId_deviceId_idx` ON `user_access_tokens`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `deletedAt` TIMESTAMP(0) NULL,
    ADD COLUMN `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastLoginAt` TIMESTAMP(0) NULL,
    ADD COLUMN `lockUntil` TIMESTAMP(0) NULL,
    ADD COLUMN `passwordChangedAt` TIMESTAMP(0) NULL;

-- CreateIndex
CREATE INDEX `user_access_tokens_revokedAt_expiresAt_idx` ON `user_access_tokens`(`revokedAt`, `expiresAt`);

-- CreateIndex
CREATE UNIQUE INDEX `user_access_tokens_userId_deviceId_key` ON `user_access_tokens`(`userId`, `deviceId`);

-- AddForeignKey
ALTER TABLE `user_access_tokens` ADD CONSTRAINT `user_access_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
