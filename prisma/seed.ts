
import { PrismaClient, Prisma } from '@prisma/client';
import { addMonths, formatISO, subDays, parseISO } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding process...');

  // 1. Clear existing data
  console.log('Clearing existing data...');
  try {
    await prisma.user.deleteMany({}); 
    console.log('Deleted Users');
    await prisma.role.deleteMany({}); 
    console.log('Deleted Roles');

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

    // Clear tenant link from Spaces and set isOccupied to false
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
    console.log('Cleared tenant links from Spaces and set isOccupied to false.');

    await prisma.tenant.deleteMany({});
    console.log('Deleted Tenants');
    await prisma.space.deleteMany({});
    console.log('Deleted Spaces');

    await prisma.building.deleteMany({}); 
    console.log('Deleted Buildings');

    console.log('Finished clearing data.');
  } catch (e: any) {
    console.error('Error during data clearing:', e);
    throw e;
  }

  // 2. Create Roles
  console.log('Creating Roles...');
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
  const propertyManagerRole = await prisma.role.create({
    data: {
      name: 'PROPERTY_MANAGER',
      description: 'Manages assigned properties, tenants, and related operations.',
      permissions: [
        'dashboard:view',
        'building:view', 'building:edit',
        'space:view', 'space:create', 'space:edit',
        'tenant:view', 'tenant:create', 'tenant:edit',
        'agreement:view', 'agreement:create', 'agreement:edit',
        'building_utility:view', 'building_utility:save',
        'billing:view', 'billing:generate',
        'payment_overview:view',
        'portal:view'
      ],
    },
  });
  const accountantRole = await prisma.role.create({
    data: {
        name: 'ACCOUNTANT',
        description: 'Manages financial records, billing, and payments.',
        permissions: [
          'dashboard:view',
          'billing:view', 'billing:manage_payments',
          'agreement:view', 
          'tenant:view',
          'payment_overview:view'
        ],
    }
  });
  const supportStaffRole = await prisma.role.create({
    data: {
      name: 'SUPPORT_STAFF',
      description: 'Assists users and views data with limited modification rights.',
      permissions: [
        'dashboard:view',
        'building:view', 
        'space:view', 
        'tenant:view', 
        'agreement:view', 
        'billing:view',
        'payment_overview:view'
      ],
    },
  });
  console.log(`Created Roles: ${superAdminRole.name}, ${propertyManagerRole.name}, ${accountantRole.name}, ${supportStaffRole.name}`);


  // 3. Create Users and assign roles
  console.log('Creating Users...');
  const user1 = await prisma.user.create({
    data: {
      // This userId must match the 'sub' claim in the JWT from your external authentication provider.
      // After you log in with the phone number '0912345678' and password 'Admin@123', the auth service should return a token where the user ID is 'b1e55c84-9055-4eb5-8bd4-a262538f7e66'.
      userId: 'b1e55c84-9055-4eb5-8bd4-a262538f7e66', 
      email: 'superadmin@leaseflow.com',
      name: 'Default Super Admin',
      firstName: 'Default',
      lastName: 'SuperAdmin',
      phoneNumber: '0912345678', // The login credential used with the auth service.
      roles: { connect: { id: superAdminRole.id } },
    },
  });
  const user2 = await prisma.user.create({
    data: {
      userId: 'google|user456_manager', 
      email: 'manager.user@leaseflow.com',
      name: 'Property Manager User',
      firstName: 'Manager',
      lastName: 'User',
      phoneNumber: '555-1111',
      roles: { connect: { id: propertyManagerRole.id } },
    },
  });
   const user3 = await prisma.user.create({
    data: {
      userId: 'firebase|user789_support', 
      email: 'support.staff@leaseflow.com',
      name: 'Support Staff User',
      firstName: 'Support',
      lastName: 'Staff',
      phoneNumber: '555-2222',
      roles: { connect: { id: supportStaffRole.id } },
    },
  });
   const user4 = await prisma.user.create({
    data: {
      userId: 'local|user000_accountant', 
      email: 'accountant.user@leaseflow.com',
      name: 'Accountant User',
      firstName: 'Accy',
      lastName: 'User',
      phoneNumber: '555-3333',
      roles: { connect: { id: accountantRole.id } },
    },
  });
  console.log(`Created Users: ${user1.email}, ${user2.email}, ${user3.email}, ${user4.email}`);


  // 4. Create Buildings with Penalty Tiers and assign managers
  console.log('Creating Buildings...');
  const building1 = await prisma.building.create({
    data: {
      name: 'Sunrise Tower',
      address: '123 Sunrise Ave, Metro City',
      managedByUserId: user1.userId, 
      penaltyPolicyTiers: {
        create: [
          { fromDay: 1, toDay: 5, feeType: 'Fixed', feeValue: 50, scope: 'Building' },
          { fromDay: 6, toDay: 10, feeType: 'Fixed', feeValue: 100, scope: 'Building' },
          { fromDay: 11, toDay: null, feeType: 'Percentage', feeValue: 2.5, scope: 'Building' },
        ],
      },
    },
  });

  const building2 = await prisma.building.create({
    data: {
      name: 'Ocean View Plaza',
      address: '456 Ocean Dr, Pacifica',
      managedByUserId: user2.userId, 
      penaltyPolicyTiers: {
        create: [
          { fromDay: 1, toDay: 3, feeType: 'Percentage', feeValue: 1, scope: 'Building' },
          { fromDay: 4, toDay: 7, feeType: 'Percentage', feeValue: 3, scope: 'Building' },
          { fromDay: 1, toDay: 5, feeType: 'Fixed', feeValue: 20, scope: 'Floor', applicableFloor: 'Penthouse' },
          { fromDay: 6, toDay: null, feeType: 'Fixed', feeValue: 40, scope: 'Floor', applicableFloor: 'Penthouse' },
        ],
      },
    },
  });
  
  const building3 = await prisma.building.create({ 
    data: {
        name: 'Tech Park One',
        address: '789 Innovation Rd, Silicon Valley',
        managedByUserId: user1.userId,
    }
  });
  console.log(`Created Buildings: ${building1.name}, ${building2.name}, ${building3.name}`);

  // 5. Create Tenants
  console.log('Creating Tenants...');
  const tenant1 = await prisma.tenant.create({
    data: {
      name: 'Alice Wonderland',
      email: 'alice@example.com',
      phone: '555-0101',
      nationalId: 'AW12345X',
      representativeName: 'Cheshire Cat',
      representativePhone: '555-0199',
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'Bob The Builder',
      email: 'bob@example.com',
      phone: '555-0202',
    },
  });

  const tenant3 = await prisma.tenant.create({
    data: {
      name: 'Carol Danvers',
      email: 'carol@example.com',
      phone: '555-0303',
      nationalId: 'CD98765Z',
    },
  });
  console.log(`Created Tenants: ${tenant1.name}, ${tenant2.name}, ${tenant3.name}`);

  // 6. Create Spaces (linking to Buildings and some to Tenants)
  console.log('Creating Spaces...');
  const space1_B1 = await prisma.space.create({ 
    data: {
      buildingId: building1.id,
      buildingName: building1.name,
      spaceIdName: 'Unit 101',
      area: 1200,
      floor: '10th',
      utilityProrationShare: 0.15,
      monthlyRentalPrice: 2500,
      isOccupied: true,
      tenantId: tenant1.id, 
    },
  });

  const space2_B1 = await prisma.space.create({ 
    data: {
      buildingId: building1.id,
      buildingName: building1.name,
      spaceIdName: 'Unit 102',
      area: 900,
      floor: '10th',
      utilityProrationShare: 0.10,
      monthlyRentalPrice: 1800,
      isOccupied: false,
    },
  });

  const space1_B2 = await prisma.space.create({ 
    data: {
      buildingId: building2.id,
      buildingName: building2.name,
      spaceIdName: 'Suite 20A',
      area: 800,
      floor: '2nd',
      utilityProrationShare: 0.20,
      monthlyRentalPrice: 1950,
      isOccupied: true,
      tenantId: tenant2.id, 
    },
  });

  const space2_B2 = await prisma.space.create({ 
    data: {
        buildingId: building2.id,
        buildingName: building2.name,
        spaceIdName: 'Penthouse Suite',
        area: 2500,
        floor: 'Penthouse',
        utilityProrationShare: 0.40,
        monthlyRentalPrice: 5500,
        isOccupied: true,
        tenantId: tenant3.id, 
    }
  });
  
  const space1_B3 = await prisma.space.create({ 
    data: {
        buildingId: building3.id,
        buildingName: building3.name,
        spaceIdName: 'Lab A1',
        area: 1500,
        floor: '1st',
        utilityProrationShare: 0.30,
        monthlyRentalPrice: 3200,
        isOccupied: false,
    }
  });
  console.log('Created Spaces and linked occupied ones to tenants via tenantId on Space.');


  // 7. Create Agreements
  console.log('Creating Agreements...');
  const agreement1_startDate_obj = subDays(new Date(), 60);
  const agreement1 = await prisma.agreement.create({ 
    data: {
      tenantId: tenant1.id,
      spaceId: space1_B1.id,
      agreementText: 'Standard Rental Agreement for Alice Wonderland...',
      startDate: agreement1_startDate_obj, 
      monthlyRentalPrice: space1_B1.monthlyRentalPrice,
      paymentTermMonths: 12,
      initialPaymentMonths: 1,
      nextPaymentDueDate: addMonths(agreement1_startDate_obj, 1), 
      initialPaymentAmount: space1_B1.monthlyRentalPrice * 1,
      initialPaymentMethod: 'Bank Transfer',
      initialPaymentBankOrWalletName: 'Metro Bank',
      initialPaymentReference: 'INITPAY001',
      initialPaymentDate: agreement1_startDate_obj,
    },
  });

  const agreement2_startDate_obj = subDays(new Date(), 30);
  const agreement2 = await prisma.agreement.create({ 
    data: {
      tenantId: tenant2.id,
      spaceId: space1_B2.id,
      agreementText: 'Standard Rental Agreement for Bob The Builder...',
      startDate: agreement2_startDate_obj, 
      monthlyRentalPrice: space1_B2.monthlyRentalPrice,
      paymentTermMonths: 6,
      initialPaymentMonths: 2,
      nextPaymentDueDate: addMonths(agreement2_startDate_obj, 2), 
      initialPaymentAmount: space1_B2.monthlyRentalPrice * 2,
      initialPaymentMethod: 'Credit Card',
      initialPaymentReference: 'INITPAY002',
      initialPaymentDate: agreement2_startDate_obj,
    },
  });
  
  const agreement3_startDate_obj = new Date();
  const agreement3 = await prisma.agreement.create({ 
    data: {
        tenantId: tenant3.id,
        spaceId: space2_B2.id,
        agreementText: 'Premium Rental Agreement for Carol Danvers...',
        startDate: agreement3_startDate_obj, 
        monthlyRentalPrice: space2_B2.monthlyRentalPrice,
        paymentTermMonths: 24,
        initialPaymentMonths: 3,
        nextPaymentDueDate: addMonths(agreement3_startDate_obj, 3), 
        additionalTerms: "Access to rooftop pool and gym included. Bi-weekly cleaning service.",
        initialPaymentAmount: space2_B2.monthlyRentalPrice * 3,
        initialPaymentMethod: 'Wallet',
        initialPaymentBankOrWalletName: 'StarPay',
        initialPaymentReference: 'INITPAY003',
        initialPaymentDate: agreement3_startDate_obj,
    }
  });
  console.log(`Created Agreements: ${agreement1.id}, ${agreement2.id}, ${agreement3.id}`);

  // 8. Create Bills (with nested UtilityBreakdownItems)
  console.log('Creating Bills...');
  const bill1_billDate = addMonths(agreement1.startDate, 1); 
  await prisma.bill.create({
    data: {
      agreementId: agreement1.id,
      tenantId: tenant1.id,
      billDate: bill1_billDate,
      dueDate: addMonths(bill1_billDate, 0, {days: 14}), 
      rentAmount: agreement1.monthlyRentalPrice,
      utilityBreakdown: [ 
          { name: 'Electricity', amount: 50 },
          { name: 'Water', amount: 20 },
      ],
      totalAmount: agreement1.monthlyRentalPrice + 50 + 20, 
      status: 'Paid',
      paymentDate: addMonths(bill1_billDate, 0, {days: 10}),
      paymentMethod: 'Bank Transfer',
      paymentReference: 'BILLPAY001',
      bankOrWalletName: 'Metro Bank',
    },
  });

  const bill2_billDate = addMonths(agreement1.startDate, 2);
  await prisma.bill.create({
    data: {
      agreementId: agreement1.id,
      tenantId: tenant1.id,
      billDate: bill2_billDate,
      dueDate: addMonths(bill2_billDate, 0, {days: 14}),
      rentAmount: agreement1.monthlyRentalPrice,
      utilityBreakdown: [
          { name: 'Electricity', amount: 55 },
          { name: 'Water', amount: 22 },
      ],
      totalAmount: agreement1.monthlyRentalPrice + 55 + 22, 
      status: 'Pending',
    },
  });
  
  const bill3_billDate = addMonths(agreement2.startDate, 2); 
  const bobBillDueDate = addMonths(bill3_billDate, 0, {days: 5}); 
  await prisma.bill.create({
    data: {
      agreementId: agreement2.id,
      tenantId: tenant2.id,
      billDate: bill3_billDate, 
      dueDate: bobBillDueDate,
      rentAmount: agreement2.monthlyRentalPrice,
      utilityBreakdown: [ 
          { name: 'Common Area Maintenance', amount: 100 },
      ],
      totalAmount: agreement2.monthlyRentalPrice + 100, 
      status: 'Overdue', 
    },
  });
  
  const bill4_billDate = addMonths(agreement3.startDate, 3); 
  await prisma.bill.create({
    data: {
      agreementId: agreement3.id,
      tenantId: tenant3.id,
      billDate: bill4_billDate, 
      dueDate: addMonths(bill4_billDate, 0, {days: 14}),
      rentAmount: agreement3.monthlyRentalPrice,
      utilityBreakdown: [ 
          { name: 'Premium Internet', amount: 150 },
          { name: 'Valet Parking', amount: 75 },
      ],
      totalAmount: agreement3.monthlyRentalPrice + 150 + 75, 
      status: 'Pending',
    },
  });
  console.log('Created Bills.');

  // 9. Create BuildingMonthlyUtilities (with nested BuildingUtilityItems)
  console.log('Creating BuildingMonthlyUtilities...');
  const todayDate = new Date();
  const lastMonthDate = subDays(todayDate, todayDate.getDate()); 
  const lastMonth = lastMonthDate.getMonth(); 
  const lastMonthYear = lastMonthDate.getFullYear();

  await prisma.buildingMonthlyUtilities.create({
    data: {
      buildingId: building1.id,
      buildingName: building1.name, 
      year: lastMonthYear,
      month: lastMonth, 
      utilities: {
        create: [
          { name: 'Building Electricity', totalCost: 1200, appliesToScope: 'Building' },
          { name: 'Building Water', totalCost: 800, appliesToScope: 'Building' },
          { name: '10th Floor Cleaning', totalCost: 300, appliesToScope: 'Floor', applicableFloor: '10th' },
        ],
      },
    },
  });

  await prisma.buildingMonthlyUtilities.create({
    data: {
      buildingId: building2.id,
      buildingName: building2.name, 
      year: lastMonthYear,
      month: lastMonth,
      utilities: {
        create: [
          { name: 'General Building Maintenance', totalCost: 1500, appliesToScope: 'Building' },
          { name: 'Penthouse Landscaping', totalCost: 250, appliesToScope: 'SpecificSpaces', applicableSpaceIdNames: ['Penthouse Suite'] },
        ],
      },
    },
  });
  console.log('Created BuildingMonthlyUtilities.');

  console.log('Seeding finished successfully!');
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
