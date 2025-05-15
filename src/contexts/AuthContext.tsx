
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
  login: (user: User) => void; // Login now takes the full user object
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserDetails, setCurrentUserDetails] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
        removeItem(LOCALSTORAGE_KEYS.CURRENT_USER); // Clear inconsistent stored user
      }
    }
    setIsLoading(false);
  }, []);

  const login = (user: User) => { // Expects full user object
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
    removeItem(LOCALSTORAGE_KEYS.CURRENT_USER);
    setCurrentUserEmail(null);
    setCurrentUserDetails(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ currentUserEmail, currentUserDetails, login, logout, isLoading }}>
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
