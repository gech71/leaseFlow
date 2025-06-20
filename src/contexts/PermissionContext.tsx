
"use client";

import type { CurrentUser, PermissionId } from '@/lib/types';
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface PermissionContextType {
  currentUser: CurrentUser | null;
  isLoading: boolean;
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

  const fetchCurrentUser = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/me');
      if (response.ok) {
        const data = await response.json();
        if (data.isSuccess && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null); // Or handle error state
          console.error("Failed to fetch user or user data missing:", data.errors || "No user data");
        }
      } else {
        setCurrentUser(null);
        console.error("Failed to fetch user, status:", response.status);
         // If 401/403, redirect to login? This can be handled by middleware too.
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const hasPermission = (permission: PermissionId | PermissionId[]): boolean => {
    if (!currentUser || !currentUser.effectivePermissions) return false;
    if (Array.isArray(permission)) {
      return permission.every(p => currentUser.effectivePermissions.includes(p));
    }
    return currentUser.effectivePermissions.includes(permission);
  };

  const hasAnyPermission = (permissions: PermissionId[]): boolean => {
    if (!currentUser || !currentUser.effectivePermissions) return false;
    return permissions.some(p => currentUser.effectivePermissions.includes(p));
  };
  
  const isSuperAdmin = useMemo(() => {
    return currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') || false;
  }, [currentUser]);


  // Display a loading spinner while fetching user data
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen w-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PermissionContext.Provider value={{ currentUser, isLoading, hasPermission, hasAnyPermission, isSuperAdmin, refetchUser: fetchCurrentUser }}>
      {children}
    </PermissionContext.Provider>
  );
};
