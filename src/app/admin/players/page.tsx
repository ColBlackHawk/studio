
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Player, PlayerCreation, User } from "@/lib/types";
import { getPlayers, deletePlayer as deletePlayerService, createPlayer, getUsers as getUsersService, getPlayerByEmail } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, Edit, Trash2, Users2, Medal, ListChecks, Mail, Phone, UserPlus, Search } from "lucide-react";
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

export default function ManagePlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentUserDetails, isLoading: authIsLoading } = useAuth();
  const router = useRouter();

  const [allAppUsers, setAllAppUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!authIsLoading && (!currentUserDetails || !['Admin', 'Owner'].includes(currentUserDetails.accountType))) {
      toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
      router.push("/");
    } else {
      fetchPlayers();
      if (currentUserDetails?.accountType === 'Admin') {
        setAllAppUsers(getUsersService());
      }
    }
  }, [currentUserDetails, authIsLoading, router, toast]);

  useEffect(() => {
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      setFilteredUsers(
        allAppUsers.filter(user =>
          user.nickname.toLowerCase().includes(lowerSearchTerm) ||
          user.email.toLowerCase().includes(lowerSearchTerm)
        )
      );
    } else {
      setFilteredUsers([]);
    }
  }, [searchTerm, allAppUsers]);

  const fetchPlayers = () => {
    setPlayers(getPlayers());
    setIsLoading(false);
  };

  const handleDeletePlayer = (id: string, nickname: string) => {
    if (deletePlayerService(id)) {
      fetchPlayers();
      toast({
        title: "Player Deleted",
        description: `Player "${nickname}" has been successfully deleted.`,
      });
    } else {
      toast({
        title: "Error",
        description: `Failed to delete player "${nickname}".`,
        variant: "destructive",
      });
    }
  };

  const handleAddUserAsPlayer = (user: User) => {
    if (!user.email) {
      toast({ title: "Error", description: "Selected user does not have an email address.", variant: "destructive" });
      return;
    }
    const existingPlayer = getPlayerByEmail(user.email);
    if (existingPlayer) {
      toast({
        title: "Player Exists",
        description: `A player profile already exists for ${user.nickname} (linked to email ${user.email}). Nickname: ${existingPlayer.nickname}`,
        variant: "default",
      });
      return;
    }

    const newPlayerData: PlayerCreation = {
      nickname: user.nickname,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      // APA number and ranking will be empty by default
    };

    const created = createPlayer(newPlayerData);
    if (created) {
      toast({
        title: "Player Added",
        description: `${user.nickname} has been added as a player.`,
      });
      fetchPlayers(); // Refresh player list
      setSearchTerm(""); // Clear search
    } else {
      toast({ title: "Error", description: `Failed to add ${user.nickname} as a player.`, variant: "destructive" });
    }
  };


  if (isLoading || authIsLoading) {
    return <p>Loading players...</p>;
  }
  if (!currentUserDetails || !['Admin', 'Owner'].includes(currentUserDetails.accountType)) {
    return <p>Redirecting...</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Manage Players</h1>
        <Button asChild>
          <Link href="/admin/players/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Player Manually
          </Link>
        </Button>
      </div>

      {currentUserDetails?.accountType === 'Admin' && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Add Existing User as Player</CardTitle>
            <CardDescription>Search for an app user by nickname or email to add them to the player database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search users by nickname or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchTerm && filteredUsers.length > 0 && (
              <ScrollArea className="h-[200px] border rounded-md p-2">
                <div className="space-y-2">
                  {filteredUsers.map(user => (
                    <div key={user.email} className="flex items-center justify-between p-2 hover:bg-muted rounded-md">
                      <div>
                        <p className="font-medium">{user.nickname}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Button size="sm" onClick={() => handleAddUserAsPlayer(user)}>
                        <UserPlus className="mr-2 h-4 w-4" /> Add as Player
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            {searchTerm && filteredUsers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No users found matching "{searchTerm}".</p>
            )}
          </CardContent>
        </Card>
      )}


      {players.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Players Found</CardTitle>
            <CardDescription>
              Add players to the database. They can then be registered for tournaments.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-10">
             <ListChecks className="mx-auto h-12 w-12 text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <Card>
           <CardHeader>
            <CardTitle>Registered Players List</CardTitle>
            <CardDescription>
              View, edit, or delete players from the central database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Users2 className="inline-block mr-1 h-4 w-4" />Nickname</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead><Mail className="inline-block mr-1 h-4 w-4" />Email</TableHead>
                  <TableHead><Phone className="inline-block mr-1 h-4 w-4" />Phone</TableHead>
                  <TableHead><Medal className="inline-block mr-1 h-4 w-4" />Ranking</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium">{player.nickname}</TableCell>
                    <TableCell>{player.firstName || player.lastName ? `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim() : "N/A"}</TableCell>
                    <TableCell>{player.email ?? "N/A"}</TableCell>
                    <TableCell>{player.phone ?? "N/A"}</TableCell>
                    <TableCell>{player.ranking ?? "N/A"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" asChild title="Edit Player">
                        <Link href={`/admin/players/${player.id}/edit`}><Edit className="h-4 w-4" /></Link>
                      </Button>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" title="Delete Player">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the player
                              "{player.nickname}". They might still appear in past tournament records if not handled.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeletePlayer(player.id, player.nickname)}>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

