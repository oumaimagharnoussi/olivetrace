-- CreateTable
CREATE TABLE `Lot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `origine` ENUM('RECEPTION', 'ASSEMBLAGE') NOT NULL,
    `huilerieId` INTEGER NULL,
    `varieteId` INTEGER NULL,
    `campagne` VARCHAR(9) NULL,
    `dateReception` DATETIME(3) NOT NULL,
    `quantiteInitialeKg` INTEGER NOT NULL,
    `numeroBon` VARCHAR(64) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Lot_code_key`(`code`),
    INDEX `Lot_dateReception_idx`(`dateReception`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LotOrigine` (
    `lotId` INTEGER NOT NULL,
    `parentId` INTEGER NOT NULL,
    `quantiteKg` INTEGER NOT NULL,

    PRIMARY KEY (`lotId`, `parentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Analyse` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lotId` INTEGER NOT NULL,
    `dateAnalyse` DATETIME(3) NOT NULL,
    `laboratoire` VARCHAR(160) NULL,
    `reference` VARCHAR(64) NULL,
    `acidite` DECIMAL(5, 2) NULL,
    `peroxyde` DECIMAL(6, 2) NULL,
    `k232` DECIMAL(5, 3) NULL,
    `k270` DECIMAL(5, 3) NULL,
    `deltaK` DECIMAL(5, 3) NULL,
    `polyphenols` INTEGER NULL,
    `autres` JSON NULL,
    `commentaire` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Analyse_lotId_dateAnalyse_idx`(`lotId`, `dateAnalyse`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Operation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('RECEPTION', 'TRANSFERT', 'ASSEMBLAGE', 'SORTIE') NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `userId` INTEGER NULL,
    `motif` ENUM('VENTE', 'CONDITIONNEMENT', 'PERTE', 'AUTRE') NULL,
    `clientId` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Operation_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Mouvement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `operationId` INTEGER NOT NULL,
    `lotId` INTEGER NOT NULL,
    `stockageId` INTEGER NOT NULL,
    `quantiteKg` INTEGER NOT NULL,

    INDEX `Mouvement_stockageId_lotId_idx`(`stockageId`, `lotId`),
    INDEX `Mouvement_lotId_idx`(`lotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Livraison` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `operationId` INTEGER NOT NULL,
    `transporteur` VARCHAR(160) NOT NULL,
    `immatriculation` VARCHAR(32) NULL,
    `chauffeur` VARCHAR(120) NULL,
    `numeroBl` VARCHAR(64) NULL,
    `adresseLivraison` VARCHAR(255) NULL,
    `dateEnlevement` DATETIME(3) NULL,
    `dateLivraisonPrevue` DATETIME(3) NULL,
    `dateLivraison` DATETIME(3) NULL,
    `statut` ENUM('PLANIFIEE', 'EN_COURS', 'LIVREE', 'ANNULEE') NOT NULL DEFAULT 'PLANIFIEE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Livraison_operationId_key`(`operationId`),
    INDEX `Livraison_statut_idx`(`statut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Lot` ADD CONSTRAINT `Lot_huilerieId_fkey` FOREIGN KEY (`huilerieId`) REFERENCES `Huilerie`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lot` ADD CONSTRAINT `Lot_varieteId_fkey` FOREIGN KEY (`varieteId`) REFERENCES `Variete`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LotOrigine` ADD CONSTRAINT `LotOrigine_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `Lot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LotOrigine` ADD CONSTRAINT `LotOrigine_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Lot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Analyse` ADD CONSTRAINT `Analyse_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `Lot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Operation` ADD CONSTRAINT `Operation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Operation` ADD CONSTRAINT `Operation_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mouvement` ADD CONSTRAINT `Mouvement_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `Operation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mouvement` ADD CONSTRAINT `Mouvement_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `Lot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mouvement` ADD CONSTRAINT `Mouvement_stockageId_fkey` FOREIGN KEY (`stockageId`) REFERENCES `Stockage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Livraison` ADD CONSTRAINT `Livraison_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `Operation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
