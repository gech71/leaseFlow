

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
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
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
  fetchWithAuth: async () => new Response(null, { status: 401 }),
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
  }, []);

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    // Attach CSRF token
    const csrfToken = Cookies.get('nibrental_csrf_token');
    const headers = new Headers(options.headers);
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken);
    }
    options.headers = headers;

    let response = await fetch(url, options);

    if (response.status === 401) {
      console.log('Access token expired, attempting to refresh...');
      const refreshResponse = await fetch('/api/auth/refresh', { method: 'POST' });
      
      if (refreshResponse.ok) {
        console.log('Session refreshed successfully. Retrying original request.');
        // The refresh endpoint sets a new cookie, so we can just retry the original request.
        response = await fetch(url, options);
      } else {
        console.log('Session refresh failed. Logging out.');
        await logout();
      }
    }

    return response;
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
    fetchWithAuth,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};
