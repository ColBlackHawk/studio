
"use client";

import type { Match, RegisteredEntry } from "@/lib/types";
import MatchCard from "./MatchCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface BracketDisplayProps {
  matches: Match[];
  registrations: RegisteredEntry[];
  onWinnerSelected: (matchId: string, winnerId: string | undefined, score?: string) => void;
}

export default function BracketDisplay({ matches, registrations, onWinnerSelected }: BracketDisplayProps) {
  if (!matches || matches.length === 0) {
    return <p className="text-center text-muted-foreground">No matches to display. Generate the bracket first.</p>;
  }

  const rounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b);
  const maxRound = Math.max(...rounds);

  const getEntryName = (entryId?: string): string => {
    if (!entryId) return "TBD / Bye";
    const entry = registrations.find(r => r.id === entryId);
    return entry ? entry.entryName : "Unknown Entry";
  };
  
  const getEntry = (entryId?: string): RegisteredEntry | undefined => {
     if (!entryId) return undefined;
     return registrations.find(r => r.id === entryId);
  }

  return (
    <ScrollArea className="w-full pb-4">
      <div className="flex gap-4 items-start">
        {rounds.map(roundNumber => (
          <div key={`round-${roundNumber}`} className="flex flex-col gap-4 min-w-[300px] md:min-w-[350px]">
            <h2 className="text-xl font-semibold text-center text-primary sticky top-0 bg-background/80 backdrop-blur-sm py-2 z-10 rounded-md">
              {roundNumber === maxRound ? "Final" : `Round ${roundNumber}`}
            </h2>
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
  );
}
