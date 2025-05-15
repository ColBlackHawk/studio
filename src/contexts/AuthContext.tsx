
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getItem, setItem, removeItem } from '@/lib/localStorage';
import { LOCALSTORAGE_KEYS } from '@/lib/constants';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  currentUser: string | null;
  login: (username: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check localStorage for existing user on initial load
    const storedUser = getItem<string>(LOCALSTORAGE_KEYS.CURRENT_USER);
    if (storedUser) {
      setCurrentUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = (username: string) => {
    if (username.trim()) {
      setItem<string>(LOCALSTORAGE_KEYS.CURRENT_USER, username.trim());
      setCurrentUser(username.trim());
      router.push('/'); // Redirect to dashboard after login
    }
  };

  const logout = () => {
    removeItem(LOCALSTORAGE_KEYS.CURRENT_USER);
    setCurrentUser(null);
    router.push('/login'); // Redirect to login after logout
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isLoading }}>
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
