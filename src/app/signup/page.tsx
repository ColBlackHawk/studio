"use client";

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_NAME } from '@/lib/constants';
import { UserPlus, Mail, User as UserIcon, Smile, LockKeyhole } from 'lucide-react';
import { createUser, getUserByEmail } from '@/lib/dataService';
import { useToast } from '@/hooks/use-toast';
import type { AccountType, UserCreation } from '@/lib/types';

// Inner component that uses useSearchParams
function SignUpForm() {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams(); // useSearchParams is now here
  const { toast } = useToast();

  useEffect(() => {
    const emailFromQuery = searchParams.get('email');
    if (emailFromQuery) {
      setEmail(decodeURIComponent(emailFromQuery));
    }
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedNickname = nickname.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedEmail) {
      toast({ title: "Error", description: "Email cannot be empty.", variant: "destructive" });
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (!trimmedNickname) {
      toast({ title: "Error", description: "Name (Nickname) cannot be empty.", variant: "destructive" });
      return;
    }
    if (!password) {
      toast({ title: "Error", description: "Password cannot be empty.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
     if (password.length < 6) { // Basic password length check
      toast({ title: "Error", description: "Password must be at least 6 characters long.", variant: "destructive" });
      return;
    }

    if (getUserByEmail(trimmedEmail)) {
      toast({ title: "Account Exists", description: "An account with this email already exists. Please log in.", variant: "default" });
      router.push('/login');
      return;
    }

    // For prototype, store password in plain text - INSECURE
    const newUserPayload: UserCreation = {
      email: trimmedEmail,
      nickname: trimmedNickname,
      password: password, // INSECURE: Storing plain text
      firstName: trimmedFirstName || undefined,
      lastName: trimmedLastName || undefined,
      accountType: 'Player' as AccountType // Default to 'Player'
    };

    const newUser = createUser(newUserPayload);

    if (newUser) {
      login(newUser); // Login expects full user object now
      toast({ title: "Account Created!", description: `Welcome to ${APP_NAME}, ${newUser.nickname}!` });
    } else {
      toast({ title: "Sign Up Failed", description: "Could not create your account. Please try again.", variant: "destructive" });
    }
  };

  return (
    <Card className="w-full max-w-lg shadow-xl">
      <CardHeader className="space-y-1 text-center">
         <div className="flex justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-primary">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
              <path d="M12 22V12"></path>
              <path d="M20 12v5.5"></path>
              <path d="M4 12v5.5"></path>
          </svg>
        </div>
        <CardTitle className="text-2xl">Create Account for {APP_NAME}</CardTitle>
        <CardDescription>Enter your details to get started.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">Name (Nickname - Required)</Label>
            <div className="relative">
              <Smile className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="nickname"
                type="text"
                placeholder="Your display name or handle"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                className="pl-10 text-base"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address (Required)</Label>
             <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 text-base"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password (Required)</Label>
              <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                  id="password"
                  type="password"
                  placeholder="Choose a password (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 text-base"
                  />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password (Required)</Label>
               <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-10 text-base"
                  />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name (Optional)</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Your first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="pl-10 text-base"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name (Optional)</Label>
               <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Your last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="pl-10 text-base"
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full">
            <UserPlus className="mr-2 h-4 w-4" /> Sign Up
          </Button>
          <p className="text-xs text-destructive text-center">Reminder: Passwords are stored in plain text for this prototype and are not secure.</p>
          <div className="text-center text-sm">
            Already have an account?{' '}
            <Button variant="link" asChild className="p-0 h-auto font-semibold">
              <Link href="/login">
                 Login
              </Link>
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-150px)] py-8">
      <Suspense fallback={
        <Card className="w-full max-w-lg shadow-xl animate-pulse">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
                <div className="h-10 w-10 bg-muted rounded-full"></div>
            </div>
            <CardTitle className="text-2xl h-8 bg-muted rounded w-3/4 mx-auto"></CardTitle>
            <CardDescription className="h-4 bg-muted rounded w-1/2 mx-auto mt-1"></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 mt-6">
            {/* Nickname */}
            <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-10 bg-muted rounded"></div>
            </div>
            {/* Email */}
            <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-10 bg-muted rounded"></div>
            </div>
            {/* Passwords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
            </div>
             {/* First/Last Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-6">
            <div className="h-10 bg-primary/80 rounded w-full"></div>
            <div className="h-3 bg-muted rounded w-3/4 mx-auto mt-2"></div>
            <div className="h-4 bg-muted rounded w-1/2 mx-auto mt-2"></div>
          </CardFooter>
        </Card>
      }>
        <SignUpForm />
      </Suspense>
    </div>
  );
}
