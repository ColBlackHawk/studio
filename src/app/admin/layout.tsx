
"use client";
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { currentUserDetails, isLoading, isLoggingOut } = useAuth(); // Added isLoggingOut
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (isLoggingOut) { // If logging out, don't run access denied logic
      return;
    }

    if (!isLoading && (!currentUserDetails || !['Admin', 'Owner'].includes(currentUserDetails.accountType))) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to access this area.",
        variant: "destructive",
      });
      router.push('/'); 
    }
  }, [currentUserDetails, isLoading, router, toast, isLoggingOut]); // Added isLoggingOut to dependencies

  if (isLoading || isLoggingOut || (!currentUserDetails || !['Admin', 'Owner'].includes(currentUserDetails.accountType))) {
    return <p>Loading or checking permissions...</p>; 
  }

  return (
    <div className="w-full">
      {children}
    </div>
  );
}
