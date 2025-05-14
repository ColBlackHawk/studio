"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Player, PlayerCreation } from "@/lib/types";
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

const playerFormSchema = z.object({
  name: z.string().min(2, { message: "Player name must be at least 2 characters." }),
  ranking: z.coerce.number().int().min(0, { message: "Ranking must be a non-negative integer."}).optional(),
});

type PlayerFormValues = z.infer<typeof playerFormSchema>;

interface PlayerFormProps {
  player?: Player;
  onSubmit: (data: PlayerCreation | Player) => void;
  isEditing?: boolean;
}

export default function PlayerForm({ player, onSubmit, isEditing = false }: PlayerFormProps) {
  const { toast } = useToast();
  const defaultValues = player
    ? { ...player, ranking: player.ranking ?? undefined }
    : { name: "", ranking: undefined };

  const form = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
    defaultValues,
  });

  const handleSubmit = (data: PlayerFormValues) => {
    const submissionData: PlayerCreation | Player = {
        ...data,
        ranking: data.ranking // Zod coerces, so it will be a number or undefined
    };

    if (isEditing && player) {
      (submissionData as Player).id = player.id;
    }
    onSubmit(submissionData);
    toast({
      title: `Player ${isEditing ? 'updated' : 'created'}`,
      description: `${data.name} has been successfully ${isEditing ? 'saved' : 'added'}.`,
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
              <FormLabel>Player Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ranking"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ranking (Optional)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="e.g., 1500" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full md:w-auto">
          {isEditing ? "Update Player" : "Create Player"}
        </Button>
      </form>
    </Form>
  );
}