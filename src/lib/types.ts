
export type TournamentType = "single" | "scotch_double";
export type ParticipantType = "player" | "team"; // 'player' means individuals/pairs, 'team' means named teams

export interface Player {
  id: string;
  nickname: string; // Was 'name', now 'nickname' and is required
  firstName?: string;
  lastName?: string;
  apaNumber?: string;
  phone?: string;
  email?: string;
  ranking?: number;
}

// Represents what is registered for a tournament
export interface RegisteredEntry {
  id: string; // Unique ID for this registration
  tournamentId: string;
  entryName: string; // Player nickname if single, or team name
  players: Player[]; // List of actual players involved. 1 for single, 2 for scotch_double/team
  seed?: number; // Optional: for bracket seeding
}

export interface Match {
  id: string; // Unique ID for this match
  round: number; // e.g., 1, 2, 3... (1-indexed)
  matchNumberInRound: number; // e.g., 1, 2 for round 1; 1 for round 2 (1-indexed)
  team1Id?: string; // ID of RegisteredEntry, or undefined if TBD/Bye
  team2Id?: string; // ID of RegisteredEntry, or undefined if TBD/Bye
  winnerId?: string; // ID of RegisteredEntry who won this match
  score?: string; // e.g., "2-1", "W-F"
  isBye?: boolean; // If true, team1Id (if present) auto-advances. team2Id should be undefined.
  // Optional: for display convenience, could be populated dynamically
  // team1Name?: string; // Resolved name of team1Id
  // team2Name?: string; // Resolved name of team2Id
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
export type TournamentCreation = Omit<Tournament, "id" | "matches"> & { matchesInfo?: string }; // matchesInfo for form
export type PlayerCreation = Omit<Player, "id">;

// Represents the structure of a team registration payload
export interface TeamRegistrationPayload {
  entryName: string; // Team Name if participantType is 'team', or main player's nickname
  playerIds: string[]; // IDs of players from the global player list
}
