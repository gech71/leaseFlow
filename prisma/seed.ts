
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

  // 2. Create the essential Roles
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

  console.log('Creating TENANT Role...');
  const tenantRole = await prisma.role.create({
    data: {
      name: 'TENANT',
      description: 'Access to the tenant portal.',
      permissions: ['portal:view'],
    },
  });
  console.log(`Created Role: ${tenantRole.name}`);


  // 3. Create the default Super Admin User
  console.log('Creating Super Admin User...');
  const superAdminUser = await prisma.user.create({
    data: {
      // ----------------- IMPORTANT! HOW TO FIX "USER NOT FOUND" ERROR -----------------
      // This 'userId' MUST exactly match the 'sub' (subject) claim from the JWT 
      // issued by your external authentication provider for your Super Admin account.
      //
      // To get the correct ID:
      // 1. Log in to your application.
      // 2. The login will fail, but your auth provider has issued a JWT access token.
      // 3. Open your browser's Developer Tools (F12 or Ctrl+Shift+I).
      // 4. Go to the "Application" or "Storage" tab.
      // 5. Look for "Cookies" and find the cookie for your application's URL.
      // 6. Find the 'leaseflow_admin_access_token' cookie and copy its value.
      // 7. Go to an online JWT decoder like https://jwt.io.
      // 8. Paste the token value into the decoder.
      // 9. In the "Decoded" payload section, find the 'sub' claim. Its value is your User ID.
      // 10. Copy that 'sub' value and paste it here, replacing the placeholder below.
      // 11. Save this file and rerun the database seed command (`npm run prisma:seed`).
      userId: 'fda67c29-7753-4a81-bb1c-b25a63b29bc7', // <-- REPLACE THIS VALUE
      email: 'superadmin@leaseflow.com',
      name: 'Default Super Admin',
      firstName: 'Default',
      lastName: 'SuperAdmin',
      phoneNumber: '0912345678',
      roles: { connect: { id: superAdminRole.id } },
    },
  });
  console.log(`Created Super Admin User: ${superAdminUser.email}`);

  // 4. Create a default Tenant User for testing
  console.log('Creating a default Tenant User for testing...');
  const defaultTenantUser = await prisma.user.create({
      data: {
          // This userId is a placeholder. For a real tenant, you would register them
          // through the User Registration in the app settings, which gets a real ID
          // from the authentication provider. This one is for easy testing of the portal.
          userId: '00000000-0000-0000-0000-000000000001',
          email: 'tenant@leaseflow.com',
          name: 'Default Tenant',
          firstName: 'Default',
          lastName: 'Tenant',
          phoneNumber: '0900000000', // Use this phone number to log into the portal
          roles: { connect: { id: tenantRole.id } },
      },
  });
   console.log(`Created Tenant User: ${defaultTenantUser.email}. Use phone ${defaultTenantUser.phoneNumber} and password 'password123' to log into the portal.`);


  console.log('Seeding finished successfully! SUPER_ADMIN and TENANT roles created, plus one Super Admin user and one test Tenant user.');
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
