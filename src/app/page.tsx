
"use client";

import { useEffect, useState } from "react";
import type { Tournament } from "@/lib/types";
import { getTournaments } from "@/lib/dataService";
import TournamentCard from "@/components/tournaments/TournamentCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, List } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation"; // Added useRouter

export default function DashboardPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true); // Renamed for clarity
  const { currentUserDetails, isLoading: authIsLoading } = useAuth(); // Renamed for clarity
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated and auth is not loading
    if (!authIsLoading && !currentUserDetails) {
      router.push('/login');
    }
  }, [authIsLoading, currentUserDetails, router]);

  useEffect(() => {
    // Only fetch tournaments if the user is authenticated (or if dashboard is public, this check might change)
    if (currentUserDetails) {
      setTournaments(getTournaments());
      setIsLoadingTournaments(false);
    } else if (!authIsLoading && !currentUserDetails) {
      // If redirecting, don't bother loading tournaments
      setIsLoadingTournaments(false);
    }
  }, [currentUserDetails, authIsLoading]);

  const canCreateTournament = currentUserDetails?.accountType === 'Admin' || currentUserDetails?.accountType === 'Owner';

  // Show loading or redirecting message
  if (authIsLoading || (!authIsLoading && !currentUserDetails)) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <p className="text-xl text-muted-foreground">Loading or redirecting...</p>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Available Tournaments</h1>
        {canCreateTournament && (
          <Button asChild>
            <Link href="/admin/tournaments/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Tournament
            </Link>
          </Button>
        )}
      </div>

      {isLoadingTournaments ? (
         <p>Loading tournaments...</p>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-lg shadow">
          <List className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium text-foreground">No tournaments available</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {canCreateTournament ? "Get started by creating a new tournament." : "Check back later for new tournaments."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      )}
    </div>
  );
}
