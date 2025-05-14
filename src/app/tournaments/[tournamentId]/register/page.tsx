
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation"; // Fixed import
import Link from "next/link";
import type { Tournament, RegisteredEntry, Player, TeamRegistrationPayload } from "@/lib/types";
import { getTournamentById, getTournamentRegistrations, addTournamentRegistration, removeTournamentRegistration as removeRegistrationService, getPlayers } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Ticket, Users, Info } from "lucide-react";
import RegistrationForm from "@/components/teams/RegistrationForm";
import RegisteredTeamsList from "@/components/teams/RegisteredTeamsList";
import { useToast } from "@/hooks/use-toast";

export default function RegisterForTournamentPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<RegisteredEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  const fetchTournamentData = useCallback(() => {
    if (tournamentId) {
      const fetchedTournament = getTournamentById(tournamentId);
      if (fetchedTournament) {
        setTournament(fetchedTournament);
        setRegistrations(getTournamentRegistrations(tournamentId));
      } else {
        // router.push("/"); // Optionally redirect if tournament not found
        toast({
          title: "Error",
          description: "Tournament not found.",
          variant: "destructive",
        });
      }
      setAllPlayers(getPlayers()); // Fetch all players for the search input
      setIsLoading(false);
    }
  }, [tournamentId, router, toast]);

  useEffect(() => {
    fetchTournamentData();
  }, [fetchTournamentData]);

  const handleRegisterTeam = (payload: TeamRegistrationPayload) => {
    if (!tournament) return;

    const { entryName, playerIds } = payload;
    const selectedPlayers = allPlayers.filter(p => playerIds.includes(p.id));

    if (selectedPlayers.length !== playerIds.length) {
        toast({ title: "Error", description: "One or more selected players not found.", variant: "destructive" });
        return;
    }
    
    try {
      addTournamentRegistration(tournament.id, entryName, selectedPlayers);
      fetchTournamentData(); // Refresh registrations list
      // Toast is handled within RegistrationForm component
    } catch (error: any) {
       toast({
        title: "Registration Failed",
        description: error.message || "Could not register for the tournament.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveRegistration = (registrationId: string) => {
    if (!tournament) return;
    const registrationToRemove = registrations.find(r => r.id === registrationId);
    if (removeRegistrationService(tournament.id, registrationId)) {
      fetchTournamentData(); // Refresh list
      toast({
        title: "Registration Removed",
        description: `"${registrationToRemove?.entryName || 'Entry'}" has been removed.`,
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to remove registration.",
        variant: "destructive",
      });
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <p className="text-xl text-muted-foreground">Loading registration page...</p>
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
        <Info className="mx-auto h-16 w-16 text-destructive" />
        <h1 className="text-3xl font-bold tracking-tight">Tournament Not Found</h1>
        <p className="text-muted-foreground">Cannot register for a tournament that does not exist.</p>
        <Button asChild>
          <Link href="/">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/tournaments/${tournamentId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
          <Ticket className="mr-3 h-8 w-8 text-accent" /> Register for {tournament.name}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <Card className="md:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle>Registration Details</CardTitle>
            <CardDescription>
              Register your {tournament.participantType} for the tournament. 
              Max entries: {tournament.maxTeams}. Currently registered: {registrations.length}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationForm 
              tournament={tournament} 
              onRegister={handleRegisterTeam}
              currentRegistrationsCount={registrations.length}
            />
          </CardContent>
        </Card>
        
        <Card className="md:col-span-1 shadow-md">
          <CardHeader>
            <CardTitle>Tournament Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong className="text-primary">Type:</strong> {tournament.tournamentType.replace("_", " ")} ({tournament.participantType})</p>
            <p><strong className="text-primary">Date:</strong> {new Date(tournament.scheduleDateTime).toLocaleDateString()}</p>
            <p><strong className="text-primary">Description:</strong> {tournament.description}</p>
          </CardContent>
        </Card>
      </div>

      <RegisteredTeamsList 
        registrations={registrations}
        onRemoveRegistration={handleRemoveRegistration}
        maxTeams={tournament.maxTeams}
      />

    </div>
  );
}
