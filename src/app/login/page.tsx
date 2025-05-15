
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_NAME } from '@/lib/constants';
import { LogIn, Mail } from 'lucide-react';
import { getUserByEmail } from '@/lib/dataService';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      toast({ title: "Error", description: "Email cannot be empty.", variant: "destructive" });
      return;
    }

    // Validate email format (simple check)
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    const existingUser = getUserByEmail(trimmedEmail);

    if (existingUser) {
      login(existingUser.email); // User exists, proceed with login
    } else {
      // User not found, redirect to sign-up page
      toast({ title: "Account Not Found", description: "No account found with this email. Please sign up.", variant: "default" });
      router.push(`/signup?email=${encodeURIComponent(trimmedEmail)}`); // Pass email to signup
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
          <CardDescription>Enter your email address to continue.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
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
