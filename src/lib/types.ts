export type TournamentType = "single" | "scotch_double";
export type ParticipantType = "player" | "team"; // 'player' means individuals/pairs, 'team' means named teams

export interface Player {
  id: string;
  name: string;
  ranking?: number;
}

// Represents what is registered for a tournament
export interface RegisteredEntry {
  id: string; // Unique ID for this registration
  tournamentId: string;
  entryName: string; // Player name if single, or team name
  players: Player[]; // List of actual players involved. 1 for single, 2 for scotch_double/team
  seed?: number;
}

export interface Match {
  id: string;
  round: number;
  matchNumberInRound: number;
  team1Id?: string; // ID of RegisteredEntry
  team2Id?: string; // ID of RegisteredEntry
  winnerId?: string; // ID of RegisteredEntry
  score?: string; // e.g., "2-1"
  isPlaceholder?: boolean; // For bracket UI
}

export interface Tournament {
  id: string;
  name: string;
  owner: string; // User ID or name
  description: string;
  tournamentType: TournamentType;
  participantType: ParticipantType;
  scheduleDateTime: string; // ISO string for date and time
  maxTeams: number; // e.g., 8, 16, 32
  matches?: Match[]; // Optional: schedule can be generated or manually input
  // Consider adding: status: 'upcoming' | 'ongoing' | 'completed'
}

// For forms, use Partial<T> for edits and Omit<T, 'id'> for creations
export type TournamentCreation = Omit<Tournament, "id" | "matches">;
export type PlayerCreation = Omit<Player, "id">;

// Represents the structure of a team registration payload
export interface TeamRegistrationPayload {
  entryName: string; // Team Name if participantType is 'team', or main player's name
  playerIds: string[]; // IDs of players from the global player list
}