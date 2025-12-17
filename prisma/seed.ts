import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seeding process...");

  // 1. Clear existing data in a safe order
  console.log("Clearing existing data...");
  try {
    await prisma.arifPayment.deleteMany({});
    console.log("Deleted ArifPayments");
    await prisma.bill.deleteMany({});
    console.log("Deleted Bills");
    await prisma.auditLog.deleteMany({});
    console.log("Deleted AuditLogs");
    await prisma.agreement.deleteMany({});
    console.log("Deleted Agreements");
    await prisma.buildingUtilityItem.deleteMany({});
    console.log("Deleted BuildingUtilityItems");
    await prisma.buildingMonthlyUtilities.deleteMany({});
    console.log("Deleted BuildingMonthlyUtilities");
    await prisma.penaltyTier.deleteMany({});
    console.log("Deleted PenaltyTiers");
    await prisma.space.deleteMany({});
    console.log("Deleted Spaces");
    await prisma.building.deleteMany({});
    console.log("Deleted Buildings");
    await prisma.tenant.deleteMany({});
    console.log("Deleted Tenants");
    await prisma.user.deleteMany({});
    console.log("Deleted Users");
    await prisma.role.deleteMany({});
    console.log("Deleted Roles");
    await prisma.agreementTemplate.deleteMany({});
    console.log("Deleted AgreementTemplates");

    console.log("Finished clearing data.");
  } catch (e: any) {
    console.error("Error during data clearing:", e);
    throw e;
  }

  // 2. Create the essential Roles
  console.log("Creating SUPER_ADMIN Role...");
  const superAdminRole = await prisma.role.create({
    data: {
      name: "SUPER_ADMIN",
      description: "Full access to all system features and data.",
      permissions: [
        "dashboard:view",
        "building:view",
        "building:export",
        "building:create",
        "building:approve",
        "building:edit",
        "building:delete",
        "space:view",
        "space:export",
        "space:create",
        "space:approve",
        "space:edit",
        "space:delete",
        "tenant:view",
        "tenant:export",
        "tenant:create",
        "tenant:edit",
        "tenant:status",
        "agreement:view",
        "agreement:create",
        "agreement:export",
        "agreement:approve",
        "agreement:edit",
        "billing:view",
        "billing:generate",
        "billing:manage_payments",
        "payment_overview:view",
        "building_utility:view",
        "building_utility:create",
        "building_utility:approve",
        "audit:view",
        "settings:user_registration:manage",
        "settings:user_management:view",
        "settings:user_management:assign",
        "settings:role_management:view",
        "settings:role_management:manage",
        "settings:agreement_templates:manage",
        "import:manage",
        "portal:view",
      ],
    },
  });
  console.log(`Created Role: ${superAdminRole.name}`);

  console.log("Creating SYSTEM_ADMIN Role...");
  const systemAdminRole = await prisma.role.create({
    data: {
      name: "SYSTEM_ADMIN",
      description:
        "Operational maker role. Can create/update records but cannot approve them.",
      permissions: [
        "dashboard:view",
        "building:view",
        "building:export",
        "building:create",
        "building:edit",
        "space:view",
        "space:create",
        "space:export",
        "tenant:view",
        "tenant:export",
        "space:edit",
        "agreement:view",
        "agreement:create",
        "agreement:export",
        "agreement:edit",
        "building_utility:view",
        "building_utility:create",
        "billing:view",
        "payment_overview:view",
        "portal:view",
      ],
    },
  });
  console.log(`Created Role: ${systemAdminRole.name}`);

  console.log("Creating TENANT Role...");
  const tenantRole = await prisma.role.create({
    data: {
      name: "TENANT",
      description: "Access to the tenant portal.",
      permissions: ["portal:view"],
    },
  });
  console.log(`Created Role: ${tenantRole.name}`);

  // 3. Create the default Super Admin User
  console.log("Creating Super Admin User...");
  const hashedPassword = await bcrypt.hash("Admin@123", 10);
  const superAdminUser = await prisma.user.create({
    data: {
      email: "superadmin@nibrental.com",
      name: "Super Admin",
      firstName: "Super",
      lastName: "Admin",
      phoneNumber: "0912345678",
      password: hashedPassword,
      roles: { connect: { id: superAdminRole.id } },
    },
  });
  console.log(`Created Super Admin User: ${superAdminUser.email}`);

  console.log(
    "Seeding finished successfully! SUPER_ADMIN and TENANT roles created, plus default admin users.",
  );
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("Prisma client disconnected.");
  });
