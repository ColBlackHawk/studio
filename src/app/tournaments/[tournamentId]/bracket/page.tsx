
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Tournament, RegisteredEntry, Match } from "@/lib/types";
import { getTournamentById, getTournamentRegistrations, updateTournament } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GitFork, Info, Users, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BracketDisplay from "@/components/tournaments/BracketDisplay";
import { advanceWinner, clearSubsequentMatches } from "@/lib/bracketUtils";

export default function TournamentBracketPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<RegisteredEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTournamentData = useCallback(() => {
    if (tournamentId) {
      setIsLoading(true);
      const fetchedTournament = getTournamentById(tournamentId);
      if (fetchedTournament) {
        setTournament(fetchedTournament);
        setRegistrations(getTournamentRegistrations(tournamentId));
      } else {
        toast({ title: "Error", description: "Tournament not found.", variant: "destructive" });
        router.push("/");
      }
      setIsLoading(false);
    }
  }, [tournamentId, router, toast]);

  useEffect(() => {
    fetchTournamentData();
  }, [fetchTournamentData]);

  const handleWinnerSelected = (matchId: string, winnerId: string | undefined, score?: string) => {
    if (!tournament || !tournament.matches) return;

    let currentMatch = tournament.matches.find(m => m.id === matchId);
    if (!currentMatch) return;

    // Create a deep copy of the match to update
    let updatedMatch = { ...currentMatch, winnerId, score };
    let newMatches: Match[];

    if (!winnerId) { // Winner is being cleared
        updatedMatch.score = undefined; // Clear score too
        newMatches = clearSubsequentMatches(tournament.matches, updatedMatch);
    } else {
        // If it was a bye, and we are now setting a winner (should not happen if byes are auto-won),
        // or if it's not a bye, then advance.
        if(currentMatch.team1Id && currentMatch.team2Id && !currentMatch.isBye) {
             updatedMatch.isBye = false; // Ensure isBye is false if two teams played
        }
        newMatches = advanceWinner(tournament.matches, updatedMatch, registrations);
    }
    
    const updatedTournamentData: Partial<Tournament> = { matches: newMatches };
    const updated = updateTournament(tournament.id, updatedTournamentData);

    if (updated) {
      setTournament(updated); // Update local state
      toast({
        title: winnerId ? "Winner Updated" : "Match Reset",
        description: `Match progress saved for ${tournament.name}.`,
      });
    } else {
      toast({ title: "Error", description: "Failed to update bracket.", variant: "destructive" });
      fetchTournamentData(); // Re-fetch to reset to last known good state
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <p className="text-xl text-muted-foreground">Loading bracket...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="space-y-6 text-center">
        <Button variant="outline" size="icon" asChild className="absolute top-20 left-6">
          <Link href="/"> <ArrowLeft className="h-4 w-4" /> </Link>
        </Button>
        <Trophy className="mx-auto h-16 w-16 text-destructive" />
        <h1 className="text-3xl font-bold tracking-tight">Tournament Not Found</h1>
        <Button asChild> <Link href="/">Return to Dashboard</Link> </Button>
      </div>
    );
  }

  if (!tournament.matches || tournament.matches.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/tournaments/${tournamentId}`}> <ArrowLeft className="h-4 w-4" /> </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
            <GitFork className="mr-3 h-8 w-8 text-accent" /> {tournament.name} - Bracket
          </h1>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Bracket Not Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The bracket for this tournament has not been generated yet.</p>
            <Button asChild className="mt-4">
              <Link href={`/tournaments/${tournamentId}`}>Return to Tournament Details</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/tournaments/${tournamentId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
            <GitFork className="mr-3 h-8 w-8 text-accent" /> {tournament.name} - Bracket
          </h1>
        </div>
         <p className="text-sm text-muted-foreground hidden md:block">
            Click on a participant in a match to mark them as the winner. Click again to clear.
        </p>
      </div>
       <p className="text-sm text-muted-foreground md:hidden text-center">
            Tap on a participant to mark as winner. Tap again to clear.
      </p>

      <BracketDisplay
        matches={tournament.matches}
        registrations={registrations}
        onWinnerSelected={handleWinnerSelected}
      />
       <div className="mt-8 text-center text-sm text-muted-foreground">
         <p>This is a single elimination bracket. Double elimination support is planned.</p>
      </div>
    </div>
  );
}
