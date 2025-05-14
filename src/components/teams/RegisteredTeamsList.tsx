
"use client";

import type { RegisteredEntry } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Users, Shield } from "lucide-react";
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

interface RegisteredTeamsListProps {
  registrations: RegisteredEntry[];
  onRemoveRegistration: (registrationId: string) => void;
  maxTeams: number;
}

export default function RegisteredTeamsList({ registrations, onRemoveRegistration, maxTeams }: RegisteredTeamsListProps) {
  if (registrations.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>No Registrations Yet</CardTitle>
          <CardDescription>Be the first to register for this tournament!</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Registered Teams/Players ({registrations.length}/{maxTeams})</CardTitle>
        <CardDescription>
          List of all entries registered for this tournament.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Shield className="inline-block mr-1 h-4 w-4" />Entry Name</TableHead>
              <TableHead><Users className="inline-block mr-1 h-4 w-4" />Player Nickname(s)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.entryName}</TableCell>
                <TableCell>{entry.players.map(p => p.nickname).join(", ")}</TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Removal</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove "{entry.entryName}" from this tournament?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRemoveRegistration(entry.id)}>
                          Remove
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
  );
}
