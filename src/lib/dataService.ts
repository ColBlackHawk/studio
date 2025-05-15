
import type { Tournament, Player, RegisteredEntry, TournamentCreation, PlayerCreation, User, AccountType } from "./types";
import { getItem, setItem, removeItem } from "./localStorage";
import { LOCALSTORAGE_KEYS } from "./constants";

// --- User ---
export const getUsers = (): User[] => {
  return getItem<User[]>(LOCALSTORAGE_KEYS.USERS) || [];
};

export const getUserByEmail = (email: string): User | undefined => {
  const users = getUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
};

export const createUser = (userData: {
  email: string;
  nickname: string;
  firstName?: string;
  lastName?: string;
  accountType: AccountType;
}): User | null => {
  if (!userData.email || !userData.nickname) {
    console.error("Email and Nickname are required to create a user.");
    return null;
  }
  if (getUserByEmail(userData.email)) {
    console.error("User with this email already exists.");
    return null;
  }
  const users = getUsers();
  const newUser: User = {
    email: userData.email,
    nickname: userData.nickname,
    firstName: userData.firstName,
    lastName: userData.lastName,
    accountType: userData.accountType,
  };
  users.push(newUser);
  setItem(LOCALSTORAGE_KEYS.USERS, users);
  return newUser;
};


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
  const { matchesInfo, ...restOfData } = tournamentData;
  const newTournament: Tournament = {
    ...restOfData, // ownerId here will be an email
    id: crypto.randomUUID(),
    matches: [], 
  };
  tournaments.push(newTournament);
  setItem(LOCALSTORAGE_KEYS.TOURNAMENTS, tournaments);
  return newTournament;
};

export const updateTournament = (id: string, updates: Partial<Tournament>): Tournament | undefined => {
  let tournaments = getTournaments();
  const index = tournaments.findIndex(t => t.id === id);
  if (index !== -1) {
    const { matchesInfo, ...restOfUpdates } = updates as TournamentCreation & Partial<Tournament>;
    const currentMatches = tournaments[index].matches || [];
    tournaments[index] = {
        ...tournaments[index],
        ...restOfUpdates,
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
    return true;
  }
  return false;
};

// --- Tournament Registrations ---
export const getTournamentRegistrations = (tournamentId: string): RegisteredEntry[] => {
  return getItem<RegisteredEntry[]>(`${LOCALSTORAGE_KEYS.REGISTRATIONS_PREFIX}${tournamentId}`) || [];
};

export const addTournamentRegistration = (tournamentId: string, entryName: string, players: Player[]): RegisteredEntry => {
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

export const removeAllTournamentRegistrations = (tournamentId: string): boolean => {
  const existingRegistrations = getItem<RegisteredEntry[]>(`${LOCALSTORAGE_KEYS.REGISTRATIONS_PREFIX}${tournamentId}`);
  if (existingRegistrations && existingRegistrations.length > 0) {
    removeItem(`${LOCALSTORAGE_KEYS.REGISTRATIONS_PREFIX}${tournamentId}`);
    return true; 
  }
  return false; 
};

