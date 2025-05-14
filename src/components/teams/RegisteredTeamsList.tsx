
"use client";

import type { RegisteredEntry, ParticipantType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Users, Shield, User, Users2 } from "lucide-react";
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
  participantType: ParticipantType;
}

export default function RegisteredTeamsList({ registrations, onRemoveRegistration, maxTeams, participantType }: RegisteredTeamsListProps) {
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

  const getEntryIcon = () => {
    switch(participantType) {
      case "Player": return <User className="inline-block mr-1 h-4 w-4" />;
      case "Scotch Doubles": return <Users2 className="inline-block mr-1 h-4 w-4" />;
      case "Team": return <Shield className="inline-block mr-1 h-4 w-4" />;
      default: return <Shield className="inline-block mr-1 h-4 w-4" />;
    }
  };
  
  const entryNameLabel = participantType === "Player" ? "Player Nickname" : 
                         participantType === "Scotch Doubles" ? "Pair Name" : 
                         "Team Name";


  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Registered Entries ({registrations.length}/{maxTeams})</CardTitle>
        <CardDescription>
          List of all entries registered for this tournament.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{getEntryIcon()}{entryNameLabel}</TableHead>
              <TableHead><Users className="inline-block mr-1 h-4 w-4" />Player(s)</TableHead>
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
