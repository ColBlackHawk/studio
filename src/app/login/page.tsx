
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
import { LogIn, Mail, LockKeyhole, ListChecks, Users, Trophy, GitFork } from 'lucide-react';
import { getUserByEmail } from '@/lib/dataService';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    if (!password) {
      toast({ title: "Error", description: "Password cannot be empty.", variant: "destructive" });
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    const existingUser = getUserByEmail(trimmedEmail);

    if (existingUser) {
      // INSECURE: Plain text password check for prototype
      if (existingUser.password === password) {
        login(existingUser); // Pass full user object
        // router.push('/'); // AuthContext handles redirection
      } else {
        toast({ title: "Login Failed", description: "Incorrect password.", variant: "destructive" });
      }
    } else {
      toast({ title: "Account Not Found", description: "No account found with this email. Please sign up.", variant: "default" });
      router.push(`/signup?email=${encodeURIComponent(trimmedEmail)}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] py-8 px-4">
      <Card className="w-full max-w-xl shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 text-primary">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
                <path d="M12 22V12"></path>
                <path d="M20 12v5.5"></path>
                <path d="M4 12v5.5"></path>
            </svg>
          </div>
          <CardTitle className="text-3xl font-bold">Welcome to {APP_NAME}!</CardTitle>
          <CardDescription className="text-muted-foreground pt-2 text-base">
            Your ultimate solution for creating, managing, and participating in tournaments.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6 px-6 pb-6">
          <div className="text-left space-y-3 text-sm text-foreground/90 p-4 border bg-muted/30 rounded-lg">
            <h3 className="text-lg font-semibold text-primary mb-2">App Features:</h3>
            <ul className="list-disc list-inside space-y-1.5">
              <li className="flex items-start">
                <Trophy className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-accent" />
                <span>Effortlessly create and manage Single & Double Elimination tournaments.</span>
              </li>
              <li className="flex items-start">
                <Users className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-accent" />
                <span>Manage a global list of players and register them for events.</span>
              </li>
              <li className="flex items-start">
                <GitFork className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-accent" />
                <span>Generate interactive brackets with easy winner selection and score tracking.</span>
              </li>
              <li className="flex items-start">
                <ListChecks className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-accent" />
                <span>View comprehensive match schedules and tournament progress.</span>
              </li>
              <li className="flex items-start">
                <Users className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-accent" />
                <span>Support for different participant types: Player, Scotch Doubles, and Teams.</span>
              </li>
              <li className="flex items-start">
                <LockKeyhole className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-accent" />
                <span>User accounts with roles (Admin, Owner, Player) for controlled access.</span>
              </li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-xl font-semibold text-center text-primary pt-2">Login to Your Account</h3>
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
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 text-base"
                />
              </div>
            </div>
            <Button type="submit" className="w-full !mt-6">
              <LogIn className="mr-2 h-4 w-4" /> Login
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-0 pb-6">
          <p className="text-xs text-destructive text-center">Reminder: Passwords are stored in plain text for this prototype and are not secure.</p>
          <div className="text-center text-sm">
            Don&apos;t have an account?{' '}
            <Button variant="link" asChild className="p-0 h-auto font-semibold">
              <Link href="/signup">
                Sign Up
              </Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
