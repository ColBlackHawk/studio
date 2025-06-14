
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Tournament, TournamentCreation, ParticipantType } from "@/lib/types";
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
import { useAuth } from "@/contexts/AuthContext"; // Import useAuth
import { useEffect } from "react";

const tournamentFormSchemaBase = z.object({
  name: z.string().min(3, { message: "Tournament name must be at least 3 characters." }),
  description: z.string().min(10, { message: "Description must be at least 10 characters." }),
  tournamentType: z.enum(["single", "double_elimination"]),
  participantType: z.enum(["Player", "Scotch Doubles", "Team"]),
  scheduleDateTime: z.date({ required_error: "A date and time for the tournament is required."}),
  maxTeams: z.coerce.number().min(2, { message: "Maximum teams/participants must be at least 2." }).max(128, { message: "Maximum teams cannot exceed 128."}),
  matchesInfo: z.string().optional(), 
  ownerId: z.string(), // ownerId will be an email string
});

type TournamentFormValues = z.infer<typeof tournamentFormSchemaBase>;

interface TournamentFormProps {
  tournament?: Tournament; 
  onSubmit: (data: Omit<TournamentCreation, "id" | "matches">) => void;
  isEditing?: boolean;
}

export default function TournamentForm({ tournament, onSubmit, isEditing = false }: TournamentFormProps) {
  const { toast } = useToast();
  const { currentUserEmail, isLoading: authLoading } = useAuth(); // Get currentUserEmail

  const defaultValues = tournament
    ? { 
        name: tournament.name,
        description: tournament.description,
        tournamentType: tournament.tournamentType,
        participantType: tournament.participantType,
        scheduleDateTime: new Date(tournament.scheduleDateTime),
        maxTeams: tournament.maxTeams,
        matchesInfo: tournament.matches && tournament.matches.length > 0 ? "Bracket exists. Use bracket management features." : '',
        ownerId: tournament.ownerId, // email of owner
      }
    : {
        name: "",
        description: "",
        tournamentType: "single" as "single" | "double_elimination",
        participantType: "Player" as ParticipantType,
        maxTeams: 8,
        scheduleDateTime: new Date(),
        matchesInfo: "",
        ownerId: currentUserEmail || "", // Set default ownerId
      };

  const form = useForm<TournamentFormValues>({
    resolver: zodResolver(tournamentFormSchemaBase),
    defaultValues,
  });

  useEffect(() => {
    if (!isEditing && currentUserEmail && !form.getValues("ownerId")) {
      form.setValue("ownerId", currentUserEmail);
    }
  }, [currentUserEmail, isEditing, form]);


  const handleSubmit = (data: TournamentFormValues) => {
    if (!data.ownerId && currentUserEmail) { // Ensure ownerId is set
        data.ownerId = currentUserEmail;
    }
    if (!data.ownerId) {
        toast({ title: "Error", description: "Tournament owner could not be determined. Please log in.", variant: "destructive"});
        return;
    }

    const submissionData: Omit<TournamentCreation, "id" | "matches"> = {
        ...data,
        scheduleDateTime: data.scheduleDateTime.toISOString(),
    };
    
    onSubmit(submissionData);

    toast({
      title: `Tournament ${isEditing ? 'updated' : 'created'}`,
      description: `${data.name} has been successfully ${isEditing ? 'updated' : 'saved'}.`,
    });
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
                    <SelectItem value="double_elimination">Double Elimination</SelectItem>
                    </SelectContent>
                </Select>
                <FormDescription>Select the bracket format for the tournament.</FormDescription>
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
                    <SelectItem value="Player">Player (Individual)</SelectItem>
                    <SelectItem value="Scotch Doubles">Scotch Doubles (Pairs)</SelectItem>
                    <SelectItem value="Team">Team (Named Teams)</SelectItem>
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
                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) } 
                        initialFocus
                    />
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
                <FormLabel>Max Entries</FormLabel>
                <FormControl>
                    <Input type="number" placeholder="e.g., 16" {...field} />
                </FormControl>
                <FormDescription>Typically a power of 2 (e.g., 4, 8, 16, 32, 64, 128).</FormDescription>
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
              <FormLabel>Matches Information</FormLabel>
              <FormControl>
                <Textarea 
                    placeholder='Brackets are managed via the "Generate/Reset Bracket" button on the tournament details page.' 
                    {...field} 
                    rows={3} 
                    readOnly 
                    className="bg-muted/50"
                />
              </FormControl>
              <FormDescription>This field is informational. Use bracket tools to manage matches.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Hidden field for ownerId, it will be populated from auth context */}
        <FormField control={form.control} name="ownerId" render={({ field }) => <Input type="hidden" {...field} />} />


        <Button type="submit" className="w-full md:w-auto" disabled={authLoading}>
          {isEditing ? "Update Tournament" : "Create Tournament"}
        </Button>
      </form>
    </Form>
  );
}
