
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Tournament, Player, TeamRegistrationPayload } from "@/lib/types";
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

  let maxPlayersToSelect = 1;
  let minPlayersToSelect = 1;
  let playerSelectionMessage = "Select 1 player.";
  let entryNameFieldLabel = "Player Nickname (auto-generated)";
  let showEntryNameField = false;

  switch (tournament.participantType) {
    case "Player":
      maxPlayersToSelect = 1;
      minPlayersToSelect = 1;
      playerSelectionMessage = `Select 1 Player (${selectedPlayers.length}/${maxPlayersToSelect})`;
      showEntryNameField = false;
      break;
    case "Scotch Doubles":
      maxPlayersToSelect = 2;
      minPlayersToSelect = 2;
      playerSelectionMessage = `Select 2 Players for the pair (${selectedPlayers.length}/${maxPlayersToSelect})`;
      entryNameFieldLabel = "Pair Name (auto-generated)"; 
      showEntryNameField = false; 
      break;
    case "Team":
      maxPlayersToSelect = 2; // Default for now, can be made dynamic based on tournament settings
      minPlayersToSelect = 1;
      playerSelectionMessage = `Select 1 or 2 Players for the Team (${selectedPlayers.length}/${maxPlayersToSelect})`;
      entryNameFieldLabel = "Team Name";
      showEntryNameField = true;
      break;
  }
  
  const registrationFormSchema = z.object({
    entryName: showEntryNameField
      ? z.string().min(2, { message: `${entryNameFieldLabel} must be at least 2 characters.` })
      : z.string().optional(),
  }).refine(() => selectedPlayers.length >= minPlayersToSelect && selectedPlayers.length <= maxPlayersToSelect , {
      message: `You must select ${minPlayersToSelect === maxPlayersToSelect ? minPlayersToSelect : `${minPlayersToSelect}-${maxPlayersToSelect}`} player(s) for ${tournament.participantType}.`,
      path: ["players"], 
  });


  type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      entryName: "",
    },
  });

   useEffect(() => {
    setSelectedPlayers([]);
    form.reset({ entryName: "" });
    form.trigger(["players"]);
  }, [tournament.participantType, form]);

  const handleSelectPlayer = (player: Player) => {
    if (selectedPlayers.length < maxPlayersToSelect) {
      setSelectedPlayers(prev => [...prev, player]);
      form.trigger(["players"]); 
    }
  };

  const handleDeselectPlayer = (playerId: string) => {
    setSelectedPlayers(prev => prev.filter(p => p.id !== playerId));
    form.trigger(["players"]); 
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
    
    if (selectedPlayers.length < minPlayersToSelect || selectedPlayers.length > maxPlayersToSelect) {
        toast({
            title: "Player Selection Error",
            description: `Please select ${minPlayersToSelect === maxPlayersToSelect ? minPlayersToSelect : `${minPlayersToSelect} to ${maxPlayersToSelect}`} player(s) for ${tournament.participantType}.`,
            variant: "destructive",
        });
        return;
    }

    let entryNameToSubmit = data.entryName || "";
    if (tournament.participantType === "Player" && selectedPlayers.length > 0) {
      entryNameToSubmit = selectedPlayers[0].nickname;
    } else if (tournament.participantType === "Scotch Doubles" && selectedPlayers.length === 2) {
      entryNameToSubmit = selectedPlayers.map(p => p.nickname).join(' & ');
    } else if (tournament.participantType === "Team" && !data.entryName) {
        toast({
            title: "Entry Name Required",
            description: "Please enter a team name.",
            variant: "destructive",
        });
        return;
    }


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
        <p className="text-sm text-muted-foreground">Participant Type: <span className="font-medium text-foreground">{tournament.participantType}</span></p>
        
        {showEntryNameField && (
          <FormField
            control={form.control}
            name="entryName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{entryNameFieldLabel}</FormLabel>
                <FormControl>
                  <Input placeholder={`Enter ${tournament.participantType.toLowerCase()} name`} {...field} />
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
            label={playerSelectionMessage}
            placeholder="Search and select player(s) by nickname..."
        />
        {form.formState.errors.players && (
             <p className="text-sm font-medium text-destructive">{form.formState.errors.players.message}</p>
        )}


        <Button 
          type="submit" 
          className="w-full"
          disabled={currentRegistrationsCount >= tournament.maxTeams}
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
