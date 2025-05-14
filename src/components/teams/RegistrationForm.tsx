
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Tournament, Player, RegisteredEntry, TeamRegistrationPayload } from "@/lib/types";
import { getPlayers } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import PlayerSearchInput from "./PlayerSearchInput";

interface RegistrationFormProps {
  tournament: Tournament;
  onRegister: (payload: TeamRegistrationPayload) => void;
  currentRegistrationsCount: number;
}

export default function RegistrationForm({ tournament, onRegister, currentRegistrationsCount }: RegistrationFormProps) {
  const { toast } = useToast();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);

  useEffect(() => {
    setAllPlayers(getPlayers());
  }, []);

  // For player-based tournaments, double_elimination (like scotch_double was) implies pairs. Single elimination is individual.
  // For team-based, this number can be higher, but the form currently supports selecting up to 2.
  // This specific logic might need adjustment based on how 'double_elimination' for 'player' participantType is intended to work.
  const maxPlayersToSelect = tournament.participantType === 'player' && tournament.tournamentType === "double_elimination" ? 2 : 1;
  
  const registrationFormSchema = z.object({
    entryName: tournament.participantType === "team" 
      ? z.string().min(2, { message: "Team name must be at least 2 characters." })
      : z.string().optional(), // Optional if participant type is player, name comes from player nickname
    // Player IDs will be managed by selectedPlayers state
  }).refine(() => selectedPlayers.length > 0 && selectedPlayers.length <= maxPlayersToSelect , {
      message: `You must select ${maxPlayersToSelect === 1 ? '1 player' : `1 or ${maxPlayersToSelect} players`}.`,
      path: ["players"], 
  }).refine(() => {
      if (tournament.participantType === 'player' && tournament.tournamentType === 'double_elimination') {
        return selectedPlayers.length === 2;
      }
      if (tournament.participantType === 'player' && tournament.tournamentType === 'single') {
        return selectedPlayers.length === 1;
      }
      // For team-based, allow 1 or 2 for now (can be expanded)
      if (tournament.participantType === 'team') {
         return selectedPlayers.length >= 1 && selectedPlayers.length <= 2; // Simplified for now
      }
      return true;
  }, {
    message: `Incorrect number of players selected for this tournament type. Select ${tournament.participantType === 'player' && tournament.tournamentType === 'double_elimination' ? '2 players for Double Elimination (player-based)' : '1 player for Single Elimination (player-based)'}. For teams, select 1 or 2 players.`,
    path: ["players"],
  });


  type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      entryName: "",
    },
  });

  const handleSelectPlayer = (player: Player) => {
    if (selectedPlayers.length < maxPlayersToSelect) {
      setSelectedPlayers(prev => [...prev, player]);
    } else if (tournament.participantType === 'team' && selectedPlayers.length < 2) { 
      // Allow up to 2 for teams for now
       setSelectedPlayers(prev => [...prev, player]);
    }
  };

  const handleDeselectPlayer = (playerId: string) => {
    setSelectedPlayers(prev => prev.filter(p => p.id !== playerId));
  };

  const handleSubmit = (data: RegistrationFormValues) => {
    if (currentRegistrationsCount >= tournament.maxTeams) {
      toast({
        title: "Registration Full",
        description: "This tournament has reached its maximum number of entries.",
        variant: "destructive",
      });
      return;
    }
    
    // Re-validate player count before submission as refine might not cover all dynamic label updates.
    let expectedPlayerCount = 1;
    if (tournament.participantType === 'player') {
        if (tournament.tournamentType === 'double_elimination') expectedPlayerCount = 2;
        else expectedPlayerCount = 1;
    } else { // team
        // For teams, we are allowing 1 or 2 players for now in this form.
        // This part could be made more flexible (e.g. min/max players per team setting on tournament)
        if (selectedPlayers.length < 1 || selectedPlayers.length > 2) {
             toast({
                title: "Player Selection Error",
                description: `Teams must have 1 or 2 players for this registration form.`,
                variant: "destructive",
            });
            return;
        }
    }
    if (tournament.participantType === 'player' && selectedPlayers.length !== expectedPlayerCount) {
         toast({
            title: "Player Selection Error",
            description: `Please select exactly ${expectedPlayerCount} player(s) for this tournament type.`,
            variant: "destructive",
        });
        return;
    }


    const entryNameToSubmit = tournament.participantType === 'team' 
      ? data.entryName! 
      : selectedPlayers.map(p => p.nickname).join(' & '); 

    const payload: TeamRegistrationPayload = {
      entryName: entryNameToSubmit,
      playerIds: selectedPlayers.map(p => p.id),
    };
    
    onRegister(payload);
    form.reset();
    setSelectedPlayers([]); 
    toast({
      title: "Registration Successful",
      description: `${payload.entryName} has been registered for ${tournament.name}.`,
    });
  };
  
  let playerSelectionLabel = `Select Player(s)`;
  if (tournament.participantType === 'player') {
    playerSelectionLabel = tournament.tournamentType === 'double_elimination' 
      ? `Select 2 Players (${selectedPlayers.length}/2)`
      : `Select 1 Player (${selectedPlayers.length}/1)`;
  } else { // team
    playerSelectionLabel = `Select 1 or 2 Players for Team (${selectedPlayers.length}/${2})`;
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 p-6 border rounded-lg shadow-md bg-card">
        <h3 className="text-xl font-semibold text-primary">Register for: {tournament.name}</h3>
        
        {tournament.participantType === "team" && (
          <FormField
            control={form.control}
            name="entryName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your team name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <PlayerSearchInput
            allPlayers={allPlayers}
            selectedPlayers={selectedPlayers}
            onSelectPlayer={handleSelectPlayer}
            onDeselectPlayer={handleDeselectPlayer}
            maxSelection={tournament.participantType === 'team' ? 2 : (tournament.tournamentType === 'double_elimination' ? 2 : 1)} // Max 2 for teams or player-based double_elimination
            label={playerSelectionLabel}
            placeholder="Search and select player(s) by nickname..."
        />
        {form.formState.errors.players && (
             <p className="text-sm font-medium text-destructive">{form.formState.errors.players.message}</p>
        )}


        <Button 
          type="submit" 
          className="w-full"
          disabled={currentRegistrationsCount >= tournament.maxTeams /* Basic check, detailed validation in handleSubmit */}
        >
          {currentRegistrationsCount >= tournament.maxTeams ? "Registration Full" : "Register"}
        </Button>
         {currentRegistrationsCount >= tournament.maxTeams && (
             <p className="text-sm text-center text-destructive">This tournament has reached its maximum capacity of {tournament.maxTeams} entries.</p>
         )}
      </form>
    </Form>
  );
}

