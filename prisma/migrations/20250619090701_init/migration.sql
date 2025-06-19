-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('Pending', 'Paid', 'Overdue', 'PendingVerification');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('Fixed', 'Percentage');

-- CreateEnum
CREATE TYPE "PenaltyScopeType" AS ENUM ('Building', 'Floor', 'SpecificSpaces');

-- CreateEnum
CREATE TYPE "UtilityScopeType" AS ENUM ('Building', 'Floor', 'SpecificSpaces');

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "buildingName" TEXT NOT NULL,
    "spaceIdName" TEXT NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "floor" TEXT NOT NULL,
    "utilityProrationShare" DOUBLE PRECISION NOT NULL,
    "monthlyRentalPrice" DOUBLE PRECISION NOT NULL,
    "isOccupied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buildingId" TEXT NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "alternativePhone" TEXT,
    "nationalId" TEXT,
    "representativeName" TEXT,
    "representativePhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "agreementText" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "monthlyRentalPrice" DOUBLE PRECISION NOT NULL,
    "additionalTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentTermMonths" INTEGER NOT NULL,
    "initialPaymentMonths" INTEGER NOT NULL,
    "nextPaymentDueDate" TIMESTAMP(3) NOT NULL,
    "initialPaymentAmount" DOUBLE PRECISION,
    "initialPaymentMethod" TEXT,
    "initialPaymentReference" TEXT,
    "initialPaymentBankOrWalletName" TEXT,
    "initialPaymentDate" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingMonthlyUtilities" (
    "id" TEXT NOT NULL,
    "buildingName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buildingId" TEXT NOT NULL,

    CONSTRAINT "BuildingMonthlyUtilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingUtilityItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "appliesToScope" "UtilityScopeType" NOT NULL,
    "applicableFloor" TEXT,
    "applicableSpaceIdNames" TEXT[],
    "buildingMonthlyUtilitiesId" TEXT NOT NULL,

    CONSTRAINT "BuildingUtilityItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "rentAmount" DOUBLE PRECISION NOT NULL,
    "utilityBreakdown" JSONB NOT NULL,
    "penaltyAmount" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "BillStatus" NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "bankOrWalletName" TEXT,
    "paymentProofUrl" TEXT,
    "adminVerifiedPayment" BOOLEAN DEFAULT false,
    "tenantPaymentNotes" TEXT,
    "adminVerificationNotes" TEXT,
    "agreementId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenaltyTier" (
    "id" TEXT NOT NULL,
    "fromDay" INTEGER NOT NULL,
    "toDay" INTEGER,
    "feeType" "FeeType" NOT NULL,
    "feeValue" DOUBLE PRECISION NOT NULL,
    "scope" "PenaltyScopeType" NOT NULL,
    "applicableFloor" TEXT,
    "applicableSpaceIdNames" TEXT[],
    "buildingId" TEXT NOT NULL,

    CONSTRAINT "PenaltyTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Building_name_key" ON "Building"("name");

-- CreateIndex
CREATE INDEX "Building_name_idx" ON "Building"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Space_tenantId_key" ON "Space"("tenantId");

-- CreateIndex
CREATE INDEX "Space_buildingId_idx" ON "Space"("buildingId");

-- CreateIndex
CREATE INDEX "Space_tenantId_idx" ON "Space"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Space_buildingId_spaceIdName_key" ON "Space"("buildingId", "spaceIdName");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");

-- CreateIndex
CREATE INDEX "Tenant_email_idx" ON "Tenant"("email");

-- CreateIndex
CREATE INDEX "Agreement_tenantId_idx" ON "Agreement"("tenantId");

-- CreateIndex
CREATE INDEX "Agreement_spaceId_idx" ON "Agreement"("spaceId");

-- CreateIndex
CREATE INDEX "BuildingMonthlyUtilities_buildingId_idx" ON "BuildingMonthlyUtilities"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingMonthlyUtilities_buildingId_year_month_key" ON "BuildingMonthlyUtilities"("buildingId", "year", "month");

-- CreateIndex
CREATE INDEX "BuildingUtilityItem_buildingMonthlyUtilitiesId_idx" ON "BuildingUtilityItem"("buildingMonthlyUtilitiesId");

-- CreateIndex
CREATE INDEX "Bill_agreementId_idx" ON "Bill"("agreementId");

-- CreateIndex
CREATE INDEX "Bill_tenantId_idx" ON "Bill"("tenantId");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "Bill_dueDate_idx" ON "Bill"("dueDate");

-- CreateIndex
CREATE INDEX "PenaltyTier_buildingId_idx" ON "PenaltyTier"("buildingId");

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingMonthlyUtilities" ADD CONSTRAINT "BuildingMonthlyUtilities_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingUtilityItem" ADD CONSTRAINT "BuildingUtilityItem_buildingMonthlyUtilitiesId_fkey" FOREIGN KEY ("buildingMonthlyUtilitiesId") REFERENCES "BuildingMonthlyUtilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyTier" ADD CONSTRAINT "PenaltyTier_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
