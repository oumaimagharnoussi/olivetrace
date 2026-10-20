-- AlterTable
ALTER TABLE `AuditLog` ADD COLUMN `ancrageId` INTEGER NULL,
    ADD COLUMN `hash` CHAR(64) NULL;

-- CreateTable
CREATE TABLE `Ancrage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `racineMerkle` CHAR(64) NOT NULL,
    `empreinte` CHAR(64) NOT NULL,
    `empreintePrecedente` CHAR(64) NULL,
    `nombreEvenements` INTEGER NOT NULL,
    `premierAuditId` BIGINT NOT NULL,
    `dernierAuditId` BIGINT NOT NULL,
    `statut` ENUM('SCELLE', 'ENVOYE', 'CONFIRME', 'ERREUR') NOT NULL DEFAULT 'SCELLE',
    `reseau` VARCHAR(32) NULL,
    `chainId` INTEGER NULL,
    `txHash` VARCHAR(66) NULL,
    `blocNumero` INTEGER NULL,
    `blocDate` DATETIME(3) NULL,
    `erreur` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Ancrage_empreinte_key`(`empreinte`),
    INDEX `Ancrage_statut_idx`(`statut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditLog_ancrageId_idx` ON `AuditLog`(`ancrageId`);

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_ancrageId_fkey` FOREIGN KEY (`ancrageId`) REFERENCES `Ancrage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
