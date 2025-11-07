
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: session, status } = useSession();

  const fetchCurrentUser = useCallback(async () => {
    setError(null);
    if (status === 'unauthenticated') {
      setCurrentUser(null);
      setIsLoading(false);
      setError("Not authenticated.");
      return;
    }
    if (status === 'loading') {
      setIsLoading(true);
      return;
    }

    if (status === 'authenticated' && session?.user) {
        // Construct CurrentUser from session data
        const roles = session.user.roles || [];
        const permissions = session.user.permissions || [];
        
        const user: CurrentUser = {
            id: session.user.id,
            email: session.user.email || 'No Email',
            name: session.user.name || 'No Name',
            roles: roles.map(roleName => ({
                id: roleName, // Placeholder, as full role objects aren't in session
                name: roleName,
                permissions: permissions, 
            })),
            effectivePermissions: permissions
        };
        setCurrentUser(user);
        setIsLoading(false);
    }

  }, [status, session]);
  
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const isSuperAdmin = useMemo(() => {
    return currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') || false;
  }, [currentUser]);

  const hasPermission = useCallback((permission: PermissionId | PermissionId[]): boolean => {
    if (isSuperAdmin) return true;
    if (!currentUser || !currentUser.effectivePermissions) return false;
    
    if (Array.isArray(permission)) {
      return permission.every(p => currentUser.effectivePermissions.includes(p));
    }
    return currentUser.effectivePermissions.includes(permission);
  }, [currentUser, isSuperAdmin]);

  const hasAnyPermission = useCallback((permissions: PermissionId[]): boolean => {
    if (isSuperAdmin) return true;
    if (!currentUser || !currentUser.effectivePermissions) return false;
    return permissions.some(p => currentUser.effectivePermissions.includes(p));
  }, [currentUser, isSuperAdmin]);

  const refetchUser = useCallback(async () => {
    setIsLoading(true);
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  const contextValue = useMemo(() => ({
    currentUser,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    isSuperAdmin,
    refetchUser
  }), [currentUser, isLoading, error, hasPermission, hasAnyPermission, isSuperAdmin, refetchUser]);


  if (isLoading && !currentUser) { 
    return (
      <div className="flex justify-center items-center h-screen w-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PermissionContext.Provider value={contextValue}>
      {children}
    </PermissionContext.Provider>
  );
};

    