
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PlayerForm from "@/components/players/PlayerForm";
import type { Player } from "@/lib/types";
import { getPlayerById, updatePlayer } from "@/lib/dataService";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function EditPlayerPage() {
  const router = useRouter();
  const params = useParams();
  const playerId = params.playerId as string;
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (playerId) {
      const fetchedPlayer = getPlayerById(playerId);
      if (fetchedPlayer) {
        setPlayer(fetchedPlayer);
      } else {
        router.push("/admin/players");
      }
      setIsLoading(false);
    }
  }, [playerId, router]);

  const handleSubmit = (data: Player) => {
    updatePlayer(playerId, data);
    router.push("/admin/players");
  };

  if (isLoading) {
    return <p>Loading player data...</p>;
  }

  if (!player) {
    return <p>Player not found.</p>;
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
         <Button variant="outline" size="icon" asChild>
          <Link href="/admin/players">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Edit Player: {player.nickname}</h1>
      </div>
      <PlayerForm player={player} onSubmit={handleSubmit} isEditing />
    </div>
  );
}
