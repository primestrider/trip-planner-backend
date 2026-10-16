-- CreateTable
CREATE TABLE `trip_invites` (
    `id` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `role` ENUM('EDITOR', 'VIEWER') NOT NULL,
    `expiresAt` TIMESTAMP(0) NOT NULL,
    `maxUses` INTEGER NULL,
    `useCount` INTEGER NOT NULL DEFAULT 0,
    `revokedAt` TIMESTAMP(0) NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `trip_invites_tokenHash_key`(`tokenHash`),
    INDEX `trip_invites_tripId_idx`(`tripId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trip_invites` ADD CONSTRAINT `trip_invites_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
