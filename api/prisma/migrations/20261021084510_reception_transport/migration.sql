-- CreateTable
CREATE TABLE `TransportReception` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numeroBon` VARCHAR(32) NOT NULL,
    `lotId` INTEGER NOT NULL,
    `transporteur` VARCHAR(160) NOT NULL,
    `immatriculation` VARCHAR(32) NULL,
    `chauffeur` VARCHAR(120) NULL,
    `numeroBl` VARCHAR(64) NULL,
    `conditionsLivraison` VARCHAR(255) NULL,
    `dateEnlevement` DATETIME(3) NULL,
    `dateArrivee` DATETIME(3) NULL,
    `quantiteAnnonceeKg` INTEGER NULL,
    `temperatureC` DECIMAL(4, 1) NULL,
    `citerneConforme` BOOLEAN NULL,
    `plombsIntacts` BOOLEAN NULL,
    `numeroPlomb` VARCHAR(64) NULL,
    `receptionnePar` VARCHAR(120) NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TransportReception_numeroBon_key`(`numeroBon`),
    UNIQUE INDEX `TransportReception_lotId_key`(`lotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TransportReception` ADD CONSTRAINT `TransportReception_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `Lot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
