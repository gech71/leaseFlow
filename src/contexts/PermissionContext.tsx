
"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { CurrentUser } from '@/lib/types';
import Cookies from 'js-cookie'; 

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

export const PermissionProvider: React.FC<{ children: React.ReactNode, initialUser: CurrentUser | null }> = ({ children, initialUser }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser); // Only true if no initial user
  const [isAuthenticated, setIsAuthenticated] = useState(!!initialUser);
  
  useEffect(() => {
    setCurrentUser(initialUser);
    setIsAuthenticated(!!initialUser);
    setIsLoading(false);
  }, [initialUser]);

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

  const refreshUser = useCallback(async () => {
    // This is now only used for manual refreshes if needed, not on initial load
    // The functionality is now in the server helper
  }, []);

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
    refreshUser,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};
