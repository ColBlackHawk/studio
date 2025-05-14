
"use client";

import type { Match, RegisteredEntry } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, UserCheck, UserX, Users, Shield, ListTree, GitMerge } from "lucide-react";
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
    if (match.winnerId === participantId) { 
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
    if (match.winnerId || (!match.winnerId && match.score !== (match.score || ""))) { // Update if winner selected OR score changed for undecided match
        onWinnerSelected(match.winnerId, score || undefined);
    }
  };

  const getParticipantName = (entry?: RegisteredEntry, matchParticipantId?: string): string => {
    if (!matchParticipantId) return "Bye"; 
    if (!entry) return "Waiting..."; 

    // Prioritize player's direct nickname if it's a single player entry
    if (entry.players && entry.players.length === 1 && entry.players[0]?.nickname) {
      return entry.players[0].nickname;
    }
    // Fallback to entryName for teams/pairs or if nickname somehow missing from player object
    return entry.entryName || "Unknown Entry"; 
  };

  const team1Name = getParticipantName(team1, match.team1Id);
  const team2Name = getParticipantName(team2, match.team2Id);

  const isClickable = (teamId?: string) => {
    if (!teamId) return false; 
    if (match.isBye && (teamId === match.team1Id || teamId === match.team2Id) && match.winnerId === teamId) {
      if (match.winnerId) return false;
    }
    if (match.bracketType === 'grandFinalReset' && match.isBye) return false;
    return true;
  }
  
  const getParticipantClasses = (teamId?: string, isWinner?: boolean) => {
    return cn(
      "p-3 rounded-md transition-all duration-150 ease-in-out w-full text-left",
      "border",
      isWinner ? "bg-accent text-accent-foreground border-accent shadow-md" : "bg-card hover:bg-muted/50",
      !isClickable(teamId) ? "cursor-not-allowed opacity-70" : "cursor-pointer",
      !teamId && "text-muted-foreground italic" 
    );
  };

  const getBracketTypeIndicator = () => {
    switch(match.bracketType) {
        case 'winners': return <Shield className="h-3 w-3 text-green-500" title="Winners' Bracket" />;
        case 'losers': return <ListTree className="h-3 w-3 text-orange-500" title="Losers' Bracket" />;
        case 'grandFinal': return <Trophy className="h-3 w-3 text-yellow-500" title="Grand Final" />;
        case 'grandFinalReset': return <GitMerge className="h-3 w-3 text-purple-500" title="Grand Final Reset" />;
        default: return null;
    }
  }
  
  const matchIdentifier = `${match.bracketType === 'winners' ? 'W' : match.bracketType === 'losers' ? 'L' : match.bracketType === 'grandFinal' ? 'GF' : match.bracketType === 'grandFinalReset' ? 'GFR' : 'M'}${match.round}-${match.matchNumberInRound}`;


  if (match.isBye && match.bracketType !== 'grandFinalReset') { 
    const advancingParticipantName = team1Name !== "Bye" ? team1Name : team2Name;
    return (
      <Card className="shadow-md bg-muted/30">
        <CardHeader className="pb-2 pt-3 flex flex-row justify-between items-center">
          <CardTitle className="text-xs text-center text-muted-foreground">
            Match {matchIdentifier}
          </CardTitle>
          {getBracketTypeIndicator()}
        </CardHeader>
        <CardContent className="text-center py-2">
          <p className="font-semibold text-primary">{advancingParticipantName}</p>
          <p className="text-sm text-muted-foreground">BYE (Auto-Win)</p>
        </CardContent>
      </Card>
    );
  }
  
  if (match.bracketType === 'grandFinalReset' && match.isBye) {
     return (
      <Card className="shadow-md bg-muted/20 opacity-60">
        <CardHeader className="pb-2 pt-3 flex flex-row justify-between items-center">
          <CardTitle className="text-xs text-center text-muted-foreground">
            Match {matchIdentifier}
          </CardTitle>
           {getBracketTypeIndicator()}
        </CardHeader>
        <CardContent className="text-center py-4">
          <p className="text-sm text-muted-foreground">Not Activated</p>
          <p className="text-xs text-muted-foreground">(If LB winner wins Grand Final)</p>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2 pt-3 flex flex-row justify-between items-center">
        <CardTitle className="text-xs text-center text-muted-foreground">
          Match {matchIdentifier}
        </CardTitle>
        {getBracketTypeIndicator()}
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
            {match.winnerId === match.team1Id && <Trophy className="h-4 w-4 text-yellow-400 ml-2" />}
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
            {match.winnerId === match.team2Id && <Trophy className="h-4 w-4 text-yellow-400 ml-2" />}
          </div>
        </Button>
      </CardContent>
      { (team1 || team2 || (match.bracketType === 'grandFinalReset' && !match.isBye) ) && !match.isBye && ( 
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
                disabled={(!match.team1Id || !match.team2Id) && !(match.bracketType === 'grandFinalReset' && !match.isBye)} 
              />
            </div>
          </CardFooter>
        )}
    </Card>
  );
}

