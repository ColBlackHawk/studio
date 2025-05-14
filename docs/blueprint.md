# **App Name**: BracketBoard

## Core Features:

- Tournament Dashboard: Display a dashboard showing available tournaments, their types (single/scotch double), schedules, descriptions, and registered team counts. Navigation links to specific tournament details.
- Tournament Detail View: Display detailed information for a selected tournament, including team registration, match schedule, and bracket links.
- Team Registration: Form to register teams or players based on tournament type with a search field for registered players or teams.  Dynamically adjusts input fields. Display list of registered teams.
- Match Schedules: Displays the match schedules. If tournamentId is provided, show schedule for that tournament, otherwise show all schedules.
- Bracket Visualization: Dynamically generates visual brackets (single or simplified double elimination for up to 32 teams) based on registered teams. Allows interactive winner selection. Bracket state (winners/scores) are in-memory and not persisted.

## Style Guidelines:

- Primary color: Dark slate gray (#2F4F4F) for a sophisticated, sporty look.
- Secondary color: Light gray (#D3D3D3) for a clean, neutral background.
- Accent: Teal (#008080) to highlight interactive elements and important information.
- Use a grid-based layout to organize the dashboard and tournament details.
- Use simple, clean icons for tournament types, navigation, and actions.
- Subtle transitions and animations to enhance the user experience when navigating and interacting with the bracket.