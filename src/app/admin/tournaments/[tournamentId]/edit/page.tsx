"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TournamentForm from "@/components/tournaments/TournamentForm";
import type { Tournament } from "@/lib/types";
import { getTournamentById, updateTournament } from "@/lib/dataService";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function EditTournamentPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tournamentId) {
      const fetchedTournament = getTournamentById(tournamentId);
      if (fetchedTournament) {
        setTournament(fetchedTournament);
      } else {
        // Handle tournament not found, e.g., redirect or show error
        router.push("/admin/tournaments");
      }
      setIsLoading(false);
    }
  }, [tournamentId, router]);

  const handleSubmit = (data: Tournament) => {
    updateTournament(tournamentId, data);
    router.push("/admin/tournaments");
  };

  if (isLoading) {
    return <p>Loading tournament data...</p>;
  }

  if (!tournament) {
    return <p>Tournament not found.</p>;
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