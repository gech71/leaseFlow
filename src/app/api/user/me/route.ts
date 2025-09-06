
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';
import type { CurrentUser, UserRole } from '@/lib/types'; // Import shared types

const ADMIN_ACCESS_TOKEN_KEY = 'nibrental_admin_access_token';

// Insecure JWT payload decoder for prototype purposes ONLY.
// DO NOT USE IN PRODUCTION. Use a proper JWT library (e.g., jose).
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT payload:', e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const authHeader = request.headers.get('Authorization');
  
  let accessToken: string | undefined;

  // This endpoint is for the admin panel, so it primarily uses the admin cookie.
  // A Bearer token could also be used for admin API calls from other clients.
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7);
  } else {
    accessToken = cookieStore.get(ADMIN_ACCESS_TOKEN_KEY)?.value;
  }

  if (!accessToken) {
    return NextResponse.json({ isSuccess: false, errors: ["Authentication required."] }, { status: 401 });
  }

  const tokenPayload = decodeJwtPayload(accessToken);
  if (!tokenPayload || !tokenPayload.sub) {
    console.error("Failed to decode access token or 'sub' claim is missing in /api/user/me.");
    return NextResponse.json({ isSuccess: false, errors: ["Invalid authentication token."] }, { status: 401 });
  }

  const externalUserId = tokenPayload.sub;

  try {
    const localUser = await databaseService.getUserByExternalId(externalUserId, { roles: true });

    if (!localUser) {
      console.warn(`User ${externalUserId} (from token) not found in local database during /api/user/me call.`);
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
      id: localUser.id, // Prisma internal ID
      userId: localUser.userId, // External ID from token's sub
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
