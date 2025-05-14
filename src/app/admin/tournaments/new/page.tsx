"use client";

import TournamentForm from "@/components/tournaments/TournamentForm";
import type { TournamentCreation } from "@/lib/types";
import { createTournament } from "@/lib/dataService";
import { useRouter } from "next/navigation"; // Corrected import
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NewTournamentPage() {
  const router = useRouter();

  const handleSubmit = (data: TournamentCreation) => {
    createTournament(data);
    router.push("/admin/tournaments"); // Navigate back to the list after creation
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/tournaments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Create New Tournament</h1>
      </div>
      <TournamentForm onSubmit={handleSubmit} />
    </div>
  );
}