
import { PrismaClient, Prisma } from '@prisma/client';
import { addMonths, formatISO, subDays } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding process...');

  // 1. Clear existing data (careful with order for FK constraints)
  console.log('Clearing existing data...');
  await prisma.utilityBreakdownItem.deleteMany({});
  console.log('Deleted UtilityBreakdownItems');
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

  // Break links between Tenant and Space before deleting them
  const tenantsToClearLink = await prisma.tenant.findMany({ where: { rentedSpaceId: { not: null } } });
  for (const tenant of tenantsToClearLink) {
    await prisma.tenant.update({ where: { id: tenant.id }, data: { rentedSpaceId: null } });
  }
  console.log('Cleared rentedSpaceId from Tenants');

  const spacesToClearLink = await prisma.space.findMany({ where: { tenantId: { not: null } } });
  for (const space of spacesToClearLink) {
    await prisma.space.update({ where: { id: space.id }, data: { tenantId: null, isOccupied: false } });
  }
  console.log('Cleared tenantId from Spaces');

  await prisma.tenant.deleteMany({});
  console.log('Deleted Tenants');
  await prisma.space.deleteMany({});
  console.log('Deleted Spaces');
  await prisma.building.deleteMany({});
  console.log('Deleted Buildings');
  console.log('Finished clearing data.');

  // 2. Create Buildings with Penalty Tiers
  console.log('Creating Buildings...');
  const building1 = await prisma.building.create({
    data: {
      name: 'Sunrise Tower',
      address: '123 Sunrise Ave, Metro City',
      createdAt: new Date(),
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
      createdAt: new Date(),
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
        createdAt: new Date(),
        // No specific penalty policy tiers initially, can be added later
    }
  });
  console.log(`Created Buildings: ${building1.name}, ${building2.name}, ${building3.name}`);

  // 3. Create Tenants
  console.log('Creating Tenants...');
  const tenant1 = await prisma.tenant.create({
    data: {
      name: 'Alice Wonderland',
      email: 'alice@example.com',
      phone: '555-0101',
      nationalId: 'AW12345X',
      representativeName: 'Cheshire Cat',
      representativePhone: '555-0199',
      createdAt: new Date(),
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'Bob The Builder',
      email: 'bob@example.com',
      phone: '555-0202',
      createdAt: new Date(),
    },
  });

  const tenant3 = await prisma.tenant.create({
    data: {
      name: 'Carol Danvers',
      email: 'carol@example.com',
      phone: '555-0303',
      nationalId: 'CD98765Z',
      createdAt: new Date(),
    },
  });
  console.log(`Created Tenants: ${tenant1.name}, ${tenant2.name}, ${tenant3.name}`);

  // 4. Create Spaces (linking to Buildings and some to Tenants)
  console.log('Creating Spaces...');
  const space1_B1 = await prisma.space.create({ // Alice's space in Sunrise Tower
    data: {
      buildingId: building1.id,
      spaceIdName: 'Unit 101',
      area: 1200,
      floor: '10th',
      utilityProrationShare: 0.15,
      monthlyRentalPrice: 2500,
      isOccupied: true,
      tenantId: tenant1.id,
      createdAt: new Date(),
    },
  });
  await prisma.tenant.update({ where: { id: tenant1.id }, data: { rentedSpaceId: space1_B1.id } });


  const space2_B1 = await prisma.space.create({ // Vacant space in Sunrise Tower
    data: {
      buildingId: building1.id,
      spaceIdName: 'Unit 102',
      area: 900,
      floor: '10th',
      utilityProrationShare: 0.10,
      monthlyRentalPrice: 1800,
      isOccupied: false,
      createdAt: new Date(),
    },
  });

  const space1_B2 = await prisma.space.create({ // Bob's space in Ocean View Plaza
    data: {
      buildingId: building2.id,
      spaceIdName: 'Suite 20A',
      area: 800,
      floor: '2nd',
      utilityProrationShare: 0.20,
      monthlyRentalPrice: 1950,
      isOccupied: true,
      tenantId: tenant2.id,
      createdAt: new Date(),
    },
  });
  await prisma.tenant.update({ where: { id: tenant2.id }, data: { rentedSpaceId: space1_B2.id } });

  const space2_B2 = await prisma.space.create({ // Carol's Penthouse in Ocean View Plaza
    data: {
        buildingId: building2.id,
        spaceIdName: 'Penthouse Suite',
        area: 2500,
        floor: 'Penthouse',
        utilityProrationShare: 0.40,
        monthlyRentalPrice: 5500,
        isOccupied: true,
        tenantId: tenant3.id,
        createdAt: new Date(),
    }
  });
  await prisma.tenant.update({ where: { id: tenant3.id }, data: { rentedSpaceId: space2_B2.id } });
  
  const space1_B3 = await prisma.space.create({ // Vacant space in Tech Park One
    data: {
        buildingId: building3.id,
        spaceIdName: 'Lab A1',
        area: 1500,
        floor: '1st',
        utilityProrationShare: 0.30,
        monthlyRentalPrice: 3200,
        isOccupied: false,
        createdAt: new Date(),
    }
  });
  console.log('Created Spaces and linked occupied ones to tenants.');


  // 5. Create Agreements
  console.log('Creating Agreements...');
  const agreement1 = await prisma.agreement.create({ // Alice's agreement
    data: {
      tenantId: tenant1.id,
      tenantName: tenant1.name,
      spaceId: space1_B1.id,
      spaceDescription: `${space1_B1.spaceIdName}, ${building1.name}`,
      agreementText: 'Standard Rental Agreement for Alice Wonderland...',
      startDate: formatISO(subDays(new Date(), 60)), // Started 60 days ago
      monthlyRentalPrice: space1_B1.monthlyRentalPrice,
      paymentTermMonths: 12,
      initialPaymentMonths: 1,
      nextPaymentDueDate: formatISO(addMonths(parseISO(formatISO(subDays(new Date(), 60))), 2)), // Due for 3rd month
      createdAt: new Date(),
      initialPaymentAmount: space1_B1.monthlyRentalPrice * 1,
      initialPaymentMethod: 'Bank Transfer',
      initialPaymentBankOrWalletName: 'Metro Bank',
      initialPaymentReference: 'INITPAY001',
      initialPaymentDate: formatISO(subDays(new Date(), 60)),
    },
  });

  const agreement2 = await prisma.agreement.create({ // Bob's agreement
    data: {
      tenantId: tenant2.id,
      tenantName: tenant2.name,
      spaceId: space1_B2.id,
      spaceDescription: `${space1_B2.spaceIdName}, ${building2.name}`,
      agreementText: 'Standard Rental Agreement for Bob The Builder...',
      startDate: formatISO(subDays(new Date(), 30)), // Started 30 days ago
      monthlyRentalPrice: space1_B2.monthlyRentalPrice,
      paymentTermMonths: 6,
      initialPaymentMonths: 2,
      nextPaymentDueDate: formatISO(addMonths(parseISO(formatISO(subDays(new Date(), 30))), 2)), // Due for 3rd month
      createdAt: new Date(),
      initialPaymentAmount: space1_B2.monthlyRentalPrice * 2,
      initialPaymentMethod: 'Credit Card',
      initialPaymentReference: 'INITPAY002',
      initialPaymentDate: formatISO(subDays(new Date(), 30)),
    },
  });
  
  const agreement3 = await prisma.agreement.create({ // Carol's agreement
    data: {
        tenantId: tenant3.id,
        tenantName: tenant3.name,
        spaceId: space2_B2.id,
        spaceDescription: `${space2_B2.spaceIdName}, ${building2.name}`,
        agreementText: 'Premium Rental Agreement for Carol Danvers...',
        startDate: formatISO(new Date()), // Starts today
        monthlyRentalPrice: space2_B2.monthlyRentalPrice,
        paymentTermMonths: 24,
        initialPaymentMonths: 3,
        nextPaymentDueDate: formatISO(addMonths(new Date(), 3)),
        createdAt: new Date(),
        additionalTerms: "Access to rooftop pool and gym included. Bi-weekly cleaning service.",
        initialPaymentAmount: space2_B2.monthlyRentalPrice * 3,
        initialPaymentMethod: 'Wallet',
        initialPaymentBankOrWalletName: 'StarPay',
        initialPaymentReference: 'INITPAY003',
        initialPaymentDate: formatISO(new Date()),
    }
  });
  console.log(`Created Agreements: ${agreement1.id}, ${agreement2.id}, ${agreement3.id}`);

  // 6. Create Bills (with nested UtilityBreakdownItems)
  console.log('Creating Bills...');
  // Bill for Alice (last month, paid)
  await prisma.bill.create({
    data: {
      agreementId: agreement1.id,
      tenantId: tenant1.id,
      spaceDescription: agreement1.spaceDescription,
      billDate: formatISO(addMonths(parseISO(agreement1.startDate), 1)),
      dueDate: formatISO(addMonths(parseISO(agreement1.startDate), 1, {days: 14})),
      rentAmount: agreement1.monthlyRentalPrice,
      totalAmount: agreement1.monthlyRentalPrice + 50 + 20,
      status: 'Paid',
      paymentDate: formatISO(addMonths(parseISO(agreement1.startDate), 1, {days: 10})),
      paymentMethod: 'Bank Transfer',
      paymentReference: 'BILLPAY001',
      bankOrWalletName: 'Metro Bank',
      utilityBreakdown: {
        create: [
          { name: 'Electricity', amount: 50 },
          { name: 'Water', amount: 20 },
        ],
      },
    },
  });

  // Bill for Alice (current month, pending)
  await prisma.bill.create({
    data: {
      agreementId: agreement1.id,
      tenantId: tenant1.id,
      spaceDescription: agreement1.spaceDescription,
      billDate: formatISO(addMonths(parseISO(agreement1.startDate), 2)),
      dueDate: formatISO(addMonths(parseISO(agreement1.startDate), 2, {days: 14})),
      rentAmount: agreement1.monthlyRentalPrice,
      totalAmount: agreement1.monthlyRentalPrice + 55 + 22,
      status: 'Pending',
      utilityBreakdown: {
        create: [
          { name: 'Electricity', amount: 55 },
          { name: 'Water', amount: 22 },
        ],
      },
    },
  });
  
  // Bill for Bob (current month, overdue)
  const bobBillDueDate = addMonths(parseISO(agreement2.startDate), 1, {days: 5}); // Bob pays early in the month after initial
  await prisma.bill.create({
    data: {
      agreementId: agreement2.id,
      tenantId: tenant2.id,
      spaceDescription: agreement2.spaceDescription,
      billDate: formatISO(addMonths(parseISO(agreement2.startDate), 1)), // Bill for month after initial payment
      dueDate: formatISO(bobBillDueDate),
      rentAmount: agreement2.monthlyRentalPrice,
      totalAmount: agreement2.monthlyRentalPrice + 100,
      status: 'Overdue', // Assuming today is past this due date for seeding
      utilityBreakdown: {
        create: [
          { name: 'Common Area Maintenance', amount: 100 },
        ],
      },
    },
  });
  
  // Bill for Carol (next month, pending, as initial payment covers first 3 months)
  await prisma.bill.create({
    data: {
      agreementId: agreement3.id,
      tenantId: tenant3.id,
      spaceDescription: agreement3.spaceDescription,
      billDate: formatISO(addMonths(parseISO(agreement3.startDate), 3)), // Bill for 4th month
      dueDate: formatISO(addMonths(parseISO(agreement3.startDate), 3, {days: 14})),
      rentAmount: agreement3.monthlyRentalPrice,
      totalAmount: agreement3.monthlyRentalPrice + 150 + 75,
      status: 'Pending',
      utilityBreakdown: {
        create: [
          { name: 'Premium Internet', amount: 150 },
          { name: 'Valet Parking', amount: 75 },
        ],
      },
    },
  });
  console.log('Created Bills.');

  // 7. Create BuildingMonthlyUtilities (with nested BuildingUtilityItems)
  console.log('Creating BuildingMonthlyUtilities...');
  const currentYear = new Date().getFullYear();
  const lastMonth = new Date().getMonth() -1 < 0 ? 11 : new Date().getMonth() -1;
  const lastMonthYear = new Date().getMonth() -1 < 0 ? currentYear -1 : currentYear;

  await prisma.buildingMonthlyUtilities.create({
    data: {
      buildingId: building1.id,
      year: lastMonthYear,
      month: lastMonth, // For last month
      createdAt: new Date(),
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
      year: lastMonthYear,
      month: lastMonth, // For last month
      createdAt: new Date(),
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
