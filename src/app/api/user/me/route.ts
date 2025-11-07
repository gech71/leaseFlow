

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { databaseService } from '@/lib/services/databaseService';
import type { CurrentUser } from '@/lib/types';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ isSuccess: false, errors: ["Authentication required."] }, { status: 401 });
  }

  try {
    const localUser = await databaseService.getUserById(session.user.id, { roles: true });

    if (!localUser) {
      return NextResponse.json({ isSuccess: false, errors: ["User not found in the system."] }, { status: 404 });
    }

    const effectivePermissionsSet = new Set<string>();
    localUser.roles.forEach(role => {
      role.permissions.forEach(permission => effectivePermissionsSet.add(permission));
    });

    const currentUserData: CurrentUser = {
      id: localUser.id,
      email: localUser.email,
      name: localUser.name || `${localUser.firstName} ${localUser.lastName}`.trim(),
      firstName: localUser.firstName,
      lastName: localUser.lastName,
      phoneNumber: localUser.phoneNumber,
      roles: localUser.roles.map(role => ({
        id: role.id,
        name: role.name,
        permissions: role.permissions || [],
      })),
      effectivePermissions: Array.from(effectivePermissionsSet),
    };

    return NextResponse.json({ isSuccess: true, user: currentUserData });

  } catch (dbError: any) {
    console.error("Database error in /api/user/me:", dbError.message);
    return NextResponse.json({ isSuccess: false, errors: ["Error fetching user details."] }, { status: 500 });
  }
}
