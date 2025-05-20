
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getItem, setItem, removeItem } from '@/lib/localStorage';
import { LOCALSTORAGE_KEYS } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/types';
import { getUserByEmail as fetchUserByEmail } from '@/lib/dataService';

interface AuthContextType {
  currentUserEmail: string | null;
  currentUserDetails: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
  isLoggingOut: boolean; // New state
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserDetails, setCurrentUserDetails] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false); // New state
  const router = useRouter();

  useEffect(() => {
    setIsLoading(true);
    const storedUserEmail = getItem<string>(LOCALSTORAGE_KEYS.CURRENT_USER);
    if (storedUserEmail) {
      const userDetails = fetchUserByEmail(storedUserEmail);
      if (userDetails) {
        setCurrentUserEmail(userDetails.email);
        setCurrentUserDetails(userDetails);
      } else {
        removeItem(LOCALSTORAGE_KEYS.CURRENT_USER); 
      }
    }
    setIsLoading(false);
  }, []);

  const login = (user: User) => {
    setIsLoading(true);
    if (user && user.email) {
        setItem<string>(LOCALSTORAGE_KEYS.CURRENT_USER, user.email);
        setCurrentUserEmail(user.email);
        setCurrentUserDetails(user);
        router.push('/');
    } else {
        console.error("Login attempt with invalid user object:", user);
    }
    setIsLoading(false);
  };

  const logout = () => {
    setIsLoggingOut(true); // Indicate logout process has started
    removeItem(LOCALSTORAGE_KEYS.CURRENT_USER);
    setCurrentUserEmail(null);
    setCurrentUserDetails(null);
    router.push('/login');
    // No need to setIsLoggingOut(false) here immediately, 
    // as the component tree will unmount/remount or the user will be on a public page.
    // If further actions were needed post-redirect, a .finally() on router.push might be used.
    // For this simple redirect, this is fine. The context will re-init on next load if needed.
  };

  return (
    <AuthContext.Provider value={{ currentUserEmail, currentUserDetails, login, logout, isLoading, isLoggingOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
