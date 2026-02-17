/*
  Warnings:

  - You are about to drop the column `calculated_at` on the `ownership_data` table. All the data in the column will be lost.
  - You are about to drop the column `ownership_count` on the `ownership_data` table. All the data in the column will be lost.
  - You are about to drop the column `ownership_percent` on the `ownership_data` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ownership_data" DROP COLUMN "calculated_at",
DROP COLUMN "ownership_count",
DROP COLUMN "ownership_percent",
ADD COLUMN     "captaincy" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ownership" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_managers" INTEGER NOT NULL DEFAULT 0;
