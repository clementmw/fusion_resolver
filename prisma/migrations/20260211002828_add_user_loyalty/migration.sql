/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `user_loyalty_points` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `user_loyalty_points` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "user_loyalty_points" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_loyalty_points_userId_key" ON "user_loyalty_points"("userId");

-- CreateIndex
CREATE INDEX "idx_user_loyalty_points" ON "user_loyalty_points"("userId");
