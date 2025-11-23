
"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { CurrentUser } from '@/lib/types';
import { usePathname, useRouter } from 'next/navigation';

interface PermissionContextType {
  currentUser: CurrentUser | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType>({
  currentUser: null,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  isSuperAdmin: false,
  isLoading: true,
  isAuthenticated: false,
  logout: async () => {},
});

export const usePermissions = () => useContext(PermissionContext);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const fetchUserPermissions = useCallback(async () => {
    // Don't fetch on public pages where no session is expected.
    const isPublicRoute = ['/login'].includes(pathname) || pathname.startsWith('/portal/connect');
    if (isPublicRoute) {
      setIsLoading(false);
      setIsAuthenticated(false);
      setCurrentUser(null);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/me');
      if (response.ok) {
        const data = await response.json();
        if (data.isSuccess && data.user) {
          setCurrentUser(data.user);
          setIsAuthenticated(true);
        } else {
          console.error("Failed to fetch user permissions:", data.errors);
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      } else {
        // Any non-200 response (e.g., 401 Unauthorized) means not authenticated
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Network error fetching user permissions:", error);
      setCurrentUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  const logout = async () => {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error("Logout request failed:", error);
    } finally {
        setCurrentUser(null);
        setIsAuthenticated(false);
        router.push('/login');
    }
  };

  const isSuperAdmin = useMemo(() => {
    return currentUser?.roles?.some(role => role.name === 'SUPER_ADMIN') || false;
  }, [currentUser]);

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
    isLoading,
    isAuthenticated,
    logout,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};
