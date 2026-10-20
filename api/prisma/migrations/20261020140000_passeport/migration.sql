-- CreateTable
CREATE TABLE `Passeport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lotConditionneId` INTEGER NOT NULL,
    `jeton` VARCHAR(32) NOT NULL,
    `publie` BOOLEAN NOT NULL DEFAULT true,
    `nomProduit` VARCHAR(160) NULL,
    `description` TEXT NULL,
    `certifications` JSON NULL,
    `afficherHuileries` BOOLEAN NOT NULL DEFAULT true,
    `afficherAnalyses` BOOLEAN NOT NULL DEFAULT true,
    `afficherProcede` BOOLEAN NOT NULL DEFAULT true,
    `afficherDestination` BOOLEAN NOT NULL DEFAULT true,
    `consultations` INTEGER NOT NULL DEFAULT 0,
    `derniereConsultation` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Passeport_lotConditionneId_key`(`lotConditionneId`),
    UNIQUE INDEX `Passeport_jeton_key`(`jeton`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Passeport` ADD CONSTRAINT `Passeport_lotConditionneId_fkey` FOREIGN KEY (`lotConditionneId`) REFERENCES `LotConditionne`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

