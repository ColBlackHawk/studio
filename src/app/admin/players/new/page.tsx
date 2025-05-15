
"use client";

import PlayerForm from "@/components/players/PlayerForm";
import type { PlayerCreation } from "@/lib/types";
import { createPlayer } from "@/lib/dataService";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function NewPlayerPage() {
  const router = useRouter();
  const { currentUserDetails, isLoading: authIsLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (authIsLoading) return;
    if (!currentUserDetails || !['Admin', 'Owner'].includes(currentUserDetails.accountType)) {
      toast({ title: "Access Denied", description: "You do not have permission to add players.", variant: "destructive" });
      router.push("/");
    }
  }, [currentUserDetails, authIsLoading, router, toast]);


  const handleSubmit = (data: PlayerCreation) => {
    createPlayer(data);
    router.push("/admin/players");
  };
  
  if (authIsLoading || (!currentUserDetails || !['Admin', 'Owner'].includes(currentUserDetails.accountType))) {
    return <p>Loading or checking permissions...</p>;
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/players">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Add New Player</h1>
      </div>
      <PlayerForm onSubmit={handleSubmit} />
    </div>
  );
}
