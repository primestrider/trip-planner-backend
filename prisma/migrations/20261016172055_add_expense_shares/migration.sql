-- CreateTable
CREATE TABLE `trip_expense_shares` (
    `expenseId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,

    INDEX `trip_expense_shares_userId_idx`(`userId`),
    PRIMARY KEY (`expenseId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trip_expense_shares` ADD CONSTRAINT `trip_expense_shares_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `trip_expenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_expense_shares` ADD CONSTRAINT `trip_expense_shares_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
