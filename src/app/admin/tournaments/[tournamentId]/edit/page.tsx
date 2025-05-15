
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TournamentForm from "@/components/tournaments/TournamentForm";
import type { Tournament } from "@/lib/types";
import { getTournamentById, updateTournament } from "@/lib/dataService";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function EditTournamentPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { currentUserDetails, isLoading: authIsLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (authIsLoading) return;

    if (!currentUserDetails || !['Admin', 'Owner'].includes(currentUserDetails.accountType)) {
      toast({ title: "Access Denied", description: "You don't have permission to edit tournaments.", variant: "destructive" });
      router.push("/");
      return;
    }

    if (tournamentId) {
      const fetchedTournament = getTournamentById(tournamentId);
      if (fetchedTournament) {
        if (currentUserDetails.accountType === 'Owner' && fetchedTournament.ownerId !== currentUserDetails.email) {
          toast({ title: "Access Denied", description: "You can only edit tournaments you own.", variant: "destructive" });
          router.push("/admin/tournaments");
          return;
        }
        setTournament(fetchedTournament);
      } else {
        toast({ title: "Not Found", description: "Tournament not found.", variant: "destructive" });
        router.push("/admin/tournaments");
      }
      setIsLoading(false);
    }
  }, [tournamentId, router, currentUserDetails, authIsLoading, toast]);

  const handleSubmit = (data: Tournament) => {
    // OwnerId should not change on edit, ensure it's correctly passed if needed by update fn
    // For this app, ownerId is set on creation and is part of the tournament object
    updateTournament(tournamentId, data);
    router.push("/admin/tournaments");
  };

  if (isLoading || authIsLoading) {
    return <p>Loading tournament data...</p>;
  }
  
  if (!currentUserDetails || !['Admin', 'Owner'].includes(currentUserDetails.accountType)) {
      return <p>Redirecting...</p>;
  }

  if (!tournament) {
    return <p>Tournament not found or access denied.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
         <Button variant="outline" size="icon" asChild>
          <Link href="/admin/tournaments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Edit Tournament: {tournament.name}</h1>
      </div>
      <TournamentForm tournament={tournament} onSubmit={handleSubmit} isEditing />
    </div>
  );
}
