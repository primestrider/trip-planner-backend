-- CreateTable
CREATE TABLE `trip_accommodations` (
    `id` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `locationName` VARCHAR(255) NULL,
    `locationAddress` VARCHAR(500) NULL,
    `locationLatitude` DECIMAL(9, 6) NULL,
    `locationLongitude` DECIMAL(9, 6) NULL,
    `locationPlaceId` VARCHAR(255) NULL,
    `locationUrl` VARCHAR(2048) NULL,
    `checkInDate` DATE NOT NULL,
    `checkOutDate` DATE NOT NULL,
    `bookingCode` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    INDEX `trip_accommodations_tripId_checkInDate_idx`(`tripId`, `checkInDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_transports` (
    `id` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `type` ENUM('FLIGHT', 'TRAIN', 'BUS', 'CAR', 'FERRY', 'OTHER') NOT NULL,
    `carrier` VARCHAR(100) NULL,
    `number` VARCHAR(50) NULL,
    `originName` VARCHAR(255) NULL,
    `originAddress` VARCHAR(500) NULL,
    `originLatitude` DECIMAL(9, 6) NULL,
    `originLongitude` DECIMAL(9, 6) NULL,
    `originPlaceId` VARCHAR(255) NULL,
    `originUrl` VARCHAR(2048) NULL,
    `destinationName` VARCHAR(255) NULL,
    `destinationAddress` VARCHAR(500) NULL,
    `destinationLatitude` DECIMAL(9, 6) NULL,
    `destinationLongitude` DECIMAL(9, 6) NULL,
    `destinationPlaceId` VARCHAR(255) NULL,
    `destinationUrl` VARCHAR(2048) NULL,
    `departureAt` DATETIME(0) NOT NULL,
    `arrivalAt` DATETIME(0) NULL,
    `bookingCode` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    INDEX `trip_transports_tripId_departureAt_idx`(`tripId`, `departureAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trip_accommodations` ADD CONSTRAINT `trip_accommodations_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_transports` ADD CONSTRAINT `trip_transports_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
