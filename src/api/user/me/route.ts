
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { databaseService } from '@/lib/services/databaseService';
import type { CurrentUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ isSuccess: false, errors: ["Authentication required."] }, { status: 401 });
  }

  try {
    // The user ID from the session token is the internal Prisma User ID.
    const localUser = await databaseService.getUserById(session.user.id, { roles: true });

    if (!localUser) {
      console.warn(`User with internal ID ${session.user.id} not found in database during /api/user/me call.`);
      return NextResponse.json({ isSuccess: false, errors: ["User not found in the system."] }, { status: 404 });
    }

    // Calculate effective permissions
    const effectivePermissionsSet = new Set<string>();
    if (localUser.roles) {
      localUser.roles.forEach(role => {
        if (role.permissions) {
          role.permissions.forEach(permission => effectivePermissionsSet.add(permission));
        }
      });
    }
    
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
