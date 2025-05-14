
import type { Tournament, Player, RegisteredEntry, TournamentCreation, PlayerCreation, Team, TeamCreation } from "./types";
import { getItem, setItem, removeItem } from "./localStorage";
import { LOCALSTORAGE_KEYS } from "./constants";

// --- Tournament ---
export const getTournaments = (): Tournament[] => {
  return getItem<Tournament[]>(LOCALSTORAGE_KEYS.TOURNAMENTS) || [];
};

export const getTournamentById = (id: string): Tournament | undefined => {
  const tournaments = getTournaments();
  return tournaments.find(t => t.id === id);
};

export const createTournament = (tournamentData: TournamentCreation): Tournament => {
  const tournaments = getTournaments();
  // Remove matchesInfo before saving if it exists
  const { matchesInfo, ...restOfData } = tournamentData;
  const newTournament: Tournament = {
    ...restOfData,
    id: crypto.randomUUID(), 
    matches: [], // Initialize with empty matches array
  };
  tournaments.push(newTournament);
  setItem(LOCALSTORAGE_KEYS.TOURNAMENTS, tournaments);
  return newTournament;
};

export const updateTournament = (id: string, updates: Partial<Tournament>): Tournament | undefined => {
  let tournaments = getTournaments();
  const index = tournaments.findIndex(t => t.id === id);
  if (index !== -1) {
    // If matchesInfo is part of updates, handle it; otherwise, just spread updates
    const { matchesInfo, ...restOfUpdates } = updates as TournamentCreation & Partial<Tournament>;
    
    // Ensure existing matches are preserved if not explicitly being updated
    const currentMatches = tournaments[index].matches || [];
    
    tournaments[index] = { 
        ...tournaments[index], 
        ...restOfUpdates,
        // Explicitly handle 'matches' update, don't let it be accidentally overridden by undefined from form
        matches: updates.matches !== undefined ? updates.matches : currentMatches 
    };
    setItem(LOCALSTORAGE_KEYS.TOURNAMENTS, tournaments);
    return tournaments[index];
  }
  return undefined;
};

export const deleteTournament = (id: string): boolean => {
  let tournaments = getTournaments();
  const initialLength = tournaments.length;
  tournaments = tournaments.filter(t => t.id !== id);
  if (tournaments.length < initialLength) {
    setItem(LOCALSTORAGE_KEYS.TOURNAMENTS, tournaments);
    // Also remove associated registrations
    removeItem(`${LOCALSTORAGE_KEYS.REGISTRATIONS_PREFIX}${id}`);
    return true;
  }
  return false;
};

// --- Player ---
export const getPlayers = (): Player[] => {
  return getItem<Player[]>(LOCALSTORAGE_KEYS.PLAYERS) || [];
};

export const getPlayerById = (id: string): Player | undefined => {
  const players = getPlayers();
  return players.find(p => p.id === id);
};

export const createPlayer = (playerData: PlayerCreation): Player => {
  const players = getPlayers();
  const newPlayer: Player = { ...playerData, id: crypto.randomUUID() };
  players.push(newPlayer);
  setItem(LOCALSTORAGE_KEYS.PLAYERS, players);
  return newPlayer;
};

export const updatePlayer = (id: string, updates: Partial<Player>): Player | undefined => {
  let players = getPlayers();
  const index = players.findIndex(p => p.id === id);
  if (index !== -1) {
    players[index] = { ...players[index], ...updates };
    setItem(LOCALSTORAGE_KEYS.PLAYERS, players);
    return players[index];
  }
  return undefined;
};

export const deletePlayer = (id: string): boolean => {
  let players = getPlayers();
  const initialLength = players.length;
  players = players.filter(p => p.id !== id);
  if (players.length < initialLength) {
    setItem(LOCALSTORAGE_KEYS.PLAYERS, players);
    // TODO: Consider implications for existing tournament registrations if a player is deleted.
    // This might require cascading deletes or warnings. For now, it's a simple delete.
    return true;
  }
  return false;
};

// --- Team ---
export const getTeams = (): Team[] => {
  return getItem<Team[]>(LOCALSTORAGE_KEYS.TEAMS) || [];
};

export const getTeamById = (id: string): Team | undefined => {
  const teams = getTeams();
  return teams.find(t => t.id === id);
};

export const createTeam = (teamData: TeamCreation): Team => {
  const teams = getTeams();
  if (teamData.playerIds.length === 0) {
    throw new Error("A team must have at least one player.");
  }
  if (teamData.type === "Scotch Doubles" && teamData.playerIds.length !== 2) {
    throw new Error("Scotch Doubles entries must have exactly 2 players.");
  }
  // Add more validation for 'Team' type player count if needed, e.g. min/max
  
  const newTeam: Team = { ...teamData, id: crypto.randomUUID() };
  teams.push(newTeam);
  setItem(LOCALSTORAGE_KEYS.TEAMS, teams);
  return newTeam;
};

export const updateTeam = (id: string, updates: Partial<Team>): Team | undefined => {
  let teams = getTeams();
  const index = teams.findIndex(t => t.id === id);
  if (index !== -1) {
    const updatedTeam = { ...teams[index], ...updates };
    if (updatedTeam.playerIds.length === 0) {
      throw new Error("A team must have at least one player.");
    }
    if (updatedTeam.type === "Scotch Doubles" && updatedTeam.playerIds.length !== 2) {
      throw new Error("Scotch Doubles entries must have exactly 2 players.");
    }
    teams[index] = updatedTeam;
    setItem(LOCALSTORAGE_KEYS.TEAMS, teams);
    return teams[index];
  }
  return undefined;
};

export const deleteTeam = (id: string): boolean => {
  let teams = getTeams();
  const initialLength = teams.length;
  teams = teams.filter(t => t.id !== id);
  if (teams.length < initialLength) {
    setItem(LOCALSTORAGE_KEYS.TEAMS, teams);
    // TODO: Consider implications for existing tournament registrations if a team is deleted.
    return true;
  }
  return false;
};


// --- Tournament Registrations ---
export const getTournamentRegistrations = (tournamentId: string): RegisteredEntry[] => {
  return getItem<RegisteredEntry[]>(`${LOCALSTORAGE_KEYS.REGISTRATIONS_PREFIX}${tournamentId}`) || [];
};

export const addTournamentRegistration = (tournamentId: string, entryName: string, players: Player[], teamId?: string): RegisteredEntry => {
  const registrations = getTournamentRegistrations(tournamentId);
  const tournament = getTournamentById(tournamentId);

  if (!tournament) {
    throw new Error("Tournament not found for registration.");
  }
  
  if (registrations.length >= tournament.maxTeams) {
    throw new Error("Maximum number of teams registered for this tournament.");
  }

  const newRegistration: RegisteredEntry = {
    id: crypto.randomUUID(),
    tournamentId,
    entryName,
    players,
    teamId, // Store the ID of the pre-defined team if applicable
  };
  registrations.push(newRegistration);
  setItem(`${LOCALSTORAGE_KEYS.REGISTRATIONS_PREFIX}${tournamentId}`, registrations);
  return newRegistration;
};

export const removeTournamentRegistration = (tournamentId: string, registrationId: string): boolean => {
  let registrations = getTournamentRegistrations(tournamentId);
  const initialLength = registrations.length;
  registrations = registrations.filter(r => r.id !== registrationId);
  if (registrations.length < initialLength) {
    setItem(`${LOCALSTORAGE_KEYS.REGISTRATIONS_PREFIX}${tournamentId}`, registrations);
    return true;
  }
  return false;
};
