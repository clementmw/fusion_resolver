/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "Outlet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL,
    "merchantId" TEXT NOT NULL,
    "reviewId" TEXT,

    CONSTRAINT "Outlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashbackConfiguration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "eligibleCustomerTypes" TEXT[],
    "merchantId" TEXT NOT NULL,
    "reviewId" TEXT,
    "netCashbackBudget" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "usedCashbackBudget" DECIMAL(65,30) NOT NULL DEFAULT 0.0,

    CONSTRAINT "CashbackConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExclusiveOffer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "eligibleCustomerTypes" TEXT[],
    "merchantId" TEXT,
    "reviewId" TEXT,
    "netOfferBudget" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "usedOfferBudget" DECIMAL(65,30) NOT NULL DEFAULT 0.0,

    CONSTRAINT "ExclusiveOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "merchantId" TEXT,
    "reviewId" TEXT,
    "pointsUsedInPeriod" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "pointsIssuedLimit" DECIMAL(65,30),

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "minCustomerType" TEXT NOT NULL,
    "loyaltyProgramId" TEXT NOT NULL,
    "reviewId" TEXT,

    CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerType" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "CustomerType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_offer_eligibility" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "offerType" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_offer_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CashbackConfigurationToOutlet" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CashbackConfigurationToOutlet_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ExclusiveOfferToOutlet" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ExclusiveOfferToOutlet_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Outlet_reviewId_key" ON "Outlet"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "CashbackConfiguration_reviewId_key" ON "CashbackConfiguration"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ExclusiveOffer_reviewId_key" ON "ExclusiveOffer"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyProgram_merchantId_key" ON "LoyaltyProgram"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyProgram_reviewId_key" ON "LoyaltyProgram"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTier_reviewId_key" ON "LoyaltyTier"("reviewId");

-- CreateIndex
CREATE INDEX "idx_user_eligibility_lookup" ON "user_offer_eligibility"("userId", "validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "idx_offer_eligibility" ON "user_offer_eligibility"("offerId", "offerType");

-- CreateIndex
CREATE INDEX "idx_outlet_offer_type" ON "user_offer_eligibility"("outletId", "offerType");

-- CreateIndex
CREATE INDEX "idx_merchant_eligibility" ON "user_offer_eligibility"("merchantId");

-- CreateIndex
CREATE INDEX "idx_active_user_eligibilities" ON "user_offer_eligibility"("userId", "isEligible");

-- CreateIndex
CREATE INDEX "_CashbackConfigurationToOutlet_B_index" ON "_CashbackConfigurationToOutlet"("B");

-- CreateIndex
CREATE INDEX "_ExclusiveOfferToOutlet_B_index" ON "_ExclusiveOfferToOutlet"("B");

-- AddForeignKey
ALTER TABLE "Outlet" ADD CONSTRAINT "Outlet_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outlet" ADD CONSTRAINT "Outlet_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbackConfiguration" ADD CONSTRAINT "CashbackConfiguration_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbackConfiguration" ADD CONSTRAINT "CashbackConfiguration_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExclusiveOffer" ADD CONSTRAINT "ExclusiveOffer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExclusiveOffer" ADD CONSTRAINT "ExclusiveOffer_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTier" ADD CONSTRAINT "LoyaltyTier_loyaltyProgramId_fkey" FOREIGN KEY ("loyaltyProgramId") REFERENCES "LoyaltyProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTier" ADD CONSTRAINT "LoyaltyTier_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerType" ADD CONSTRAINT "CustomerType_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CashbackConfigurationToOutlet" ADD CONSTRAINT "_CashbackConfigurationToOutlet_A_fkey" FOREIGN KEY ("A") REFERENCES "CashbackConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CashbackConfigurationToOutlet" ADD CONSTRAINT "_CashbackConfigurationToOutlet_B_fkey" FOREIGN KEY ("B") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExclusiveOfferToOutlet" ADD CONSTRAINT "_ExclusiveOfferToOutlet_A_fkey" FOREIGN KEY ("A") REFERENCES "ExclusiveOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExclusiveOfferToOutlet" ADD CONSTRAINT "_ExclusiveOfferToOutlet_B_fkey" FOREIGN KEY ("B") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
