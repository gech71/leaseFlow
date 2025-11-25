

"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { CurrentUser } from '@/lib/types';
import Cookies from 'js-cookie'; 
import { getUserSessionAction } from '@/lib/actions/server-helpers';
import { useToast } from '@/hooks/use-toast';

interface PermissionContextType {
  currentUser: CurrentUser | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: (sessionExpired?: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
  handleApiCall: <T>(apiCall: () => Promise<T>) => Promise<T | undefined>;
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
  handleApiCall: async (apiCall) => apiCall(),
});

export const usePermissions = () => useContext(PermissionContext);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();
  
  const logout = useCallback(async (sessionExpired = false) => {
    try {
        const csrfToken = Cookies.get('nibrental_csrf_token');
        await fetch('/api/auth/logout', { 
            method: 'POST',
             headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken || '',
            }
        });
    } catch (error) {
        console.error("Logout request failed:", error);
    } finally {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setIsLoading(false); // Stop loading on logout
        const loginUrl = new URL('/login', window.location.origin);
        if (sessionExpired) {
          loginUrl.searchParams.set('error', 'session_expired');
          if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
            loginUrl.searchParams.set('from', window.location.pathname);
          }
        }
        window.location.href = loginUrl.toString();
    }
  }, []);

  const handleApiCall = useCallback(async <T>(apiCall: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await apiCall();
    } catch (error: any) {
      if (error.message?.includes("Authentication required") || error.message?.includes("Session expired")) {
        await logout(true);
        return undefined;
      }
      // Re-throw other errors to be handled by the component
      throw error;
    }
  }, [logout]);


  const refreshUser = useCallback(async () => {
    // No need to set loading to true here, as it's for background refreshes or initial load.
    // The initial `isLoading` state is true by default.
    try {
      const { isSuccess, user } = await getUserSessionAction();
      if (isSuccess && user) {
        setCurrentUser(user);
        setIsAuthenticated(true);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Error refreshing user session:", error);
      setCurrentUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

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
    handleApiCall,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};
