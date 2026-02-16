/*
  Warnings:

  - A unique constraint covering the columns `[userId,outletId,offerType,offerId]` on the table `user_offer_eligibility` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "idx_active_user_eligibilities";

-- DropIndex
DROP INDEX "idx_merchant_eligibility";

-- DropIndex
DROP INDEX "idx_outlet_offer_type";

-- DropIndex
DROP INDEX "idx_user_eligibility_lookup";

-- CreateIndex
CREATE INDEX "idx_user_active_offers" ON "user_offer_eligibility"("userId", "isEligible", "validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "idx_user_offertype_dates" ON "user_offer_eligibility"("userId", "offerType", "validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "idx_user_outlet_dates" ON "user_offer_eligibility"("userId", "outletId", "validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "idx_last_updated" ON "user_offer_eligibility"("lastUpdated");

-- CreateIndex
CREATE INDEX "idx_merchant_offers" ON "user_offer_eligibility"("merchantId", "offerType");

-- CreateIndex
CREATE UNIQUE INDEX "user_offer_eligibility_userId_outletId_offerType_offerId_key" ON "user_offer_eligibility"("userId", "outletId", "offerType", "offerId");
