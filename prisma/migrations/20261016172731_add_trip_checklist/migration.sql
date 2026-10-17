-- CreateTable
CREATE TABLE `trip_checklist_items` (
    `id` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `category` VARCHAR(50) NULL,
    `assignedToUserId` VARCHAR(191) NULL,
    `isChecked` BOOLEAN NOT NULL DEFAULT false,
    `checkedAt` TIMESTAMP(0) NULL,
    `checkedByUserId` VARCHAR(191) NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    INDEX `trip_checklist_items_tripId_isChecked_idx`(`tripId`, `isChecked`),
    INDEX `trip_checklist_items_assignedToUserId_idx`(`assignedToUserId`),
    INDEX `trip_checklist_items_checkedByUserId_idx`(`checkedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trip_checklist_items` ADD CONSTRAINT `trip_checklist_items_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_checklist_items` ADD CONSTRAINT `trip_checklist_items_assignedToUserId_fkey` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_checklist_items` ADD CONSTRAINT `trip_checklist_items_checkedByUserId_fkey` FOREIGN KEY (`checkedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
