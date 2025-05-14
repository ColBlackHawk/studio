
'use server';
/**
 * @fileOverview Utility functions for generating and managing tournament brackets.
 *
 * - generateSingleEliminationBracket - Creates initial matches for a single elimination bracket.
 * - advanceWinner - Updates matches when a winner is selected.
 */
import type { Match, RegisteredEntry, Tournament } from './types';

// Helper to get the next power of 2
const getNextPowerOfTwo = (n: number): number => {
  if (n <= 0) return 0;
  let power = 1;
  while (power < n) {
    power *= 2;
  }
  return power;
};

export const generateSingleEliminationBracket = async (
  tournamentId: string,
  registrations: RegisteredEntry[],
  maxTeams: number // Use tournament.maxTeams to determine bracket size
): Promise<Match[]> => {
  const matches: Match[] = [];
  if (registrations.length < 2) {
    // Not enough players to form a bracket
    return [];
  }

  // Determine bracket size (next power of 2 based on maxTeams or actual registrations if less)
  // For simplicity, we'll base it on maxTeams to ensure a full bracket structure if possible.
  // Or, if maxTeams is large but registrations are few, use registrations.
  const bracketSize = getNextPowerOfTwo(Math.min(registrations.length, maxTeams));
  const numberOfByes = bracketSize - registrations.length;

  // Shuffle registrations for random pairings (optional, can also use seed or registration order)
  const shuffledRegistrations = [...registrations].sort(() => Math.random() - 0.5);

  let firstRoundMatchesCount = bracketSize / 2;
  let registrationIndex = 0;

  // Create first round matches
  for (let i = 0; i < firstRoundMatchesCount; i++) {
    const matchId = crypto.randomUUID();
    let team1Id: string | undefined = undefined;
    let team2Id: string | undefined = undefined;
    let isBye = false;

    if (registrationIndex < registrations.length) {
      team1Id = shuffledRegistrations[registrationIndex++]?.id;
    }

    // Assign byes strategically if needed, or pair remaining players
    // This simplified logic just pairs them up. A more robust system distributes byes.
    if (registrationIndex < registrations.length) {
      team2Id = shuffledRegistrations[registrationIndex++]?.id;
    } else if (team1Id && numberOfByes > (firstRoundMatchesCount - 1 - i) * 2) {
      // Simplified bye assignment: if team1 exists and we still need to assign byes.
      // A proper algorithm would distribute byes according to seeding rules.
      // For now, if team2 is missing and we have byes to assign, team1 gets a bye.
      isBye = true;
    }
    
    // If only team1Id is set after attempting to get team2Id, and no more registrations, it's a bye.
    if (team1Id && !team2Id && registrationIndex >= registrations.length) {
        isBye = true;
    }


    matches.push({
      id: matchId,
      tournamentId,
      round: 1,
      matchNumberInRound: i + 1,
      team1Id,
      team2Id,
      isBye: isBye,
      winnerId: isBye ? team1Id : undefined, // Auto-advance winner if it's a bye
    });
  }

  // Create subsequent rounds with placeholder matches
  let currentRound = 1;
  let matchesInCurrentRound = firstRoundMatchesCount;

  while (matchesInCurrentRound > 1) {
    currentRound++;
    const matchesInNextRound = matchesInCurrentRound / 2;
    for (let i = 0; i < matchesInNextRound; i++) {
      matches.push({
        id: crypto.randomUUID(),
        tournamentId,
        round: currentRound,
        matchNumberInRound: i + 1,
        team1Id: undefined,
        team2Id: undefined,
      });
    }
    matchesInCurrentRound = matchesInNextRound;
  }
  return matches;
};

export const advanceWinner = async (
  currentMatches: Match[],
  updatedMatch: Match,
  registrations: RegisteredEntry[]
): Promise<Match[]> => {
  const newMatches = currentMatches.map(m => m.id === updatedMatch.id ? updatedMatch : m);

  if (!updatedMatch.winnerId || updatedMatch.isBye) {
    // If winner is cleared or it was a bye already handled, no further advancement needed from this update.
    // However, if a bye's winner was cleared, we need to clear subsequent matches.
    // This part can get complex, for now, assume clearing a winner means manual re-evaluation.
    return newMatches;
  }

  const { round, matchNumberInRound, winnerId } = updatedMatch;

  // Find the next match for the winner
  const nextRound = round + 1;
  // Winner of match 1 & 2 play in nextRound match 1, winner of 3 & 4 play in nextRound match 2, etc.
  const nextMatchNumberInRound = Math.ceil(matchNumberInRound / 2);

  const nextMatchIndex = newMatches.findIndex(
    m => m.round === nextRound && m.matchNumberInRound === nextMatchNumberInRound
  );

  if (nextMatchIndex !== -1) {
    const nextMatch = { ...newMatches[nextMatchIndex] };
    // Determine if the winner is team1 or team2 in the next match
    // If original matchNumberInRound is odd, winner goes to team1 slot. If even, team2 slot.
    if (matchNumberInRound % 2 === 1) { // Winner of 1st match in pair (e.g., M1 of M1&M2)
      nextMatch.team1Id = winnerId;
    } else { // Winner of 2nd match in pair (e.g., M2 of M1&M2)
      nextMatch.team2Id = winnerId;
    }
    
    // Check if both players for the next match are set, then clear its winnerId if any (in case of re-playing)
    if (nextMatch.team1Id && nextMatch.team2Id) {
      nextMatch.winnerId = undefined; 
    }
    // Check for auto-bye if one team is set and the other remains undefined after all previous matches are done
     const previousRoundMatches = newMatches.filter(m => m.round === round);
     const allPreviousRoundMatchesCompletedOrBye = previousRoundMatches.every(m => m.winnerId || m.isBye);

    if (allPreviousRoundMatchesCompletedOrBye) {
        if (nextMatch.team1Id && !nextMatch.team2Id && !registrations.find(r => r.id === nextMatch.team2Id)) {
             // If only team1 is set and team2 cannot be determined from previous round, it's a bye for team1
             const isPotentiallyBye = !newMatches.some(m => m.round === round && Math.ceil(m.matchNumberInRound / 2) === nextMatchNumberInRound && m.matchNumberInRound % 2 === 0 && m.winnerId);
             if(isPotentiallyBye) {
                nextMatch.isBye = true;
                nextMatch.winnerId = nextMatch.team1Id;
             }
        } else if (!nextMatch.team1Id && nextMatch.team2Id && !registrations.find(r => r.id === nextMatch.team1Id)) {
            // If only team2 is set and team1 cannot be determined
            const isPotentiallyBye = !newMatches.some(m => m.round === round && Math.ceil(m.matchNumberInRound / 2) === nextMatchNumberInRound && m.matchNumberInRound % 2 === 1 && m.winnerId);
            if(isPotentiallyBye) {
                nextMatch.isBye = true;
                nextMatch.winnerId = nextMatch.team2Id;
            }
        } else {
            nextMatch.isBye = false; // If both teams are eventually set, it's not a bye.
        }
    }


    newMatches[nextMatchIndex] = nextMatch;
    
    // Recursively advance if this nextMatch now has a winner (due to a bye)
    if (nextMatch.winnerId && nextMatch.isBye) {
       // Since advanceWinner is now async, we need to await its recursive call
       return await advanceWinner(newMatches, nextMatch, registrations);
    }
  }
  return newMatches;
};

// Helper to clear subsequent matches if a winner is un-set or a match is reset
export const clearSubsequentMatches = async (
  currentMatches: Match[],
  fromMatch: Match
): Promise<Match[]> => {
  let matchesToClear = [fromMatch.id];
  const clearedMatches = [...currentMatches];

  // Find the match that the winner of fromMatch would have advanced to
  let currentRound = fromMatch.round;
  let currentMatchNumberInRound = fromMatch.matchNumberInRound;

  while (true) {
    const nextRound = currentRound + 1;
    const nextMatchNumberInRound = Math.ceil(currentMatchNumberInRound / 2);
    
    const nextMatchIndex = clearedMatches.findIndex(
      m => m.round === nextRound && m.matchNumberInRound === nextMatchNumberInRound
    );

    if (nextMatchIndex === -1) break; // No more subsequent matches

    const nextMatch = { ...clearedMatches[nextMatchIndex] };
    
    let changed = false;
    if (currentMatchNumberInRound % 2 === 1) { // fromMatch was team1 source
      if (nextMatch.team1Id === fromMatch.winnerId || nextMatch.team1Id === fromMatch.team1Id || nextMatch.team1Id === fromMatch.team2Id) { // check against previous winner or participant
        nextMatch.team1Id = undefined;
        changed = true;
      }
    } else { // fromMatch was team2 source
      if (nextMatch.team2Id === fromMatch.winnerId || nextMatch.team2Id === fromMatch.team1Id || nextMatch.team2Id === fromMatch.team2Id) {
        nextMatch.team2Id = undefined;
        changed = true;
      }
    }

    if (changed) {
      nextMatch.winnerId = undefined;
      nextMatch.isBye = false;
      nextMatch.score = undefined;
      clearedMatches[nextMatchIndex] = nextMatch;
      matchesToClear.push(nextMatch.id);
      
      // Continue clearing from this changed match
      currentRound = nextMatch.round;
      currentMatchNumberInRound = nextMatch.matchNumberInRound;
    } else {
      // If this specific path didn't contribute, no need to clear further down this line
      break;
    }
    if (!nextMatch.team1Id && !nextMatch.team2Id) break; // Stop if match is now empty
  }
  
  // Reset the fromMatch itself if winner is being cleared
   const originalMatchIndex = clearedMatches.findIndex(m => m.id === fromMatch.id);
   if(originalMatchIndex !== -1 && !fromMatch.winnerId) {
       clearedMatches[originalMatchIndex] = {
           ...clearedMatches[originalMatchIndex],
           winnerId: undefined,
           score: undefined,
           // isBye remains as it was initially set unless explicitly changed
       };
   }


  return clearedMatches;
};
