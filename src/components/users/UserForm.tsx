
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { User, AccountType, UserCreation } from "@/lib/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const accountTypes: AccountType[] = ['Admin', 'Owner', 'Player'];

const userFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  nickname: z.string().min(2, { message: "Nickname must be at least 2 characters." }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  accountType: z.enum(accountTypes, { required_error: "Account type is required." }),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormProps {
  user?: User;
  onSubmit: (data: UserCreation | User) => void;
  isEditing?: boolean;
}

export default function UserForm({ user, onSubmit, isEditing = false }: UserFormProps) {
  const { toast } = useToast();
  const defaultValues = user
    ? { 
        ...user,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
      }
    : { 
        email: "",
        nickname: "", 
        firstName: "",
        lastName: "",
        accountType: "Player" as AccountType,
      };

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues,
  });

  const handleSubmit = (data: UserFormValues) => {
    onSubmit(data as UserCreation | User); // Type assertion based on isEditing
    toast({
      title: `User ${isEditing ? 'updated' : 'created'}`,
      description: `${data.nickname} (${data.email}) has been successfully ${isEditing ? 'saved' : 'added'}.`,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (Required)</FormLabel>
              <FormControl>
                <Input type="email" placeholder="user@example.com" {...field} readOnly={isEditing} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nickname"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nickname (Required)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., TheUser" {...field} />
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
          name="accountType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Type (Required)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {accountTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full md:w-auto">
          {isEditing ? "Update User" : "Create User"}
        </Button>
      </form>
    </Form>
  );
}
