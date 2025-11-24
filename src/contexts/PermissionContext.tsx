
"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { CurrentUser } from '@/lib/types';
import Cookies from 'js-cookie'; // Using a library for easier cookie handling on client

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

// --- Interceptor for fetch ---
// This will automatically handle token refreshes and CSRF tokens for API calls.
const originalFetch = fetch;

const fetchWithAuth = async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
    // Add CSRF token to state-changing requests
    const method = options?.method?.toUpperCase() || 'GET';
    const newOptions = { ...options };

    if (method !== 'GET' && method !== 'HEAD') {
        const csrfToken = Cookies.get('nibrental_csrf_token');
        if (csrfToken) {
            newOptions.headers = {
                ...newOptions.headers,
                'x-csrf-token': csrfToken,
            };
        } else {
            console.warn('CSRF token not found for a state-changing request.');
        }
    }

    let response = await originalFetch(url, newOptions);

    if (response.status === 401 && !url.toString().includes('/api/auth/refresh')) {
        console.log("Access token expired, attempting to refresh...");
        const refreshResponse = await originalFetch('/api/auth/refresh', {
            method: 'POST',
        });
        
        if (refreshResponse.ok) {
            console.log("Token refreshed successfully. Retrying original request.");
            response = await originalFetch(url, newOptions); // Retry the original request
        } else {
            console.log("Refresh token failed. Logging out.");
            window.location.href = '/login?error=session_expired'; 
        }
    }

    return response;
};

if (typeof window !== 'undefined') {
    window.fetch = fetchWithAuth;
}
// --- End Interceptor ---

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
          // If fetching user fails but we thought we were authenticated, clear it
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
    // Initial check for access token to reduce initial loading time
    // If the access token exists, we are likely authenticated. The fetchUser will confirm.
    if (typeof window !== 'undefined') {
        const hasAccessToken = !!Cookies.get('nibrental_access_token');
        if(hasAccessToken) {
            setIsAuthenticated(true);
        }
    }
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
        // Use a full page navigation to ensure all state is cleared
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
