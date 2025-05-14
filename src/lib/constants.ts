
export const LOCALSTORAGE_KEYS = {
  TOURNAMENTS: "bracketboard_tournaments",
  PLAYERS: "bracketboard_players",
  TEAMS: "bracketboard_teams", // New key for teams
  // Registrations are stored per tournament: `bracketboard_registrations_${tournamentId}`
  REGISTRATIONS_PREFIX: "bracketboard_registrations_", 
};

export const APP_NAME = "BracketBoard";
