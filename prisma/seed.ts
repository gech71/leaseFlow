
import { PrismaClient, Prisma } from '@prisma/client';
import { addMonths, formatISO, subDays, parseISO } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding process...');

  // 1. Clear existing data
  console.log('Clearing existing data...');
  try {
    // Order: Delete records that depend on others first, or records whose deletion cascades.

    // Bill is child of Agreement. UtilityBreakdownItem is child of Bill.
    await prisma.bill.deleteMany({});
    console.log('Deleted Bills (and cascaded to UtilityBreakdownItems if schema is set up for it)');

    // Agreement is child of Tenant and Space.
    await prisma.agreement.deleteMany({});
    console.log('Deleted Agreements');

    // BuildingUtilityItem is child of BuildingMonthlyUtilities.
    await prisma.buildingUtilityItem.deleteMany({});
    console.log('Deleted BuildingUtilityItems');

    // BuildingMonthlyUtilities is child of Building.
    await prisma.buildingMonthlyUtilities.deleteMany({});
    console.log('Deleted BuildingMonthlyUtilities');

    // PenaltyTier is child of Building.
    await prisma.penaltyTier.deleteMany({});
    console.log('Deleted PenaltyTiers');

    // Find tenants that have a rentedSpace
    const tenantsToClearLink = await prisma.tenant.findMany({
      where: {
        rentedSpace: {
          isNot: null,
        },
      },
      select: { id: true }
    });
    for (const tenant of tenantsToClearLink) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          rentedSpace: {
            disconnect: true,
          },
        },
      });
    }
    console.log('Cleared rentedSpace link from Tenants');

    // Find spaces that have a tenant
    const spacesToClearLink = await prisma.space.findMany({
      where: {
        tenant: {
          isNot: null,
        },
      },
      select: {id: true}
    });
    for (const space of spacesToClearLink) {
      await prisma.space.update({
        where: { id: space.id },
        data: {
          tenant: {
            disconnect: true,
          },
          isOccupied: false, // Also update isOccupied status
        },
      });
    }
    console.log('Cleared tenant link from Spaces and set isOccupied to false');

    // Now delete Tenants and Spaces
    await prisma.tenant.deleteMany({});
    console.log('Deleted Tenants');
    await prisma.space.deleteMany({});
    console.log('Deleted Spaces');

    // Finally, delete Buildings (which should cascade to PenaltyTiers if schema is set)
    await prisma.building.deleteMany({});
    console.log('Deleted Buildings');

    console.log('Finished clearing data.');
  } catch (e: any) {
    console.error('Error during data clearing:', e);
    throw e; // Re-throw to stop seeding if clearing fails
  }


  // 2. Create Buildings with Penalty Tiers
  console.log('Creating Buildings...');
  const building1 = await prisma.building.create({
    data: {
      name: 'Sunrise Tower',
      address: '123 Sunrise Ave, Metro City',
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

  // 4. Create Spaces (linking to Buildings and some to Tenants)
  console.log('Creating Spaces...');
  const space1_B1 = await prisma.space.create({ // Alice's space in Sunrise Tower
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
  // Link space back to tenant
  await prisma.tenant.update({
    where: { id: tenant1.id },
    data: {
      rentedSpace: {
        connect: { id: space1_B1.id }
      }
    }
  });


  const space2_B1 = await prisma.space.create({ // Vacant space in Sunrise Tower
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

  const space1_B2 = await prisma.space.create({ // Bob's space in Ocean View Plaza
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
   // Link space back to tenant
  await prisma.tenant.update({
    where: { id: tenant2.id },
    data: {
      rentedSpace: {
        connect: { id: space1_B2.id }
      }
    }
  });

  const space2_B2 = await prisma.space.create({ // Carol's Penthouse in Ocean View Plaza
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
   // Link space back to tenant
  await prisma.tenant.update({
    where: { id: tenant3.id },
    data: {
      rentedSpace: {
        connect: { id: space2_B2.id }
      }
    }
  });
  
  const space1_B3 = await prisma.space.create({ // Vacant space in Tech Park One
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
  console.log('Created Spaces and linked occupied ones to tenants.');


  // 5. Create Agreements
  console.log('Creating Agreements...');
  const agreement1_startDate = subDays(new Date(), 60);
  const agreement1 = await prisma.agreement.create({ // Alice's agreement
    data: {
      tenantId: tenant1.id,
      // tenantName: tenant1.name, // Removed
      spaceId: space1_B1.id,
      spaceDescription: `${space1_B1.spaceIdName}, ${building1.name}`,
      agreementText: 'Standard Rental Agreement for Alice Wonderland...',
      startDate: formatISO(agreement1_startDate), 
      monthlyRentalPrice: space1_B1.monthlyRentalPrice,
      paymentTermMonths: 12,
      initialPaymentMonths: 1,
      nextPaymentDueDate: formatISO(addMonths(agreement1_startDate, 2)), 
      initialPaymentAmount: space1_B1.monthlyRentalPrice * 1,
      initialPaymentMethod: 'Bank Transfer',
      initialPaymentBankOrWalletName: 'Metro Bank',
      initialPaymentReference: 'INITPAY001',
      initialPaymentDate: formatISO(agreement1_startDate),
    },
  });

  const agreement2_startDate = subDays(new Date(), 30);
  const agreement2 = await prisma.agreement.create({ // Bob's agreement
    data: {
      tenantId: tenant2.id,
      // tenantName: tenant2.name, // Removed
      spaceId: space1_B2.id,
      spaceDescription: `${space1_B2.spaceIdName}, ${building2.name}`,
      agreementText: 'Standard Rental Agreement for Bob The Builder...',
      startDate: formatISO(agreement2_startDate), 
      monthlyRentalPrice: space1_B2.monthlyRentalPrice,
      paymentTermMonths: 6,
      initialPaymentMonths: 2,
      nextPaymentDueDate: formatISO(addMonths(agreement2_startDate, 2)), 
      initialPaymentAmount: space1_B2.monthlyRentalPrice * 2,
      initialPaymentMethod: 'Credit Card',
      initialPaymentReference: 'INITPAY002',
      initialPaymentDate: formatISO(agreement2_startDate),
    },
  });
  
  const agreement3_startDate = new Date();
  const agreement3 = await prisma.agreement.create({ // Carol's agreement
    data: {
        tenantId: tenant3.id,
        // tenantName: tenant3.name, // Removed
        spaceId: space2_B2.id,
        spaceDescription: `${space2_B2.spaceIdName}, ${building2.name}`,
        agreementText: 'Premium Rental Agreement for Carol Danvers...',
        startDate: formatISO(agreement3_startDate), 
        monthlyRentalPrice: space2_B2.monthlyRentalPrice,
        paymentTermMonths: 24,
        initialPaymentMonths: 3,
        nextPaymentDueDate: formatISO(addMonths(agreement3_startDate, 3)),
        additionalTerms: "Access to rooftop pool and gym included. Bi-weekly cleaning service.",
        initialPaymentAmount: space2_B2.monthlyRentalPrice * 3,
        initialPaymentMethod: 'Wallet',
        initialPaymentBankOrWalletName: 'StarPay',
        initialPaymentReference: 'INITPAY003',
        initialPaymentDate: formatISO(agreement3_startDate),
    }
  });
  console.log(`Created Agreements: ${agreement1.id}, ${agreement2.id}, ${agreement3.id}`);

  // 6. Create Bills (with nested UtilityBreakdownItems)
  console.log('Creating Bills...');
  // Bill for Alice (last month, paid)
  const bill1_billDate = addMonths(parseISO(agreement1.startDate), 1);
  await prisma.bill.create({
    data: {
      agreementId: agreement1.id,
      tenantId: tenant1.id,
      spaceDescription: agreement1.spaceDescription,
      billDate: formatISO(bill1_billDate),
      dueDate: formatISO(addMonths(bill1_billDate, 0, {days: 14})), 
      rentAmount: agreement1.monthlyRentalPrice,
      totalAmount: agreement1.monthlyRentalPrice + 50 + 20, // Example utility costs
      status: 'Paid',
      paymentDate: formatISO(addMonths(bill1_billDate, 0, {days: 10})),
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
  const bill2_billDate = addMonths(parseISO(agreement1.startDate), 2);
  await prisma.bill.create({
    data: {
      agreementId: agreement1.id,
      tenantId: tenant1.id,
      spaceDescription: agreement1.spaceDescription,
      billDate: formatISO(bill2_billDate),
      dueDate: formatISO(addMonths(bill2_billDate, 0, {days: 14})),
      rentAmount: agreement1.monthlyRentalPrice,
      totalAmount: agreement1.monthlyRentalPrice + 55 + 22, // Example utility costs
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
  const bill3_billDate = addMonths(parseISO(agreement2.startDate), 1); // Bill for month after initial payment
  const bobBillDueDate = addMonths(bill3_billDate, 0, {days: 5}); 
  await prisma.bill.create({
    data: {
      agreementId: agreement2.id,
      tenantId: tenant2.id,
      spaceDescription: agreement2.spaceDescription,
      billDate: formatISO(bill3_billDate), 
      dueDate: formatISO(bobBillDueDate),
      rentAmount: agreement2.monthlyRentalPrice,
      totalAmount: agreement2.monthlyRentalPrice + 100, // Example utility cost
      status: 'Overdue', // Assuming today is past this due date for seeding
      utilityBreakdown: {
        create: [
          { name: 'Common Area Maintenance', amount: 100 },
        ],
      },
    },
  });
  
  // Bill for Carol (next month, pending, as initial payment covers first 3 months)
  const bill4_billDate = addMonths(parseISO(agreement3.startDate), 3); // Bill for 4th month
  await prisma.bill.create({
    data: {
      agreementId: agreement3.id,
      tenantId: tenant3.id,
      spaceDescription: agreement3.spaceDescription,
      billDate: formatISO(bill4_billDate), 
      dueDate: formatISO(addMonths(bill4_billDate, 0, {days: 14})),
      rentAmount: agreement3.monthlyRentalPrice,
      totalAmount: agreement3.monthlyRentalPrice + 150 + 75, // Example utility costs
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

