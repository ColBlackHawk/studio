
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { getTournaments, deleteTournament as deleteTournamentService } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit, Trash2, Eye, Users, CalendarDays, ListChecks } from "lucide-react";
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

export default function ManageTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTournaments = () => {
    setTournaments(getTournaments());
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const handleDeleteTournament = (id: string, name: string) => {
    if (deleteTournamentService(id)) {
      fetchTournaments(); // Refresh list
      toast({
        title: "Tournament Deleted",
        description: `Tournament "${name}" has been successfully deleted.`,
      });
    } else {
      toast({
        title: "Error",
        description: `Failed to delete tournament "${name}".`,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <p>Loading tournaments...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Manage Tournaments</h1>
        <Button asChild>
          <Link href="/admin/tournaments/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Tournament
          </Link>
        </Button>
      </div>

      {tournaments.length === 0 ? (
         <Card>
          <CardHeader>
            <CardTitle>No Tournaments Found</CardTitle>
            <CardDescription>
              Get started by creating a new tournament.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-10">
             <ListChecks className="mx-auto h-12 w-12 text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Existing Tournaments</CardTitle>
            <CardDescription>
              View, edit, or delete your tournaments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Participant Type</TableHead>
                  <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4" />Date</TableHead>
                  <TableHead><Users className="inline-block mr-1 h-4 w-4" />Max Entries</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tournaments.map((tournament) => (
                  <TableRow key={tournament.id}>
                    <TableCell className="font-medium">{tournament.name}</TableCell>
                    <TableCell className="capitalize">{tournament.tournamentType.replace("_", " ")}</TableCell>
                    <TableCell>{tournament.participantType}</TableCell>
                    <TableCell>{new Date(tournament.scheduleDateTime).toLocaleDateString()}</TableCell>
                    <TableCell>{tournament.maxTeams}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" asChild title="View Details">
                        <Link href={`/tournaments/${tournament.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="outline" size="icon" asChild title="Edit Tournament">
                        <Link href={`/admin/tournaments/${tournament.id}/edit`}><Edit className="h-4 w-4" /></Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" title="Delete Tournament">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the tournament
                              "{tournament.name}" and all its associated data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTournament(tournament.id, tournament.name)}>
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
