
'use server';
/**
 * @fileOverview Utility functions for generating and managing tournament brackets.
 *
 * - generateSingleEliminationBracket - Creates initial matches for a single elimination bracket.
 * - generateDoubleEliminationBracket - Creates initial matches for a double elimination bracket.
 * - advanceWinner - Updates matches when a winner is selected.
 * - clearSubsequentMatches - Resets parts of the bracket.
 */
import type { Match, RegisteredEntry, Tournament, TournamentType } from './types';

// Helper to get the next power of 2
const getNextPowerOfTwo = (n: number): number => {
  if (n <= 0) return 0;
  let power = 1;
  while (power < n) {
    power *= 2;
  }
  return power;
};

export async function generateSingleEliminationBracket(
  tournamentId: string,
  registrations: RegisteredEntry[],
  maxTeams: number
): Promise<Match[]> {
  const matches: Match[] = [];
  if (registrations.length < 2) return [];

  const bracketSize = getNextPowerOfTwo(Math.min(registrations.length, maxTeams));
  let R = [...registrations]; // Clone to avoid mutating original
  
  // Add byes if necessary
  const byesNeeded = bracketSize - R.length;
  for (let i = 0; i < byesNeeded; i++) {
    R.push({ id: `bye-${i}`, entryName: "BYE", players: [], tournamentId }); // Placeholder for bye
  }

  // Simple shuffle for pairing. For more advanced seeding, this should be replaced.
  R.sort(() => Math.random() - 0.5);

  let roundNumber = 1;
  let currentRoundMatches: { team1Id?: string; team2Id?: string; isBye?: boolean; winnerId?: string }[] = [];

  for (let i = 0; i < R.length; i += 2) {
    const team1 = R[i];
    const team2 = R[i + 1];
    const isTeam1Bye = team1.entryName === "BYE";
    const isTeam2Bye = team2.entryName === "BYE";

    let matchDetail: { team1Id?: string; team2Id?: string; isBye?: boolean; winnerId?: string } = {
      team1Id: isTeam1Bye ? undefined : team1.id,
      team2Id: isTeam2Bye ? undefined : team2.id,
      isBye: false,
    };

    if (isTeam1Bye && !isTeam2Bye) { // team2 gets a bye
      matchDetail.isBye = true;
      matchDetail.winnerId = team2.id;
      matchDetail.team1Id = team2.id; // Bye matches often list the advancing player as team1
      matchDetail.team2Id = undefined;
    } else if (!isTeam1Bye && isTeam2Bye) { // team1 gets a bye
      matchDetail.isBye = true;
      matchDetail.winnerId = team1.id;
    } else if (isTeam1Bye && isTeam2Bye) {
      // This case should ideally not happen with proper bye distribution for powers of 2
      // For simplicity, skip if two byes meet.
      continue;
    }
    currentRoundMatches.push(matchDetail);
  }

  let matchNumberInRoundSE = 1;
  for (const detail of currentRoundMatches) {
    matches.push({
      id: crypto.randomUUID(),
      tournamentId,
      round: roundNumber,
      matchNumberInRound: matchNumberInRoundSE++,
      bracketType: 'winners', // Single elimination is essentially just a 'winners' bracket
      team1Id: detail.team1Id,
      team2Id: detail.team2Id,
      isBye: detail.isBye,
      winnerId: detail.winnerId,
    });
  }
  
  // Create subsequent rounds with placeholder matches
  let matchesInCurrentRound = currentRoundMatches.length;
  while (matchesInCurrentRound > 1) {
    roundNumber++;
    const matchesInNextRound = matchesInCurrentRound / 2;
    matchNumberInRoundSE = 1;
    for (let i = 0; i < matchesInNextRound; i++) {
      matches.push({
        id: crypto.randomUUID(),
        tournamentId,
        round: roundNumber,
        matchNumberInRound: matchNumberInRoundSE++,
        bracketType: 'winners',
        team1Id: undefined,
        team2Id: undefined,
      });
    }
    matchesInCurrentRound = matchesInNextRound;
  }
  return matches;
};


export async function generateDoubleEliminationBracket(
  tournamentId: string,
  registrations: RegisteredEntry[],
  maxTeamsInput: number // Use tournament.maxTeams to determine bracket size
): Promise<Match[]> {
  const allMatches: Match[] = [];
  if (registrations.length < 2) return [];

  const numParticipants = registrations.length;
  const bracketSize = getNextPowerOfTwo(numParticipants); // True bracket size based on participants for WB
  
  let R = [...registrations]; // Clone
  const byesNeeded = bracketSize - numParticipants;

  // Add actual bye entries if needed for consistent handling
  for (let i = 0; i < byesNeeded; i++) {
    R.push({ id: `bye-${tournamentId}-${i}`, entryName: `BYE-${i}`, players: [], tournamentId: tournamentId, seed: Infinity });
  }
  
  // Simple shuffle. TODO: Implement seeding for better bye distribution
  R.sort(() => Math.random() - 0.5); 

  // --- Winners' Bracket (WB) ---
  let wbMatches: Match[] = [];
  let currentRoundWB = 1;
  let teamsForCurrentRoundWB = [...R];
  let matchNumberInRoundWB = 1;

  while (teamsForCurrentRoundWB.length > 1) {
    let teamsForNextRoundWB = [];
    matchNumberInRoundWB = 1;
    for (let i = 0; i < teamsForCurrentRoundWB.length; i += 2) {
      const team1 = teamsForCurrentRoundWB[i];
      const team2 = teamsForCurrentRoundWB[i+1];
      const isTeam1Bye = team1.entryName.startsWith("BYE");
      const isTeam2Bye = team2.entryName.startsWith("BYE");
      
      const match: Match = {
        id: crypto.randomUUID(),
        tournamentId,
        round: currentRoundWB,
        matchNumberInRound: matchNumberInRoundWB++,
        bracketType: 'winners',
        team1Id: isTeam1Bye ? undefined : team1.id,
        team2Id: isTeam2Bye ? undefined : team2.id,
        isBye: false,
      };

      if (isTeam1Bye && !isTeam2Bye) { // team2 gets bye
          match.team1Id = team2.id; 
          match.team2Id = undefined;
          match.isBye = true;
          match.winnerId = team2.id;
          teamsForNextRoundWB.push(team2);
      } else if (!isTeam1Bye && isTeam2Bye) { // team1 gets bye
          match.isBye = true;
          match.winnerId = team1.id;
          teamsForNextRoundWB.push(team1);
      } else if (isTeam1Bye && isTeam2Bye) {
          // Two byes meet, advance a conceptual bye placeholder or handle as per rules.
          // For simplicity, we create a bye match that auto-advances one bye.
          // This scenario is rare with proper power-of-2 seeding.
          match.team1Id = team1.id; // Placeholder for bye
          match.isBye = true;
          match.winnerId = team1.id;
          teamsForNextRoundWB.push(team1);
      } else {
          // Regular match, winner TBD
          // Placeholder for advancing team, real winner comes from playing the match
          teamsForNextRoundWB.push({ id: `winner-wb-${currentRoundWB}-${match.matchNumberInRound}`, entryName: "TBD", players: [], tournamentId });
      }
      wbMatches.push(match);
    }
    teamsForCurrentRoundWB = teamsForNextRoundWB;
    currentRoundWB++;
  }
  allMatches.push(...wbMatches);

  // --- Losers' Bracket (LB) ---
  // This is highly simplified and needs a proper algorithm.
  // For now, creating a placeholder structure.
  const wbRound1Matches = wbMatches.filter(m => m.round === 1 && !m.isBye);
  let lbRound = 1;
  let matchNumberInRoundLB = 1;

  // Example: LB Round 1 matches from WB Round 1 losers
  if (wbRound1Matches.length >= 2) { // Need at least 2 non-bye matches in WB R1 to form LB R1
      for (let i = 0; i < wbRound1Matches.length / 2; i++) { // Approximate, assumes even # of losers
          allMatches.push({
              id: crypto.randomUUID(),
              tournamentId,
              round: lbRound,
              matchNumberInRound: matchNumberInRoundLB++,
              bracketType: 'losers',
              team1Id: undefined, // Placeholder for loser of WB R1 Match 2*i+1
              team2Id: undefined, // Placeholder for loser of WB R1 Match 2*i+2
          });
      }
  }
  // ... More LB rounds would be generated here based on WB losers and LB winners ...
  // This part is complex and requires careful mapping.

  // --- Grand Final (GF) ---
  // Placeholder for Grand Final
  allMatches.push({
    id: crypto.randomUUID(),
    tournamentId,
    round: 1, // GF Round 1
    matchNumberInRound: 1,
    bracketType: 'grandFinal',
    team1Id: undefined, // Winner of WB
    team2Id: undefined, // Winner of LB
  });
  
  // Placeholder for Grand Final Reset (if needed)
  // This match is only relevant if the LB winner wins the first GF match.
  // It's often not created upfront, but conditionally.
  // For generation, we can create it as a possibility.
  allMatches.push({
    id: crypto.randomUUID(),
    tournamentId,
    round: 2, // GF Round 2 (Reset)
    matchNumberInRound: 1,
    bracketType: 'grandFinalReset',
    team1Id: undefined, 
    team2Id: undefined,
    isBye: true, // Initially a "bye" until activated
  });


  return allMatches;
}

export async function advanceWinner (
  currentMatches: Match[],
  updatedMatch: Match,
  registrations: RegisteredEntry[],
  tournamentType: TournamentType
): Promise<Match[]> {
  let newMatches = currentMatches.map(m => m.id === updatedMatch.id ? { ...updatedMatch } : m);

  if (tournamentType === 'single') {
    return advanceWinnerSingleElimination(newMatches, updatedMatch, registrations);
  } else if (tournamentType === 'double_elimination') {
    return advanceWinnerDoubleElimination(newMatches, updatedMatch, registrations);
  }
  return newMatches; // Should not happen
};

async function advanceWinnerSingleElimination(
  currentMatches: Match[],
  updatedMatch: Match,
  registrations: RegisteredEntry[]
): Promise<Match[]> {
   let newMatches = [...currentMatches]; // Work on a copy

  if (!updatedMatch.winnerId && !updatedMatch.isBye) { // Winner cleared, and it wasn't a bye to begin with
    // If winner is cleared, subsequent matches need to be reset.
    // The updatedMatch itself is already in newMatches via map.
    return clearSubsequentMatches(newMatches, updatedMatch, 'single'); // Pass 'single'
  }
  
  if (updatedMatch.isBye && updatedMatch.winnerId !== (updatedMatch.team1Id || updatedMatch.team2Id)) {
      // If a bye's winner is somehow changed to not be the bye recipient, it's an invalid state.
      // Revert or handle as error. For now, just log and don't advance.
      console.warn("Attempted to change winner of a bye match incorrectly.", updatedMatch);
      return newMatches;
  }
  
  if (!updatedMatch.winnerId) return newMatches; // No winner to advance


  const { round, matchNumberInRound, winnerId } = updatedMatch;

  const nextRound = round + 1;
  const nextMatchNumberInRound = Math.ceil(matchNumberInRound / 2);

  const nextMatchIndex = newMatches.findIndex(
    m => m.round === nextRound && m.matchNumberInRound === nextMatchNumberInRound && m.bracketType === 'winners' // Ensure targeting SE bracket
  );

  if (nextMatchIndex !== -1) {
    const nextMatch = { ...newMatches[nextMatchIndex] };
    if (matchNumberInRound % 2 === 1) {
      nextMatch.team1Id = winnerId;
    } else {
      nextMatch.team2Id = winnerId;
    }

    // Reset winner if participants change
    if (nextMatch.winnerId && (nextMatch.team1Id !== winnerId && nextMatch.team2Id !== winnerId)) {
       nextMatch.winnerId = undefined;
       nextMatch.score = undefined;
    }
    nextMatch.isBye = false; // If players are advancing, it's not a bye by definition

    // Check for auto-bye in the next match
    if (nextMatch.team1Id && !nextMatch.team2Id) {
        // Is team2 slot supposed to be filled by another match in the current round?
        const siblingMatchNumber = matchNumberInRound % 2 === 1 ? matchNumberInRound + 1 : matchNumberInRound -1;
        const siblingMatch = newMatches.find(m => m.round === round && m.matchNumberInRound === siblingMatchNumber && m.bracketType === 'winners');
        if (!siblingMatch || (siblingMatch.isBye && !siblingMatch.team2Id)) { // If sibling is a bye for team1 or doesn't exist
             nextMatch.isBye = true;
             nextMatch.winnerId = nextMatch.team1Id;
        }
    } else if (!nextMatch.team1Id && nextMatch.team2Id) {
        const siblingMatchNumber = matchNumberInRound % 2 === 1 ? matchNumberInRound + 1 : matchNumberInRound -1;
        const siblingMatch = newMatches.find(m => m.round === round && m.matchNumberInRound === siblingMatchNumber && m.bracketType === 'winners');
         if (!siblingMatch || (siblingMatch.isBye && !siblingMatch.team1Id)) {
            nextMatch.isBye = true;
            nextMatch.winnerId = nextMatch.team2Id;
        }
    }


    newMatches[nextMatchIndex] = nextMatch;
    if (nextMatch.winnerId && nextMatch.isBye) {
       return advanceWinnerSingleElimination(newMatches, nextMatch, registrations); // Recurse for auto-bye
    }
  }
  return newMatches;
}


async function advanceWinnerDoubleElimination(
  currentMatches: Match[],
  updatedMatch: Match,
  registrations: RegisteredEntry[]
): Promise<Match[]> {
  let newMatches = [...currentMatches]; // Work on a copy

  if (!updatedMatch.winnerId && !updatedMatch.isBye) {
    return clearSubsequentMatches(newMatches, updatedMatch, 'double_elimination');
  }
  if (!updatedMatch.winnerId) return newMatches; // No winner to advance

  const { id: matchId, round, matchNumberInRound, winnerId, bracketType, team1Id, team2Id } = updatedMatch;
  const loserId = winnerId === team1Id ? team2Id : team1Id;

  if (bracketType === 'winners') {
    // Advance winner in WB
    const nextWbRound = round + 1;
    const nextWbMatchNumber = Math.ceil(matchNumberInRound / 2);
    const nextWbMatchIndex = newMatches.findIndex(m => m.bracketType === 'winners' && m.round === nextWbRound && m.matchNumberInRound === nextWbMatchNumber);

    if (nextWbMatchIndex !== -1) {
      if (matchNumberInRound % 2 === 1) newMatches[nextWbMatchIndex].team1Id = winnerId;
      else newMatches[nextWbMatchIndex].team2Id = winnerId;
      newMatches[nextWbMatchIndex].isBye = false; // populated, so not a bye. Check for auto-bye later.
      
      // If this completes the participants for the next WB match, check if it becomes a bye
      const nextWbParticipants = newMatches[nextWbMatchIndex];
      if(nextWbParticipants.team1Id && !nextWbParticipants.team2Id) {
        // Check if team2 source is a bye. This requires knowing overall bracket structure or assuming pairing.
        // For simplicity, if one participant is known and the other slot is from a bye in the previous round.
      } // Similar for team2Id and !team1Id

    } else { // Winner of WB is the WB Champion, advances to Grand Final
      const gfMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinal');
      if (gfMatchIndex !== -1) newMatches[gfMatchIndex].team1Id = winnerId;
    }

    // Advance loser to LB (if not WB final and loser exists)
    if (loserId && nextWbMatchIndex !== -1) { // Loser exists and it's not the WB final match
        // Determine target LB match. This logic is complex and depends on bracket structure.
        // Simplified: find first available LB slot that corresponds to this WB round's losers.
        // Example: WB R1 Losers go to LB R1. WB R2 Losers go to LB R3 (after LB R2 where LB R1 winners play).
        // This needs a mapping table or a more robust algorithm.
        // For this pass, let's assume a simplified LB advancement or placeholder.
        
        // A very simplified placeholder for LB loser placement:
        let targetLbRound, targetLbMatchNumberInRound;
        if (round === 1) { // WB R1 losers go to LB R1
            targetLbRound = 1;
            targetLbMatchNumberInRound = matchNumberInRound; // This pairing is simplistic.
        } else { // WB R2 losers go to LB R3, etc. (even LB rounds usually W-losers vs L-winners)
            targetLbRound = round * 2 - 1; // Approximation
            targetLbMatchNumberInRound = Math.ceil(matchNumberInRound / 2);
        }

        const targetLbMatchIndex = newMatches.findIndex(m => 
            m.bracketType === 'losers' && 
            m.round === targetLbRound && 
            !m.team1Id // Find first empty slot, or second if first taken
        );

        if (targetLbMatchIndex !== -1) {
            if (!newMatches[targetLbMatchIndex].team1Id) newMatches[targetLbMatchIndex].team1Id = loserId;
            else if (!newMatches[targetLbMatchIndex].team2Id) newMatches[targetLbMatchIndex].team2Id = loserId;
            newMatches[targetLbMatchIndex].isBye = false;
        }
    }
  } else if (bracketType === 'losers') {
    // Advance winner in LB
    const nextLbMatch = newMatches.find(m => m.bracketType === 'losers' && m.round === round + 1 /* and matches this winner's path */);
    // This needs a proper way to find the next LB match.
    // For now, assume LB winner goes to Grand Final if it's the last LB match.
    const isLastLbMatch = !newMatches.some(m => m.bracketType === 'losers' && m.round > round); // Simplistic check
    if (isLastLbMatch) {
      const gfMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinal');
      if (gfMatchIndex !== -1) newMatches[gfMatchIndex].team2Id = winnerId;
    } else {
        // Find next LB match (complex, depends on bracket structure)
        // Simplified: Find next LB match in next round, first available slot
        const nextLbRound = round + 1;
        // Losers bracket progression can be non-linear in terms of matchNumberInRound.
        // For example, winner of L1.1 vs L1.2 plays in L2.1. Winner of W1.1-loser vs W1.2-loser also feeds into L2.
        // This is a placeholder.
        const nextPotentialLbMatchIndex = newMatches.findIndex(m => 
            m.bracketType === 'losers' && m.round === nextLbRound && (!m.team1Id || !m.team2Id)
        );
        if (nextPotentialLbMatchIndex !== -1) {
            if (matchNumberInRound % 2 === 1 || !newMatches[nextPotentialLbMatchIndex].team1Id ) { // Simplified placement
                 newMatches[nextPotentialLbMatchIndex].team1Id = winnerId;
            } else {
                 newMatches[nextPotentialLbMatchIndex].team2Id = winnerId;
            }
            newMatches[nextPotentialLbMatchIndex].isBye = false;
        }
    }
    // Loser of LB match is eliminated.
  } else if (bracketType === 'grandFinal') {
    const gfResetMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinalReset');
    if (winnerId === team1Id) { // WB Winner wins GF
      // Tournament over. (Unless there's a specific rule about WB winner losing once etc.)
      if (gfResetMatchIndex !== -1) newMatches[gfResetMatchIndex].isBye = true; // Deactivate reset
    } else if (winnerId === team2Id) { // LB Winner wins GF
      if (gfResetMatchIndex !== -1) {
        newMatches[gfResetMatchIndex].team1Id = team1Id; // WB Winner from original GF
        newMatches[gfResetMatchIndex].team2Id = team2Id; // LB Winner from original GF
        newMatches[gfResetMatchIndex].isBye = false; // Activate reset match
        newMatches[gfResetMatchIndex].winnerId = undefined; // Reset winner for this new match
        newMatches[gfResetMatchIndex].score = undefined;
      }
    }
  } else if (bracketType === 'grandFinalReset') {
    // Winner of this match is the tournament champion.
  }

  // Auto-resolve byes in DE (very simplified)
  for(let i=0; i < newMatches.length; i++) {
    const match = newMatches[i];
    if (!match.winnerId && !match.isBye) {
        if (match.team1Id && !match.team2Id && registrations.find(r => r.id === match.team1Id) && !match.bracketType.startsWith('grandFinal')) {
            // Check if team2 slot is supposed to be fed from a bye in previous round
            // This check is very superficial for DE.
            match.isBye = true;
            match.winnerId = match.team1Id;
            newMatches[i] = match;
            // Recursively call, but be careful of infinite loops.
            // For DE, bye propagation is more controlled by initial generation.
        } else if (match.team2Id && !match.team1Id && registrations.find(r => r.id === match.team2Id) && !match.bracketType.startsWith('grandFinal')) {
            match.isBye = true;
            match.winnerId = match.team2Id;
            newMatches[i] = match;
        }
    }
  }

  return newMatches;
}


export async function clearSubsequentMatches (
  currentMatches: Match[],
  fromMatch: Match,
  tournamentType: TournamentType
): Promise<Match[]> {
  let clearedMatches = [...currentMatches];
  const matchIdToClearFrom = fromMatch.id;

  // Find the index of the match being reset
  const fromMatchIndex = clearedMatches.findIndex(m => m.id === matchIdToClearFrom);
  if (fromMatchIndex === -1) return clearedMatches;

  // Reset the source match itself (clear winner, score)
  clearedMatches[fromMatchIndex] = {
    ...clearedMatches[fromMatchIndex],
    winnerId: undefined,
    score: undefined,
    // isBye state should typically be preserved as it's part of initial generation
  };
  
  // For double elimination, clearing subsequent matches is very complex due to players moving between brackets.
  // A full implementation would trace all paths from this match.
  // For now, this function will be simplified for DE: it primarily resets the current match and relies on re-playing
  // to fix the bracket. Or, it might only clear the immediate next match in its own bracket path.

  if (tournamentType === 'single') {
      let queue = [clearedMatches[fromMatchIndex]];
      while(queue.length > 0) {
          const currentCleared = queue.shift()!;
          if (!currentCleared) continue;

          const nextRound = currentCleared.round + 1;
          const nextMatchNumber = Math.ceil(currentCleared.matchNumberInRound / 2);
          
          const nextMatchIdx = clearedMatches.findIndex(m => 
              m.bracketType === currentCleared.bracketType && // Assuming same bracket type for SE
              m.round === nextRound && 
              m.matchNumberInRound === nextMatchNumber
          );

          if (nextMatchIdx !== -1) {
              let changed = false;
              if (currentCleared.matchNumberInRound % 2 === 1) { // current was team1 source for next
                  if (clearedMatches[nextMatchIdx].team1Id) {
                       clearedMatches[nextMatchIdx].team1Id = undefined;
                       changed = true;
                  }
              } else { // current was team2 source for next
                  if (clearedMatches[nextMatchIdx].team2Id) {
                      clearedMatches[nextMatchIdx].team2Id = undefined;
                      changed = true;
                  }
              }

              if (changed || clearedMatches[nextMatchIdx].winnerId) {
                  clearedMatches[nextMatchIdx].winnerId = undefined;
                  clearedMatches[nextMatchIdx].score = undefined;
                  clearedMatches[nextMatchIdx].isBye = false; // If it was a bye due to this path, it's no longer auto-decided.
                  queue.push(clearedMatches[nextMatchIdx]); // Add to queue to clear further
              }
          }
      }
  } else if (tournamentType === 'double_elimination') {
    // Simplified for DE: Reset the current match. Further propagation is hard.
    // Users might need to manually resolve or re-generate the bracket if extensive changes are needed.
    // This is a known limitation for this iteration.
    // We could try to clear the *immediate* next match in WB and the corresponding LB entry.
    
    // Example: If clearing a WB match:
    // 1. Clear its winner.
    // 2. Find where its winner would have gone in WB, clear that participant slot.
    // 3. Find where its loser would have gone in LB, clear that participant slot.
    // This still doesn't recursively clear.

    // For now, the reset of fromMatch (done above) is the primary action.
    // More sophisticated clearing for DE is a future enhancement.
  }


  return clearedMatches;
};
