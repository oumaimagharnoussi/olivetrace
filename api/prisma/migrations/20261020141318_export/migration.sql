-- CreateTable
CREATE TABLE `Expedition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `statut` ENUM('PREPAREE', 'EXPEDIEE', 'LIVREE', 'ANNULEE') NOT NULL DEFAULT 'PREPAREE',
    `clientId` INTEGER NOT NULL,
    `paysDestination` VARCHAR(2) NOT NULL,
    `adresseLivraison` VARCHAR(255) NULL,
    `datePrevue` DATETIME(3) NOT NULL,
    `dateDepart` DATETIME(3) NULL,
    `dateLivraison` DATETIME(3) NULL,
    `incoterm` VARCHAR(3) NULL,
    `lieuIncoterm` VARCHAR(120) NULL,
    `modeTransport` ENUM('MARITIME', 'ROUTIER', 'AERIEN', 'FERROVIAIRE') NOT NULL DEFAULT 'MARITIME',
    `transporteur` VARCHAR(160) NULL,
    `navire` VARCHAR(120) NULL,
    `portChargement` VARCHAR(120) NULL,
    `portDechargement` VARCHAR(120) NULL,
    `numeroConteneur` VARCHAR(32) NULL,
    `numeroPlomb` VARCHAR(32) NULL,
    `numeroConnaissement` VARCHAR(64) NULL,
    `numeroCommande` VARCHAR(64) NULL,
    `numeroFacture` VARCHAR(64) NULL,
    `nombrePalettes` INTEGER NULL,
    `poidsBrutKg` INTEGER NULL,
    `notes` TEXT NULL,
    `userId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Expedition_code_key`(`code`),
    INDEX `Expedition_statut_idx`(`statut`),
    INDEX `Expedition_datePrevue_idx`(`datePrevue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExpeditionLigne` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `expeditionId` INTEGER NOT NULL,
    `lotConditionneId` INTEGER NOT NULL,
    `quantiteUnites` INTEGER NOT NULL,
    `mouvementId` INTEGER NULL,

    UNIQUE INDEX `ExpeditionLigne_mouvementId_key`(`mouvementId`),
    INDEX `ExpeditionLigne_lotConditionneId_idx`(`lotConditionneId`),
    UNIQUE INDEX `ExpeditionLigne_expeditionId_lotConditionneId_key`(`expeditionId`, `lotConditionneId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Expedition` ADD CONSTRAINT `Expedition_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expedition` ADD CONSTRAINT `Expedition_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpeditionLigne` ADD CONSTRAINT `ExpeditionLigne_expeditionId_fkey` FOREIGN KEY (`expeditionId`) REFERENCES `Expedition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpeditionLigne` ADD CONSTRAINT `ExpeditionLigne_lotConditionneId_fkey` FOREIGN KEY (`lotConditionneId`) REFERENCES `LotConditionne`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpeditionLigne` ADD CONSTRAINT `ExpeditionLigne_mouvementId_fkey` FOREIGN KEY (`mouvementId`) REFERENCES `MouvementProduitFini`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
