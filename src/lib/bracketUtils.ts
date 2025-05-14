
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
  participants.sort(() => Math.random() - 0.5); // Shuffle for random pairing

  // Cap participants at maxTeamsCap
  if (participants.length > maxTeamsCap) {
    participants = participants.slice(0, maxTeamsCap);
  }

  if (participants.length < 2) return [];

  const allMatches: Match[] = [];
  // `advancingSlots` will hold IDs of participants for the current round's pairings
  let advancingSlots: (string | null)[] = participants.map(p => p.id); 
  let round = 1;

  // Keep track of which original participant IDs feed into which "null" (TBD) slots
  const placeholderFeedSource = new Map<string, string>(); // Key: placeholderId, Value: sourceMatchId

  while (advancingSlots.length > 1) {
    const nextRoundAdvancingSlots: (string | null)[] = [];
    let matchNumberInRound = 1;
    
    const numSlotsThisRound = advancingSlots.length;
    const idealBracketSizeForThisLevel = getNextPowerOfTwo(numSlotsThisRound);
    const numByesThisLevel = idealBracketSizeForThisLevel - numSlotsThisRound;

    const playingThisLevel: (string | null)[] = [];
    const receivingByesThisLevel: (string | null)[] = [];

    // Distribute byes: those at the end of the shuffled list get byes if not perfectly balanced.
    // Prioritize actual players for byes over "TBD" slots if mixed.
    const sortedForByeDistribution = [...advancingSlots].sort((a, b) => {
      if (a === null && b !== null) return 1; // nulls (TBDs) play first if possible
      if (a !== null && b === null) return -1;
      return 0; // then random order
    });
    
    for (let i = 0; i < sortedForByeDistribution.length; i++) {
      if (i < numByesThisLevel) {
        receivingByesThisLevel.push(sortedForByeDistribution[i]);
      } else {
        playingThisLevel.push(sortedForByeDistribution[i]);
      }
    }
    
    // Add players receiving byes directly to the next round's advancing slots
    nextRoundAdvancingSlots.push(...receivingByesThisLevel);

    // Create matches for those playing
    for (let i = 0; i < playingThisLevel.length; i += 2) {
      const team1Id = playingThisLevel[i]; 
      const team2Id = playingThisLevel[i + 1]; // Should always exist due to even `playingThisLevel.length`

      const matchId = crypto.randomUUID();
      allMatches.push({
        id: matchId,
        tournamentId,
        round: round,
        matchNumberInRound: matchNumberInRound++,
        bracketType: 'winners', // Single elimination uses 'winners' for bracketType
        team1Id: team1Id || undefined, 
        team2Id: team2Id || undefined, 
        isBye: false, // These are actual matches, not byes in the sense of "vs BYE entity"
      });
      const placeholderId = `winner-of-${matchId}`;
      placeholderFeedSource.set(placeholderId, matchId);
      nextRoundAdvancingSlots.push(placeholderId); // Winner of this match advances
    }
    
    advancingSlots = nextRoundAdvancingSlots;
    advancingSlots.sort(() => Math.random() - 0.5); // Shuffle for next round's pairings
    round++;

    if (round > 20) break; // Safety break
  }
  
  // The matches are created with undefined team1Id/team2Id if they are fed by a previous match.
  // The `advanceWinner` function will populate these.
  // No explicit "Player vs BYE" matches are created. Players who get byes skip rounds of play.
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
        // This case means two byes meet. One effectively advances.
        // Mark one slot with the "advancing" bye entity, make it a bye.
        match.team1Id = team1.id; 
        match.team2Id = undefined;
        match.isBye = true;
        match.winnerId = team1.id; // team1 (a BYE entity) "wins"
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
  registrations: RegisteredEntry[] // Not strictly needed with new SE generation, but kept for signature consistency
): Promise<Match[]> {
   let newMatches = [...currentMatches]; 

  if (!updatedMatch.winnerId && !updatedMatch.isBye) { 
    return clearSubsequentMatches(newMatches, updatedMatch, 'single');
  }
  
  if (updatedMatch.isBye && updatedMatch.winnerId !== (updatedMatch.team1Id || updatedMatch.team2Id)) {
      // This scenario should not occur with the new SE generation if a match is marked `isBye=true`.
      // It's more relevant for DE or manual bye setting.
      console.warn("Attempted to change winner of a bye match incorrectly in SE.", updatedMatch);
      return newMatches;
  }
  
  if (!updatedMatch.winnerId) return newMatches; 


  const { round, matchNumberInRound, winnerId } = updatedMatch;
  // For SE, all matches are 'winners' bracketType.
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
        // If participants changed, reset winner/score.
        // With new SE gen, `isBye` should remain false for these subsequent matches unless both feeders become byes (not possible in SE path).
        nextMatch.winnerId = undefined;
        nextMatch.score = undefined;
        nextMatch.isBye = false; // A match fed by winners is not intrinsically a bye.
    }

    // Check if nextMatch could become a bye IF its OTHER feeder was an auto-advanced bye.
    // This scenario is less likely with the new SE generation but kept for robustness.
    if (nextMatch.team1Id && !nextMatch.team2Id) {
        const otherFeederMatchNumber = nextMatch.matchNumberInRound * 2;
        const otherFeeder = newMatches.find(m => m.round === round && m.matchNumberInRound === otherFeederMatchNumber && m.bracketType === 'winners');
        if (otherFeeder && otherFeeder.isBye && otherFeeder.winnerId) { // This 'isBye' refers to DE style byes.
             if (!nextMatch.isBye || nextMatch.winnerId !== nextMatch.team1Id) {
                  nextMatch.isBye = true; nextMatch.winnerId = nextMatch.team1Id;
             }
        }
    } else if (!nextMatch.team1Id && nextMatch.team2Id) {
        const otherFeederMatchNumber = (nextMatch.matchNumberInRound * 2) - 1;
        const otherFeeder = newMatches.find(m => m.round === round && m.matchNumberInRound === otherFeederMatchNumber && m.bracketType === 'winners');
        if (otherFeeder && otherFeeder.isBye && otherFeeder.winnerId) {
            if (!nextMatch.isBye || nextMatch.winnerId !== nextMatch.team2Id) {
                nextMatch.isBye = true; nextMatch.winnerId = nextMatch.team2Id;
            }
        }
    }
    // If both slots are filled, it's definitely not a bye.
    else if (nextMatch.team1Id && nextMatch.team2Id) {
        nextMatch.isBye = false;
        nextMatch.winnerId = undefined; // Ensure winner is clear if it was previously a bye.
    }


    if (JSON.stringify(nextMatchOriginal) !== JSON.stringify(nextMatch)){
        newMatches[nextMatchIndex] = nextMatch;
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
    if (round < maxWbRound) { 
        const nextWbRound = round + 1;
        const nextWbMatchNumber = Math.ceil(matchNumberInRound / 2);
        const nextWbMatchIndex = newMatches.findIndex(m => m.bracketType === 'winners' && m.round === nextWbRound && m.matchNumberInRound === nextWbMatchNumber);

        if (nextWbMatchIndex !== -1) {
            const originalNextWbMatch = newMatches[nextWbMatchIndex];
            let nextWbMatch = {...originalNextWbMatch};
            let changed = false;

            if (matchNumberInRound % 2 === 1) { 
                if(nextWbMatch.team1Id !== winnerId) { nextWbMatch.team1Id = winnerId; changed = true;}
            } else { 
                if(nextWbMatch.team2Id !== winnerId) { nextWbMatch.team2Id = winnerId; changed = true;}
            }

            if(changed) {
                nextWbMatch.winnerId = undefined;
                nextWbMatch.score = undefined;
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
                    return advanceWinnerDoubleElimination(newMatches, nextWbMatch, registrations);
                }
            }
        }
        if (loserId) {
            let targetLbRound;
            if (round === 1) targetLbRound = 1; 
            else targetLbRound = (round * 2) - 2; 
            
            let targetLbMatchIndex = -1;
            const expectedLbMatchNumber = Math.ceil(matchNumberInRound / 2); 
            targetLbMatchIndex = newMatches.findIndex(m => m.bracketType === 'losers' && m.round === targetLbRound && m.matchNumberInRound === expectedLbMatchNumber && (!m.team1Id || !m.team2Id));

            if (targetLbMatchIndex === -1) { 
                 targetLbMatchIndex = newMatches.findIndex(m => m.bracketType === 'losers' && m.round === targetLbRound && (!m.team1Id || !m.team2Id));
            }
             if (targetLbMatchIndex === -1 && targetLbRound + 1 <= getMaxRoundForBracket(newMatches, 'losers') ) { 
                 targetLbRound++;
                 targetLbMatchIndex = newMatches.findIndex(m => m.bracketType === 'losers' && m.round === targetLbRound && (!m.team1Id || !m.team2Id));
            }


            if (targetLbMatchIndex !== -1) {
                const originalTargetLbMatch = newMatches[targetLbMatchIndex];
                let targetLbMatch = {...originalTargetLbMatch};
                let changedInLb = false;

                if (!targetLbMatch.team1Id) { targetLbMatch.team1Id = loserId; changedInLb = true; }
                else if (!targetLbMatch.team2Id && targetLbMatch.team1Id !== loserId) { targetLbMatch.team2Id = loserId; changedInLb = true; }
                
                if (changedInLb) {
                    targetLbMatch.isBye = false; 
                    targetLbMatch.winnerId = undefined;
                    targetLbMatch.score = undefined;
                    newMatches[targetLbMatchIndex] = targetLbMatch;
                }
            }
        }
    } else { 
      const gfMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinal');
      if (gfMatchIndex !== -1 && newMatches[gfMatchIndex].team1Id !== winnerId) {
        newMatches[gfMatchIndex].team1Id = winnerId;
        newMatches[gfMatchIndex].isBye = !(newMatches[gfMatchIndex].team1Id && newMatches[gfMatchIndex].team2Id); 
        if(newMatches[gfMatchIndex].isBye) newMatches[gfMatchIndex].winnerId = newMatches[gfMatchIndex].team1Id || newMatches[gfMatchIndex].team2Id;
        else newMatches[gfMatchIndex].winnerId = undefined;
      }
    }
  } else if (bracketType === 'losers') {
    const maxLbRound = getMaxRoundForBracket(newMatches, 'losers');
    if (round < maxLbRound) { 
        let nextLbRound = round + 1;
        let nextLbMatchNumber = Math.ceil(matchNumberInRound / 2);

        const nextLbMatchIndex = newMatches.findIndex(m => m.bracketType === 'losers' && m.round === nextLbRound && m.matchNumberInRound === nextLbMatchNumber);
        if (nextLbMatchIndex !== -1) {
            const originalNextLbMatch = newMatches[nextLbMatchIndex];
            let nextLbMatch = {...originalNextLbMatch};
            let changed = false;

            if (matchNumberInRound % 2 === 1 || !nextLbMatch.team1Id) { 
                 if(nextLbMatch.team1Id !== winnerId) {nextLbMatch.team1Id = winnerId; changed = true; }
            } else {
                 if(nextLbMatch.team2Id !== winnerId) {nextLbMatch.team2Id = winnerId; changed = true; }
            }
            if (changed) {
                nextLbMatch.isBye = false; 
                nextLbMatch.winnerId = undefined; nextLbMatch.score = undefined;
                newMatches[nextLbMatchIndex] = nextLbMatch;
                 if (nextLbMatch.isBye && nextLbMatch.winnerId && nextLbMatch.id !== updatedMatch.id) {
                    return advanceWinnerDoubleElimination(newMatches, nextLbMatch, registrations);
                }
            }
        }
    } else { 
      const gfMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinal');
      if (gfMatchIndex !== -1 && newMatches[gfMatchIndex].team2Id !== winnerId) {
        newMatches[gfMatchIndex].team2Id = winnerId;
        newMatches[gfMatchIndex].isBye = !(newMatches[gfMatchIndex].team1Id && newMatches[gfMatchIndex].team2Id);
        if(newMatches[gfMatchIndex].isBye) newMatches[gfMatchIndex].winnerId = newMatches[gfMatchIndex].team1Id || newMatches[gfMatchIndex].team2Id;
        else newMatches[gfMatchIndex].winnerId = undefined;

        const gfFinal = newMatches[gfMatchIndex];
        if (gfFinal.isBye && gfFinal.winnerId && gfFinal.winnerId === gfFinal.team1Id) { 
            const gfResetIndex = newMatches.findIndex(m => m.bracketType === 'grandFinalReset');
            if (gfResetIndex !== -1) {
                newMatches[gfResetIndex].isBye = true; 
                newMatches[gfResetIndex].winnerId = undefined; 
            }
        }
      }
    }
  } else if (bracketType === 'grandFinal') {
    const gfResetMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinalReset');
    if (winnerId === team1Id) { 
      if (gfResetMatchIndex !== -1) {
         newMatches[gfResetMatchIndex].isBye = true; 
         newMatches[gfResetMatchIndex].team1Id = undefined;
         newMatches[gfResetMatchIndex].team2Id = undefined;
         newMatches[gfResetMatchIndex].winnerId = undefined; 
      }
    } else if (winnerId === team2Id && team1Id && team2Id) { 
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

  // Reset the current match's winner and score
  clearedMatches[fromMatchIndex] = {
    ...clearedMatches[fromMatchIndex],
    winnerId: undefined,
    score: undefined,
    // isBye should generally not change when clearing a winner, unless specific logic dictates it
  };
  
  if (tournamentType === 'single') {
      // For single elimination, the new generation logic doesn't rely on complex bye propagation for setup.
      // Clearing a winner should primarily clear the participant from the next match they fed into.
      let queue: Match[] = [clearedMatches[fromMatchIndex]];
      const visitedForClearing = new Set<string>();

      while(queue.length > 0) {
          const currentClearedSourceMatch = queue.shift()!; // The match whose winner was just cleared
          if (!currentClearedSourceMatch || visitedForClearing.has(currentClearedSourceMatch.id)) continue;
          visitedForClearing.add(currentClearedSourceMatch.id);

          const maxRound = getMaxRoundForBracket(clearedMatches, 'winners'); // SE uses 'winners'
          if (currentClearedSourceMatch.round >= maxRound) continue;

          const nextRound = currentClearedSourceMatch.round + 1;
          const nextMatchNumber = Math.ceil(currentClearedSourceMatch.matchNumberInRound / 2);
          
          const nextMatchFedIndex = clearedMatches.findIndex(m => 
              m.bracketType === 'winners' && 
              m.round === nextRound && 
              m.matchNumberInRound === nextMatchNumber
          );

          if (nextMatchFedIndex !== -1) {
              let nextMatchFed = { ...clearedMatches[nextMatchFedIndex] };
              let participantRemoved = false;

              if (currentClearedSourceMatch.matchNumberInRound % 2 === 1) { // currentClearedSourceMatch was team1 source for nextMatchFed
                  if (nextMatchFed.team1Id) { // If team1 slot was filled (by the winner we are now clearing)
                       nextMatchFed.team1Id = undefined;
                       participantRemoved = true;
                  }
              } else { // currentClearedSourceMatch was team2 source for nextMatchFed
                  if (nextMatchFed.team2Id) { 
                      nextMatchFed.team2Id = undefined;
                      participantRemoved = true;
                  }
              }

              // If a participant was removed OR if the fed match already had a winner (implying it was resolved)
              if (participantRemoved || nextMatchFed.winnerId) {
                  nextMatchFed.winnerId = undefined;
                  nextMatchFed.score = undefined;
                  nextMatchFed.isBye = false; // If a feeder is cleared, it's no longer a bye fed by that path.
                                            // A bye could only occur if the OTHER feeder guaranteed it AND was itself a bye.
                                            // This is complex to reinstate perfectly here, simpler to assume not a bye.
                  
                  clearedMatches[nextMatchFedIndex] = nextMatchFed;
                  if(participantRemoved) { // Only continue clearing if we actually changed this match's participants
                     queue.push(nextMatchFed); 
                  }
              }
          }
      }
  } else if (tournamentType === 'double_elimination') {
    // For DE, clearing is very complex due to WB/LB interactions.
    // A simplified approach: reset the current match and its immediate dependents.
    // Full propagation for DE clearing often requires a bracket reset.
    
    const { round, matchNumberInRound, bracketType, team1Id: originalTeam1Id, team2Id: originalTeam2Id } = clearedMatches[fromMatchIndex];

    // Function to clear a specific slot in a target match and reset it
    const clearTargetSlot = (targetMatchId: string | undefined, slotToClear: 'team1' | 'team2') => {
        if (!targetMatchId) return;
        const targetIdx = clearedMatches.findIndex(m => m.id === targetMatchId);
        if (targetIdx !== -1) {
            if (slotToClear === 'team1') clearedMatches[targetIdx].team1Id = undefined;
            else clearedMatches[targetIdx].team2Id = undefined;
            
            clearedMatches[targetIdx].winnerId = undefined;
            clearedMatches[targetIdx].score = undefined;
            // Re-evaluating isBye for DE targets during clear is very complex.
            // For now, if a feeder is cleared, assume it's not a bye unless both slots become determined by other byes.
            // A simple approach is to set isBye to false if a participant is removed.
            if (clearedMatches[targetIdx].team1Id || clearedMatches[targetIdx].team2Id ) { // If at least one participant remains
                 clearedMatches[targetIdx].isBye = false; // Unlikely to be a bye if one side is now TBD
            } else { // If both slots become TBD
                 clearedMatches[targetIdx].isBye = false;
            }

            // TODO: Add this cleared match to a queue for further limited propagation if desired.
        }
    };
    
    // Find WB dependents
    if (bracketType === 'winners') {
        const nextWbRound = round + 1;
        const nextWbMatchNum = Math.ceil(matchNumberInRound / 2);
        const nextWbMatch = clearedMatches.find(m => m.bracketType === 'winners' && m.round === nextWbRound && m.matchNumberInRound === nextWbMatchNum);
        if (nextWbMatch) {
            clearTargetSlot(nextWbMatch.id, matchNumberInRound % 2 === 1 ? 'team1' : 'team2');
        }
        // Also need to consider the loser dropping to LB. This path is harder to trace backwards reliably.
        // For now, we won't try to pull the loser back from LB automatically when clearing a WB match.
    } 
    // Find LB dependents
    else if (bracketType === 'losers') {
        const nextLbRound = round + 1;
        const nextLbMatchNum = Math.ceil(matchNumberInRound / 2); // Simplified assumption
        const nextLbMatch = clearedMatches.find(m => m.bracketType === 'losers' && m.round === nextLbRound && m.matchNumberInRound === nextLbMatchNum);
        if (nextLbMatch) {
            clearTargetSlot(nextLbMatch.id, matchNumberInRound % 2 === 1 ? 'team1' : 'team2'); // Simplified assumption
        }
    } 
    // Find GF dependents
    else if (bracketType === 'grandFinal') {
        const gfResetMatch = clearedMatches.find(m => m.bracketType === 'grandFinalReset');
        if (gfResetMatch) {
            clearTargetSlot(gfResetMatch.id, 'team1'); // Assuming GF winner path relates to team1 in reset, or both.
            clearTargetSlot(gfResetMatch.id, 'team2');
            clearedMatches[clearedMatches.findIndex(m=>m.id === gfResetMatch.id)!].isBye = true; // Reset match becomes inactive bye
        }
    }
    // Clearing GrandFinalReset has no further dependents.
  }
  return clearedMatches;
};
