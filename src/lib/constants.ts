
export const LOCALSTORAGE_KEYS = {
  TOURNAMENTS: "tournamentbracket_tournaments",
  PLAYERS: "tournamentbracket_players",
  // TEAMS: "bracketboard_teams", // REMOVED
  // Registrations are stored per tournament: `bracketboard_registrations_${tournamentId}`
  REGISTRATIONS_PREFIX: "tournamentbracket_registrations_", 
  CURRENT_USER: "tournamentbracket_currentUser", // For simulated auth
};

export const APP_NAME = "TournamentBracket";
