
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
  refreshUser: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType>({
  currentUser: null,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  isSuperAdmin: false,
  isLoading: true,
  isAuthenticated: false,
  logout: async () => {},
  refreshUser: async () => {},
});

export const usePermissions = () => useContext(PermissionContext);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/user/me');
      if (response.ok) {
        const data = await response.json();
        if (data.isSuccess && data.user) {
          setCurrentUser(data.user);
          setIsAuthenticated(true);
        } else {
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      } else {
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
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = async () => {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error("Logout request failed:", error);
    } finally {
        setCurrentUser(null);
        setIsAuthenticated(false);
        window.location.href = '/login';
    }
  };

  const isSuperAdmin = useMemo(() => {
    return currentUser?.roles?.some(role => role.name === 'SUPER_ADMIN') || false;
  }, [currentUser]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!currentUser || !permission) return false;
    if (isSuperAdmin) return true;
    return currentUser.effectivePermissions.includes(permission);
  }, [currentUser, isSuperAdmin]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (!currentUser || !permissions || permissions.length === 0) return false;
    if (isSuperAdmin) return true;
    return permissions.some(p => currentUser.effectivePermissions.includes(p));
  }, [currentUser, isSuperAdmin]);
  
  const value = {
    currentUser,
    hasPermission,
    hasAnyPermission,
    isSuperAdmin,
    isLoading,
    isAuthenticated,
    logout,
    refreshUser: fetchUser,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};
