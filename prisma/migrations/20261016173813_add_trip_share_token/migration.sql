-- AlterTable
ALTER TABLE `trips` ADD COLUMN `shareToken` VARCHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `trips_shareToken_key` ON `trips`(`shareToken`);

