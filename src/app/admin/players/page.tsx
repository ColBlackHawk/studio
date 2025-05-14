
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Player } from "@/lib/types";
import { getPlayers, deletePlayer as deletePlayerService } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit, Trash2, Users2, Medal, ListChecks, Mail, Phone } from "lucide-react";
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

export default function ManagePlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchPlayers = () => {
    setPlayers(getPlayers());
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handleDeletePlayer = (id: string, nickname: string) => {
    if (deletePlayerService(id)) {
      fetchPlayers(); // Refresh list
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

  if (isLoading) {
    return <p>Loading players...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Manage Players</h1>
        <Button asChild>
          <Link href="/admin/players/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Player
          </Link>
        </Button>
      </div>

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
            <CardTitle>Registered Players</CardTitle>
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
