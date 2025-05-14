
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import type { Team, Player, TeamCreation } from "@/lib/types";
import { getPlayers } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import PlayerSearchInput from "./PlayerSearchInput"; // Assuming this can be reused/adapted

const teamFormSchemaBase = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  type: z.enum(["Scotch Doubles", "Team"]),
  playerIds: z.array(z.string()).min(1, "At least one player must be selected."),
});

const teamFormSchema = teamFormSchemaBase.refine(
  (data) => {
    if (data.type === "Scotch Doubles") {
      return data.playerIds.length === 2;
    }
    return true; // For "Team" type, PlayerSearchInput will handle max players (e.g. 2-4)
  },
  {
    message: "Scotch Doubles entries must have exactly 2 players.",
    path: ["playerIds"], // Point error to playerIds field
  }
).refine(
  (data) => {
    if (data.type === "Team") { // Example: Team must have at least 2 players
        return data.playerIds.length >= 1 && data.playerIds.length <= 4; // Max 4 for example
    }
    return true;
  },
  {
    message: "Teams must have between 1 and 4 players.", // Adjust as needed
    path: ["playerIds"],
  }
);


type TeamFormValues = z.infer<typeof teamFormSchema>;

interface TeamFormProps {
  team?: Team;
  onSubmit: (data: TeamCreation | Team) => void;
  isEditing?: boolean;
}

export default function TeamForm({ team, onSubmit, isEditing = false }: TeamFormProps) {
  const { toast } = useToast();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);

  const defaultValues: Partial<TeamFormValues> = team
    ? { ...team, playerIds: team.playerIds || [] }
    : { name: "", type: "Team", playerIds: [] };
  
  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues,
  });
  
  const currentTeamType = form.watch("type");
  const maxPlayersForType = currentTeamType === "Scotch Doubles" ? 2 : 4; // Example max 4 for 'Team'

  useEffect(() => {
    setAllPlayers(getPlayers());
    if (team && team.playerIds) {
      const initialSelectedPlayers = getPlayers().filter(p => team.playerIds.includes(p.id));
      setSelectedPlayers(initialSelectedPlayers);
    }
  }, [team]);
  
  useEffect(() => {
    // When team type changes, reset selected players if they exceed new max or don't fit criteria
    if (currentTeamType === "Scotch Doubles" && selectedPlayers.length > 2) {
      setSelectedPlayers(prev => prev.slice(0, 2));
      form.setValue("playerIds", selectedPlayers.slice(0, 2).map(p => p.id));
    } else if (currentTeamType === "Team" && selectedPlayers.length > maxPlayersForType) {
       setSelectedPlayers(prev => prev.slice(0, maxPlayersForType));
       form.setValue("playerIds", selectedPlayers.slice(0, maxPlayersForType).map(p => p.id));
    }
    form.trigger("playerIds"); // re-validate
  }, [currentTeamType, form, selectedPlayers, maxPlayersForType]);


  const handleSelectPlayer = (player: Player) => {
    if (selectedPlayers.length < maxPlayersForType) {
      const newSelectedPlayers = [...selectedPlayers, player];
      setSelectedPlayers(newSelectedPlayers);
      form.setValue("playerIds", newSelectedPlayers.map(p => p.id));
      form.trigger("playerIds");
    }
  };

  const handleDeselectPlayer = (playerId: string) => {
    const newSelectedPlayers = selectedPlayers.filter(p => p.id !== playerId);
    setSelectedPlayers(newSelectedPlayers);
    form.setValue("playerIds", newSelectedPlayers.map(p => p.id));
    form.trigger("playerIds");
  };

  const handleSubmitForm = (data: TeamFormValues) => {
    const submissionData: TeamCreation | Team = {
        ...data,
        playerIds: selectedPlayers.map(p => p.id), // Ensure playerIds are from state
    };
    if (isEditing && team) {
      (submissionData as Team).id = team.id;
    }
    onSubmit(submissionData);
    // Toast is handled by parent page
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name (Team or Pair)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., The Champions or PlayerA/PlayerB" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Team">Team</SelectItem>
                  <SelectItem value="Scotch Doubles">Scotch Doubles (Pair)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Select if this is a general team or a specific Scotch Doubles pair.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormItem>
            <FormLabel>
                {currentTeamType === "Scotch Doubles" ? "Select 2 Players" : `Select Players (1-${maxPlayersForType})`}
            </FormLabel>
            <PlayerSearchInput
                allPlayers={allPlayers}
                selectedPlayers={selectedPlayers}
                onSelectPlayer={handleSelectPlayer}
                onDeselectPlayer={handleDeselectPlayer}
                maxSelection={maxPlayersForType}
                label={`Selected Players (${selectedPlayers.length}/${maxPlayersForType})`}
                placeholder="Search and add players by nickname..."
            />
            {form.formState.errors.playerIds && (
                 <p className="text-sm font-medium text-destructive">{form.formState.errors.playerIds.message}</p>
            )}
        </FormItem>


        <Button type="submit" className="w-full md:w-auto">
          {isEditing ? "Update Team/Pair" : "Create Team/Pair"}
        </Button>
      </form>
    </Form>
  );
}
