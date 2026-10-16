-- AlterTable
ALTER TABLE `trips` ADD COLUMN `budgetAmount` DECIMAL(14, 2) NULL,
    ADD COLUMN `currency` CHAR(3) NOT NULL DEFAULT 'IDR';

-- CreateTable
CREATE TABLE `trip_expenses` (
    `id` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `category` ENUM('ACCOMMODATION', 'TRANSPORT', 'FOOD', 'ACTIVITY', 'SHOPPING', 'OTHER') NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `spentDate` DATE NULL,
    `paidByUserId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    INDEX `trip_expenses_tripId_spentDate_idx`(`tripId`, `spentDate`),
    INDEX `trip_expenses_paidByUserId_idx`(`paidByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trip_expenses` ADD CONSTRAINT `trip_expenses_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_expenses` ADD CONSTRAINT `trip_expenses_paidByUserId_fkey` FOREIGN KEY (`paidByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
