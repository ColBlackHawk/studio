
import type { Tournament, Player, RegisteredEntry, TournamentCreation, PlayerCreation, User, AccountType, UserCreation } from "./types";
import { getItem, setItem, removeItem } from "./localStorage";
import { LOCALSTORAGE_KEYS } from "./constants";

// --- User ---
export const getUsers = (): User[] => {
  return getItem<User[]>(LOCALSTORAGE_KEYS.USERS) || [];
};

export const getUserByEmail = (email: string): User | undefined => {
  if (!email) return undefined;
  const users = getUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
};

export const createUser = (userData: UserCreation): User | null => {
  if (!userData.email || !userData.nickname) {
    console.error("Email and Nickname are required to create a user.");
    return null;
  }
  
  const users = getUsers();
  const isAdminEmail = userData.email.toLowerCase() === 'admin@tournamentbracket.com';
  const existingUserIndex = users.findIndex(u => u.email.toLowerCase() === userData.email.toLowerCase());

  let finalUserData: User = {
    email: userData.email,
    nickname: userData.nickname,
    firstName: userData.firstName,
    lastName: userData.lastName,
    accountType: isAdminEmail ? 'Admin' : userData.accountType, // Force Admin for specific email
  };
  
  if (isAdminEmail && userData.nickname !== 'Admin') {
      finalUserData.nickname = 'Admin'; // Force nickname for admin email
  }


  if (existingUserIndex !== -1) {
    // If admin email signs up again or is being explicitly created, update it.
    // For other users, prevent overriding if they exist, unless an explicit updateUser is called.
    if (isAdminEmail) {
        users[existingUserIndex] = finalUserData;
    } else {
        console.error("User with this email already exists. Use updateUser if modification is intended.");
        return users[existingUserIndex]; // Return existing user instead of erroring out for signup flow
    }
  } else {
    users.push(finalUserData);
  }
  
  setItem(LOCALSTORAGE_KEYS.USERS, users);
  return finalUserData;
};

export const updateUser = (email: string, updates: Partial<Omit<User, 'email'>>): User | undefined => {
  let users = getUsers();
  const index = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (index !== -1) {
    // Prevent changing email; email is the identifier.
    const { email: newEmail, ...restOfUpdates } = updates as Partial<User>; 
    users[index] = { ...users[index], ...restOfUpdates };
    setItem(LOCALSTORAGE_KEYS.USERS, users);
    return users[index];
  }
  console.warn(`User with email ${email} not found for update.`);
  return undefined;
};

export const deleteUser = (email: string): boolean => {
  let users = getUsers();
  const initialLength = users.length;
  users = users.filter(u => u.email.toLowerCase() !== email.toLowerCase());
  if (users.length < initialLength) {
    setItem(LOCALSTORAGE_KEYS.USERS, users);
    return true;
  }
  return false;
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

export const getPlayerByEmail = (email: string): Player | undefined => {
  if (!email) return undefined;
  const players = getPlayers();
  return players.find(p => p.email?.toLowerCase() === email.toLowerCase());
}

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

  // Check for duplicate players within this tournament
    const existingPlayerIdsInTournament = new Set<string>();
    registrations.forEach(reg => {
      reg.players.forEach(p => existingPlayerIdsInTournament.add(p.id));
    });

    const duplicates = players.filter(p => existingPlayerIdsInTournament.has(p.id));
    if (duplicates.length > 0) {
      const duplicateNicknames = duplicates.map(d => d.nickname).join(", ");
      throw new Error(`Player(s) "${duplicateNicknames}" are already registered in this tournament.`);
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
    // Also clear matches if all registrations are removed, as the bracket is no longer valid
    const tournament = getTournamentById(tournamentId);
    if (tournament) {
        updateTournament(tournamentId, { ...tournament, matches: [] });
    }
    return true; 
  }
  return false; 
};
