
export type TournamentType = "single" | "double_elimination";
// "Player" means individuals, "Scotch Doubles" means pairs, "Team" means named teams of 2 for now.
export type ParticipantType = "Player" | "Scotch Doubles" | "Team"; 

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

// Represents a pre-defined team or pair
export interface Team {
  id: string;
  name: string; // Team or Pair name
  type: "Scotch Doubles" | "Team"; // Specifies if it's a pair or a general team
  playerIds: string[]; // Array of Player IDs belonging to this team
}

// Represents what is registered for a tournament
export interface RegisteredEntry {
  id: string; // Unique ID for this registration
  tournamentId: string;
  entryName: string; // Player nickname if single, or team name/pair name
  players: Player[]; // List of actual players involved. 1 for Player, 2 for Scotch Doubles, or N for Team
  seed?: number; // Optional: for bracket seeding
  teamId?: string; // Optional: if this entry represents a pre-defined team
}

export interface Match {
  id: string; // Unique ID for this match
  tournamentId: string;
  round: number; // Round number within its specific bracket (winners, losers)
  matchNumberInRound: number; // Order within that round
  bracketType: 'winners' | 'losers' | 'grandFinal' | 'grandFinalReset'; // Type of bracket this match belongs to
  team1Id?: string; // ID of RegisteredEntry, or undefined if TBD/Bye
  team2Id?: string; // ID of RegisteredEntry, or undefined if TBD/Bye
  winnerId?: string; // ID of RegisteredEntry who won this match
  score?: string; // e.g., "2-1", "W-F"
  isBye?: boolean; // If true, team1Id (if present) auto-advances. team2Id should be undefined.
  team1FeederMatchId?: string; // ID of the match in the PREVIOUS round that feeds team1 slot
  team2FeederMatchId?: string; // ID of the match in the PREVIOUS round that feeds team2 slot
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
export type TeamCreation = Omit<Team, "id">;


// Represents the structure of a team registration payload
export interface TeamRegistrationPayload {
  entryName: string; // Team Name if participantType is 'team', or main player's nickname / pair name
  playerIds: string[]; // IDs of players from the global player list
  teamId?: string; // ID of the pre-defined team being registered, if applicable
}
