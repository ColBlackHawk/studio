
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

  const maxPlayersToSelect = tournament.tournamentType === "scotch_double" ? 2 : 1;
  
  const registrationFormSchema = z.object({
    entryName: tournament.participantType === "team" 
      ? z.string().min(2, { message: "Team name must be at least 2 characters." })
      : z.string().optional(), // Optional if participant type is player, name comes from player nickname
    // Player IDs will be managed by selectedPlayers state
  }).refine(() => selectedPlayers.length === maxPlayersToSelect, {
      message: `You must select ${maxPlayersToSelect} player(s).`,
      path: ["players"], // Arbitrary path for error display, or handle this outside zod
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

    if (selectedPlayers.length !== maxPlayersToSelect) {
       toast({
        title: "Player Selection Error",
        description: `Please select exactly ${maxPlayersToSelect} player(s).`,
        variant: "destructive",
      });
      return;
    }

    const entryNameToSubmit = tournament.participantType === 'team' 
      ? data.entryName! 
      : selectedPlayers.map(p => p.nickname).join(' & '); // Auto-generate name from player nicknames

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
            maxSelection={maxPlayersToSelect}
            label={`Select Player${maxPlayersToSelect > 1 ? 's' : ''} (${selectedPlayers.length}/${maxPlayersToSelect})`}
            placeholder="Search and select player(s) by nickname..."
        />
        {form.formState.errors.players && (
             <p className="text-sm font-medium text-destructive">{form.formState.errors.players.message}</p>
        )}


        <Button 
          type="submit" 
          className="w-full"
          disabled={currentRegistrationsCount >= tournament.maxTeams || selectedPlayers.length !== maxPlayersToSelect}
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
