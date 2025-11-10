
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CurrentUser } from '@/lib/types';
import { useSession } from 'next-auth/react';
import { databaseService } from '@/lib/services/databaseService'; // Can't be used on client
import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();

  useEffect(() => {
    const fetchUserPermissions = async () => {
      // Don't fetch on public or auth pages
      if (pathname === '/login' || pathname.startsWith('/portal/connect')) {
          setIsLoading(false);
          return;
      }
      
      if (status === 'authenticated') {
        try {
          const response = await fetch('/api/user/me');
          if (response.ok) {
            const data = await response.json();
            if (data.isSuccess) {
              setCurrentUser(data.user);
            } else {
              console.error("Failed to fetch user permissions:", data.errors);
              setCurrentUser(null);
            }
          } else {
            console.error("API error fetching user permissions:", response.statusText);
            setCurrentUser(null);
          }
        } catch (error) {
          console.error("Network error fetching user permissions:", error);
          setCurrentUser(null);
        }
      }
      setIsLoading(false);
    };

    if (status !== 'loading') {
      fetchUserPermissions();
    }
  }, [session, status, pathname]);

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
