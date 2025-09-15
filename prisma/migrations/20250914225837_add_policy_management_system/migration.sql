-- CreateEnum
CREATE TYPE "public"."PolicyPeriod" AS ENUM ('DAILY', 'MONTHLY');

-- CreateTable
CREATE TABLE "public"."Policy" (
    "id" TEXT NOT NULL,
    "maxAmount" DECIMAL(10,2) NOT NULL,
    "period" "public"."PolicyPeriod" NOT NULL,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Policy_organizationId_idx" ON "public"."Policy"("organizationId");

-- CreateIndex
CREATE INDEX "Policy_categoryId_idx" ON "public"."Policy"("categoryId");

-- CreateIndex
CREATE INDEX "Policy_userId_idx" ON "public"."Policy"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_organizationId_categoryId_userId_key" ON "public"."Policy"("organizationId", "categoryId", "userId");

-- AddForeignKey
ALTER TABLE "public"."Policy" ADD CONSTRAINT "Policy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Policy" ADD CONSTRAINT "Policy_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Policy" ADD CONSTRAINT "Policy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
