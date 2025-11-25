
import { NextResponse, type NextRequest } from 'next/server';
import * as dashboardActions from '@/app/admin/dashboard/actions';
import * as billingActions from '@/app/admin/billing/actions';
import * as buildingActions from '@/app/admin/buildings/actions';
import * as spaceActions from '@/app/admin/spaces/actions';
import * as tenantActions from '@/app/admin/tenants/actions';
import * as agreementActions from '@/app/admin/agreements/actions';
import * as templateActions from '@/app/admin/settings/agreement-template/actions';
import * as userManagementActions from '@/app/admin/settings/user-management/actions';
import * as roleManagementActions from '@/app/admin/settings/role-management/actions';
import * as profileActions from '@/app/admin/profile/actions';
import * as importActions from '@/app/admin/import/actions';

const actions: { [key: string]: Function } = {
  ...dashboardActions,
  ...billingActions,
  ...buildingActions,
  ...spaceActions,
  ...tenantActions,
  ...agreementActions,
  ...templateActions,
  ...userManagementActions,
  ...roleManagementActions,
  ...profileActions,
  ...importActions,
};

export async function POST(request: NextRequest) {
  try {
    const { action, args } = await request.json();
    
    if (typeof action !== 'string' || !actions[action]) {
      return NextResponse.json({ error: `Action '${action}' not found.` }, { status: 400 });
    }

    const actionFn = actions[action];
    const result = await actionFn(...(args || []));
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`API action route error:`, error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred in the action handler.' }, 
      { status: 500 }
    );
  }
}
