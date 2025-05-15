
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
  if (!userData.email || !userData.nickname || !userData.password) {
    console.error("Email, Nickname, and Password are required to create a user.");
    return null;
  }

  const users = getUsers();
  const isAdminEmail = userData.email.toLowerCase() === 'admin@tournamentbracket.com';
  const existingUserIndex = users.findIndex(u => u.email.toLowerCase() === userData.email.toLowerCase());

  let finalUserData: User = {
    email: userData.email,
    nickname: userData.nickname,
    password: userData.password, // Storing plain text password - INSECURE
    firstName: userData.firstName,
    lastName: userData.lastName,
    accountType: isAdminEmail ? 'Admin' : userData.accountType,
  };

  if (isAdminEmail) {
    finalUserData.nickname = 'Admin'; // Force nickname for admin email
    if (finalUserData.password !== 'password'){ // Ensure admin default password if explicitly created
        // In a real scenario, admin password should be set securely, not hardcoded or easily changed here
    }
  }


  if (existingUserIndex !== -1) {
    if (isAdminEmail) {
        users[existingUserIndex] = { ...users[existingUserIndex], ...finalUserData }; // Ensure admin details are updated
    } else {
        console.error("User with this email already exists. Use updateUser if modification is intended.");
        return users[existingUserIndex];
    }
  } else {
    users.push(finalUserData);
  }

  setItem(LOCALSTORAGE_KEYS.USERS, users);
  // Initialize admin user if not present
  const adminUser = users.find(u => u.email.toLowerCase() === 'admin@tournamentbracket.com');
  if (!adminUser) {
    users.push({
      email: 'admin@tournamentbracket.com',
      nickname: 'Admin',
      password: 'password', // Default admin password - INSECURE
      accountType: 'Admin',
    });
    setItem(LOCALSTORAGE_KEYS.USERS, users);
  }


  return finalUserData;
};

export const updateUser = (email: string, updates: Partial<Omit<User, 'email'>>): User | undefined => {
  let users = getUsers();
  const index = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (index !== -1) {
    // Prevent changing email; email is the identifier.
    const { email: newEmail, ...restOfUpdates } = updates as Partial<User>;
    // If password is being updated and is empty, retain old password. Otherwise, update.
    // For this prototype, if `restOfUpdates.password` is provided (even if empty string for "remove"), it updates.
    // A more robust system would handle empty password updates carefully (e.g., require "current password").
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

// Ensure default admin exists on app load if no users are present at all
(() => {
  if (typeof window !== 'undefined') { // Only run on client
    const users = getUsers();
    if (users.length === 0) {
      setItem(LOCALSTORAGE_KEYS.USERS, [{
        email: 'admin@tournamentbracket.com',
        nickname: 'Admin',
        password: 'password', // Default admin password - INSECURE
        accountType: 'Admin',
      }]);
    } else {
      const adminUser = users.find(u => u.email.toLowerCase() === 'admin@tournamentbracket.com');
      if (!adminUser) {
        users.push({
          email: 'admin@tournamentbracket.com',
          nickname: 'Admin',
          password: 'password', // Default admin password - INSECURE
          accountType: 'Admin',
        });
        setItem(LOCALSTORAGE_KEYS.USERS, users);
      } else {
        // Ensure existing admin user has a password if it's missing (e.g. from older state)
        // And ensure their account type is Admin and nickname is Admin
        let adminUpdated = false;
        if (!adminUser.password) {
          adminUser.password = 'password';
          adminUpdated = true;
        }
        if (adminUser.accountType !== 'Admin') {
            adminUser.accountType = 'Admin';
            adminUpdated = true;
        }
        if (adminUser.nickname !== 'Admin') {
            adminUser.nickname = 'Admin';
            adminUpdated = true;
        }
        if (adminUpdated) {
            setItem(LOCALSTORAGE_KEYS.USERS, users);
        }
      }
    }
  }
})();
