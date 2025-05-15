
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getItem, setItem, removeItem } from '@/lib/localStorage';
import { LOCALSTORAGE_KEYS } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/types'; // Import User type
import { getUserByEmail as fetchUserByEmail } from '@/lib/dataService'; // To get full user details

interface AuthContextType {
  currentUserEmail: string | null; // Stores the email of the logged-in user
  currentUserDetails: User | null; // Stores full details of the logged-in user
  login: (email: string) => void;
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
    const storedUserEmail = getItem<string>(LOCALSTORAGE_KEYS.CURRENT_USER);
    if (storedUserEmail) {
      const userDetails = fetchUserByEmail(storedUserEmail);
      if (userDetails) {
        setCurrentUserEmail(userDetails.email);
        setCurrentUserDetails(userDetails);
      } else {
        // Clear inconsistent stored user if details not found
        removeItem(LOCALSTORAGE_KEYS.CURRENT_USER);
      }
    }
    setIsLoading(false);
  }, []);

  const login = (email: string) => {
    if (email.trim()) {
      const userDetails = fetchUserByEmail(email.trim());
      if (userDetails) {
        setItem<string>(LOCALSTORAGE_KEYS.CURRENT_USER, userDetails.email);
        setCurrentUserEmail(userDetails.email);
        setCurrentUserDetails(userDetails);
        router.push('/'); 
      } else {
        // This case should ideally be handled by login/signup page logic
        // (i.e., user shouldn't be able to "login" if their record doesn't exist)
        console.error("Login attempt for non-existent user:", email);
        // Optionally, redirect to signup or show an error
      }
    }
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
