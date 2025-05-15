
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import UserForm from "@/components/users/UserForm";
import type { User } from "@/lib/types";
import { getUserByEmail, updateUser as updateUserService } from "@/lib/dataService";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userEmail = decodeURIComponent(params.userEmail as string); // Decode email from URL
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentUserDetails } = useAuth();

  useEffect(() => {
     if (currentUserDetails?.accountType !== 'Admin') {
      toast({ title: "Access Denied", description: "You do not have permission to perform this action.", variant: "destructive" });
      router.push("/");
      return;
    }
    if (userEmail) {
      const fetchedUser = getUserByEmail(userEmail);
      if (fetchedUser) {
        setUser(fetchedUser);
      } else {
        toast({ title: "User not found", description: `User with email ${userEmail} not found.`, variant: "destructive" });
        router.push("/admin/users");
      }
      setIsLoading(false);
    }
  }, [userEmail, router, toast, currentUserDetails]);

  const handleSubmit = (data: User) => {
    // Prevent editing email if it's the admin's own email and they are trying to change it to non-admin
    if (currentUserDetails?.email === userEmail && data.accountType !== 'Admin' && userEmail === 'admin@tournamentbracket.com') {
        toast({
            title: "Action Not Allowed",
            description: "The primary admin account ('admin@tournamentbracket.com') type cannot be changed from 'Admin'.",
            variant: "destructive",
        });
        // Reset form field to 'Admin' or simply don't submit the change for accountType
        // For simplicity, we'll just prevent the update here. A more robust form would reset the field.
        return; 
    }

    updateUserService(userEmail, data); // Email is the identifier and shouldn't change
    router.push("/admin/users");
  };
  
  if (currentUserDetails?.accountType !== 'Admin') {
    return <p>Redirecting...</p>;
  }

  if (isLoading) {
    return <p>Loading user data...</p>;
  }

  if (!user) {
    return <p>User not found.</p>;
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
         <Button variant="outline" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Edit User: {user.nickname}</h1>
      </div>
      <UserForm user={user} onSubmit={handleSubmit} isEditing />
    </div>
  );
}
