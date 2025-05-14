
"use client";

import type { Match, RegisteredEntry } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, UserCheck, UserX, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface MatchCardProps {
  match: Match;
  team1?: RegisteredEntry;
  team2?: RegisteredEntry;
  onWinnerSelected: (winnerId: string | undefined, score?: string) => void;
}

export default function MatchCard({ match, team1, team2, onWinnerSelected }: MatchCardProps) {
  const [score, setScore] = useState(match.score || "");

  useEffect(() => {
    setScore(match.score || "");
  }, [match.score]);

  const handleSetWinner = (participantId: string | undefined) => {
    if (match.winnerId === participantId) { // Clicking the winner again clears them
      onWinnerSelected(undefined, undefined);
      setScore("");
    } else {
      onWinnerSelected(participantId, score || undefined);
    }
  };

  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScore(e.target.value);
  };
  
  const handleScoreBlur = () => {
    // Only update score if a winner is already selected, or if clearing score for a decided match
    if (match.winnerId || (!match.winnerId && match.score)) {
        onWinnerSelected(match.winnerId, score || undefined);
    }
  };

  const team1Name = team1?.entryName ?? (match.team1Id ? "Waiting..." : "Bye");
  const team2Name = team2?.entryName ?? (match.team2Id ? "Waiting..." : "Bye");

  const isClickable = (teamId?: string) => {
    if (!teamId) return false; // Cannot select TBD/Bye as winner
    if (match.isBye && teamId === match.team1Id) return false; // Cannot change winner of a bye match
    return true;
  }
  
  const getParticipantClasses = (teamId?: string, isWinner?: boolean) => {
    return cn(
      "p-3 rounded-md transition-all duration-150 ease-in-out w-full text-left",
      "border",
      isWinner ? "bg-accent text-accent-foreground border-accent shadow-md" : "bg-card hover:bg-muted/50",
      !isClickable(teamId) ? "cursor-not-allowed opacity-70" : "cursor-pointer",
      !teamId && "text-muted-foreground italic" // Style for TBD/Bye
    );
  };


  if (match.isBye) {
    return (
      <Card className="shadow-md bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-center">
            Match {match.round}-{match.matchNumberInRound}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-2">
          <p className="font-semibold text-primary">{team1Name}</p>
          <p className="text-sm text-muted-foreground">BYE (Auto-Win)</p>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm text-center text-muted-foreground">
          Match {match.round}-{match.matchNumberInRound}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 py-2">
        <Button
          variant="outline"
          className={getParticipantClasses(match.team1Id, match.winnerId === match.team1Id)}
          onClick={() => isClickable(match.team1Id) && handleSetWinner(match.team1Id)}
          disabled={!isClickable(match.team1Id)}
          title={isClickable(match.team1Id) ? `Set ${team1Name} as winner` : undefined}
        >
          <div className="flex items-center justify-between w-full">
            <span className="truncate">{team1Name}</span>
            {match.winnerId === match.team1Id && <Trophy className="h-4 w-4 text-yellow-500 ml-2" />}
          </div>
        </Button>
        
        <div className="text-center text-xs font-semibold text-muted-foreground">VS</div>

        <Button
          variant="outline"
          className={getParticipantClasses(match.team2Id, match.winnerId === match.team2Id)}
          onClick={() => isClickable(match.team2Id) && handleSetWinner(match.team2Id)}
          disabled={!isClickable(match.team2Id)}
          title={isClickable(match.team2Id) ? `Set ${team2Name} as winner` : undefined}
        >
           <div className="flex items-center justify-between w-full">
            <span className="truncate">{team2Name}</span>
            {match.winnerId === match.team2Id && <Trophy className="h-4 w-4 text-yellow-500 ml-2" />}
          </div>
        </Button>
      </CardContent>
      { (team1 || team2) && !match.isBye && ( // Show score input if not a bye and at least one team known
          <CardFooter className="pt-2 pb-3">
            <div className="w-full space-y-1">
              <Label htmlFor={`score-${match.id}`} className="text-xs text-muted-foreground">Score (Optional)</Label>
              <Input
                id={`score-${match.id}`}
                type="text"
                placeholder="e.g., 3-1"
                value={score}
                onChange={handleScoreChange}
                onBlur={handleScoreBlur}
                className="h-8 text-sm"
                disabled={!match.team1Id || !match.team2Id} // Disable if both teams not present
              />
            </div>
          </CardFooter>
        )}
    </Card>
  );
}
