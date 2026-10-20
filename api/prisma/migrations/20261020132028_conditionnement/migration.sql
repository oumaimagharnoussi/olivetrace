-- AlterTable
ALTER TABLE `Lot` MODIFY `origine` ENUM('RECEPTION', 'ASSEMBLAGE', 'FILTRATION') NOT NULL;

-- AlterTable
ALTER TABLE `Operation` MODIFY `type` ENUM('RECEPTION', 'TRANSFERT', 'ASSEMBLAGE', 'SORTIE', 'FILTRATION', 'CONDITIONNEMENT') NOT NULL;

-- AlterTable
ALTER TABLE `Stockage` MODIFY `type` ENUM('CUVE_SOUTERRAINE', 'CITERNE', 'CUVE_TAMPON') NOT NULL;

-- CreateTable
CREATE TABLE `FormatConditionnement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `nom` VARCHAR(120) NOT NULL,
    `contenanceMl` INTEGER NOT NULL,
    `materiau` VARCHAR(60) NULL,
    `unitesParCarton` INTEGER NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FormatConditionnement_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Filtration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `operationId` INTEGER NOT NULL,
    `lotEntreeId` INTEGER NOT NULL,
    `lotSortieId` INTEGER NOT NULL,
    `quantiteEntreeKg` INTEGER NOT NULL,
    `quantiteSortieKg` INTEGER NOT NULL,
    `operateur` VARCHAR(120) NOT NULL,
    `typeFiltre` VARCHAR(80) NULL,
    `porositeMicrons` DECIMAL(6, 1) NULL,
    `pressionBar` DECIMAL(5, 2) NULL,
    `temperatureC` DECIMAL(4, 1) NULL,
    `debitLh` INTEGER NULL,
    `dureeMinutes` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Filtration_code_key`(`code`),
    UNIQUE INDEX `Filtration_operationId_key`(`operationId`),
    UNIQUE INDEX `Filtration_lotSortieId_key`(`lotSortieId`),
    INDEX `Filtration_lotEntreeId_idx`(`lotEntreeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LotConditionne` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `operationId` INTEGER NOT NULL,
    `lotVracId` INTEGER NOT NULL,
    `formatId` INTEGER NOT NULL,
    `nombreUnites` INTEGER NOT NULL,
    `quantiteKg` INTEGER NOT NULL,
    `dluo` DATETIME(3) NULL,
    `clientId` INTEGER NULL,
    `paysDestination` VARCHAR(2) NULL,
    `destination` VARCHAR(160) NULL,
    `operateur` VARCHAR(120) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LotConditionne_code_key`(`code`),
    UNIQUE INDEX `LotConditionne_operationId_key`(`operationId`),
    INDEX `LotConditionne_lotVracId_idx`(`lotVracId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MouvementProduitFini` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lotConditionneId` INTEGER NOT NULL,
    `type` ENUM('CONDITIONNEMENT', 'EXPEDITION', 'CASSE', 'AJUSTEMENT') NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `quantiteUnites` INTEGER NOT NULL,
    `clientId` INTEGER NULL,
    `reference` VARCHAR(64) NULL,
    `userId` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MouvementProduitFini_lotConditionneId_idx`(`lotConditionneId`),
    INDEX `MouvementProduitFini_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Filtration` ADD CONSTRAINT `Filtration_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `Operation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Filtration` ADD CONSTRAINT `Filtration_lotEntreeId_fkey` FOREIGN KEY (`lotEntreeId`) REFERENCES `Lot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Filtration` ADD CONSTRAINT `Filtration_lotSortieId_fkey` FOREIGN KEY (`lotSortieId`) REFERENCES `Lot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LotConditionne` ADD CONSTRAINT `LotConditionne_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `Operation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LotConditionne` ADD CONSTRAINT `LotConditionne_lotVracId_fkey` FOREIGN KEY (`lotVracId`) REFERENCES `Lot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LotConditionne` ADD CONSTRAINT `LotConditionne_formatId_fkey` FOREIGN KEY (`formatId`) REFERENCES `FormatConditionnement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LotConditionne` ADD CONSTRAINT `LotConditionne_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MouvementProduitFini` ADD CONSTRAINT `MouvementProduitFini_lotConditionneId_fkey` FOREIGN KEY (`lotConditionneId`) REFERENCES `LotConditionne`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MouvementProduitFini` ADD CONSTRAINT `MouvementProduitFini_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MouvementProduitFini` ADD CONSTRAINT `MouvementProduitFini_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Formats courants, modifiables dans les référentiels.
INSERT INTO `FormatConditionnement` (`code`, `nom`, `contenanceMl`, `materiau`, `unitesParCarton`, `actif`, `createdAt`, `updatedAt`) VALUES
  ('VER-250', 'Bouteille verre 25 cl', 250, 'verre', 24, true, NOW(3), NOW(3)),
  ('VER-500', 'Bouteille verre 50 cl', 500, 'verre', 12, true, NOW(3), NOW(3)),
  ('VER-750', 'Bouteille verre 75 cl', 750, 'verre', 12, true, NOW(3), NOW(3)),
  ('VER-1000', 'Bouteille verre 1 L', 1000, 'verre', 12, true, NOW(3), NOW(3)),
  ('BID-5000', 'Bidon fer blanc 5 L', 5000, 'fer blanc', 4, true, NOW(3), NOW(3));
