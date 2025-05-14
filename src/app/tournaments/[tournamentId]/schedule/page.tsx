
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Tournament, RegisteredEntry, Match } from "@/lib/types";
import { getTournamentById, getTournamentRegistrations } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CalendarCheck, ListOrdered, Trophy, Shield, ListTree, GitMerge, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TournamentSchedulePage() {
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

  const getEntry = (entryId?: string): RegisteredEntry | undefined => {
    if (!entryId) return undefined;
    return registrations.find(r => r.id === entryId);
  };

  const getMatchIdentifier = (match: Match): string => {
    const prefix = 
      match.bracketType === 'winners' ? 'W' :
      match.bracketType === 'losers' ? 'L' :
      match.bracketType === 'grandFinal' ? 'GF' :
      match.bracketType === 'grandFinalReset' ? 'GFR' : 'M';
    return `${prefix}${match.round}-${match.matchNumberInRound}`;
  };
  
  const getBracketTypeDisplay = (match: Match) => {
    switch(match.bracketType) {
        case 'winners': return <span className="flex items-center"><Shield className="mr-1 h-4 w-4 text-green-500" /> Winners'</span>;
        case 'losers': return <span className="flex items-center"><ListTree className="mr-1 h-4 w-4 text-orange-500" /> Losers'</span>;
        case 'grandFinal': return <span className="flex items-center"><Trophy className="mr-1 h-4 w-4 text-yellow-500" /> Grand Final</span>;
        case 'grandFinalReset': return <span className="flex items-center"><GitMerge className="mr-1 h-4 w-4 text-purple-500" /> GF Reset</span>;
        default: return "N/A";
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <p className="text-xl text-muted-foreground">Loading schedule...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="space-y-6 text-center">
        <Button variant="outline" size="icon" asChild className="absolute top-20 left-6">
          <Link href="/"> <ArrowLeft className="h-4 w-4" /> </Link>
        </Button>
        <Info className="mx-auto h-16 w-16 text-destructive" />
        <h1 className="text-3xl font-bold tracking-tight">Tournament Not Found</h1>
        <Button asChild> <Link href="/">Return to Dashboard</Link> </Button>
      </div>
    );
  }

  const sortedMatches = tournament.matches?.slice().sort((a, b) => {
    const bracketOrder = ['winners', 'losers', 'grandFinal', 'grandFinalReset'];
    if (bracketOrder.indexOf(a.bracketType) !== bracketOrder.indexOf(b.bracketType)) {
        return bracketOrder.indexOf(a.bracketType) - bracketOrder.indexOf(b.bracketType);
    }
    if (a.round !== b.round) return a.round - b.round;
    return a.matchNumberInRound - b.matchNumberInRound;
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/tournaments/${tournamentId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center">
          <CalendarCheck className="mr-3 h-8 w-8 text-accent" /> Match Schedule: {tournament.name}
        </h1>
      </div>

      {!sortedMatches || sortedMatches.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Matches Generated</CardTitle>
            <CardDescription>
              The bracket for this tournament has not been generated yet. Please go back to the
              tournament details page to generate the bracket.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-10">
            <ListOrdered className="mx-auto h-12 w-12 text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Match List</CardTitle>
            <CardDescription>
              Overview of all scheduled matches for {tournament.name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match #</TableHead>
                  {tournament.tournamentType === 'double_elimination' && <TableHead>Bracket</TableHead>}
                  <TableHead>Round</TableHead>
                  <TableHead>Participant 1</TableHead>
                  <TableHead>Participant 2</TableHead>
                  <TableHead>Winner</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMatches.map((match) => {
                  const team1 = getEntry(match.team1Id);
                  const team2 = getEntry(match.team2Id);
                  const winner = getEntry(match.winnerId);
                  
                  if (match.isBye && match.bracketType !== 'grandFinalReset') { // GFR can be inactive bye
                     const advancingTeam = team1 || team2; // The one not undefined is advancing
                     return (
                        <TableRow key={match.id} className="bg-muted/30">
                            <TableCell className="font-medium">{getMatchIdentifier(match)}</TableCell>
                            {tournament.tournamentType === 'double_elimination' && <TableCell>{getBracketTypeDisplay(match)}</TableCell>}
                            <TableCell>{match.round}</TableCell>
                            <TableCell colSpan={tournament.tournamentType === 'double_elimination' ? 2 : 3} className="text-center italic">
                                {advancingTeam ? `${advancingTeam.entryName} receives a BYE` : "BYE"}
                            </TableCell>
                            <TableCell>{advancingTeam?.entryName ?? "N/A"}</TableCell>
                            <TableCell>BYE</TableCell>
                        </TableRow>
                     );
                  }
                  
                  // Special case for Grand Final Reset if it's not active
                  if (match.bracketType === 'grandFinalReset' && match.isBye) {
                     return (
                        <TableRow key={match.id} className="bg-muted/20 opacity-70">
                             <TableCell className="font-medium">{getMatchIdentifier(match)}</TableCell>
                            {tournament.tournamentType === 'double_elimination' && <TableCell>{getBracketTypeDisplay(match)}</TableCell>}
                             <TableCell>{match.round}</TableCell>
                             <TableCell colSpan={tournament.tournamentType === 'double_elimination' ? 4 : 3} className="text-center italic text-muted-foreground">
                                Grand Final Reset (Not Activated)
                             </TableCell>
                        </TableRow>
                     );
                  }

                  return (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">{getMatchIdentifier(match)}</TableCell>
                       {tournament.tournamentType === 'double_elimination' && <TableCell>{getBracketTypeDisplay(match)}</TableCell>}
                      <TableCell>{match.round}</TableCell>
                      <TableCell>{team1?.entryName || (match.team1Id ? "TBD" : "BYE")}</TableCell>
                      <TableCell>{team2?.entryName || (match.team2Id ? "TBD" : "BYE")}</TableCell>
                      <TableCell className={winner ? "font-semibold text-accent" : ""}>
                        {winner?.entryName || (match.winnerId ? "TBD" : "---")}
                      </TableCell>
                      <TableCell>{match.score || "---"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

