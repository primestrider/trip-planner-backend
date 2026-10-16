-- AlterTable
-- Keep existing free-text locations by renaming the column instead of dropping it
ALTER TABLE `itinerary_items` CHANGE COLUMN `location` `locationName` VARCHAR(255) NULL,
    ADD COLUMN `locationAddress` VARCHAR(500) NULL,
    ADD COLUMN `locationLatitude` DECIMAL(9, 6) NULL,
    ADD COLUMN `locationLongitude` DECIMAL(9, 6) NULL,
    ADD COLUMN `locationPlaceId` VARCHAR(255) NULL,
    ADD COLUMN `locationUrl` VARCHAR(2048) NULL;
