-- CreateTable
CREATE TABLE "user_loyalty_points" (
    "id" TEXT NOT NULL,
    "points" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_loyalty_points_pkey" PRIMARY KEY ("id")
);
