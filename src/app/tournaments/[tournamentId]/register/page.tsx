
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Tournament, RegisteredEntry, Player, TeamRegistrationPayload, PlayerCreation } from "@/lib/types";
import { 
  getTournamentById, 
  getTournamentRegistrations, 
  addTournamentRegistration, 
  removeTournamentRegistration as removeRegistrationService, 
  getPlayers, 
  removeAllTournamentRegistrations,
  getPlayerByEmail, // Added
  createPlayer // Added
} from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Ticket, Users, Info, User, Users2, UserPlus, LogOutIcon } from "lucide-react";
import RegistrationForm from "@/components/teams/RegistrationForm";
import RegisteredTeamsList from "@/components/teams/RegisteredTeamsList";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext"; // Added

export default function RegisterForTournamentPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const { toast } = useToast();
  const { currentUserDetails } = useAuth(); // Get current user

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<RegisteredEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  const [isCurrentUserRegistered, setIsCurrentUserRegistered] = useState(false);
  const [currentUserRegistrationId, setCurrentUserRegistrationId] = useState<string | null>(null);


  const fetchTournamentData = useCallback(() => {
    if (tournamentId) {
      setIsLoading(true);
      const fetchedTournament = getTournamentById(tournamentId);
      if (fetchedTournament) {
        setTournament(fetchedTournament);
        const currentRegistrations = getTournamentRegistrations(tournamentId);
        setRegistrations(currentRegistrations);

        // Check if current user is registered (only if it's a 'Player' type tournament)
        if (currentUserDetails && fetchedTournament.participantType === 'Player') {
          const userReg = currentRegistrations.find(reg => 
            reg.players.some(p => p.email?.toLowerCase() === currentUserDetails.email.toLowerCase())
          );
          setIsCurrentUserRegistered(!!userReg);
          setCurrentUserRegistrationId(userReg?.id || null);
        } else {
          setIsCurrentUserRegistered(false);
          setCurrentUserRegistrationId(null);
        }

      } else {
        toast({
          title: "Error",
          description: "Tournament not found.",
          variant: "destructive",
        });
        // router.push("/"); 
      }
      setAllPlayers(getPlayers()); 
      setIsLoading(false);
    }
  }, [tournamentId, toast, currentUserDetails]);

  useEffect(() => {
    fetchTournamentData();
  }, [fetchTournamentData]);

  const handleRegisterCurrentUser = () => {
    if (!tournament || !currentUserDetails) return;

    if (registrations.length >= tournament.maxTeams) {
      toast({ title: "Registration Full", description: "This tournament has reached its maximum number of entries.", variant: "destructive" });
      return;
    }

    let playerToRegister = getPlayerByEmail(currentUserDetails.email);

    if (!playerToRegister) {
      const newPlayerData: PlayerCreation = {
        nickname: currentUserDetails.nickname,
        email: currentUserDetails.email,
        firstName: currentUserDetails.firstName,
        lastName: currentUserDetails.lastName,
      };
      playerToRegister = createPlayer(newPlayerData);
    }

    if (playerToRegister) {
      try {
        addTournamentRegistration(tournament.id, playerToRegister.nickname, [playerToRegister]);
        toast({ title: "Registered!", description: `You have been registered for ${tournament.name}.` });
        fetchTournamentData(); // Re-fetch to update UI
      } catch (error: any) {
        toast({ title: "Registration Failed", description: error.message || "Could not register you for the tournament.", variant: "destructive" });
      }
    } else {
       toast({ title: "Error", description: "Could not find or create your player profile.", variant: "destructive" });
    }
  };

  const handleUnregisterCurrentUser = () => {
    if (!tournament || !currentUserDetails || !currentUserRegistrationId) return;

    if (removeRegistrationService(tournament.id, currentUserRegistrationId)) {
      toast({ title: "Unregistered", description: `You have been unregistered from ${tournament.name}.` });
      fetchTournamentData(); // Re-fetch to update UI
    } else {
      toast({ title: "Error", description: "Failed to unregister.", variant: "destructive" });
    }
  };

  const handleRegisterTeam = (payload: TeamRegistrationPayload) => {
    if (!tournament) return;

    const { entryName, playerIds } = payload;
    const selectedPlayers = allPlayers.filter(p => playerIds.includes(p.id));

    if (selectedPlayers.length !== playerIds.length) {
        toast({ title: "Error", description: "One or more selected players not found.", variant: "destructive" });
        return;
    }
    
    const existingPlayerIdsInTournament = new Set<string>();
    registrations.forEach(reg => {
      reg.players.forEach(p => existingPlayerIdsInTournament.add(p.id));
    });

    const duplicates = selectedPlayers.filter(p => existingPlayerIdsInTournament.has(p.id));
    if (duplicates.length > 0) {
      const duplicateNicknames = duplicates.map(d => d.nickname).join(", ");
      toast({
        title: "Duplicate Player(s)",
        description: `Player(s) "${duplicateNicknames}" are already registered in this tournament.`,
        variant: "destructive",
      });
      return;
    }

    try {
      addTournamentRegistration(tournament.id, entryName, selectedPlayers);
      fetchTournamentData();
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
      fetchTournamentData();
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

  const handleClearAllRegistrations = () => {
    if (!tournament) return;
    if (removeAllTournamentRegistrations(tournament.id)) {
      fetchTournamentData();
      toast({
        title: "All Registrations Cleared",
        description: `All entries for "${tournament.name}" have been removed.`,
      });
    } else {
      toast({
        title: "No Registrations to Clear",
        description: `There were no entries to remove for "${tournament.name}".`,
        variant: "default",
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

  const getParticipantTypeIcon = (type: Tournament["participantType"]) => {
    switch (type) {
      case "Player":
        return <User className="h-5 w-5 text-primary mr-1" />;
      case "Scotch Doubles":
        return <Users2 className="h-5 w-5 text-primary mr-1" />;
      case "Team":
        return <Users className="h-5 w-5 text-primary mr-1" />;
      default:
        return <Info className="h-5 w-5 text-primary mr-1" />;
    }
  };

  const showSimplifiedRegistration = currentUserDetails && tournament.participantType === 'Player';

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

      {showSimplifiedRegistration && (
        <Card className="shadow-md bg-primary/5">
          <CardHeader>
            <CardTitle>Quick Registration</CardTitle>
            <CardDescription>Register or unregister yourself for this tournament.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {isCurrentUserRegistered ? (
              <Button onClick={handleUnregisterCurrentUser} variant="destructive" size="lg">
                <LogOutIcon className="mr-2 h-5 w-5" /> Unregister {currentUserDetails.nickname}
              </Button>
            ) : (
              <Button onClick={handleRegisterCurrentUser} variant="default" size="lg" disabled={registrations.length >= tournament.maxTeams}>
                <UserPlus className="mr-2 h-5 w-5" /> Register as {currentUserDetails.nickname}
              </Button>
            )}
          </CardContent>
           {registrations.length >= tournament.maxTeams && !isCurrentUserRegistered && (
             <CardContent className="text-center text-destructive text-sm">
               This tournament has reached its maximum capacity of {tournament.maxTeams} entries.
             </CardContent>
           )}
        </Card>
      )}
      
      {(showSimplifiedRegistration) && <Separator className="my-8" />}


      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <Card className="md:col-span-2 shadow-lg">
          <CardHeader>
             <CardTitle>{showSimplifiedRegistration ? "Manual / Other Registration Types" : "Registration Details"}</CardTitle>
            <CardDescription>
              {showSimplifiedRegistration 
                ? `Register another player, or entries for Team/Scotch Doubles tournaments.`
                : `Register your ${tournament.participantType.toLowerCase()} for the tournament.`
              }
              <br />
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
            <p className="flex items-center"><strong className="text-primary mr-1">Format:</strong> {tournament.tournamentType.replace("_", " ")}</p>
            <p className="flex items-center">
                {getParticipantTypeIcon(tournament.participantType)}
                <strong className="text-primary mr-1">Type:</strong> {tournament.participantType}
            </p>
            <p><strong className="text-primary">Date:</strong> {new Date(tournament.scheduleDateTime).toLocaleDateString()}</p>
            <p><strong className="text-primary">Description:</strong> {tournament.description}</p>
          </CardContent>
        </Card>
      </div>

      <RegisteredTeamsList
        registrations={registrations}
        onRemoveRegistration={handleRemoveRegistration}
        onClearAllRegistrations={handleClearAllRegistrations}
        maxTeams={tournament.maxTeams}
        participantType={tournament.participantType}
      />

    </div>
  );
}
