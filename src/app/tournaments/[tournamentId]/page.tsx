
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Tournament, RegisteredEntry, Match } from "@/lib/types";
import { getTournamentById, getTournamentRegistrations, updateTournament } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CalendarDays, Users, Trophy, Info, Edit, ListChecks, Ticket, LineChart, RefreshCw, GitFork } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateSingleEliminationBracket } from "@/lib/bracketUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function TournamentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<RegisteredEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tournamentId) {
      const fetchedTournament = getTournamentById(tournamentId);
      if (fetchedTournament) {
        setTournament(fetchedTournament);
        setRegistrations(getTournamentRegistrations(tournamentId));
      } else {
        // router.push("/"); // Redirect if tournament not found
      }
      setIsLoading(false);
    }
  }, [tournamentId, router]);

  const handleGenerateBracket = () => {
    if (!tournament || registrations.length < 2) {
      toast({
        title: "Cannot Generate Bracket",
        description: registrations.length < 2 ? "At least 2 entries must be registered." : "Tournament not found.",
        variant: "destructive",
      });
      return;
    }

    // For simplicity, we always generate a single elimination bracket.
    // Future enhancement: choose bracket type based on tournament.tournamentType
    const newMatches = generateSingleEliminationBracket(tournament.id, registrations, tournament.maxTeams);
    const updatedTournamentData: Partial<Tournament> = { matches: newMatches };
    
    const updated = updateTournament(tournament.id, updatedTournamentData);
    if (updated) {
      setTournament(updated); // Update local state to reflect new matches
      toast({
        title: "Bracket Generated",
        description: `A new single elimination bracket has been generated for ${tournament.name}.`,
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to generate or save the bracket.",
        variant: "destructive",
      });
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <p className="text-xl text-muted-foreground">Loading tournament details...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="space-y-6 text-center">
         <Button variant="outline" size="icon" asChild className="absolute top-20 left-6">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Trophy className="mx-auto h-16 w-16 text-destructive" />
        <h1 className="text-3xl font-bold tracking-tight">Tournament Not Found</h1>
        <p className="text-muted-foreground">The tournament you are looking for does not exist or may have been removed.</p>
        <Button asChild>
          <Link href="/">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }
  
  const canGenerateBracket = registrations.length >= 2;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
          <Trophy className="mr-3 h-8 w-8 text-accent" /> {tournament.name}
        </h1>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Tournament Information</CardTitle>
          <CardDescription className="flex items-center gap-2 pt-1">
            <Info className="h-4 w-4" />
            {tournament.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center">
              <Users className="h-5 w-5 text-muted-foreground mr-2" />
              <span className="font-medium">Type:</span>&nbsp;
              <span className="capitalize">{tournament.tournamentType.replace("_", " ")} ({tournament.participantType})</span>
            </div>
            <div className="flex items-center">
              <CalendarDays className="h-5 w-5 text-muted-foreground mr-2" />
              <span className="font-medium">Date:</span>&nbsp;
              {new Date(tournament.scheduleDateTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div className="space-y-3">
             <div className="flex items-center">
              <Users className="h-5 w-5 text-muted-foreground mr-2" />
              <span className="font-medium">Owner:</span>&nbsp;
              {tournament.owner}
            </div>
            <div className="flex items-center">
              <ListChecks className="h-5 w-5 text-muted-foreground mr-2" />
              <span className="font-medium">Registered / Max:</span>&nbsp;
              {registrations.length} / {tournament.maxTeams}
            </div>
          </div>
        </CardContent>
         <CardFooter className="border-t pt-6 flex flex-col sm:flex-row justify-between items-center gap-2">
           <p className="text-sm text-muted-foreground">Manage this tournament from the admin panel.</p>
           {canGenerateBracket ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="shadow-md hover:shadow-lg transition-shadow">
                  <RefreshCw className="mr-2 h-4 w-4" /> Generate / Reset Bracket
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Bracket Generation</AlertDialogTitle>
                  <AlertDialogDescription>
                    {tournament.matches && tournament.matches.length > 0
                      ? "This will clear any existing bracket and generate a new one. All current match progress will be lost. Are you sure?"
                      : "This will generate a new bracket for the registered entries. Continue?"}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGenerateBracket}>
                    {tournament.matches && tournament.matches.length > 0 ? "Reset and Generate" : "Generate Bracket"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
           ) : (
             <Button variant="outline" disabled title="Need at least 2 registered entries to generate a bracket.">
                <RefreshCw className="mr-2 h-4 w-4" /> Generate Bracket
             </Button>
           )}
         </CardFooter>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button asChild size="lg" className="shadow-md hover:shadow-lg transition-shadow">
          <Link href={`/tournaments/${tournamentId}/register`} className="flex flex-col items-center justify-center h-24">
            <Ticket className="h-8 w-8 mb-1" />
            Team Registration
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="shadow-md hover:shadow-lg transition-shadow" disabled={!tournament.matches || tournament.matches.length === 0}>
          <Link href={`/tournaments/${tournamentId}/schedule`} className="flex flex-col items-center justify-center h-24">
            <CalendarDays className="h-8 w-8 mb-1" />
            Match Schedule
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="shadow-md hover:shadow-lg transition-shadow" disabled={!tournament.matches || tournament.matches.length === 0} title={(!tournament.matches || tournament.matches.length === 0) ? "Generate bracket first" : "View Bracket"}>
          <Link href={`/tournaments/${tournamentId}/bracket`} className="flex flex-col items-center justify-center h-24">
            <GitFork className="h-8 w-8 mb-1" /> {/* Changed from LineChart */}
            View Bracket
          </Link>
        </Button>
      </div>
    </div>
  );
}
