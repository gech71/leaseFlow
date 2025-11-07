
"use client";

import type { CurrentUser, PermissionId } from '@/lib/types';
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface PermissionContextType {
  currentUser: CurrentUser | null;
  isLoading: boolean;
  error: string | null;
  hasPermission: (permission: PermissionId | PermissionId[]) => boolean;
  hasAnyPermission: (permissions: PermissionId[]) => boolean;
  isSuperAdmin: boolean;
  refetchUser: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const usePermissions = (): PermissionContextType => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

interface PermissionProviderProps {
  children: ReactNode;
}

export const PermissionProvider: React.FC<PermissionProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const { data: session, status, update } = useSession(); // Use next-auth session

  const isLoading = status === 'loading';
  const error = status === 'unauthenticated' ? 'Session expired or not authenticated.' : null;

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
        // Map the session user to your CurrentUser type
        const user: CurrentUser = {
            id: session.user.id,
            email: session.user.email || 'No Email',
            name: session.user.name || 'No Name',
            // The following fields might not be in the default session user type.
            // You need to augment the session type in next-auth.d.ts
            // @ts-ignore
            firstName: session.user.firstName,
            // @ts-ignore
            lastName: session.user.lastName,
            // @ts-ignore
            phoneNumber: session.user.phoneNumber,
            // @ts-ignore
            roles: session.user.roles || [],
            // @ts-ignore
            effectivePermissions: session.user.permissions || []
        };
        setCurrentUser(user);
    } else {
      setCurrentUser(null);
    }
  }, [session, status]);
  
  const isSuperAdmin = useMemo(() => {
    // @ts-ignore
    return currentUser?.roles?.some(role => role === 'SUPER_ADMIN' || role.name === 'SUPER_ADMIN') || false;
  }, [currentUser]);

  const hasPermission = useCallback((permission: PermissionId | PermissionId[]): boolean => {
    if (isSuperAdmin) return true;
    if (!currentUser || !currentUser.effectivePermissions) return false;
    
    const checkPermission = (p: PermissionId) => currentUser.effectivePermissions.includes(p);

    if (Array.isArray(permission)) {
      return permission.every(checkPermission);
    }
    return checkPermission(permission);
  }, [currentUser, isSuperAdmin]);

  const hasAnyPermission = useCallback((permissions: PermissionId[]): boolean => {
    if (isSuperAdmin) return true;
    if (!currentUser || !currentUser.effectivePermissions) return false;
    return permissions.some(p => currentUser.effectivePermissions.includes(p));
  }, [currentUser, isSuperAdmin]);

  const refetchUser = useCallback(async () => {
    await update(); // This refetches the session from next-auth
  }, [update]);

  const contextValue = useMemo(() => ({
    currentUser,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    isSuperAdmin,
    refetchUser
  }), [currentUser, isLoading, error, hasPermission, hasAnyPermission, isSuperAdmin, refetchUser]);

  return (
    <PermissionContext.Provider value={contextValue}>
      {children}
    </PermissionContext.Provider>
  );
};
