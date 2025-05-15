
export type TournamentType = "single" | "double_elimination";
export type ParticipantType = "Player" | "Scotch Doubles" | "Team";

export interface Player {
  id: string;
  nickname: string;
  firstName?: string;
  lastName?: string;
  apaNumber?: string;
  phone?: string;
  email?: string; // Player's email, can be different from app user's email
  ranking?: number;
}

// Represents what is registered for a tournament
export interface RegisteredEntry {
  id: string; // Unique ID for this registration
  tournamentId: string;
  entryName: string; // Player nickname if single, or team name/pair name
  players: Player[]; // List of actual players involved. 1 for Player, 2 for Scotch Doubles, or N for Team
  seed?: number; // Optional: for bracket seeding
}

export interface Match {
  id: string; // Unique ID for this match
  tournamentId: string;
  round: number;
  matchNumberInRound: number;
  bracketType: 'winners' | 'losers' | 'grandFinal' | 'grandFinalReset';
  team1Id?: string;
  team1FeederMatchId?: string;
  team1FeederType?: 'winner' | 'loser';
  team2Id?: string;
  team2FeederMatchId?: string;
  team2FeederType?: 'winner' | 'loser';
  winnerId?: string;
  score?: string;
  isBye?: boolean;
}

export type AccountType = 'Admin' | 'Owner' | 'Player';

export interface User {
  email: string; // Unique identifier for app users
  nickname: string; // Required display name / handle
  password?: string; // Insecure: Plain text password for prototype
  firstName?: string;
  lastName?: string;
  accountType: AccountType; // Role of the user
}

export interface Tournament {
  id: string;
  name: string;
  ownerId: string; // User's email of the tournament creator
  description: string;
  tournamentType: TournamentType;
  participantType: ParticipantType;
  scheduleDateTime: string; // ISO string for date and time
  maxTeams: number; // e.g., 8, 16, 32
  matches?: Match[];
}

export type TournamentCreation = Omit<Tournament, "id" | "matches"> & {
  matchesInfo?: string;
};
export type PlayerCreation = Omit<Player, "id">;

// For creating a new user, email, nickname, password, and accountType must be provided.
export type UserCreation = Required<Pick<User, 'email' | 'nickname' | 'password' | 'accountType'>> & Partial<Omit<User, 'email' | 'nickname' | 'password' | 'accountType'>>;


export interface TeamRegistrationPayload {
  entryName: string;
  playerIds: string[];
}
