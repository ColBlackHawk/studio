
"use client";

import TeamForm from "@/components/teams/TeamForm";
import type { TeamCreation } from "@/lib/types";
import { createTeam } from "@/lib/dataService";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export default function NewTeamPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = (data: TeamCreation) => {
    try {
      createTeam(data);
      toast({
        title: "Team/Pair Created",
        description: `"${data.name}" has been successfully created.`,
      });
      router.push("/admin/teams");
    } catch (error: any) {
      toast({
        title: "Error Creating Team/Pair",
        description: error.message || "Could not create the team/pair.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/teams">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Add New Team/Pair</h1>
      </div>
      <TeamForm onSubmit={handleSubmit} />
    </div>
  );
}
