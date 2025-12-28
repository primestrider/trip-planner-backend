/*
  Warnings:

  - Added the required column `deviceId` to the `user_access_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `user_access_tokens` ADD COLUMN `deviceId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `user_access_tokens_userId_deviceId_idx` ON `user_access_tokens`(`userId`, `deviceId`);

-- CreateIndex
CREATE INDEX `user_access_tokens_expiresAt_idx` ON `user_access_tokens`(`expiresAt`);
