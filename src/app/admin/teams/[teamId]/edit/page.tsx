
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TeamForm from "@/components/teams/TeamForm";
import type { Team } from "@/lib/types";
import { getTeamById, updateTeam } from "@/lib/dataService";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export default function EditTeamPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.teamId as string;
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (teamId) {
      const fetchedTeam = getTeamById(teamId);
      if (fetchedTeam) {
        setTeam(fetchedTeam);
      } else {
        router.push("/admin/teams");
      }
      setIsLoading(false);
    }
  }, [teamId, router]);

  const handleSubmit = (data: Team) => {
     try {
      updateTeam(teamId, data);
       toast({
        title: "Team/Pair Updated",
        description: `"${data.name}" has been successfully updated.`,
      });
      router.push("/admin/teams");
    } catch (error: any) {
      toast({
        title: "Error Updating Team/Pair",
        description: error.message || "Could not update the team/pair.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <p>Loading team data...</p>;
  }

  if (!team) {
    return <p>Team not found.</p>;
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
         <Button variant="outline" size="icon" asChild>
          <Link href="/admin/teams">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Edit Team/Pair: {team.name}</h1>
      </div>
      <TeamForm team={team} onSubmit={handleSubmit} isEditing />
    </div>
  );
}
