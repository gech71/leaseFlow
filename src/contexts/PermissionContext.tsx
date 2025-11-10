"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CurrentUser } from '@/lib/types';
import { useSession } from 'next-auth/react';

interface PermissionContextType {
  currentUser: CurrentUser | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
}

const PermissionContext = createContext<PermissionContextType>({
  currentUser: null,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  isSuperAdmin: false,
  isLoading: true,
});

export const usePermissions = () => useContext(PermissionContext);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { data: session, status } = useSession();

  useEffect(() => {
    const fetchUserPermissions = async () => {
      if (status === 'authenticated' && session?.user) {
        // In JWT strategy, user data is already in the session
        const userFromSession = session.user as CurrentUser;
        setCurrentUser(userFromSession);
      }
      setIsLoading(false);
    };

    if (status !== 'loading') {
      fetchUserPermissions();
    }
  }, [session, status]);
  
  const isSuperAdmin = currentUser?.roles?.some(role => role.name === 'SUPER_ADMIN') || false;

  const hasPermission = (permission: string): boolean => {
    if (!currentUser || !permission) return false;
    if (isSuperAdmin) return true;
    return currentUser.effectivePermissions.includes(permission);
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!currentUser || !permissions || permissions.length === 0) return false;
    if (isSuperAdmin) return true;
    return permissions.some(p => currentUser.effectivePermissions.includes(p));
  };
  
  const value = {
    currentUser,
    hasPermission,
    hasAnyPermission,
    isSuperAdmin,
    isLoading: isLoading || status === 'loading',
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};
