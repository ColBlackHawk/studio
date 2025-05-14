
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
  nickname: z.string().min(2, { message: "Nickname must be at least 2 characters." }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  apaNumber: z.string().optional(),
  phone: z.string().optional(), // Consider adding regex for phone validation if needed
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')), // Allow empty string
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
    ? { 
        ...player, 
        ranking: player.ranking ?? undefined,
        firstName: player.firstName ?? "",
        lastName: player.lastName ?? "",
        apaNumber: player.apaNumber ?? "",
        phone: player.phone ?? "",
        email: player.email ?? "",
      }
    : { 
        nickname: "", 
        firstName: "",
        lastName: "",
        apaNumber: "",
        phone: "",
        email: "",
        ranking: undefined 
      };

  const form = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
    defaultValues,
  });

  const handleSubmit = (data: PlayerFormValues) => {
    const submissionData: PlayerCreation | Player = {
        ...data,
        // Ensure optional fields are set to undefined if empty, or keep as is from form
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        apaNumber: data.apaNumber || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        ranking: data.ranking // Zod coerces, so it will be a number or undefined
    };

    if (isEditing && player) {
      (submissionData as Player).id = player.id;
    }
    onSubmit(submissionData);
    toast({
      title: `Player ${isEditing ? 'updated' : 'created'}`,
      description: `${data.nickname} has been successfully ${isEditing ? 'saved' : 'added'}.`,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="nickname"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nickname (Required)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., The Rocket" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid md:grid-cols-2 gap-8">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., John" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
         <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (Optional)</FormLabel>
              <FormControl>
                <Input type="email" placeholder="e.g., player@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid md:grid-cols-2 gap-8">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., (555) 123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="apaNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>APA Number (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 12345678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
