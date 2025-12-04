export const dynamic = "force-dynamic";

// Main form interaction is client-side, but data fetching for props is server-side.

import { Suspense } from "react";
import { PageHeader } from "@/components/custom/PageHeader";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { databaseService } from "@/lib/services/databaseService";
import type {
  Tenant,
  Space,
  Prisma,
  User,
  Role,
  AgreementTemplate,
} from "@prisma/client"; // For server-side fetching
import { GenerateAgreementClientPage } from "./client-page"; // Import the new client component
import { getUserAndManagedIds } from "@/lib/actions/server-helpers";

// This is an async Server Component responsible for fetching data
async function GenerateAgreementDataFetcher() {
  const { isSuperAdmin, managedBuildingIds, currentUser } =
    await getUserAndManagedIds();

  // For generating agreements, a manager should be able to see ANY tenant,
  // so they can add an existing tenant to one of their buildings.
  const tenantWhereClause: Prisma.TenantWhereInput = {};

  const spaceWhereClause: Prisma.SpaceWhereInput = {
    isOccupied: false,
    ...(!isSuperAdmin ? { buildingId: { in: managedBuildingIds! } } : {}),
  };

  // Agreement templates are not scoped to a building. Allow managers to use
  // templates created by others in the organization rather than limiting to
  // templates created by the current user.
  // For non-superadmins, show templates that are global, created by the
  // current user, or scoped to one of the buildings they manage.
  const agreementTemplateWhere: Prisma.AgreementTemplateWhereInput =
    !isSuperAdmin
      ? {
          OR: [
            { buildingId: null },
            { createdById: currentUser.id },
            ...(managedBuildingIds && managedBuildingIds.length > 0
              ? [{ buildingId: { in: managedBuildingIds } }]
              : []),
          ],
        }
      : {};

  const tenants = await databaseService.getAllTenants({
    where: tenantWhereClause,
    orderBy: { name: "asc" },
  });
  const availableSpaces = await databaseService.getAllSpaces({
    where: spaceWhereClause,
    orderBy: [{ buildingName: "asc" }, { spaceIdName: "asc" }],
  });
  const agreementTemplates = await databaseService.getAllAgreementTemplates({
    where: agreementTemplateWhere,
    orderBy: { name: "asc" },
  });

  // Serialize dates before passing to client component
  const serializableTenants = tenants.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt?.toISOString() || t.createdAt.toISOString(), // Fallback for updatedAt
  }));
  const serializableSpaces = availableSpaces.map((s) => ({
    ...s,
    area: Number(s.area),
    utilityProrationShare: Number(s.utilityProrationShare),
    monthlyRentalPrice: Number(s.monthlyRentalPrice),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt?.toISOString() || s.createdAt.toISOString(), // Fallback for updatedAt
  }));

  return (
    <GenerateAgreementClientPage
      tenants={serializableTenants}
      availableSpaces={serializableSpaces}
      agreementTemplates={agreementTemplates}
    />
  );
}

// Server Component to fetch initial data
export default function GenerateAgreementPage() {
  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Generate Rental Agreement"
        description="Select a template, tenant, and space, then generate and save the complete record."
        actions={
          <Link href="/admin/agreements" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Agreements
            </Button>
          </Link>
        }
      />
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-[50vh]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        }
      >
        <GenerateAgreementDataFetcher />
      </Suspense>
    </div>
  );
}
