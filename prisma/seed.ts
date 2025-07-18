
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding process...');

  // 1. Clear existing data in a safe order
  console.log('Clearing existing data...');
  try {
    // Clear models with relations first
    await prisma.bill.deleteMany({});
    console.log('Deleted Bills');
    await prisma.agreement.deleteMany({});
    console.log('Deleted Agreements');
    await prisma.buildingUtilityItem.deleteMany({});
    console.log('Deleted BuildingUtilityItems');
    await prisma.buildingMonthlyUtilities.deleteMany({});
    console.log('Deleted BuildingMonthlyUtilities');
    await prisma.penaltyTier.deleteMany({});
    console.log('Deleted PenaltyTiers');

    // Clear tenant links from Spaces before deleting tenants
    const spacesWithTenants = await prisma.space.findMany({
      where: { tenantId: { not: null } },
      select: { id: true }
    });
    for (const space of spacesWithTenants) {
      await prisma.space.update({
        where: { id: space.id },
        data: {
          tenant: { disconnect: true }, 
          isOccupied: false
        }
      });
    }
    console.log('Cleared tenant links from Spaces.');
    
    // Now delete models that were referenced
    await prisma.tenant.deleteMany({});
    console.log('Deleted Tenants');
    await prisma.space.deleteMany({});
    console.log('Deleted Spaces');
    await prisma.building.deleteMany({}); 
    console.log('Deleted Buildings');
    
    // Finally, clear user and role data
    await prisma.user.deleteMany({}); 
    console.log('Deleted Users');
    await prisma.role.deleteMany({}); 
    console.log('Deleted Roles');
    
    console.log('Finished clearing data.');
  } catch (e: any) {
    console.error('Error during data clearing:', e);
    throw e;
  }

  // 2. Create the essential SUPER_ADMIN Role
  console.log('Creating SUPER_ADMIN Role...');
  const superAdminRole = await prisma.role.create({
    data: {
      name: 'SUPER_ADMIN',
      description: 'Full access to all system features and data.',
      permissions: [
        'dashboard:view',
        'building:view', 'building:create', 'building:edit', 'building:delete',
        'space:view', 'space:create', 'space:edit', 'space:delete',
        'tenant:view', 'tenant:create', 'tenant:edit', 'tenant:delete',
        'agreement:view', 'agreement:create', 'agreement:edit', 'agreement:delete',
        'building_utility:view', 'building_utility:save',
        'billing:view', 'billing:generate', 'billing:manage_payments', 'billing:delete',
        'payment_overview:view',
        'settings:user_registration:manage', 
        'settings:user_management:view', 'settings:user_management:assign',
        'settings:role_management:view', 'settings:role_management:manage',
        'portal:view'
      ],
    },
  });
  console.log(`Created Role: ${superAdminRole.name}`);

  // 3. Create the default Super Admin User
  console.log('Creating Super Admin User...');
  const superAdminUser = await prisma.user.create({
    data: {
      // IMPORTANT: This 'userId' MUST match the 'sub' (subject) claim from the JWT issued by your external authentication provider.
      //
      // HOW TO FIX A "USER NOT FOUND" ERROR:
      // 1. Log in to your application.
      // 2. Your auth provider will give your app a JWT access token.
      // 3. Decode this JWT (you can use online tools like jwt.io).
      // 4. Find the 'sub' claim in the decoded payload. That is your user ID.
      // 5. Replace the value below with the actual user ID from your token.
      // 6. Rerun the database seed command (`npm run prisma:seed`).
      userId: 'fda67c29-7753-4a81-bb1c-b25a63b29bc7',
      email: 'superadmin@leaseflow.com',
      name: 'Default Super Admin',
      firstName: 'Default',
      lastName: 'SuperAdmin',
      phoneNumber: '0912345678', // The login credential used with the auth service.
      roles: { connect: { id: superAdminRole.id } },
    },
  });
  console.log(`Created Super Admin User: ${superAdminUser.email}`);

  console.log('Seeding finished successfully! Only the SUPER_ADMIN role and user were created.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('Prisma client disconnected.');
  });
