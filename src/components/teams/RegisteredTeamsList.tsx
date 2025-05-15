
"use client";

import type { RegisteredEntry, ParticipantType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Users, Shield, User, Users2, FileSignature, XCircle } from "lucide-react";
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
  onClearAllRegistrations: () => void;
  maxTeams: number;
  participantType: ParticipantType;
}

export default function RegisteredTeamsList({ registrations, onRemoveRegistration, onClearAllRegistrations, maxTeams, participantType }: RegisteredTeamsListProps) {
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

  let firstColumnHeader = "Entry Name";
  let secondColumnHeader = "Player(s)";
  let firstColumnIcon = <Shield className="inline-block mr-1 h-4 w-4" />;
  let secondColumnIcon = <Users className="inline-block mr-1 h-4 w-4" />;

  if (participantType === "Player") {
    firstColumnHeader = "Player Nickname";
    firstColumnIcon = <User className="inline-block mr-1 h-4 w-4" />;
    secondColumnHeader = "Full Name";
    secondColumnIcon = <FileSignature className="inline-block mr-1 h-4 w-4" />;
  } else if (participantType === "Scotch Doubles") {
    firstColumnHeader = "Pair Name";
    firstColumnIcon = <Users2 className="inline-block mr-1 h-4 w-4" />;
    secondColumnHeader = "Players"; // Nicknames of the pair
    secondColumnIcon = <Users className="inline-block mr-1 h-4 w-4" />;
  } else if (participantType === "Team") {
    firstColumnHeader = "Team Name";
    firstColumnIcon = <Shield className="inline-block mr-1 h-4 w-4" />;
    secondColumnHeader = "Players"; // Nicknames of team members
    secondColumnIcon = <Users className="inline-block mr-1 h-4 w-4" />;
  }


  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row justify-between items-center">
        <div>
          <CardTitle>Registered Entries ({registrations.length}/{maxTeams})</CardTitle>
          <CardDescription>
            List of all entries registered for this tournament.
          </CardDescription>
        </div>
        {registrations.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <XCircle className="mr-2 h-4 w-4" /> Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently remove all
                  ({registrations.length}) registered entries from this tournament.
                  This will also clear any existing bracket progress.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onClearAllRegistrations}>
                  Yes, Clear All Entries
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{firstColumnIcon}{firstColumnHeader}</TableHead>
              <TableHead>{secondColumnIcon}{secondColumnHeader}</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations.map((entry) => {
              let firstColumnDisplayValue = entry.entryName;
              if (participantType === "Player" && entry.players && entry.players.length > 0) {
                firstColumnDisplayValue = entry.players[0].nickname || entry.entryName; // Prioritize direct nickname
              }

              return (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{firstColumnDisplayValue}</TableCell>
                  <TableCell>
                    {participantType === "Player" && entry.players.length > 0
                      ? `${entry.players[0].firstName || ''} ${entry.players[0].lastName || ''}`.trim() || "N/A"
                      : entry.players.map(p => p.nickname).join(", ")}
                  </TableCell>
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
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
