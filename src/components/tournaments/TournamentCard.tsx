
"use client";
import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Trophy, Info, Edit, ListChecks, ShieldQuestion, GitFork, User, Users2 } from "lucide-react";
import { getTournamentRegistrations } from "@/lib/dataService";
import { useEffect, useState } from "react";

interface TournamentCardProps {
  tournament: Tournament;
}

export default function TournamentCard({ tournament }: TournamentCardProps) {
  const [registeredCount, setRegisteredCount] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRegisteredCount(getTournamentRegistrations(tournament.id).length);
    }
  }, [tournament.id]);

  const getTournamentFormatIcon = (type: Tournament["tournamentType"]) => {
    switch (type) {
      case "single":
        return <User className="h-4 w-4 text-muted-foreground" title="Single Elimination" />;
      case "double_elimination":
        return <GitFork className="h-4 w-4 text-muted-foreground" title="Double Elimination"/>;
      default:
        return <ShieldQuestion className="h-4 w-4 text-muted-foreground" />;
    }
  };
  
  const getParticipantTypeLabel = (participantType: Tournament["participantType"]) => {
    switch (participantType) {
      case "Player":
        return "Player (Individual)";
      case "Scotch Doubles":
        return "Scotch Doubles (Pairs)";
      case "Team":
        return "Team";
      default:
        return participantType;
    }
  };


  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-xl font-semibold text-primary">{tournament.name}</span>
          <Trophy className="h-6 w-6 text-accent" />
        </CardTitle>
        <CardDescription className="flex items-center gap-2 text-sm">
          <Info className="h-4 w-4" />
          {tournament.description.length > 100 ? `${tournament.description.substring(0, 97)}...` : tournament.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 flex-grow">
        <div className="flex items-center text-sm text-muted-foreground">
          {getTournamentFormatIcon(tournament.tournamentType)}
          <span className="ml-2 capitalize">{tournament.tournamentType.replace("_", " ")}</span>
        </div>
         <div className="flex items-center text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span className="ml-2">{getParticipantTypeLabel(tournament.participantType)}</span>
        </div>
        <div className="flex items-center text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span className="ml-2">{new Date(tournament.scheduleDateTime).toLocaleDateString()} - {new Date(tournament.scheduleDateTime).toLocaleTimeString()}</span>
        </div>
        <div className="flex items-center text-sm text-muted-foreground">
          <ListChecks className="h-4 w-4" />
          <span className="ml-2">{registeredCount} / {tournament.maxTeams} Registered Entries</span>
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2 pt-4 border-t">
          <Button asChild variant="outline" size="sm">
            <Link href={`/tournaments/${tournament.id}`}>
              <Info className="mr-2 h-4 w-4" /> Details
            </Link>
          </Button>
          <Button asChild variant="default" size="sm">
            <Link href={`/tournaments/${tournament.id}/register`}>
              <Edit className="mr-2 h-4 w-4" /> Register
            </Link>
          </Button>
      </CardFooter>
    </Card>
  );
}
