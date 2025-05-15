# BracketBoard
This is a Tournament Bracket Board app developed with the assistance of Firebase Studio and Gemini.

"Create a Next.js and React application called 'BracketBoard' for managing tournaments. The app should provide a user-friendly interface for creating, managing, and participating in tournaments, primarily focusing on bracket generation and match tracking.

Core Features & Entities:

Tournament Management:

Implement full CRUD (Create, Read, Update, Delete) functionality for tournaments.
Tournament details should include: a unique ID, name, owner/organizer name, a detailed description, tournament type (Single Elimination, Double Elimination), participant type (Player, Scotch Doubles, Team), scheduled date and time, and a maximum number of entries (e.g., 8, 16, 32, up to 128).
Each tournament should store an array of its generated matches.
Player Management:

Implement CRUD for a global list of players.
Player details should include: a unique ID, a required nickname, and optional fields for first name, last name, APA number, phone number, and email address, and a numerical ranking.
Tournament Registration System:

Allow entries (players, pairs, or teams) to be registered for specific tournaments.
Based on the tournament's participantType:
Player: Register a single player; the entry name defaults to the player's nickname.
Scotch Doubles: Register two players; the entry name should be auto-generated (e.g., "Player1 Nickname & Player2 Nickname").
Team: Register 1 or 2 players under a custom, user-provided team name.
Validate registrations to prevent the same player from being entered multiple times in the same tournament.
Enforce the tournament's maximum entry limit.
Provide functionality to remove individual registrations or clear all registrations for a tournament, with confirmation dialogs.
Bracket Generation & Logic:

Single Elimination: Generate brackets that correctly handle play-in rounds for participant counts that are not a power of two, ensuring winners advance to a balanced main bracket.
Double Elimination:
Generate a Winners' Bracket (WB) that includes play-in rounds if necessary.
Generate a structured Losers' Bracket (LB) where WB losers are systematically fed into LB rounds to meet advancing LB winners. This includes pairing losers of WB play-ins with losers from the first main WB round.
Generate a Grand Final match, with a potential reset match if the LB winner wins the first Grand Final encounter.
Implement logic for advancing winners through both single and double elimination brackets. When a winner is selected, subsequent matches should update automatically.
Implement logic to clear subsequent match data if a winner selection is undone.
Handle byes appropriately during generation and advancement in both bracket types.
All bracket and match data should be persisted.
User Interface & Experience:

Layout & Navigation:

A main layout with a header (displaying the app name "BracketBoard" and a logo) and a persistent sidebar for navigation.
Sidebar navigation links: Dashboard, Manage Tournaments, Manage Players.
The layout should be responsive, with a mobile-friendly menu (e.g., sheet-based sidebar).
Pages:

Dashboard (/): Display a grid of TournamentCard components for all available tournaments, showing key details and links to register or view details. Handle the case of no tournaments.
Admin - Manage Tournaments (/admin/tournaments): List existing tournaments with options to edit, delete (with confirmation), or view. Include a button to create a new tournament.
Admin - New/Edit Tournament Form: A comprehensive form for tournament CRUD operations, including inputs for all tournament fields and selection for types.
Admin - Manage Players (/admin/players): List existing players with options to edit or delete (with confirmation). Include a button to add a new player.
Admin - New/Edit Player Form: A form for player CRUD operations.
Tournament Detail Page (/tournaments/[id]): Display detailed information about a selected tournament. Include a "Generate/Reset Bracket" button (with confirmation) and links to "Entry Registration," "Match Schedule," and "View Bracket" (buttons dynamically enabled/disabled based on bracket status).
Tournament Registration Page (/tournaments/[id]/register):
Display tournament info.
A form to register based on participantType, allowing selection of players from the global player list.
A list of currently registered entries for that tournament, with options to remove individual entries or clear all.
Tournament Bracket Page (/tournaments/[id]/bracket):
Display the interactive tournament bracket.
For double elimination, render distinct sections for Winners' Bracket, Losers' Bracket, and Grand Final(s).
Use a MatchCard component for each match, showing participant names (defaulting to nickname for individual players), and allowing users to click to select a winner (and click again to clear). Include an optional input for match scores.
Winner selections should persist and update the bracket display.
Tournament Match Schedule Page (/tournaments/[id]/schedule):
Display a table listing all scheduled matches for the tournament, including round, participants, winner, and score. For DE, also indicate bracket type (Winners', Losers', etc.).
This page should automatically refresh its data if changes are made to the bracket (e.g., on window focus).
Technical Specifications:

Stack: Next.js (App Router), React, TypeScript.
Styling: Tailwind CSS and ShadCN UI components. Implement a consistent, modern theme (e.g., a light base with Dark Slate Gray as primary text/elements and Teal as an accent color, defined in globals.css using HSL CSS variables).
Icons: Use lucide-react for all iconography.
Data Persistence: Utilize browser localStorage for all application data (tournaments, players, registrations, match states). Implement robust dataService.ts for these operations.
User Feedback: Employ toasts (e.g., using useToast hook and Toaster component) for notifications related to CRUD actions, errors, and successful operations.
Code Quality: Ensure clean, well-organized, and maintainable code with functional components and React Hooks. Implement proper error handling and user-friendly messages.
State Management: Primarily use React's built-in state management (useState, useEffect, useCallback), passing props and callbacks as needed.
Forms: Use react-hook-form with zod for form validation.
Utilities: Use clsx and tailwind-merge for constructing CSS class names.
