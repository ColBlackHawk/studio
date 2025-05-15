
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Added for redirection
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_NAME } from '@/lib/constants';
import { LogIn } from 'lucide-react';
import { getTournaments, getPlayers } from '@/lib/dataService'; // Added imports

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const { login } = useAuth();
  const router = useRouter(); // Initialize router

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      alert("Username cannot be empty.");
      return;
    }

    // Check if user exists
    const tournaments = getTournaments();
    const players = getPlayers();

    const userExistsAsOwner = tournaments.some(t => t.ownerId === trimmedUsername);
    const userExistsAsPlayer = players.some(p => p.nickname === trimmedUsername);

    if (userExistsAsOwner || userExistsAsPlayer) {
      login(trimmedUsername); // User exists, proceed with login
    } else {
      // User not found, redirect to sign-up page
      router.push('/signup');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
      <Card className="w-full max-w-sm shadow-xl">
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
          <CardTitle className="text-2xl">Login to {APP_NAME}</CardTitle>
          <CardDescription>Enter your username to continue.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="e.g., TournamentMaster"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="text-base"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full">
              <LogIn className="mr-2 h-4 w-4" /> Login
            </Button>
            <div className="text-center text-sm">
              Don't have an account?{' '}
              <Button variant="link" asChild className="p-0 h-auto font-semibold">
                <Link href="/signup">
                  Sign Up
                </Link>
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
