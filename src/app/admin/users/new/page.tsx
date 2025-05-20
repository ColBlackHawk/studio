
"use client";

import UserForm from "@/components/users/UserForm";
import type { UserCreation } from "@/lib/types";
import { createUser as createUserService, getUserByEmail } from "@/lib/dataService";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";


export default function NewUserPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUserDetails } = useAuth();

  useEffect(() => {
    if (currentUserDetails?.accountType !== 'Admin') {
      toast({ title: "Access Denied", description: "You do not have permission to perform this action.", variant: "destructive" });
      router.push("/"); 
    }
  }, [currentUserDetails, router, toast]);


  const handleSubmit = (data: UserCreation) => {
    if (getUserByEmail(data.email)) {
      toast({
        title: "User Exists",
        description: `A user with email ${data.email} already exists.`,
        variant: "destructive",
      });
      return;
    }
    
    const newUser = createUserService(data);
    if (newUser) {
        router.push("/admin/users");
    } else {
        // This case might be redundant if getUserByEmail catches all duplicates,
        // but it's a fallback for other potential creation issues from createUserService.
        toast({
            title: "Creation Failed",
            description: "Could not create the user. The email might already be in use or another error occurred.",
            variant: "destructive",
        });
    }
  };
  
  if (currentUserDetails?.accountType !== 'Admin') {
    return <p>Redirecting...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Add New User</h1>
      </div>
      <UserForm onSubmit={handleSubmit} />
    </div>
  );
}
