
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { User, AccountType, UserCreation } from "@/lib/types";
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

const accountTypes: AccountType[] = ['Admin', 'Owner', 'Player'];

const baseUserFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  nickname: z.string().min(2, { message: "Nickname must be at least 2 characters." }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  accountType: z.enum(accountTypes, { required_error: "Account type is required." }),
});

// Schema for creating a user (password required)
const createUserFormSchema = baseUserFormSchema.extend({
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Schema for editing a user (password optional)
const editUserFormSchema = baseUserFormSchema.extend({
  password: z.string().min(6, { message: "Password must be at least 6 characters." }).optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
}).refine((data) => {
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "New passwords don't match",
  path: ["confirmPassword"],
});


interface UserFormProps {
  user?: User;
  onSubmit: (data: UserCreation | User) => void;
  isEditing?: boolean;
}

export default function UserForm({ user, onSubmit, isEditing = false }: UserFormProps) {
  const { toast } = useToast();

  const formSchema = isEditing ? editUserFormSchema : createUserFormSchema;
  type UserFormValues = z.infer<typeof formSchema>;


  const defaultValues: Partial<UserFormValues> = user
    ? {
        ...user,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        password: "", // Don't prefill password for editing
        confirmPassword: "",
      }
    : {
        email: "",
        nickname: "",
        firstName: "",
        lastName: "",
        accountType: "Player" as AccountType,
        password: "",
        confirmPassword: "",
      };

  const form = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const handleSubmit = (data: UserFormValues) => {
    const submissionData: Partial<UserCreation | User> = { // Use Partial to build up
      email: data.email,
      nickname: data.nickname,
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      accountType: data.accountType,
    };

    if (data.password) { // Only include password if provided (and valid for schema)
      submissionData.password = data.password;
    } else if (!isEditing) {
      // This case should be caught by createUserFormSchema making password required
      toast({ title: "Error", description: "Password is required for new users.", variant: "destructive" });
      return;
    }
    // If editing and password fields are blank, the existing password remains unchanged (not sent in `updates`)

    onSubmit(submissionData as UserCreation | User);
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{isEditing ? "New Password (Optional)" : "Password (Required)"}</FormLabel>
              <FormControl>
                <Input type="password" placeholder={isEditing ? "Leave blank to keep current" : "Min. 6 characters"} {...field} />
              </FormControl>
              <FormDescription className="text-xs text-destructive">
                Warning: Passwords stored in plain text for this prototype (insecure).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{isEditing ? "Confirm New Password" : "Confirm Password (Required)"}</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Re-enter password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
