/*
  Warnings:

  - A unique constraint covering the columns `[shopDomain]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `tenant` ADD COLUMN `accessToken` VARCHAR(191) NULL,
    ADD COLUMN `shopDomain` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Tenant_shopDomain_key` ON `Tenant`(`shopDomain`);
