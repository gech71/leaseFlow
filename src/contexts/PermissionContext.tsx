
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

    try {
      const response = await fetch('/api/user/me');
      if (response.ok) {
        const data = await response.json();
        if (data.isSuccess && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
          const errorMessage = data.errors?.join(', ') || 'User data not found.';
          setError(errorMessage);
        }
      } else {
        let errorText = `Authentication failed. Status: ${response.status}`;
        try {
            const errorData = await response.json();
            errorText = errorData.errors?.join(', ') || errorText;
        } catch (e) {
        }
        setCurrentUser(null);
        setError(errorText);
      }
    } catch (error) {
      const errorMessage = (error as Error).message || 'A network error occurred while fetching user data.';
      setCurrentUser(null);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [status]);
  
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const hasPermission = useCallback((permission: PermissionId | PermissionId[]): boolean => {
    if (!currentUser || !currentUser.effectivePermissions) return false;
    if (isSuperAdmin) return true;
    if (Array.isArray(permission)) {
      return permission.every(p => currentUser.effectivePermissions.includes(p));
    }
    return currentUser.effectivePermissions.includes(permission);
  }, [currentUser]);

  const hasAnyPermission = useCallback((permissions: PermissionId[]): boolean => {
    if (!currentUser || !currentUser.effectivePermissions) return false;
    if (isSuperAdmin) return true;
    return permissions.some(p => currentUser.effectivePermissions.includes(p));
  }, [currentUser]);
  
  const isSuperAdmin = useMemo(() => {
    return currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') || false;
  }, [currentUser]);

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
