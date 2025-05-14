
"use client";

import type { Match, RegisteredEntry, TournamentType } from "@/lib/types";
import MatchCard from "./MatchCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Shield, ListTree, Trophy } from "lucide-react";

interface BracketDisplayProps {
  matches: Match[];
  registrations: RegisteredEntry[];
  onWinnerSelected: (matchId: string, winnerId: string | undefined, score?: string) => void;
  bracketTypeTitle?: string; // e.g., "Winners' Bracket", "Losers' Bracket"
  tournamentType: TournamentType;
}

export default function BracketDisplay({ matches, registrations, onWinnerSelected, bracketTypeTitle, tournamentType }: BracketDisplayProps) {
  if (!matches || matches.length === 0) {
    if (bracketTypeTitle) { // Only show specific message if title implies specific bracket expected
        return <p className="text-center text-muted-foreground py-4">No matches to display for {bracketTypeTitle}.</p>;
    }
    return <p className="text-center text-muted-foreground py-4">No matches to display.</p>;
  }

  const rounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b);
  // For DE Grand Finals, round numbers might restart or be special. Max round logic needs context.
  const maxRoundOverall = Math.max(...matches.map(m => m.round)); 

  const getEntry = (entryId?: string): RegisteredEntry | undefined => {
     if (!entryId) return undefined;
     return registrations.find(r => r.id === entryId);
  }

  const getRoundTitle = (roundNumber: number, bracketType?: string) => {
    if (bracketType === 'grandFinal') return "Grand Final";
    if (bracketType === 'grandFinalReset') return "Grand Final (Reset)";
    if (bracketType === 'losers') return `Losers' Round ${roundNumber}`;
    // For winners or single elimination, check if it's the final round
    const isFinalRound = roundNumber === maxRoundOverall && matches.filter(m => m.round === roundNumber).length === 1;
    if (isFinalRound && (bracketType === 'winners' || tournamentType === 'single')) return "Final";
    return `Round ${roundNumber}`;
  }


  return (
    <div className="space-y-4">
      {bracketTypeTitle && (
        <h2 className="text-2xl font-bold text-primary flex items-center">
          {bracketTypeTitle === "Winners' Bracket" ? <Shield className="mr-2 h-6 w-6 text-green-500" /> : 
           bracketTypeTitle === "Losers' Bracket" ? <ListTree className="mr-2 h-6 w-6 text-orange-500" /> : 
           <Trophy className="mr-2 h-6 w-6 text-yellow-500" />}
          {bracketTypeTitle}
        </h2>
      )}
      <ScrollArea className="w-full pb-4 border rounded-lg shadow-md bg-card">
        <div className="flex gap-4 items-start p-4">
          {rounds.map(roundNumber => (
            <div key={`round-${bracketTypeTitle}-${roundNumber}`} className="flex flex-col gap-4 min-w-[300px] md:min-w-[350px]">
              <h3 className="text-xl font-semibold text-center text-primary sticky top-0 bg-card/90 backdrop-blur-sm py-2 z-10 rounded-md shadow-sm">
                {getRoundTitle(roundNumber, matches.find(m => m.round === roundNumber)?.bracketType)}
              </h3>
              {matches
                .filter(match => match.round === roundNumber)
                .sort((a,b) => a.matchNumberInRound - b.matchNumberInRound)
                .map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    team1={getEntry(match.team1Id)}
                    team2={getEntry(match.team2Id)}
                    onWinnerSelected={(winnerId, score) => onWinnerSelected(match.id, winnerId, score)}
                  />
                ))}
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
