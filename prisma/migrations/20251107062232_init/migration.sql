-- CreateEnum
CREATE TYPE "BuildingStatus" AS ENUM ('Active', 'Inactive');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('Pending', 'Paid', 'Overdue', 'PendingVerification');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('Active', 'Inactive');

-- CreateEnum
CREATE TYPE "UtilityScope" AS ENUM ('Building', 'Floor', 'SpecificSpaces');

-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('Fixed', 'Percentage');

-- CreateEnum
CREATE TYPE "PenaltyFrequency" AS ENUM ('OneTime', 'Daily');

-- CreateEnum
CREATE TYPE "PenaltyScope" AS ENUM ('Building', 'Floor', 'SpecificSpaces');

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "accountNumber" TEXT NOT NULL,
    "status" "BuildingStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "buildingName" TEXT NOT NULL,
    "spaceIdName" TEXT NOT NULL,
    "area" DECIMAL(10,2) NOT NULL,
    "floor" TEXT NOT NULL,
    "utilityProrationShare" DECIMAL(5,4) NOT NULL,
    "monthlyRentalPrice" DECIMAL(12,2) NOT NULL,
    "isOccupied" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternativePhone" TEXT,
    "nationalId" TEXT,
    "representativeName" TEXT,
    "representativePhone" TEXT,
    "rentedSpaceId" TEXT,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "agreementText" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "monthlyRentalPrice" DECIMAL(12,2) NOT NULL,
    "additionalTerms" TEXT,
    "paymentTermMonths" INTEGER NOT NULL,
    "initialPaymentMonths" INTEGER NOT NULL,
    "nextPaymentDueDate" TIMESTAMP(3) NOT NULL,
    "initialPaymentAmount" DECIMAL(12,2),
    "initialPaymentDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisabledAgreement" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "disabledById" TEXT NOT NULL,
    "disabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisabledAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "rentAmount" DECIMAL(12,2) NOT NULL,
    "utilityBreakdown" JSONB NOT NULL DEFAULT '[]',
    "penaltyAmount" DECIMAL(12,2),
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'Pending',
    "paymentDate" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "bankOrWalletName" TEXT,
    "paymentProofDataUri" TEXT,
    "adminVerifiedPayment" BOOLEAN,
    "tenantPaymentNotes" TEXT,
    "adminVerificationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

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
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "BuildingMonthlyUtilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingUtilityItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "appliesToScope" "UtilityScope" NOT NULL,
    "applicableFloor" TEXT,
    "applicableSpaceIdNames" TEXT[],
    "monthlyUtilitiesId" TEXT NOT NULL,

    CONSTRAINT "BuildingUtilityItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenaltyTier" (
    "id" TEXT NOT NULL,
    "fromDay" INTEGER NOT NULL,
    "toDay" INTEGER,
    "penaltyType" "PenaltyType" NOT NULL,
    "feeValue" DECIMAL(10,2) NOT NULL,
    "frequency" "PenaltyFrequency" NOT NULL,
    "scope" "PenaltyScope" NOT NULL,
    "applicableFloor" TEXT,
    "applicableSpaceIdNames" TEXT[],
    "buildingId" TEXT NOT NULL,

    CONSTRAINT "PenaltyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phoneNumber" TEXT,
    "tempPassword" TEXT,
    "password" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Secret" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AgreementTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArifPayment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "transactionId" TEXT,
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArifPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ManagedBuildings" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ManagedBuildings_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_RoleToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoleToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Building_name_key" ON "Building"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Building_accountNumber_key" ON "Building"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Space_tenantId_key" ON "Space"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Space_buildingId_spaceIdName_key" ON "Space"("buildingId", "spaceIdName");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_phone_key" ON "Tenant"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_rentedSpaceId_key" ON "Tenant"("rentedSpaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_userId_key" ON "Tenant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DisabledAgreement_agreementId_disabledById_key" ON "DisabledAgreement"("agreementId", "disabledById");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingMonthlyUtilities_buildingId_year_month_key" ON "BuildingMonthlyUtilities"("buildingId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementTemplate_name_key" ON "AgreementTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ArifPayment_sessionId_key" ON "ArifPayment"("sessionId");

-- CreateIndex
CREATE INDEX "_ManagedBuildings_B_index" ON "_ManagedBuildings"("B");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisabledAgreement" ADD CONSTRAINT "DisabledAgreement_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisabledAgreement" ADD CONSTRAINT "DisabledAgreement_disabledById_fkey" FOREIGN KEY ("disabledById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingMonthlyUtilities" ADD CONSTRAINT "BuildingMonthlyUtilities_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingUtilityItem" ADD CONSTRAINT "BuildingUtilityItem_monthlyUtilitiesId_fkey" FOREIGN KEY ("monthlyUtilitiesId") REFERENCES "BuildingMonthlyUtilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyTier" ADD CONSTRAINT "PenaltyTier_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementTemplate" ADD CONSTRAINT "AgreementTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArifPayment" ADD CONSTRAINT "ArifPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ManagedBuildings" ADD CONSTRAINT "_ManagedBuildings_A_fkey" FOREIGN KEY ("A") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ManagedBuildings" ADD CONSTRAINT "_ManagedBuildings_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
