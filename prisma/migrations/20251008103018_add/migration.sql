/*
  Warnings:

  - Changed the type of `status` on the `Game` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('IN_GAME', 'ENDED');

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "status",
ADD COLUMN     "status" "GameStatus" NOT NULL;
