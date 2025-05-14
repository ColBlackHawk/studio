"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Tournament, TournamentCreation } from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const tournamentFormSchema = z.object({
  name: z.string().min(3, { message: "Tournament name must be at least 3 characters." }),
  owner: z.string().min(2, { message: "Owner name must be at least 2 characters." }),
  description: z.string().min(10, { message: "Description must be at least 10 characters." }),
  tournamentType: z.enum(["single", "scotch_double"]),
  participantType: z.enum(["player", "team"]),
  scheduleDateTime: z.date({ required_error: "A date and time for the tournament is required."}),
  maxTeams: z.coerce.number().min(2, { message: "Maximum teams must be at least 2." }).max(32, { message: "Maximum teams cannot exceed 32."}),
  // Matches field can be complex; for now, a simple text area for match notes or manual entry.
  // For a real app, this would be a more structured input or generated based on registrations.
  matchesInfo: z.string().optional(), 
});

type TournamentFormValues = z.infer<typeof tournamentFormSchema>;

interface TournamentFormProps {
  tournament?: Tournament;
  onSubmit: (data: TournamentCreation | Tournament) => void;
  isEditing?: boolean;
}

export default function TournamentForm({ tournament, onSubmit, isEditing = false }: TournamentFormProps) {
  const { toast } = useToast();
  const defaultValues = tournament
    ? { 
        ...tournament, 
        scheduleDateTime: new Date(tournament.scheduleDateTime),
        matchesInfo: tournament.matches ? JSON.stringify(tournament.matches, null, 2) : '' // Example for matches
      }
    : {
        name: "",
        owner: "",
        description: "",
        tournamentType: "single" as "single" | "scotch_double",
        participantType: "player" as "player" | "team",
        maxTeams: 8,
        scheduleDateTime: new Date(),
        matchesInfo: "",
      };

  const form = useForm<TournamentFormValues>({
    resolver: zodResolver(tournamentFormSchema),
    defaultValues,
  });

  const handleSubmit = (data: TournamentFormValues) => {
    const submissionData: TournamentCreation | Tournament = {
      ...data,
      scheduleDateTime: data.scheduleDateTime.toISOString(),
      // Basic handling for matches - in a real app, this would be more structured.
      matches: data.matchesInfo ? tryParseMatches(data.matchesInfo) : [],
    };
    if (isEditing && tournament) {
      (submissionData as Tournament).id = tournament.id;
    }
    onSubmit(submissionData);
    toast({
      title: `Tournament ${isEditing ? 'updated' : 'created'}`,
      description: `${data.name} has been successfully ${isEditing ? 'updated' : 'saved'}.`,
    });
  };
  
  const tryParseMatches = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch (e) {
      return []; // Or handle error, e.g., by showing a toast
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tournament Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Spring Fling Open" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="owner"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Owner/Organizer</FormLabel>
              <FormControl>
                <Input placeholder="Your Name / Organization" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Provide details about the tournament..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid md:grid-cols-2 gap-8">
            <FormField
            control={form.control}
            name="tournamentType"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Tournament Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select tournament type" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    <SelectItem value="single">Single Elimination</SelectItem>
                    <SelectItem value="scotch_double">Scotch Double</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="participantType"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Participant Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select participant type" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    <SelectItem value="player">Player-based (individuals/pairs)</SelectItem>
                    <SelectItem value="team">Team-based (named teams)</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <div className="grid md:grid-cols-2 gap-8">
            <FormField
            control={form.control}
            name="scheduleDateTime"
            render={({ field }) => (
                <FormItem className="flex flex-col">
                <FormLabel>Schedule Date & Time</FormLabel>
                <Popover>
                    <PopoverTrigger asChild>
                    <FormControl>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                        )}
                        >
                        {field.value ? (
                            format(field.value, "PPP HH:mm")
                        ) : (
                            <span>Pick a date and time</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                    </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) } // Disable past dates
                        initialFocus
                    />
                    {/* Basic Time Picker - For a real app use a dedicated time picker component */}
                    <div className="p-2 border-t">
                      <Input 
                        type="time" 
                        defaultValue={field.value ? format(field.value, "HH:mm") : "12:00"}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':').map(Number);
                          const newDate = new Date(field.value || new Date());
                          newDate.setHours(hours, minutes);
                          field.onChange(newDate);
                        }}
                      />
                    </div>
                    </PopoverContent>
                </Popover>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="maxTeams"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Max Teams/Participants</FormLabel>
                <FormControl>
                    <Input type="number" placeholder="e.g., 16" {...field} />
                </FormControl>
                <FormDescription>Typically a power of 2 (e.g., 4, 8, 16, 32).</FormDescription>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
         <FormField
          control={form.control}
          name="matchesInfo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Matches Information (Optional, JSON format)</FormLabel>
              <FormControl>
                <Textarea placeholder='e.g., [{"round": 1, "matchNumberInRound": 1, "team1Id": "...", "team2Id": "..."}]' {...field} rows={5} />
              </FormControl>
              <FormDescription>Manual entry for match details. For structured data, use JSON array format.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full md:w-auto">
          {isEditing ? "Update Tournament" : "Create Tournament"}
        </Button>
      </form>
    </Form>
  );
}