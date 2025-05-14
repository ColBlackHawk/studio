
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

// Helper to get max round for a specific bracket type
function getMaxRoundForBracket(matches: Match[], bracketType: 'winners' | 'losers' | 'grandFinal' | 'grandFinalReset'): number {
    const bracketMatches = matches.filter(m => m.bracketType === bracketType);
    if (bracketMatches.length === 0) return 0;
    return Math.max(...bracketMatches.map(m => m.round));
}

async function propagateGeneratedByes(initialMatches: Match[], bracketTypeScope: 'winners' | 'losers'): Promise<Match[]> {
  let currentMatches = JSON.parse(JSON.stringify(initialMatches)) as Match[]; // Deep copy
  let madeChangeInPass;

  const maxRound = getMaxRoundForBracket(currentMatches, bracketTypeScope);

  do {
    madeChangeInPass = false;
    for (const match of currentMatches) {
      // Only consider actual bye matches that have a winner and are not in the final round of their scope
      if (match.bracketType === bracketTypeScope && match.isBye && match.winnerId && match.round < maxRound) {
        const nextRound = match.round + 1;
        const nextMatchNumberInRound = Math.ceil(match.matchNumberInRound / 2);
        const nextMatchIdx = currentMatches.findIndex(
          (m: Match) => m.bracketType === bracketTypeScope && m.round === nextRound && m.matchNumberInRound === nextMatchNumberInRound
        );

        if (nextMatchIdx !== -1) {
          const targetMatchOriginal = currentMatches[nextMatchIdx];
          let targetMatchUpdated = { ...targetMatchOriginal }; // Work on a copy
          let slotFilled = false;

          // Place the winner of the current bye match into the target match
          if (match.matchNumberInRound % 2 === 1) { // current bye match is source for team1 of targetMatch
            if (targetMatchUpdated.team1Id !== match.winnerId) {
              targetMatchUpdated.team1Id = match.winnerId;
              slotFilled = true;
            }
          } else { // current bye match is source for team2 of targetMatch
            if (targetMatchUpdated.team2Id !== match.winnerId) {
              targetMatchUpdated.team2Id = match.winnerId;
              slotFilled = true;
            }
          }

          if (slotFilled) {
            // A slot in targetMatchUpdated was filled by a bye winner.
            // Now, determine if targetMatchUpdated itself becomes a bye.
            const feeder1MatchNumber = (targetMatchUpdated.matchNumberInRound * 2) - 1;
            const feeder2MatchNumber = targetMatchUpdated.matchNumberInRound * 2;
            const prevRoundNumber = targetMatchUpdated.round - 1;

            const feeder1 = currentMatches.find(m => m.bracketType === bracketTypeScope && m.round === prevRoundNumber && m.matchNumberInRound === feeder1MatchNumber);
            const feeder2 = currentMatches.find(m => m.bracketType === bracketTypeScope && m.round === prevRoundNumber && m.matchNumberInRound === feeder2MatchNumber);
            
            const feeder1IsResolvedBye = feeder1 && feeder1.isBye && feeder1.winnerId;
            const feeder2IsResolvedBye = feeder2 && feeder2.isBye && feeder2.winnerId;

            if (targetMatchUpdated.team1Id && !targetMatchUpdated.team2Id) { // team1 is filled, team2 is not
              if (feeder2IsResolvedBye) { // If team2's slot was fed by a bye that resolved
                targetMatchUpdated.isBye = true;
                targetMatchUpdated.winnerId = targetMatchUpdated.team1Id;
              } else { // team2 slot to be filled by a playing match, or feeder2 doesn't exist (should not happen in perfectly structured bracket)
                targetMatchUpdated.isBye = false;
                targetMatchUpdated.winnerId = undefined;
              }
            } else if (!targetMatchUpdated.team1Id && targetMatchUpdated.team2Id) { // team2 is filled, team1 is not
              if (feeder1IsResolvedBye) { // If team1's slot was fed by a bye that resolved
                targetMatchUpdated.isBye = true;
                targetMatchUpdated.winnerId = targetMatchUpdated.team2Id;
              } else {
                targetMatchUpdated.isBye = false;
                targetMatchUpdated.winnerId = undefined;
              }
            } else if (targetMatchUpdated.team1Id && targetMatchUpdated.team2Id) { // both slots filled
              targetMatchUpdated.isBye = false;
              targetMatchUpdated.winnerId = undefined;
            }
            // If one slot is filled and the other feeder doesn't exist (e.g. odd number of matches in prev round), it's a bye.
            // This scenario is implicitly handled if !feeder1 or !feeder2 and a slot remains empty.
            // Example: 3 teams. R1M1(P1vP2), R1M2(P3vBYE). R2M1.
            // propagate R1M2 -> P3 to R2M1.team2. R2M1 is (TBD vs P3). Feeder1 is R1M1 (not a bye). Feeder2 is R1M2 (bye).
            // R2M1.team1Id gets winner of R1M1. R2M1.team2Id gets P3. Not a bye.
            
            if (JSON.stringify(targetMatchOriginal) !== JSON.stringify(targetMatchUpdated)) {
                 currentMatches[nextMatchIdx] = targetMatchUpdated;
                 madeChangeInPass = true; // Continue iterating until no more changes
            }
          }
        }
      }
    }
  } while (madeChangeInPass);

  return currentMatches;
}


export async function generateSingleEliminationBracket(
  tournamentId: string,
  registrations: RegisteredEntry[],
  maxTeams: number
): Promise<Match[]> {
  let matches: Match[] = [];
  if (registrations.length < 2) return [];

  const bracketSize = getNextPowerOfTwo(Math.min(registrations.length, maxTeams));
  let R = [...registrations]; 
  
  const byesNeeded = bracketSize - R.length;
  for (let i = 0; i < byesNeeded; i++) {
    R.push({ id: `bye-${tournamentId}-${i}`, entryName: `BYE-${i}`, players: [], tournamentId, seed: Infinity }); 
  }

  R.sort(() => Math.random() - 0.5);

  let roundNumber = 1;
  let currentRoundMatchesDetails: { team1Id?: string; team2Id?: string; isBye?: boolean; winnerId?: string }[] = [];
  let matchNumberInRoundSE = 1;

  for (let i = 0; i < R.length; i += 2) {
    const team1 = R[i];
    const team2 = R[i + 1];
    const isTeam1Bye = team1.entryName.startsWith("BYE");
    const isTeam2Bye = team2.entryName.startsWith("BYE");

    let matchDetail: { team1Id?: string; team2Id?: string; isBye?: boolean; winnerId?: string } = {
      team1Id: isTeam1Bye ? undefined : team1.id,
      team2Id: isTeam2Bye ? undefined : team2.id,
      isBye: false,
    };

    if (isTeam1Bye && !isTeam2Bye) { 
      matchDetail.isBye = true;
      matchDetail.winnerId = team2.id;
      matchDetail.team1Id = team2.id; 
      matchDetail.team2Id = undefined;
    } else if (!isTeam1Bye && isTeam2Bye) { 
      matchDetail.isBye = true;
      matchDetail.winnerId = team1.id;
    } else if (isTeam1Bye && isTeam2Bye) {
      continue;
    }
    
    matches.push({
      id: crypto.randomUUID(),
      tournamentId,
      round: roundNumber,
      matchNumberInRound: matchNumberInRoundSE++,
      bracketType: 'winners',
      team1Id: matchDetail.team1Id,
      team2Id: matchDetail.team2Id,
      isBye: matchDetail.isBye,
      winnerId: matchDetail.winnerId,
    });
  }
  
  let matchesInCurrentRoundCount = matches.filter(m => m.round === roundNumber).length;
  while (matchesInCurrentRoundCount > 1) {
    roundNumber++;
    const matchesInNextRoundCount = matchesInCurrentRoundCount / 2;
    matchNumberInRoundSE = 1;
    for (let i = 0; i < matchesInNextRoundCount; i++) {
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
    matchesInCurrentRoundCount = matchesInNextRoundCount;
  }
  
  matches = await propagateGeneratedByes(matches, 'winners');
  return matches;
};


export async function generateDoubleEliminationBracket(
  tournamentId: string,
  registrations: RegisteredEntry[],
  maxTeamsInput: number 
): Promise<Match[]> {
  let allMatches: Match[] = [];
  if (registrations.length < 2) return [];

  const numParticipants = registrations.length;
  const bracketSize = getNextPowerOfTwo(numParticipants); 
  
  let R = [...registrations]; 
  const byesNeeded = bracketSize - numParticipants;

  for (let i = 0; i < byesNeeded; i++) {
    R.push({ id: `bye-${tournamentId}-${i}`, entryName: `BYE-${i}`, players: [], tournamentId: tournamentId, seed: Infinity });
  }
  
  R.sort(() => Math.random() - 0.5); 

  // --- Winners' Bracket (WB) ---
  let wbRound = 1;
  let teamsForCurrentRoundWB = [...R];
  let matchNumberInRoundWB = 1;

  // Generate WB Round 1
  matchNumberInRoundWB = 1;
  for (let i = 0; i < teamsForCurrentRoundWB.length; i += 2) {
    const team1 = teamsForCurrentRoundWB[i];
    const team2 = teamsForCurrentRoundWB[i+1];
    const isTeam1Bye = team1.entryName.startsWith("BYE");
    const isTeam2Bye = team2.entryName.startsWith("BYE");
    
    const match: Match = {
      id: crypto.randomUUID(),
      tournamentId,
      round: wbRound,
      matchNumberInRound: matchNumberInRoundWB++,
      bracketType: 'winners',
      team1Id: isTeam1Bye ? undefined : team1.id,
      team2Id: isTeam2Bye ? undefined : team2.id,
      isBye: false,
    };

    if (isTeam1Bye && !isTeam2Bye) {
        match.team1Id = team2.id; 
        match.team2Id = undefined;
        match.isBye = true;
        match.winnerId = team2.id;
    } else if (!isTeam1Bye && isTeam2Bye) {
        match.isBye = true;
        match.winnerId = team1.id;
    } else if (isTeam1Bye && isTeam2Bye) {
        // This case means two byes meet, which should not happen if byes are distributed correctly.
        // If it does, effectively one bye advances.
        match.team1Id = team1.id; 
        match.isBye = true;
        match.winnerId = team1.id;
    }
    allMatches.push(match);
  }

  // Generate subsequent WB rounds (placeholders)
  let matchesInCurrentWbRoundCount = allMatches.filter(m => m.bracketType === 'winners' && m.round === wbRound).length;
  while(matchesInCurrentWbRoundCount > 1) {
    wbRound++;
    const matchesInNextWbRoundCount = matchesInCurrentWbRoundCount / 2;
    matchNumberInRoundWB = 1;
    for (let i = 0; i < matchesInNextWbRoundCount; i++) {
      allMatches.push({
        id: crypto.randomUUID(),
        tournamentId,
        round: wbRound,
        matchNumberInRound: matchNumberInRoundWB++,
        bracketType: 'winners',
        team1Id: undefined,
        team2Id: undefined,
      });
    }
    matchesInCurrentWbRoundCount = matchesInNextWbRoundCount;
  }
  
  allMatches = await propagateGeneratedByes(allMatches, 'winners');

  // --- Losers' Bracket (LB) --- Placeholder Structure
  // Actual LB generation is complex and depends on WB progression.
  const wbFinalRound = getMaxRoundForBracket(allMatches, 'winners');
  let lbRoundNumber = 1;
  let numLbMatches = bracketSize / 2; // Initial LB matches roughly related to WB size

  // Simplified LB structure: create a linear set of LB rounds
  // Number of LB rounds is roughly 2 * log2(N) - 2 or similar for full DE
  // For now, a few placeholder rounds.
  for (let r = 0; r < wbFinalRound * 2 -2 ; r++) { // Heuristic for number of LB rounds
      let matchesThisLbRound = Math.max(1, numLbMatches / Math.pow(2, Math.floor(r/2) + (r%2) ) ); // very rough
      if (r > 0 && r%2 !== 0 ) matchesThisLbRound = Math.max(1, numLbMatches / Math.pow(2, Math.floor(r/2) +1 ));


      // For small brackets, ensure at least one LB match if there's a WB
      if (wbFinalRound > 1 && r === 0 && bracketSize > 2) matchesThisLbRound = bracketSize / 4;
      else if (wbFinalRound > 1 && r === 1 && bracketSize > 4) matchesThisLbRound = bracketSize / 4;
      
      if (matchesThisLbRound < 1 && wbFinalRound > 0) matchesThisLbRound = 1; // Ensure last LB match if needed

      for (let i = 0; i < matchesThisLbRound; i++) {
        if (allMatches.filter(m => m.bracketType === 'losers').length >= (bracketSize-2) && bracketSize > 2) break; // Max LB matches approx N-2 for small N
         if (allMatches.filter(m => m.bracketType === 'losers').length >= (bracketSize-1) && bracketSize <= 2) break;
        
          allMatches.push({
              id: crypto.randomUUID(),
              tournamentId,
              round: lbRoundNumber,
              matchNumberInRound: i + 1,
              bracketType: 'losers',
              team1Id: undefined, 
              team2Id: undefined, 
          });
      }
      if(matchesThisLbRound > 0) lbRoundNumber++;
      if (matchesThisLbRound === 1 && r > 0) break; // Stop if we've reached a single LB final match
  }


  // --- Grand Final (GF) ---
  allMatches.push({
    id: crypto.randomUUID(),
    tournamentId,
    round: 1, 
    matchNumberInRound: 1,
    bracketType: 'grandFinal',
    team1Id: undefined, 
    team2Id: undefined, 
  });
  
  allMatches.push({
    id: crypto.randomUUID(),
    tournamentId,
    round: 2, 
    matchNumberInRound: 1,
    bracketType: 'grandFinalReset',
    team1Id: undefined, 
    team2Id: undefined,
    isBye: true, 
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
  return newMatches; 
};

async function advanceWinnerSingleElimination(
  currentMatches: Match[],
  updatedMatch: Match,
  registrations: RegisteredEntry[]
): Promise<Match[]> {
   let newMatches = [...currentMatches]; 

  if (!updatedMatch.winnerId && !updatedMatch.isBye) { 
    return clearSubsequentMatches(newMatches, updatedMatch, 'single');
  }
  
  if (updatedMatch.isBye && updatedMatch.winnerId !== (updatedMatch.team1Id || updatedMatch.team2Id)) {
      console.warn("Attempted to change winner of a bye match incorrectly.", updatedMatch);
      return newMatches;
  }
  
  if (!updatedMatch.winnerId) return newMatches; 


  const { round, matchNumberInRound, winnerId } = updatedMatch;
  const maxRoundForBracket = getMaxRoundForBracket(newMatches, 'winners');
  if (round >= maxRoundForBracket) return newMatches; // Final match, no next match to advance to

  const nextRound = round + 1;
  const nextMatchNumberInRound = Math.ceil(matchNumberInRound / 2);

  const nextMatchIndex = newMatches.findIndex(
    m => m.round === nextRound && m.matchNumberInRound === nextMatchNumberInRound && m.bracketType === 'winners'
  );

  if (nextMatchIndex !== -1) {
    const nextMatchOriginal = newMatches[nextMatchIndex];
    let nextMatch = { ...nextMatchOriginal };
    let participantPlaced = false;

    if (matchNumberInRound % 2 === 1) { // updatedMatch is team1 source for nextMatch
      if (nextMatch.team1Id !== winnerId) {
        nextMatch.team1Id = winnerId;
        participantPlaced = true;
      }
    } else { // updatedMatch is team2 source for nextMatch
      if (nextMatch.team2Id !== winnerId) {
        nextMatch.team2Id = winnerId;
        participantPlaced = true;
      }
    }
    
    if (participantPlaced) {
        // Reset winner/score if participants changed and it wasn't already a bye that resolved itself
        if (!nextMatch.isBye || nextMatch.winnerId !== (nextMatch.team1Id || nextMatch.team2Id) ) {
             nextMatch.winnerId = undefined;
             nextMatch.score = undefined;
             nextMatch.isBye = false; // Assume not a bye until proven by other feeder
        }
    }

    // Check if nextMatch becomes a bye due to its other feeder being a bye
    if (nextMatch.team1Id && !nextMatch.team2Id) {
        const otherFeederMatchNumber = nextMatch.matchNumberInRound * 2; // Sibling that feeds team2 slot
        const otherFeeder = newMatches.find(m => m.round === round && m.matchNumberInRound === otherFeederMatchNumber && m.bracketType === 'winners');
        if (otherFeeder && otherFeeder.isBye && otherFeeder.winnerId) {
            if (!nextMatch.isBye || nextMatch.winnerId !== nextMatch.team1Id) {
                 nextMatch.isBye = true;
                 nextMatch.winnerId = nextMatch.team1Id;
            }
        }
    } else if (!nextMatch.team1Id && nextMatch.team2Id) {
        const otherFeederMatchNumber = (nextMatch.matchNumberInRound * 2) - 1; // Sibling that feeds team1 slot
        const otherFeeder = newMatches.find(m => m.round === round && m.matchNumberInRound === otherFeederMatchNumber && m.bracketType === 'winners');
        if (otherFeeder && otherFeeder.isBye && otherFeeder.winnerId) {
            if (!nextMatch.isBye || nextMatch.winnerId !== nextMatch.team2Id) {
                nextMatch.isBye = true;
                nextMatch.winnerId = nextMatch.team2Id;
            }
        }
    } else if (nextMatch.team1Id && nextMatch.team2Id) { // Both slots filled, ensure it's not marked as bye
        if (nextMatch.isBye) { // If it was a bye, but now has two players, it's no longer a bye.
            nextMatch.isBye = false;
            nextMatch.winnerId = undefined;
            nextMatch.score = undefined;
        }
    }

    if (JSON.stringify(nextMatchOriginal) !== JSON.stringify(nextMatch)){
        newMatches[nextMatchIndex] = nextMatch;
        // If nextMatch became a bye and has a winner, recurse to propagate *this newly formed bye*
        if (nextMatch.isBye && nextMatch.winnerId && nextMatch.id !== updatedMatch.id) {
           return advanceWinnerSingleElimination(newMatches, nextMatch, registrations);
        }
    }
  }
  return newMatches;
}


async function advanceWinnerDoubleElimination(
  currentMatches: Match[],
  updatedMatch: Match,
  registrations: RegisteredEntry[]
): Promise<Match[]> {
  let newMatches = [...currentMatches]; 

  if (!updatedMatch.winnerId && !updatedMatch.isBye) {
    return clearSubsequentMatches(newMatches, updatedMatch, 'double_elimination');
  }
  if (updatedMatch.isBye && updatedMatch.winnerId !== (updatedMatch.team1Id || updatedMatch.team2Id)) {
      console.warn("Attempted to change winner of a DE bye match incorrectly.", updatedMatch);
      return newMatches;
  }
  if (!updatedMatch.winnerId) return newMatches;

  const { id: matchId, round, matchNumberInRound, winnerId, bracketType, team1Id, team2Id } = updatedMatch;
  const loserId = winnerId === team1Id ? team2Id : team1Id;

  if (bracketType === 'winners') {
    const maxWbRound = getMaxRoundForBracket(newMatches, 'winners');
    if (round < maxWbRound) { // Not the WB final match
        const nextWbRound = round + 1;
        const nextWbMatchNumber = Math.ceil(matchNumberInRound / 2);
        const nextWbMatchIndex = newMatches.findIndex(m => m.bracketType === 'winners' && m.round === nextWbRound && m.matchNumberInRound === nextWbMatchNumber);

        if (nextWbMatchIndex !== -1) {
            const originalNextWbMatch = newMatches[nextWbMatchIndex];
            let nextWbMatch = {...originalNextWbMatch};
            let changed = false;

            if (matchNumberInRound % 2 === 1) { // current updatedMatch feeds team1 of nextWbMatch
                if(nextWbMatch.team1Id !== winnerId) { nextWbMatch.team1Id = winnerId; changed = true;}
            } else { // current updatedMatch feeds team2 of nextWbMatch
                if(nextWbMatch.team2Id !== winnerId) { nextWbMatch.team2Id = winnerId; changed = true;}
            }

            if(changed) {
                // Reset winner/score if participants changed
                nextWbMatch.winnerId = undefined;
                nextWbMatch.score = undefined;
                nextWbMatch.isBye = false; // Assume not a bye until proven

                // Check if nextWbMatch becomes a bye
                if (nextWbMatch.team1Id && !nextWbMatch.team2Id) {
                    const otherFeederNumber = nextWbMatch.matchNumberInRound * 2;
                    const otherFeeder = newMatches.find(m => m.bracketType === 'winners' && m.round === round && m.matchNumberInRound === otherFeederNumber);
                    if (otherFeeder && otherFeeder.isBye && otherFeeder.winnerId) {
                       if (!nextWbMatch.isBye || nextWbMatch.winnerId !== nextWbMatch.team1Id) {
                            nextWbMatch.isBye = true; nextWbMatch.winnerId = nextWbMatch.team1Id;
                       }
                    }
                } else if (!nextWbMatch.team1Id && nextWbMatch.team2Id) {
                    const otherFeederNumber = (nextWbMatch.matchNumberInRound * 2) - 1;
                    const otherFeeder = newMatches.find(m => m.bracketType === 'winners' && m.round === round && m.matchNumberInRound === otherFeederNumber);
                     if (otherFeeder && otherFeeder.isBye && otherFeeder.winnerId) {
                        if (!nextWbMatch.isBye || nextWbMatch.winnerId !== nextWbMatch.team2Id) {
                            nextWbMatch.isBye = true; nextWbMatch.winnerId = nextWbMatch.team2Id;
                        }
                    }
                } else if (nextWbMatch.team1Id && nextWbMatch.team2Id) {
                    nextWbMatch.isBye = false; nextWbMatch.winnerId = undefined;
                }
                newMatches[nextWbMatchIndex] = nextWbMatch;
                if (nextWbMatch.isBye && nextWbMatch.winnerId && nextWbMatch.id !== updatedMatch.id) {
                     // Recurse if this WB match became a bye
                    return advanceWinnerDoubleElimination(newMatches, nextWbMatch, registrations);
                }
            }
        }
        // Advance loser to LB (if loser exists)
        if (loserId) {
            // Simplified LB placement: find first available slot in an appropriate LB round
            // This needs a proper mapping for a real DE bracket.
            let targetLbRound;
            // WB R1 losers -> LB R1 or R2 (depending on structure)
            // WB R2 losers -> LB R3 or R4 etc.
            // For a standard N-team DE, WB round R losers drop to LB round 2R-1 or 2R.
            if (round === 1) targetLbRound = 1; // Simplification: WB R1 losers to LB R1
            else targetLbRound = (round * 2) - 2; // WB R2 -> LB R2, WB R3 -> LB R4 (approx)
            
            // Find an LB match in targetLbRound that needs a participant
            // This assumes specific pairing, which is not robust.
            let targetLbMatchIndex = -1;
            const lbMatchesInRound = newMatches.filter(m => m.bracketType === 'losers' && m.round === targetLbRound);
            
            // Try to place loser based on WB match number (very rough pairing)
            const expectedLbMatchNumber = Math.ceil(matchNumberInRound / 2); 
            targetLbMatchIndex = newMatches.findIndex(m => m.bracketType === 'losers' && m.round === targetLbRound && m.matchNumberInRound === expectedLbMatchNumber && (!m.team1Id || !m.team2Id));

            if (targetLbMatchIndex === -1) { // Fallback: first available slot in target round
                 targetLbMatchIndex = newMatches.findIndex(m => m.bracketType === 'losers' && m.round === targetLbRound && (!m.team1Id || !m.team2Id));
            }
             if (targetLbMatchIndex === -1 && targetLbRound + 1 <= getMaxRoundForBracket(newMatches, 'losers') ) { // Fallback: first available slot in next target round
                 targetLbRound++;
                 targetLbMatchIndex = newMatches.findIndex(m => m.bracketType === 'losers' && m.round === targetLbRound && (!m.team1Id || !m.team2Id));
            }


            if (targetLbMatchIndex !== -1) {
                const originalTargetLbMatch = newMatches[targetLbMatchIndex];
                let targetLbMatch = {...originalTargetLbMatch};
                let changedInLb = false;

                // Simple placement: if team1 is empty, or if team2 is empty and team1 isn't this loser.
                if (!targetLbMatch.team1Id) { targetLbMatch.team1Id = loserId; changedInLb = true; }
                else if (!targetLbMatch.team2Id && targetLbMatch.team1Id !== loserId) { targetLbMatch.team2Id = loserId; changedInLb = true; }
                
                if (changedInLb) {
                    targetLbMatch.isBye = false; // Assume not a bye if a loser drops in
                    targetLbMatch.winnerId = undefined;
                    targetLbMatch.score = undefined;
                    // Check if this LB match becomes a bye (if its OTHER feeder was a bye from LB or another WB drop)
                    // This part of DE bye logic is complex and omitted for this simplification pass
                    newMatches[targetLbMatchIndex] = targetLbMatch;
                }
            }
        }
    } else { // Winner of WB (round === maxWbRound) advances to Grand Final team1 slot
      const gfMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinal');
      if (gfMatchIndex !== -1 && newMatches[gfMatchIndex].team1Id !== winnerId) {
        newMatches[gfMatchIndex].team1Id = winnerId;
        newMatches[gfMatchIndex].isBye = !(newMatches[gfMatchIndex].team1Id && newMatches[gfMatchIndex].team2Id); // GF is bye if one team missing
        if(newMatches[gfMatchIndex].isBye) newMatches[gfMatchIndex].winnerId = newMatches[gfMatchIndex].team1Id || newMatches[gfMatchIndex].team2Id;
        else newMatches[gfMatchIndex].winnerId = undefined;
      }
    }
  } else if (bracketType === 'losers') {
    const maxLbRound = getMaxRoundForBracket(newMatches, 'losers');
    if (round < maxLbRound) { // Not the LB final match
        // Advance winner in LB. This also needs a proper pairing logic.
        // Simplified: find next LB match in next round, first available slot logic is not robust for LB.
        // Assuming specific pairing logic for LB. Example: Winner of L_R_M advances to L_{R+1}_{ceil(M/2)} if R is odd (loser drops), or L_{R+1}_M if R is even (winners play)
        let nextLbRound = round + 1;
        let nextLbMatchNumber;
        // This pairing logic is highly dependent on specific DE bracket structure.
        // For instance, after losers drop, they play, then winners play other winners or other dropped losers.
        // Placeholder:
        nextLbMatchNumber = Math.ceil(matchNumberInRound / 2);


        const nextLbMatchIndex = newMatches.findIndex(m => m.bracketType === 'losers' && m.round === nextLbRound && m.matchNumberInRound === nextLbMatchNumber);
        if (nextLbMatchIndex !== -1) {
            const originalNextLbMatch = newMatches[nextLbMatchIndex];
            let nextLbMatch = {...originalNextLbMatch};
            let changed = false;

            if (matchNumberInRound % 2 === 1 || !nextLbMatch.team1Id) { // Simplified placement
                 if(nextLbMatch.team1Id !== winnerId) {nextLbMatch.team1Id = winnerId; changed = true; }
            } else {
                 if(nextLbMatch.team2Id !== winnerId) {nextLbMatch.team2Id = winnerId; changed = true; }
            }
            if (changed) {
                nextLbMatch.isBye = false; // Assume not a bye if filled
                nextLbMatch.winnerId = undefined; nextLbMatch.score = undefined;
                // Add logic here to check if nextLbMatch becomes a bye due to ITS other feeder.
                newMatches[nextLbMatchIndex] = nextLbMatch;
                 if (nextLbMatch.isBye && nextLbMatch.winnerId && nextLbMatch.id !== updatedMatch.id) {
                    return advanceWinnerDoubleElimination(newMatches, nextLbMatch, registrations);
                }
            }
        }
    } else { // Winner of LB (round === maxLbRound) advances to Grand Final team2 slot
      const gfMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinal');
      if (gfMatchIndex !== -1 && newMatches[gfMatchIndex].team2Id !== winnerId) {
        newMatches[gfMatchIndex].team2Id = winnerId;
        newMatches[gfMatchIndex].isBye = !(newMatches[gfMatchIndex].team1Id && newMatches[gfMatchIndex].team2Id);
        if(newMatches[gfMatchIndex].isBye) newMatches[gfMatchIndex].winnerId = newMatches[gfMatchIndex].team1Id || newMatches[gfMatchIndex].team2Id;
        else newMatches[gfMatchIndex].winnerId = undefined;

        // If GF becomes a bye and has a winner (e.g. WB winner waiting, LB winner is BYE), then propagate GF.
        const gfFinal = newMatches[gfMatchIndex];
        if (gfFinal.isBye && gfFinal.winnerId && gfFinal.winnerId === gfFinal.team1Id) { // WB champ wins by default if LB finalist is bye
            // This means WB champ wins the tournament.
            const gfResetIndex = newMatches.findIndex(m => m.bracketType === 'grandFinalReset');
            if (gfResetIndex !== -1) {
                newMatches[gfResetIndex].isBye = true; // Deactivate reset
                newMatches[gfResetIndex].winnerId = undefined; // Ensure it's not carrying a winner
            }
        }

      }
    }
  } else if (bracketType === 'grandFinal') {
    const gfResetMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinalReset');
    if (winnerId === team1Id) { // WB Winner wins GF
      if (gfResetMatchIndex !== -1) {
         newMatches[gfResetMatchIndex].isBye = true; 
         newMatches[gfResetMatchIndex].team1Id = undefined;
         newMatches[gfResetMatchIndex].team2Id = undefined;
         newMatches[gfResetMatchIndex].winnerId = undefined; // Ensure it's fully reset
      }
    } else if (winnerId === team2Id && team1Id && team2Id) { // LB Winner wins GF
      if (gfResetMatchIndex !== -1) {
        newMatches[gfResetMatchIndex].team1Id = team1Id; 
        newMatches[gfResetMatchIndex].team2Id = team2Id; 
        newMatches[gfResetMatchIndex].isBye = false; 
        newMatches[gfResetMatchIndex].winnerId = undefined; 
        newMatches[gfResetMatchIndex].score = undefined;
      }
    }
  } else if (bracketType === 'grandFinalReset') {
    // Winner of this match is the tournament champion. No further advancement.
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

  const fromMatchIndex = clearedMatches.findIndex(m => m.id === matchIdToClearFrom);
  if (fromMatchIndex === -1) return clearedMatches;

  clearedMatches[fromMatchIndex] = {
    ...clearedMatches[fromMatchIndex],
    winnerId: undefined,
    score: undefined,
  };
  
  if (tournamentType === 'single') {
      let queue: Match[] = [clearedMatches[fromMatchIndex]];
      const visitedForClearing = new Set<string>(); // Prevent infinite loops in complex clear scenarios

      while(queue.length > 0) {
          const currentCleared = queue.shift()!;
          if (!currentCleared || visitedForClearing.has(currentCleared.id)) continue;
          visitedForClearing.add(currentCleared.id);

          // Determine the next match this currentCleared match would feed into
          const maxRoundForBracket = getMaxRoundForBracket(clearedMatches, currentCleared.bracketType as 'winners'); // SE only has 'winners'
          if (currentCleared.round >= maxRoundForBracket) continue;


          const nextRound = currentCleared.round + 1;
          const nextMatchNumber = Math.ceil(currentCleared.matchNumberInRound / 2);
          
          const nextMatchIdx = clearedMatches.findIndex(m => 
              m.bracketType === currentCleared.bracketType && 
              m.round === nextRound && 
              m.matchNumberInRound === nextMatchNumber
          );

          if (nextMatchIdx !== -1) {
              let nextMatchOriginal = clearedMatches[nextMatchIdx];
              let nextMatchUpdated = {...nextMatchOriginal};
              let changed = false;

              // Check if the participant from currentCleared match needs to be removed from nextMatchUpdated
              if (currentCleared.matchNumberInRound % 2 === 1) { // currentCleared was team1 source for nextMatchUpdated
                  if (nextMatchUpdated.team1Id) { // If team1 slot was filled by this path
                       nextMatchUpdated.team1Id = undefined;
                       changed = true;
                  }
              } else { // currentCleared was team2 source for nextMatchUpdated
                  if (nextMatchUpdated.team2Id) { // If team2 slot was filled by this path
                      nextMatchUpdated.team2Id = undefined;
                      changed = true;
                  }
              }

              // If participants changed, or if it had a winner, reset winner/score/bye status
              if (changed || nextMatchUpdated.winnerId) {
                  nextMatchUpdated.winnerId = undefined;
                  nextMatchUpdated.score = undefined;
                  // Re-evaluate if it's a bye only if one participant remains from the *other* feeder.
                  // If both feeders are now undetermined, it's not a bye.
                  if (nextMatchUpdated.team1Id && !nextMatchUpdated.team2Id) {
                      // Check if team2's feeder ensures team1 gets a bye
                      const team2FeederNumber = nextMatchUpdated.matchNumberInRound * 2;
                      const team2Feeder = clearedMatches.find(m => m.round === nextRound -1 && m.matchNumberInRound === team2FeederNumber && m.bracketType === currentCleared.bracketType);
                      if (team2Feeder && team2Feeder.isBye && team2Feeder.winnerId) nextMatchUpdated.isBye = true; else nextMatchUpdated.isBye = false;
                      if(nextMatchUpdated.isBye) nextMatchUpdated.winnerId = nextMatchUpdated.team1Id;

                  } else if (!nextMatchUpdated.team1Id && nextMatchUpdated.team2Id) {
                       const team1FeederNumber = (nextMatchUpdated.matchNumberInRound * 2) -1;
                       const team1Feeder = clearedMatches.find(m => m.round === nextRound -1 && m.matchNumberInRound === team1FeederNumber && m.bracketType === currentCleared.bracketType);
                       if (team1Feeder && team1Feeder.isBye && team1Feeder.winnerId) nextMatchUpdated.isBye = true; else nextMatchUpdated.isBye = false;
                       if(nextMatchUpdated.isBye) nextMatchUpdated.winnerId = nextMatchUpdated.team2Id;
                  } else {
                      nextMatchUpdated.isBye = false; // Not a bye if both slots empty or both filled by non-byes
                  }
                  
                  if (JSON.stringify(nextMatchOriginal) !== JSON.stringify(nextMatchUpdated)){
                     clearedMatches[nextMatchIdx] = nextMatchUpdated;
                     queue.push(nextMatchUpdated); // Add to queue to clear further
                  }
              }
          }
      }
  } else if (tournamentType === 'double_elimination') {
    // For DE, clearing is very complex.
    // A simple approach for now: reset the current match.
    // And try to clear the immediate next matches this one feeds into (one in WB, one in LB if applicable).
    // This won't fully propagate. A full reset via regeneration might be better for major changes.
    
    const { round, matchNumberInRound, bracketType } = clearedMatches[fromMatchIndex];

    if (bracketType === 'winners') {
        // Clear next WB match slot
        const nextWbRound = round + 1;
        const nextWbMatchNum = Math.ceil(matchNumberInRound / 2);
        const nextWbIdx = clearedMatches.findIndex(m => m.bracketType === 'winners' && m.round === nextWbRound && m.matchNumberInRound === nextWbMatchNum);
        if (nextWbIdx !== -1) {
            if (matchNumberInRound % 2 === 1) clearedMatches[nextWbIdx].team1Id = undefined;
            else clearedMatches[nextWbIdx].team2Id = undefined;
            clearedMatches[nextWbIdx].winnerId = undefined; clearedMatches[nextWbIdx].score = undefined; clearedMatches[nextWbIdx].isBye = false;
            // Potentially add clearedMatches[nextWbIdx] to a queue for further limited clearing
        }
        // Clear corresponding LB match slot (simplistic)
        // This requires knowing which LB match the loser would have gone to.
    } else if (bracketType === 'losers') {
        // Clear next LB match slot
        // Finding the "next" LB match is non-trivial.
    } else if (bracketType === 'grandFinal') {
        // If clearing GF, also reset the GF reset match
        const gfResetIdx = clearedMatches.findIndex(m => m.bracketType === 'grandFinalReset');
        if (gfResetIdx !== -1) {
            clearedMatches[gfResetIdx].team1Id = undefined; clearedMatches[gfResetIdx].team2Id = undefined;
            clearedMatches[gfResetIdx].winnerId = undefined; clearedMatches[gfResetIdx].score = undefined;
            clearedMatches[gfResetIdx].isBye = true;
        }
    }
    // GrandFinalReset clearing has no further effect.
  }
  return clearedMatches;
};


    