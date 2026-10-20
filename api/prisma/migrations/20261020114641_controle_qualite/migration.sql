-- AlterTable
ALTER TABLE `Analyse` ADD COLUMN `categorie` ENUM('EXTRA_VIERGE', 'VIERGE', 'LAMPANTE') NULL,
    ADD COLUMN `ecarts` JSON NULL,
    ADD COLUMN `esterEthyliques` DECIMAL(6, 1) NULL,
    ADD COLUMN `medianeDefaut` DECIMAL(3, 1) NULL,
    ADD COLUMN `medianeFruite` DECIMAL(3, 1) NULL,
    ADD COLUMN `resultat` ENUM('NON_ANALYSE', 'CONFORME', 'INCOMPLET', 'NON_CONFORME') NULL;

-- AlterTable
ALTER TABLE `Lot` ADD COLUMN `bloque` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `categorieVisee` ENUM('EXTRA_VIERGE', 'VIERGE', 'LAMPANTE') NOT NULL DEFAULT 'EXTRA_VIERGE',
    ADD COLUMN `statutQualite` ENUM('NON_ANALYSE', 'CONFORME', 'INCOMPLET', 'NON_CONFORME') NOT NULL DEFAULT 'NON_ANALYSE';

-- CreateTable
CREATE TABLE `Specification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `nom` VARCHAR(160) NOT NULL,
    `categorie` ENUM('EXTRA_VIERGE', 'VIERGE', 'LAMPANTE') NULL,
    `clientId` INTEGER NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Specification_code_key`(`code`),
    UNIQUE INDEX `Specification_categorie_key`(`categorie`),
    INDEX `Specification_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CritereQualite` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `specificationId` INTEGER NOT NULL,
    `parametre` ENUM('ACIDITE', 'PEROXYDE', 'K232', 'K270', 'DELTA_K', 'POLYPHENOLS', 'ESTERS_ETHYLIQUES', 'MEDIANE_DEFAUT', 'MEDIANE_FRUITE') NOT NULL,
    `min` DECIMAL(8, 3) NULL,
    `max` DECIMAL(8, 3) NULL,

    UNIQUE INDEX `CritereQualite_specificationId_parametre_key`(`specificationId`, `parametre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NonConformite` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `lotId` INTEGER NOT NULL,
    `analyseId` INTEGER NULL,
    `description` TEXT NOT NULL,
    `statut` ENUM('OUVERTE', 'EN_TRAITEMENT', 'CLOTUREE') NOT NULL DEFAULT 'OUVERTE',
    `decision` ENUM('CONTRE_ANALYSE_CONFORME', 'DECLASSEMENT', 'ASSEMBLAGE_CORRECTIF', 'DEROGATION', 'DESTRUCTION', 'AUTRE') NULL,
    `actionCorrective` TEXT NULL,
    `ouverteParId` INTEGER NULL,
    `clotureeParId` INTEGER NULL,
    `clotureeLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NonConformite_code_key`(`code`),
    INDEX `NonConformite_lotId_idx`(`lotId`),
    INDEX `NonConformite_statut_idx`(`statut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Specification` ADD CONSTRAINT `Specification_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CritereQualite` ADD CONSTRAINT `CritereQualite_specificationId_fkey` FOREIGN KEY (`specificationId`) REFERENCES `Specification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformite` ADD CONSTRAINT `NonConformite_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `Lot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformite` ADD CONSTRAINT `NonConformite_analyseId_fkey` FOREIGN KEY (`analyseId`) REFERENCES `Analyse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformite` ADD CONSTRAINT `NonConformite_ouverteParId_fkey` FOREIGN KEY (`ouverteParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NonConformite` ADD CONSTRAINT `NonConformite_clotureeParId_fkey` FOREIGN KEY (`clotureeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Critères réglementaires des catégories (règlement délégué UE 2022/2104, annexe I).
-- Ils restent modifiables dans l'écran Qualité > Critères.
INSERT INTO `Specification` (`code`, `nom`, `categorie`, `actif`, `createdAt`, `updatedAt`) VALUES
    ('UE-EXTRA-VIERGE', 'Huile d''olive vierge extra (UE 2022/2104)', 'EXTRA_VIERGE', true, NOW(3), NOW(3)),
    ('UE-VIERGE', 'Huile d''olive vierge (UE 2022/2104)', 'VIERGE', true, NOW(3), NOW(3));

-- La médiane du fruité doit être supérieure à 0 : le panel la note au dixième, d'où le minimum 0,1.
INSERT INTO `CritereQualite` (`specificationId`, `parametre`, `min`, `max`)
SELECT s.id, c.parametre, c.min, c.max FROM `Specification` s
JOIN (
    SELECT 'UE-EXTRA-VIERGE' AS code, 'ACIDITE' AS parametre, NULL AS min, 0.8 AS max
    UNION ALL SELECT 'UE-EXTRA-VIERGE', 'PEROXYDE', NULL, 20
    UNION ALL SELECT 'UE-EXTRA-VIERGE', 'K232', NULL, 2.5
    UNION ALL SELECT 'UE-EXTRA-VIERGE', 'K270', NULL, 0.22
    UNION ALL SELECT 'UE-EXTRA-VIERGE', 'DELTA_K', NULL, 0.01
    UNION ALL SELECT 'UE-EXTRA-VIERGE', 'ESTERS_ETHYLIQUES', NULL, 35
    UNION ALL SELECT 'UE-EXTRA-VIERGE', 'MEDIANE_DEFAUT', NULL, 0
    UNION ALL SELECT 'UE-EXTRA-VIERGE', 'MEDIANE_FRUITE', 0.1, NULL
    UNION ALL SELECT 'UE-VIERGE', 'ACIDITE', NULL, 2
    UNION ALL SELECT 'UE-VIERGE', 'PEROXYDE', NULL, 20
    UNION ALL SELECT 'UE-VIERGE', 'K232', NULL, 2.6
    UNION ALL SELECT 'UE-VIERGE', 'K270', NULL, 0.25
    UNION ALL SELECT 'UE-VIERGE', 'DELTA_K', NULL, 0.01
    UNION ALL SELECT 'UE-VIERGE', 'MEDIANE_DEFAUT', NULL, 3.5
    UNION ALL SELECT 'UE-VIERGE', 'MEDIANE_FRUITE', 0.1, NULL
) c ON c.code = s.code;
