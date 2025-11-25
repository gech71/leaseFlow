

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
  callServerAction: <T extends (...args: any[]) => Promise<any>>(
    actionName: string,
    ...args: Parameters<T>
  ) => Promise<Awaited<ReturnType<T>> | { success: false; error: string; }>;
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
  callServerAction: async () => ({ success: false, error: 'Context not ready' }),
});

export const usePermissions = () => useContext(PermissionContext);

export const PermissionProvider: React.FC<{ children: React.ReactNode, initialUser: CurrentUser | null }> = ({ children, initialUser }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);
  const [isAuthenticated, setIsAuthenticated] = useState(!!initialUser);
  
  useEffect(() => {
    setCurrentUser(initialUser);
    setIsAuthenticated(!!initialUser);
    setIsLoading(false);
  }, [initialUser]);

  const logout = async () => {
    try {
        const csrfToken = Cookies.get('nibrental_csrf_token');
        await fetch('/api/auth/logout', { 
            method: 'POST',
            headers: {
                'x-csrf-token': csrfToken || '',
            }
        });
    } catch (error) {
        console.error("Logout request failed:", error);
    } finally {
        setCurrentUser(null);
        setIsAuthenticated(false);
        window.location.href = '/login';
    }
  };
  
  const refreshUser = useCallback(async () => {
    // This function is likely no longer needed as data is fetched on the server.
    // Kept for potential manual refresh scenarios.
  }, []);

  const callServerAction = useCallback(async <T extends (...args: any[]) => Promise<any>>(
    actionName: string,
    ...args: Parameters<T>
  ): Promise<Awaited<ReturnType<T>> | { success: false; error: string; }> => {
    const csrfToken = Cookies.get('nibrental_csrf_token');
    
    try {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '',
        },
        body: JSON.stringify({ action: actionName, args: args }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'An unexpected server error occurred.' }));
        throw new Error(result.error || 'An unexpected server error occurred.');
      }
      
      return await response.json();

    } catch (error: any) {
      console.error(`Client-side error calling server action '${actionName}':`, error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred while communicating with the server.',
      };
    }
  }, []);


  const effectivePermissions = useMemo(() => {
    if (!currentUser) return new Set<string>();
    return new Set(currentUser.effectivePermissions);
  }, [currentUser]);

  const isSuperAdmin = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.roles.some(role => role.name === 'SUPER_ADMIN');
  }, [currentUser]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!currentUser) return false;
    if (isSuperAdmin) return true;
    return effectivePermissions.has(permission);
  }, [currentUser, isSuperAdmin, effectivePermissions]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (!currentUser) return false;
    if (isSuperAdmin) return true;
    return permissions.some(p => effectivePermissions.has(p));
  }, [currentUser, isSuperAdmin, effectivePermissions]);

  const value = {
    currentUser,
    hasPermission,
    hasAnyPermission,
    isSuperAdmin,
    isLoading,
    isAuthenticated,
    logout,
    refreshUser,
    callServerAction,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};
