
"use client";
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { currentUserDetails, isLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && (!currentUserDetails || !['Admin', 'Owner'].includes(currentUserDetails.accountType))) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to access this area.",
        variant: "destructive",
      });
      router.push('/'); // Redirect non-admins/owners away
    }
  }, [currentUserDetails, isLoading, router, toast]);

  if (isLoading || (!currentUserDetails || !['Admin', 'Owner'].includes(currentUserDetails.accountType))) {
    // You can render a loading spinner or a simple message here
    return <p>Loading or checking permissions...</p>; 
  }

  return (
    <div className="w-full">
      {children}
    </div>
  );
}
