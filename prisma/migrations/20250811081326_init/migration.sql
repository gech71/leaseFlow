-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('Pending', 'Paid', 'Overdue', 'PendingVerification');

-- CreateEnum
CREATE TYPE "UtilityScope" AS ENUM ('Building', 'Floor', 'SpecificSpaces');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('Fixed', 'Percentage');

-- CreateEnum
CREATE TYPE "PenaltyScope" AS ENUM ('Building', 'Floor', 'SpecificSpaces');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "tempPassword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "buildingName" TEXT NOT NULL,
    "spaceIdName" TEXT NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "floor" TEXT NOT NULL,
    "utilityProrationShare" DOUBLE PRECISION NOT NULL,
    "monthlyRentalPrice" DOUBLE PRECISION NOT NULL,
    "isOccupied" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "alternativePhone" TEXT,
    "nationalId" TEXT,
    "representativeName" TEXT,
    "representativePhone" TEXT,
    "rentedSpaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "agreementText" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "monthlyRentalPrice" DOUBLE PRECISION NOT NULL,
    "paymentTermMonths" INTEGER NOT NULL,
    "initialPaymentMonths" INTEGER NOT NULL,
    "nextPaymentDueDate" TIMESTAMP(3) NOT NULL,
    "additionalTerms" TEXT,
    "initialPaymentAmount" DOUBLE PRECISION,
    "initialPaymentMethod" TEXT,
    "initialPaymentReference" TEXT,
    "initialPaymentBankOrWalletName" TEXT,
    "initialPaymentDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "rentAmount" DOUBLE PRECISION NOT NULL,
    "utilityBreakdown" JSONB,
    "penaltyAmount" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'Pending',
    "paymentDate" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "bankOrWalletName" TEXT,
    "paymentProofUrl" TEXT,
    "adminVerifiedPayment" BOOLEAN,
    "tenantPaymentNotes" TEXT,
    "adminVerificationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingMonthlyUtilities" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "buildingName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildingMonthlyUtilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingUtilityItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "appliesToScope" "UtilityScope" NOT NULL DEFAULT 'Building',
    "applicableFloor" TEXT,
    "applicableSpaceIdNames" TEXT[],
    "monthlyUtilitiesId" TEXT,

    CONSTRAINT "BuildingUtilityItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenaltyTier" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "fromDay" INTEGER NOT NULL,
    "toDay" INTEGER,
    "feeType" "FeeType" NOT NULL,
    "feeValue" DOUBLE PRECISION NOT NULL,
    "scope" "PenaltyScope" NOT NULL DEFAULT 'Building',
    "applicableFloor" TEXT,
    "applicableSpaceIdNames" TEXT[],

    CONSTRAINT "PenaltyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RoleToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoleToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BuildingManagers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BuildingManagers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Space_tenantId_key" ON "Space"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_userId_key" ON "Tenant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_phone_key" ON "Tenant"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_nationalId_key" ON "Tenant"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_rentedSpaceId_key" ON "Tenant"("rentedSpaceId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingMonthlyUtilities_buildingId_year_month_key" ON "BuildingMonthlyUtilities"("buildingId", "year", "month");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- CreateIndex
CREATE INDEX "_BuildingManagers_B_index" ON "_BuildingManagers"("B");

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingMonthlyUtilities" ADD CONSTRAINT "BuildingMonthlyUtilities_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingUtilityItem" ADD CONSTRAINT "BuildingUtilityItem_monthlyUtilitiesId_fkey" FOREIGN KEY ("monthlyUtilitiesId") REFERENCES "BuildingMonthlyUtilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyTier" ADD CONSTRAINT "PenaltyTier_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BuildingManagers" ADD CONSTRAINT "_BuildingManagers_A_fkey" FOREIGN KEY ("A") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BuildingManagers" ADD CONSTRAINT "_BuildingManagers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
