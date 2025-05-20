
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@/lib/types";
import { getUsers as getUsersService, deleteUser as deleteUserService } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area"; // Added import
import { PlusCircle, Edit, Trash2, Mail, User as UserIcon, ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function ManageUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentUserDetails } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (currentUserDetails?.accountType !== 'Admin') {
      toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
      router.push("/"); 
    } else {
      fetchUsers();
    }
  }, [currentUserDetails, router, toast]);

  const fetchUsers = () => {
    setUsers(getUsersService());
    setIsLoading(false);
  };

  const handleDeleteUser = (email: string, nickname: string) => {
    if (currentUserDetails?.email === email) {
      toast({
        title: "Cannot Delete Self",
        description: "Admins cannot delete their own account.",
        variant: "destructive",
      });
      return;
    }
    if (deleteUserService(email)) {
      fetchUsers(); // Refresh list
      toast({
        title: "User Deleted",
        description: `User "${nickname}" (${email}) has been successfully deleted.`,
      });
    } else {
      toast({
        title: "Error",
        description: `Failed to delete user "${nickname}".`,
        variant: "destructive",
      });
    }
  };

  if (isLoading || currentUserDetails?.accountType !== 'Admin') {
    return <p>Loading users or checking permissions...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Manage Users</h1>
        <Button asChild>
          <Link href="/admin/users/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New User
          </Link>
        </Button>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Users Found</CardTitle>
            <CardDescription>
              Add users to the system. Only the 'admin@tournamentbracket.com' account is created by default.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-10">
             <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <Card>
           <CardHeader>
            <CardTitle>Registered Users</CardTitle>
            <CardDescription>
              View, edit, or delete user accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-380px)]"> {/* Adjust height as needed */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><UserIcon className="inline-block mr-1 h-4 w-4" />Nickname</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead><Mail className="inline-block mr-1 h-4 w-4" />Email</TableHead>
                    <TableHead><ShieldAlert className="inline-block mr-1 h-4 w-4" />Account Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.email}>
                      <TableCell className="font-medium">{user.nickname}</TableCell>
                      <TableCell>{user.firstName || user.lastName ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : "N/A"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.accountType}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="icon" asChild title="Edit User">
                          <Link href={`/admin/users/${encodeURIComponent(user.email)}/edit`}><Edit className="h-4 w-4" /></Link>
                        </Button>
                         <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" title="Delete User" disabled={currentUserDetails?.email === user.email}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the user
                                "{user.nickname}" ({user.email}).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(user.email, user.nickname)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
