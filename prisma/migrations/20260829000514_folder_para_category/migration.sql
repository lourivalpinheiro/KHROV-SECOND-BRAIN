-- CreateEnum
CREATE TYPE "ParaCategory" AS ENUM ('PROJECTS', 'AREAS', 'RESOURCES', 'ARCHIVE');

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN "paraCategory" "ParaCategory";

-- CreateIndex
CREATE UNIQUE INDEX "Folder_userId_paraCategory_key" ON "Folder"("userId", "paraCategory");
