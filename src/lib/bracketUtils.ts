
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
function getMaxRoundForBracket(matches: Match[], bracketType: 'winners' | 'losers' | 'grandFinal' | 'grandFinalReset' | 'single'): number {
    const bracketMatches = matches.filter(m => m.bracketType === bracketType || (bracketType === 'single' && m.bracketType === 'winners'));
    if (bracketMatches.length === 0) return 0;
    return Math.max(...bracketMatches.map(m => m.round));
}

async function propagateGeneratedByesDE(initialMatches: Match[], bracketTypeScope: 'winners' | 'losers'): Promise<Match[]> {
  let currentMatches = JSON.parse(JSON.stringify(initialMatches)) as Match[]; // Deep copy
  let madeChangeInPass;

  const maxRound = getMaxRoundForBracket(currentMatches, bracketTypeScope);

  do {
    madeChangeInPass = false;
    for (const match of currentMatches) {
      if (match.bracketType === bracketTypeScope && match.isBye && match.winnerId && match.round < maxRound) {
        const nextRound = match.round + 1;
        const nextMatchNumberInRound = Math.ceil(match.matchNumberInRound / 2);
        const nextMatchIdx = currentMatches.findIndex(
          (m: Match) => m.bracketType === bracketTypeScope && m.round === nextRound && m.matchNumberInRound === nextMatchNumberInRound
        );

        if (nextMatchIdx !== -1) {
          const targetMatchOriginal = currentMatches[nextMatchIdx];
          let targetMatchUpdated = { ...targetMatchOriginal };
          let slotFilled = false;

          if (match.matchNumberInRound % 2 === 1) { 
            if (targetMatchUpdated.team1Id !== match.winnerId) {
              targetMatchUpdated.team1Id = match.winnerId;
              slotFilled = true;
            }
          } else { 
            if (targetMatchUpdated.team2Id !== match.winnerId) {
              targetMatchUpdated.team2Id = match.winnerId;
              slotFilled = true;
            }
          }

          if (slotFilled) {
            const feeder1MatchNumber = (targetMatchUpdated.matchNumberInRound * 2) - 1;
            const feeder2MatchNumber = targetMatchUpdated.matchNumberInRound * 2;
            const prevRoundNumber = targetMatchUpdated.round - 1;

            const feeder1 = currentMatches.find(m => m.bracketType === bracketTypeScope && m.round === prevRoundNumber && m.matchNumberInRound === feeder1MatchNumber);
            const feeder2 = currentMatches.find(m => m.bracketType === bracketTypeScope && m.round === prevRoundNumber && m.matchNumberInRound === feeder2MatchNumber);
            
            const feeder1IsResolvedBye = feeder1 && feeder1.isBye && feeder1.winnerId;
            const feeder2IsResolvedBye = feeder2 && feeder2.isBye && feeder2.winnerId;

            if (targetMatchUpdated.team1Id && !targetMatchUpdated.team2Id) {
              if (feeder2IsResolvedBye) { 
                targetMatchUpdated.isBye = true;
                targetMatchUpdated.winnerId = targetMatchUpdated.team1Id;
              } else { 
                targetMatchUpdated.isBye = false;
                targetMatchUpdated.winnerId = undefined;
              }
            } else if (!targetMatchUpdated.team1Id && targetMatchUpdated.team2Id) {
              if (feeder1IsResolvedBye) { 
                targetMatchUpdated.isBye = true;
                targetMatchUpdated.winnerId = targetMatchUpdated.team2Id;
              } else {
                targetMatchUpdated.isBye = false;
                targetMatchUpdated.winnerId = undefined;
              }
            } else if (targetMatchUpdated.team1Id && targetMatchUpdated.team2Id) { 
              targetMatchUpdated.isBye = false;
              targetMatchUpdated.winnerId = undefined;
            }
            
            if (JSON.stringify(targetMatchOriginal) !== JSON.stringify(targetMatchUpdated)) {
                 currentMatches[nextMatchIdx] = targetMatchUpdated;
                 madeChangeInPass = true; 
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
  initialRegistrations: RegisteredEntry[],
  maxTeamsCap: number
): Promise<Match[]> {
  let participants = [...initialRegistrations];
  // Shuffle for fairness in initial matchups if not seeded
  participants.sort(() => Math.random() - 0.5); 

  if (participants.length > maxTeamsCap) {
    participants = participants.slice(0, maxTeamsCap);
  }

  if (participants.length < 2) {
    if (participants.length === 1) { // Handle single participant tournament
        return [{
            id: crypto.randomUUID(),
            tournamentId,
            round: 1,
            matchNumberInRound: 1,
            bracketType: 'winners',
            team1Id: participants[0].id,
            team2Id: undefined,
            isBye: true,
            winnerId: participants[0].id,
        }];
    }
    return []; // Not enough participants
  }

  const allMatches: Match[] = [];
  // `advancingSlots` will hold IDs of participants for the current round's pairings
  // null indicates a slot to be filled by a winner from a previous match.
  let advancingSlots: (string | null)[] = participants.map(p => p.id); 
  let round = 1;

  // Loop until only one winner remains (or until no more pairs can be made)
  while (advancingSlots.length > 1) {
    const nextRoundAdvancingSlots: (string | null)[] = [];
    let matchNumberInRound = 1;
    
    let currentRoundParticipantsAndPlaceholders = [...advancingSlots];
    
    // If odd number, one participant/placeholder gets a bye to the next round of *pairing*
    let participantReceivingByeThisPairingStage: string | null = null;
    if (currentRoundParticipantsAndPlaceholders.length % 2 !== 0) {
      // Prioritize giving byes to actual players over placeholders to avoid empty matches later if possible
      let byeCandidateIndex = currentRoundParticipantsAndPlaceholders.findIndex(p => p !== null && !p.startsWith('winner-of-'));
      if (byeCandidateIndex === -1) { // If all are placeholders or null, just pick the first one
        byeCandidateIndex = 0;
      }
      participantReceivingByeThisPairingStage = currentRoundParticipantsAndPlaceholders.splice(byeCandidateIndex, 1)[0];
      if (participantReceivingByeThisPairingStage) { // Should always be true
          nextRoundAdvancingSlots.push(participantReceivingByeThisPairingStage);
      }
    }

    // Create matches for the current round
    for (let i = 0; i < currentRoundParticipantsAndPlaceholders.length; i += 2) {
      const team1Feeder = currentRoundParticipantsAndPlaceholders[i]; 
      const team2Feeder = currentRoundParticipantsAndPlaceholders[i + 1]; // Should always exist due to even length now

      const matchId = crypto.randomUUID();
      allMatches.push({
        id: matchId,
        tournamentId,
        round: round,
        matchNumberInRound: matchNumberInRound++,
        bracketType: 'winners', // Single elimination uses 'winners' for bracketType
        // If feeder is a placeholder (e.g., "winner-of-XYZ"), teamId is undefined initially.
        // Otherwise, it's a direct participant ID.
        team1Id: team1Feeder && team1Feeder.startsWith('winner-of-') ? undefined : team1Feeder, 
        team2Id: team2Feeder && team2Feeder.startsWith('winner-of-') ? undefined : team2Feeder, 
        isBye: false, // Byes are handled by advancing participant directly to nextRoundAdvancingSlots
      });
      // The winner of this newly created match will advance.
      nextRoundAdvancingSlots.push(`winner-of-${matchId}`); 
    }
    
    advancingSlots = nextRoundAdvancingSlots;
    // Order of advancingSlots now matters for deterministic pairing in the next round.
    // Standard brackets usually pair top half vs bottom half, or 1st vs last, 2nd vs 2nd-last etc.
    // For simplicity here, we'll keep the order (byes first, then match winners in order of creation).
    round++;

    if (round > 20) break; // Safety break to prevent infinite loops
  }
  
  return allMatches;
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

    if (isTeam1Bye && !isTeam2Bye) { // team1 is BYE, team2 is Player
        match.team1Id = team2.id; // Player visually takes the first slot
        match.team2Id = undefined;
        match.isBye = true;
        match.winnerId = team2.id;
    } else if (!isTeam1Bye && isTeam2Bye) { // team1 is Player, team2 is BYE
        match.isBye = true;
        match.winnerId = team1.id;
    } else if (isTeam1Bye && isTeam2Bye) {
        match.team1Id = team1.id; 
        match.team2Id = undefined;
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
  
  allMatches = await propagateGeneratedByesDE(allMatches, 'winners');

  // --- Losers' Bracket (LB) --- Placeholder Structure
  const wbFinalRound = getMaxRoundForBracket(allMatches, 'winners');
  let lbRoundNumber = 1;
  let numLbMatches = bracketSize / 2; 

  for (let r = 0; r < wbFinalRound * 2 -2 ; r++) { 
      let matchesThisLbRound = Math.max(1, numLbMatches / Math.pow(2, Math.floor(r/2) + (r%2) ) ); 
      if (r > 0 && r%2 !== 0 ) matchesThisLbRound = Math.max(1, numLbMatches / Math.pow(2, Math.floor(r/2) +1 ));

      if (wbFinalRound > 1 && r === 0 && bracketSize > 2) matchesThisLbRound = bracketSize / 4;
      else if (wbFinalRound > 1 && r === 1 && bracketSize > 4) matchesThisLbRound = bracketSize / 4;
      
      if (matchesThisLbRound < 1 && wbFinalRound > 0) matchesThisLbRound = 1; 

      for (let i = 0; i < matchesThisLbRound; i++) {
        if (allMatches.filter(m => m.bracketType === 'losers').length >= (bracketSize-2) && bracketSize > 2) break; 
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
      if (matchesThisLbRound === 1 && r > 0) break; 
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

async function advanceWinnerSingleElimination(
  currentMatches: Match[],
  updatedMatch: Match,
  registrations: RegisteredEntry[] // Keep for signature, though not directly used for SE participant data
): Promise<Match[]> {
  let newMatches = JSON.parse(JSON.stringify(currentMatches)) as Match[]; // Deep copy

  const uMatchIndex = newMatches.findIndex(m => m.id === updatedMatch.id);
  if (uMatchIndex !== -1) {
      newMatches[uMatchIndex] = {...updatedMatch}; 
  }

  if (!updatedMatch.winnerId && !updatedMatch.isBye) { 
    if (uMatchIndex !== -1) {
        newMatches[uMatchIndex].winnerId = undefined;
        newMatches[uMatchIndex].score = undefined;
    }
    return clearSubsequentMatches(newMatches, updatedMatch, 'single');
  }
  
  if (updatedMatch.isBye && updatedMatch.winnerId && 
      updatedMatch.winnerId !== updatedMatch.team1Id && updatedMatch.winnerId !== updatedMatch.team2Id &&
      (updatedMatch.team1Id || updatedMatch.team2Id) ) { // ensure there was a participant in the bye
    console.warn("Advancing a bye match with an inconsistent winner. Correcting.", updatedMatch);
    if (uMatchIndex !== -1) {
        newMatches[uMatchIndex].winnerId = newMatches[uMatchIndex].team1Id || newMatches[uMatchIndex].team2Id;
        updatedMatch.winnerId = newMatches[uMatchIndex].winnerId; // update the copy we are working with
    }
  }
  
  if (!updatedMatch.winnerId) return newMatches; 

  const { round, matchNumberInRound, winnerId } = updatedMatch;
  const maxRoundForBracket = getMaxRoundForBracket(newMatches, 'winners');
  if (round >= maxRoundForBracket) {
    return newMatches; 
  }

  const nextRound = round + 1;
  const nextMatchNumberInRound = Math.ceil(matchNumberInRound / 2);

  const nextMatchIndex = newMatches.findIndex(
    m => m.round === nextRound && m.matchNumberInRound === nextMatchNumberInRound && m.bracketType === 'winners'
  );

  if (nextMatchIndex !== -1) {
    const nextMatchOriginal = { ...newMatches[nextMatchIndex] }; 
    let nextMatch = newMatches[nextMatchIndex]; 

    if (matchNumberInRound % 2 === 1) { 
      if (nextMatch.team1Id === undefined) {
        nextMatch.team1Id = winnerId;
      } else if (nextMatch.team1Id !== winnerId) {
        console.warn(`Conflict: Tried to place ${winnerId} in team1 slot of match ${nextMatch.id} (SE), but it was already ${nextMatch.team1Id}`);
      }
    } else { 
      if (nextMatch.team2Id === undefined) {
        nextMatch.team2Id = winnerId;
      } else if (nextMatch.team2Id !== winnerId) {
        console.warn(`Conflict: Tried to place ${winnerId} in team2 slot of match ${nextMatch.id} (SE), but it was already ${nextMatch.team2Id}`);
      }
    }
    
    nextMatch.winnerId = undefined; 
    nextMatch.score = undefined;    

    const matchesInPreviousRound = newMatches.filter(m => m.round === round && m.bracketType === 'winners' && !m.isBye).length;

    if (nextMatch.team1Id && nextMatch.team2Id) {
        nextMatch.isBye = false;
    } else if (nextMatch.team1Id && !nextMatch.team2Id) {
        const team2FeederMatchNumber = nextMatch.matchNumberInRound * 2;
        const team2FeederExists = newMatches.some(m => m.round === round && m.matchNumberInRound === team2FeederMatchNumber && m.bracketType === 'winners');
        if (!team2FeederExists || team2FeederMatchNumber > matchesInPreviousRound) { 
            nextMatch.isBye = true;
            nextMatch.winnerId = nextMatch.team1Id;
        } else {
            nextMatch.isBye = false; 
        }
    } else if (!nextMatch.team1Id && nextMatch.team2Id) {
        const team1FeederMatchNumber = (nextMatch.matchNumberInRound * 2) - 1;
        const team1FeederExists = newMatches.some(m => m.round === round && m.matchNumberInRound === team1FeederMatchNumber && m.bracketType === 'winners');

        if (!team1FeederExists || team1FeederMatchNumber > matchesInPreviousRound) { 
            nextMatch.isBye = true;
            nextMatch.winnerId = nextMatch.team2Id;
        } else {
            nextMatch.isBye = false; 
        }
    } else { 
        nextMatch.isBye = false; 
    }

    if (JSON.stringify(nextMatchOriginal) !== JSON.stringify(nextMatch)) {
        newMatches[nextMatchIndex] = nextMatch; 
        if (nextMatch.isBye && nextMatch.winnerId) {
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
  if (updatedMatch.isBye && updatedMatch.winnerId !== (updatedMatch.team1Id || updatedMatch.team2Id) && (updatedMatch.team1Id || updatedMatch.team2Id) ) {
      console.warn("Attempted to change winner of a DE bye match incorrectly.", updatedMatch);
      // Correct the winner if it's a bye
      const uMatchIdx = newMatches.findIndex(m => m.id === updatedMatch.id);
      if (uMatchIdx !== -1) {
        newMatches[uMatchIdx].winnerId = newMatches[uMatchIdx].team1Id || newMatches[uMatchIdx].team2Id;
        updatedMatch.winnerId = newMatches[uMatchIdx].winnerId; // update working copy
      }
  }
  if (!updatedMatch.winnerId) return newMatches;

  const { id: matchId, round, matchNumberInRound, winnerId, bracketType, team1Id, team2Id } = updatedMatch;
  const loserId = winnerId === team1Id ? team2Id : team1Id;

  if (bracketType === 'winners') {
    const maxWbRound = getMaxRoundForBracket(newMatches, 'winners');
    if (round < maxWbRound) { 
        const nextWbRound = round + 1;
        const nextWbMatchNumber = Math.ceil(matchNumberInRound / 2);
        const nextWbMatchIndex = newMatches.findIndex(m => m.bracketType === 'winners' && m.round === nextWbRound && m.matchNumberInRound === nextWbMatchNumber);

        if (nextWbMatchIndex !== -1) {
            const originalNextWbMatch = newMatches[nextWbMatchIndex];
            let nextWbMatch = {...originalNextWbMatch};
            let changed = false;

            if (matchNumberInRound % 2 === 1) { 
                if(nextWbMatch.team1Id === undefined ) { nextWbMatch.team1Id = winnerId; changed = true;}
                else if(nextWbMatch.team1Id !== winnerId) { console.warn("DE WB Conflict team1", winnerId, nextWbMatch); }

            } else { 
                if(nextWbMatch.team2Id === undefined) { nextWbMatch.team2Id = winnerId; changed = true;}
                 else if(nextWbMatch.team2Id !== winnerId) { console.warn("DE WB Conflict team2", winnerId, nextWbMatch); }
            }

            if(changed) {
                nextWbMatch.winnerId = undefined;
                nextMatch.score = undefined;
                nextWbMatch.isBye = false; 

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
                    // Use return await for recursive calls that return Promise<Match[]>
                    newMatches = await advanceWinnerDoubleElimination(newMatches, nextWbMatch, registrations);
                }
            }
        }
        if (loserId) {
            let targetLbRound;
            // Simplified LB placement logic - this needs refinement for standard DE progression
            if (round === 1) targetLbRound = 1; 
            else targetLbRound = (round * 2) - 2; // This formula might not be universally correct for DE
            
            let targetLbMatchIndex = -1;
            // Attempt to find a specific match based on WB structure, then a generic open slot.
            const expectedLbMatchNumber = Math.ceil(matchNumberInRound / 2); 
            targetLbMatchIndex = newMatches.findIndex(m => m.bracketType === 'losers' && m.round === targetLbRound && m.matchNumberInRound === expectedLbMatchNumber && (!m.team1Id || !m.team2Id));

            if (targetLbMatchIndex === -1) { 
                 targetLbMatchIndex = newMatches.findIndex(m => m.bracketType === 'losers' && m.round === targetLbRound && (!m.team1Id || !m.team2Id));
            }
             if (targetLbMatchIndex === -1 && targetLbRound + 1 <= getMaxRoundForBracket(newMatches, 'losers') ) { 
                 targetLbRound++; // Try next LB round
                 targetLbMatchIndex = newMatches.findIndex(m => m.bracketType === 'losers' && m.round === targetLbRound && (!m.team1Id || !m.team2Id));
            }


            if (targetLbMatchIndex !== -1) {
                const originalTargetLbMatch = newMatches[targetLbMatchIndex];
                let targetLbMatch = {...originalTargetLbMatch};
                let changedInLb = false;

                // Place loser in the first available slot
                if (!targetLbMatch.team1Id) { targetLbMatch.team1Id = loserId; changedInLb = true; }
                else if (!targetLbMatch.team2Id && targetLbMatch.team1Id !== loserId) { targetLbMatch.team2Id = loserId; changedInLb = true; }
                
                if (changedInLb) {
                    targetLbMatch.isBye = false; 
                    targetLbMatch.winnerId = undefined;
                    targetLbMatch.score = undefined;
                    newMatches[targetLbMatchIndex] = targetLbMatch;
                    // TODO: If placing this loser creates a bye in LB, it should be propagated.
                }
            } else {
                console.warn("Could not find suitable Losers' Bracket match for loser:", loserId, "from WB Round", round);
            }
        }
    } else { // Winner of WB Final Round
      const gfMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinal');
      if (gfMatchIndex !== -1 ) {
        let gfMatch = newMatches[gfMatchIndex];
        if (gfMatch.team1Id !== winnerId) {
            gfMatch.team1Id = winnerId; // WB Winner goes to team1 slot of GF
            gfMatch.isBye = !(gfMatch.team1Id && gfMatch.team2Id); 
            if(gfMatch.isBye) gfMatch.winnerId = gfMatch.team1Id || gfMatch.team2Id;
            else gfMatch.winnerId = undefined;
            newMatches[gfMatchIndex] = gfMatch;
        }
      }
    }
  } else if (bracketType === 'losers') {
    const maxLbRound = getMaxRoundForBracket(newMatches, 'losers');
    if (round < maxLbRound) { 
        let nextLbRound = round + 1;
        let nextLbMatchNumber = Math.ceil(matchNumberInRound / 2); // Simplified

        const nextLbMatchIndex = newMatches.findIndex(m => m.bracketType === 'losers' && m.round === nextLbRound && m.matchNumberInRound === nextLbMatchNumber);
        if (nextLbMatchIndex !== -1) {
            const originalNextLbMatch = newMatches[nextLbMatchIndex];
            let nextLbMatch = {...originalNextLbMatch};
            let changed = false;

            // Place winner in the first available slot or appropriate slot based on pairing
            if (matchNumberInRound % 2 === 1 || !nextLbMatch.team1Id) { 
                 if(nextLbMatch.team1Id === undefined) {nextLbMatch.team1Id = winnerId; changed = true; }
                 else if (nextLbMatch.team1Id !== winnerId) { console.warn("DE LB Conflict team1", winnerId, nextLbMatch); }
            } else {
                 if(nextLbMatch.team2Id === undefined) {nextLbMatch.team2Id = winnerId; changed = true; }
                 else if (nextLbMatch.team2Id !== winnerId) { console.warn("DE LB Conflict team2", winnerId, nextLbMatch); }
            }
            if (changed) {
                nextLbMatch.isBye = !(nextLbMatch.team1Id && nextLbMatch.team2Id); 
                nextLbMatch.winnerId = undefined; nextLbMatch.score = undefined;
                 if(nextLbMatch.isBye) nextLbMatch.winnerId = nextLbMatch.team1Id || nextLbMatch.team2Id;

                newMatches[nextLbMatchIndex] = nextLbMatch;
                 if (nextLbMatch.isBye && nextLbMatch.winnerId && nextLbMatch.id !== updatedMatch.id) {
                    newMatches = await advanceWinnerDoubleElimination(newMatches, nextLbMatch, registrations);
                }
            }
        }
    } else { // Winner of LB Final Round
      const gfMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinal');
      if (gfMatchIndex !== -1) {
        let gfMatch = newMatches[gfMatchIndex];
        if (gfMatch.team2Id !== winnerId) {
            gfMatch.team2Id = winnerId; // LB Winner goes to team2 slot of GF
            gfMatch.isBye = !(gfMatch.team1Id && gfMatch.team2Id);
            if(gfMatch.isBye) gfMatch.winnerId = gfMatch.team1Id || gfMatch.team2Id;
            else gfMatch.winnerId = undefined;
            newMatches[gfMatchIndex] = gfMatch;

            // If GF becomes a bye due to LB winner and WB winner is already there, and WB winner wins the bye
            if (gfMatch.isBye && gfMatch.winnerId && gfMatch.winnerId === gfMatch.team1Id) { 
                const gfResetIndex = newMatches.findIndex(m => m.bracketType === 'grandFinalReset');
                if (gfResetIndex !== -1) {
                    newMatches[gfResetIndex].isBye = true; // Reset match is not needed
                    newMatches[gfResetIndex].winnerId = undefined; 
                }
            }
        }
      }
    }
  } else if (bracketType === 'grandFinal') {
    const gfResetMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinalReset');
    if (winnerId === team1Id) { // WB winner wins GF
      if (gfResetMatchIndex !== -1) {
         newMatches[gfResetMatchIndex].isBye = true; // Reset not needed
         newMatches[gfResetMatchIndex].team1Id = undefined;
         newMatches[gfResetMatchIndex].team2Id = undefined;
         newMatches[gfResetMatchIndex].winnerId = undefined; 
      }
    } else if (winnerId === team2Id && team1Id && team2Id) { // LB winner wins GF, force reset
      if (gfResetMatchIndex !== -1) {
        newMatches[gfResetMatchIndex].team1Id = team1Id; 
        newMatches[gfResetMatchIndex].team2Id = team2Id; 
        newMatches[gfResetMatchIndex].isBye = false; // Reset match is now active
        newMatches[gfResetMatchIndex].winnerId = undefined; 
        newMatches[gfResetMatchIndex].score = undefined;
      }
    }
  } else if (bracketType === 'grandFinalReset') {
    // Winner of this match is the tournament champion. No further advancement.
  }
  return newMatches;
}


export async function advanceWinner (
  currentMatches: Match[],
  updatedMatch: Match,
  registrations: RegisteredEntry[],
  tournamentType: TournamentType
): Promise<Match[]> {
  let newMatches = JSON.parse(JSON.stringify(currentMatches)) as Match[];
  const matchIdx = newMatches.findIndex(m => m.id === updatedMatch.id);
  if (matchIdx !== -1) {
      newMatches[matchIdx] = {...updatedMatch}; // Ensure the initially updated match is in the array
  } else {
      console.error("Updated match not found in currentMatches array for advancement.");
      return currentMatches; // Should not happen
  }


  if (tournamentType === 'single') {
    return advanceWinnerSingleElimination(newMatches, updatedMatch, registrations);
  } else if (tournamentType === 'double_elimination') {
    return advanceWinnerDoubleElimination(newMatches, updatedMatch, registrations);
  }
  return newMatches; 
};


async function clearSubsequentMatchesSingle(
  matches: Match[],
  sourceMatch: Match // This is the match whose winner was cleared, already updated in `matches`
): Promise<Match[]> {
  let newMatches = JSON.parse(JSON.stringify(matches)) as Match[];
  let queue: Match[] = [sourceMatch];
  const visitedForClearing = new Set<string>();

  while (queue.length > 0) {
    const currentIterationSourceMatch = queue.shift()!; // The match whose outgoing path we are clearing
    
    // Check if already processed to avoid cycles or redundant work if a match feeds itself (not in SE)
    if (visitedForClearing.has(currentIterationSourceMatch.id)) continue;
    visitedForClearing.add(currentIterationSourceMatch.id);

    const maxRound = getMaxRoundForBracket(newMatches, 'winners'); // SE uses 'winners'
    if (currentIterationSourceMatch.round >= maxRound) continue; // No further matches to clear from this one

    const nextRound = currentIterationSourceMatch.round + 1;
    const nextMatchNumber = Math.ceil(currentIterationSourceMatch.matchNumberInRound / 2);

    const nextMatchFedIndex = newMatches.findIndex(m =>
      m.bracketType === 'winners' &&
      m.round === nextRound &&
      m.matchNumberInRound === nextMatchNumber
    );

    if (nextMatchFedIndex !== -1) {
      const originalNextFed = {...newMatches[nextMatchFedIndex]}; // For comparison
      let nextMatchFed = newMatches[nextMatchFedIndex]; // Direct reference
      let participantRemoved = false;

      // Determine which slot in nextMatchFed was fed by currentIterationSourceMatch
      if (currentIterationSourceMatch.matchNumberInRound % 2 === 1) { // currentIterationSourceMatch was team1 source for nextMatchFed
        if (nextMatchFed.team1Id !== undefined) { 
          nextMatchFed.team1Id = undefined;
          participantRemoved = true;
        }
      } else { // currentIterationSourceMatch was team2 source for nextMatchFed
        if (nextMatchFed.team2Id !== undefined) {
          nextMatchFed.team2Id = undefined;
          participantRemoved = true;
        }
      }
      
      // If a participant was removed from nextMatchFed OR if nextMatchFed already had a winner (implying it was resolved from this path and needs reset)
      if (participantRemoved || nextMatchFed.winnerId) {
        nextMatchFed.winnerId = undefined;
        nextMatchFed.score = undefined;
        nextMatchFed.isBye = false; // When clearing, assume it's no longer a resolved bye from this path
        
        // Only add to queue if the state of nextMatchFed actually changed.
        if (JSON.stringify(originalNextFed) !== JSON.stringify(nextMatchFed)) {
            newMatches[nextMatchFedIndex] = nextMatchFed; // Persist change
            queue.push(nextMatchFed); // Add to queue to clear its dependents
        }
      }
    }
  }
  return newMatches;
}

export async function clearSubsequentMatches (
  currentMatches: Match[],
  fromMatch: Match, // The match where the winner was initially cleared by the user
  tournamentType: TournamentType
): Promise<Match[]> {
  let matchesToUpdate = JSON.parse(JSON.stringify(currentMatches)) as Match[]; 

  const fromMatchIndex = matchesToUpdate.findIndex(m => m.id === fromMatch.id);
  if (fromMatchIndex === -1) return matchesToUpdate;

  // The fromMatch itself is already updated by the caller to have no winnerId/score.
  // We pass this already-updated version of fromMatch to the specific clearing functions.
  const initialMatchToClearFrom = matchesToUpdate[fromMatchIndex];
  initialMatchToClearFrom.winnerId = undefined;
  initialMatchToClearFrom.score = undefined;
  // Generally, isBye status of 'fromMatch' doesn't change when its winner is cleared,
  // unless it was a dynamically formed bye that's now invalid.
  // For SE, if it was a structural bye from generation, it remains so. If it was a dynamically formed one,
  // it should become !isBye. Handled by SE clear.
  
  if (tournamentType === 'single') {
      // For single elimination, `initialMatchToClearFrom`'s isBye might need to become false
      // if it was a dynamically created bye from a previous advanceWinner call.
      // The clearSubsequentMatchesSingle will handle resetting isBye for subsequent matches.
      if (initialMatchToClearFrom.team1Id && initialMatchToClearFrom.team2Id) {
           initialMatchToClearFrom.isBye = false; // If both participants were set, it definitely wasn't a pending bye.
      }
      // If it had one participant and was a bye, clearing winner might mean it's no longer a resolved bye.
      // However, the structural nature of byes in the new SE gen means this is less of an issue for fromMatch.
      return clearSubsequentMatchesSingle(matchesToUpdate, initialMatchToClearFrom);
  } else if (tournamentType === 'double_elimination') {
    // DE clearing logic remains complex and simplified for now.
    // This part needs significant enhancement for robust DE bracket management.
    console.warn("Clearing subsequent matches in Double Elimination is currently simplified.");
    
    // Basic reset of direct dependents for DE
    const { round, matchNumberInRound, bracketType } = initialMatchToClearFrom;

    const clearTargetSlotDE = (targetMatchQuery: Partial<Match>, slotToClear: 'team1' | 'team2') => {
        const targetIdx = matchesToUpdate.findIndex(m => 
            m.bracketType === targetMatchQuery.bracketType && 
            m.round === targetMatchQuery.round && 
            m.matchNumberInRound === targetMatchQuery.matchNumberInRound
        );
        if (targetIdx !== -1) {
            if (slotToClear === 'team1') matchesToUpdate[targetIdx].team1Id = undefined;
            else matchesToUpdate[targetIdx].team2Id = undefined;
            
            matchesToUpdate[targetIdx].winnerId = undefined;
            matchesToUpdate[targetIdx].score = undefined;
            matchesToUpdate[targetIdx].isBye = false; // Simplified reset
            // TODO: Queue this match for further clearing in DE.
        }
    };

    if (bracketType === 'winners') {
        const nextWbRound = round + 1;
        const nextWbMatchNum = Math.ceil(matchNumberInRound / 2);
        clearTargetSlotDE({ bracketType: 'winners', round: nextWbRound, matchNumberInRound: nextWbMatchNum }, matchNumberInRound % 2 === 1 ? 'team1' : 'team2');
        // Also need to clear the corresponding Losers' Bracket entry. This is very complex to trace.
    } else if (bracketType === 'losers') {
        const nextLbRound = round + 1;
        const nextLbMatchNum = Math.ceil(matchNumberInRound / 2); // Simplified
        clearTargetSlotDE({ bracketType: 'losers', round: nextLbRound, matchNumberInRound: nextLbMatchNum }, matchNumberInRound % 2 === 1 ? 'team1' : 'team2');
    } else if (bracketType === 'grandFinal') {
        const gfResetMatchIdx = matchesToUpdate.findIndex(m => m.bracketType === 'grandFinalReset');
        if (gfResetMatchIdx !== -1) {
            matchesToUpdate[gfResetMatchIdx].team1Id = undefined;
            matchesToUpdate[gfResetMatchIdx].team2Id = undefined;
            matchesToUpdate[gfResetMatchIdx].winnerId = undefined;
            matchesToUpdate[gfResetMatchIdx].score = undefined;
            matchesToUpdate[gfResetMatchIdx].isBye = true; // Reset match becomes inactive
        }
    }
  }
  return matchesToUpdate;
};

