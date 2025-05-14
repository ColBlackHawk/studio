"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Tournament, RegisteredEntry } from "@/lib/types";
import { getTournamentById, getTournamentRegistrations } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CalendarDays, Users, Trophy, Info, Edit, BarChart3, ListChecks, Ticket, LineChart } from "lucide-react";

export default function TournamentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.tournamentId as string;

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
         <CardFooter className="border-t pt-6">
           <p className="text-sm text-muted-foreground">Manage this tournament from the admin panel.</p>
         </CardFooter>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button asChild size="lg" className="shadow-md hover:shadow-lg transition-shadow">
          <Link href={`/tournaments/${tournamentId}/register`} className="flex flex-col items-center justify-center h-24">
            <Ticket className="h-8 w-8 mb-1" />
            Team Registration
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="shadow-md hover:shadow-lg transition-shadow">
          <Link href={`/tournaments/${tournamentId}/schedule`} className="flex flex-col items-center justify-center h-24">
            <CalendarDays className="h-8 w-8 mb-1" />
            Match Schedule
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="shadow-md hover:shadow-lg transition-shadow">
          <Link href={`/tournaments/${tournamentId}/bracket`} className="flex flex-col items-center justify-center h-24">
            <LineChart className="h-8 w-8 mb-1" /> {/* Using LineChart as a proxy for Bracket icon */}
            View Bracket
          </Link>
        </Button>
      </div>
    </div>
  );
}