
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Team, Player } from "@/lib/types";
import { getTeams, deleteTeam as deleteTeamService, getPlayers } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit, Trash2, Users2, ListChecks, Shield, User } from "lucide-react";
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

export default function ManageTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTeamsAndPlayers = () => {
    setTeams(getTeams());
    setPlayers(getPlayers());
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTeamsAndPlayers();
  }, []);

  const handleDeleteTeam = (id: string, name: string) => {
    if (deleteTeamService(id)) {
      fetchTeamsAndPlayers(); // Refresh list
      toast({
        title: "Team/Pair Deleted",
        description: `"${name}" has been successfully deleted.`,
      });
    } else {
      toast({
        title: "Error",
        description: `Failed to delete "${name}".`,
        variant: "destructive",
      });
    }
  };

  const getPlayerNickname = (playerId: string) => {
    return players.find(p => p.id === playerId)?.nickname || "Unknown Player";
  };

  if (isLoading) {
    return <p>Loading teams and players...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Manage Teams & Pairs</h1>
        <Button asChild>
          <Link href="/admin/teams/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Team/Pair
          </Link>
        </Button>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Teams or Pairs Found</CardTitle>
            <CardDescription>
              Create teams or pairs. They can then be registered for tournaments.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-10">
             <ListChecks className="mx-auto h-12 w-12 text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <Card>
           <CardHeader>
            <CardTitle>Defined Teams & Pairs</CardTitle>
            <CardDescription>
              View, edit, or delete teams and pairs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Shield className="inline-block mr-1 h-4 w-4" />Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead><Users2 className="inline-block mr-1 h-4 w-4" />Members</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>{team.type}</TableCell>
                    <TableCell>
                      {team.playerIds.map(playerId => getPlayerNickname(playerId)).join(", ")}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" asChild title="Edit Team/Pair">
                        <Link href={`/admin/teams/${team.id}/edit`}><Edit className="h-4 w-4" /></Link>
                      </Button>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" title="Delete Team/Pair">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the team/pair
                              "{team.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTeam(team.id, team.name)}>
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
