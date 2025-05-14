
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

// Helper to check if a number is a power of two
const isPowerOfTwo = (n: number): boolean => {
    if (n <= 0) return false;
    return (n & (n - 1)) === 0;
};

// Helper to get the largest power of two less than or equal to n
const getPreviousPowerOfTwo = (n: number): number => {
    if (n <= 0) return 0;
    let power = 1;
    while (power * 2 <= n) {
        power *= 2;
    }
    return power;
};


// Helper to get max round for a specific bracket type
function getMaxRoundForBracket(matches: Match[], bracketType: 'winners' | 'losers' | 'grandFinal' | 'grandFinalReset' | 'single'): number {
    const relevantBracketTypes = bracketType === 'single' ? ['winners'] : [bracketType];
    const bracketMatches = matches.filter(m => relevantBracketTypes.includes(m.bracketType));
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
  // Optional: Shuffle for fairness if not seeded. For now, using order of registration.
  // participants.sort(() => Math.random() - 0.5); 

  if (participants.length > maxTeamsCap) {
    participants = participants.slice(0, maxTeamsCap);
  }

  const N = participants.length;
  if (N === 0) return [];
  if (N === 1) {
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

  const allMatches: Match[] = [];
  let roundCounter = 1;
  type Feeder = string | { winnerOfMatchId: string };
  let feedersForMainBracket: Feeder[];

  if (isPowerOfTwo(N)) {
    feedersForMainBracket = participants.map(p => p.id as Feeder);
  } else {
    const prevPowerOfTwo = getPreviousPowerOfTwo(N); // e.g., for N=9, prevPowerOfTwo=8. This is the target size for the main bracket's first round.
    const numPlayInMatches = N - prevPowerOfTwo;
    const numParticipantsInPlayIn = numPlayInMatches * 2;
    const numByesPastPlayIn = N - numParticipantsInPlayIn;

    // Assuming participants are sorted by seed (highest first) or registration order
    const byeParticipants = participants.slice(0, numByesPastPlayIn);
    const playInParticipants = participants.slice(numByesPastPlayIn);

    feedersForMainBracket = byeParticipants.map(p => p.id as Feeder);

    let matchNumberInPlayInRound = 1;
    for (let i = 0; i < playInParticipants.length; i += 2) {
      const team1Entry = playInParticipants[i];
      const team2Entry = playInParticipants[i + 1]; // Might be undefined if an odd number of players end up in play-in pool due to prior logic, though numParticipantsInPlayIn should be even.

      const matchId = crypto.randomUUID();
      const playInMatch: Match = {
        id: matchId,
        tournamentId,
        round: roundCounter, // Play-in round is Round 1
        matchNumberInRound: matchNumberInPlayInRound++,
        bracketType: 'winners',
        team1Id: team1Entry.id,
        team2Id: team2Entry ? team2Entry.id : undefined,
        isBye: !team2Entry, // A play-in slot is a bye only if its opponent is missing
      };

      if (playInMatch.isBye) {
        playInMatch.winnerId = team1Entry.id; // Winner is the one present
        feedersForMainBracket.push(team1Entry.id); // Advances directly
      } else {
        feedersForMainBracket.push({ winnerOfMatchId: matchId }); // Winner placeholder advances
      }
      allMatches.push(playInMatch);
    }
    roundCounter++; // Increment for the first round of the main bracket
  }

  // Main bracket generation (starting from a power-of-two number of feeders)
  let currentFeeders = feedersForMainBracket;
  // Optional: Shuffle feedersForMainBracket if seeding/pairing beyond simple order is desired for the main bracket.
  // currentFeeders.sort(() => Math.random() - 0.5);


  while (currentFeeders.length > 1) {
    const currentRoundMatches: Match[] = [];
    const nextRoundFeeders: Feeder[] = [];
    let matchNumberInCurrentRound = 1;

    for (let i = 0; i < currentFeeders.length; i += 2) {
      const feeder1 = currentFeeders[i];
      const feeder2 = currentFeeders[i + 1];
      const matchId = crypto.randomUUID();

      const team1Id = typeof feeder1 === 'string' ? feeder1 : undefined;
      const team1FeederMatchId = typeof feeder1 !== 'string' ? feeder1.winnerOfMatchId : undefined;
      
      const team2Id = typeof feeder2 === 'string' ? feeder2 : undefined;
      const team2FeederMatchId = typeof feeder2 !== 'string' ? feeder2.winnerOfMatchId : undefined;

      const newMatch: Match = {
        id: matchId,
        tournamentId,
        round: roundCounter,
        matchNumberInRound: matchNumberInCurrentRound++,
        bracketType: 'winners',
        team1Id,
        team2Id,
        team1FeederMatchId,
        team2FeederMatchId,
        isBye: false, // Structural byes are handled before this loop or by advanceWinner if a feeder match was a bye
      };
      
      // A match in a power-of-two round can only become a bye if one of its feeders was *already* a resolved bye
      // and the other feeder slot *also* resolves to a bye or is empty.
      // This dynamic bye determination is best handled by advanceWinner when feeder results come in.
      // For initial generation, if team1Id is present and team2Id is TBD (via team2FeederMatchId), it's not a bye yet.
      currentRoundMatches.push(newMatch);
      nextRoundFeeders.push({ winnerOfMatchId: matchId });
    }
    
    allMatches.push(...currentRoundMatches);
    currentFeeders = nextRoundFeeders;
    roundCounter++;

    if (roundCounter > 20) break; // Safety break
  }
  
  return allMatches;
}


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
    } else if (isTeam1Bye && isTeam2Bye) { // Should not happen if byes < participants
        match.team1Id = team1.id; // Arbitrary assignment for a full BYE match
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
  updatedMatch: Match, // The match that was just decided
  registrations: RegisteredEntry[] 
): Promise<Match[]> {
  let newMatches = JSON.parse(JSON.stringify(currentMatches)) as Match[]; // Deep copy

  const uMatchIndex = newMatches.findIndex(m => m.id === updatedMatch.id);
  if (uMatchIndex !== -1) {
    newMatches[uMatchIndex] = { ...newMatches[uMatchIndex], ...updatedMatch };
  } else {
    console.error("Updated match not found for SE advancement start.");
    return currentMatches;
  }
  
  // If winner was cleared, handle subsequent match clearing
  if (!updatedMatch.winnerId && !updatedMatch.isBye) { 
    return clearSubsequentMatchesSingle(newMatches, updatedMatch);
  }

  // If it's a bye, its winner is already set. 
  // Or, if a winner was set for a non-bye match, propagate it.
  if (updatedMatch.winnerId) {
    // Find the match this one feeds into
    const nextMatchIndex = newMatches.findIndex(m =>
      m.bracketType === 'winners' &&
      (m.team1FeederMatchId === updatedMatch.id || m.team2FeederMatchId === updatedMatch.id)
    );

    if (nextMatchIndex !== -1) {
      let nextMatch = { ...newMatches[nextMatchIndex] }; // Work with a copy
      let changed = false;

      if (nextMatch.team1FeederMatchId === updatedMatch.id) {
        if (nextMatch.team1Id !== updatedMatch.winnerId) {
          nextMatch.team1Id = updatedMatch.winnerId;
          changed = true;
        }
      } else if (nextMatch.team2FeederMatchId === updatedMatch.id) {
        if (nextMatch.team2Id !== updatedMatch.winnerId) {
          nextMatch.team2Id = updatedMatch.winnerId;
          changed = true;
        }
      }
      
      if (changed) {
        // If a participant changed, winner of nextMatch is no longer valid
        nextMatch.winnerId = undefined; 
        nextMatch.score = undefined;
        
        // Check if nextMatch now becomes a bye
        // This happens if one participant is set, and the other slot has no feeder and no participant
        if (nextMatch.team1Id && !nextMatch.team2Id && !nextMatch.team2FeederMatchId) {
          nextMatch.isBye = true;
          nextMatch.winnerId = nextMatch.team1Id;
        } else if (!nextMatch.team1Id && !nextMatch.team1FeederMatchId && nextMatch.team2Id) {
          nextMatch.isBye = true;
          nextMatch.winnerId = nextMatch.team2Id;
        } else {
          nextMatch.isBye = false; // If both slots are now filled (or one filled and other has feeder), not a bye
        }
        
        newMatches[nextMatchIndex] = nextMatch;
        // If this nextMatch became a bye AND has a winner, recursively call advanceWinner for it.
        if (nextMatch.isBye && nextMatch.winnerId) {
          // Ensure we don't recurse on the same match if updatedMatch was already a bye.
          if (updatedMatch.id !== nextMatch.id) {
             return advanceWinnerSingleElimination(newMatches, nextMatch, registrations);
          }
        }
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

  const uMatchIndexOriginal = newMatches.findIndex(m => m.id === updatedMatch.id);
  if (uMatchIndexOriginal !== -1) {
      newMatches[uMatchIndexOriginal] = {...newMatches[uMatchIndexOriginal], ...updatedMatch};
  }


  if (!updatedMatch.winnerId && !updatedMatch.isBye) {
    return clearSubsequentMatches(newMatches, updatedMatch, 'double_elimination');
  }
  if (updatedMatch.isBye && updatedMatch.winnerId !== (updatedMatch.team1Id || updatedMatch.team2Id) && (updatedMatch.team1Id || updatedMatch.team2Id) ) {
      console.warn("Attempted to change winner of a DE bye match incorrectly.", updatedMatch);
      // Correct the winner if it's a bye
      const uMatchIdx = newMatches.findIndex(m => m.id === updatedMatch.id);
      if (uMatchIdx !== -1) {
        newMatches[uMatchIdx].winnerId = newMatches[uMatchIdx].team1Id || newMatches[uMatchIdx].team2Id;
        // updatedMatch.winnerId = newMatches[uMatchIdx].winnerId; // update working copy if needed by subsequent logic
      }
  }
  if (!updatedMatch.winnerId) return newMatches; // No winner to advance

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
                nextWbMatch.score = undefined; // Corrected from nextMatch.score
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
                    newMatches = await advanceWinnerDoubleElimination(newMatches, nextWbMatch, registrations);
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
            } else {
                console.warn("Could not find suitable Losers' Bracket match for loser:", loserId, "from WB Round", round);
            }
        }
    } else { // Winner of WB Final Round
      const gfMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinal');
      if (gfMatchIndex !== -1 ) {
        let gfMatch = newMatches[gfMatchIndex];
        if (gfMatch.team1Id !== winnerId) { // Check if already set to avoid issues on re-click
            gfMatch.team1Id = winnerId; 
            gfMatch.isBye = !(gfMatch.team1Id && gfMatch.team2Id); 
            if(gfMatch.isBye) gfMatch.winnerId = gfMatch.team1Id || gfMatch.team2Id;
            else { gfMatch.winnerId = undefined; gfMatch.score = undefined; } // Reset if it was a bye and now isn't
            newMatches[gfMatchIndex] = gfMatch;
        }
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
        if (gfMatch.team2Id !== winnerId) { // Check if already set
            gfMatch.team2Id = winnerId; 
            gfMatch.isBye = !(gfMatch.team1Id && gfMatch.team2Id);
            if(gfMatch.isBye) gfMatch.winnerId = gfMatch.team1Id || gfMatch.team2Id;
            else { gfMatch.winnerId = undefined; gfMatch.score = undefined; }
            newMatches[gfMatchIndex] = gfMatch;

            if (gfMatch.isBye && gfMatch.winnerId && gfMatch.winnerId === gfMatch.team1Id) { 
                const gfResetIndex = newMatches.findIndex(m => m.bracketType === 'grandFinalReset');
                if (gfResetIndex !== -1) {
                    newMatches[gfResetIndex].isBye = true; 
                    newMatches[gfResetIndex].winnerId = undefined; 
                }
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
        if(!newMatches[gfResetMatchIndex].team1Id || !newMatches[gfResetMatchIndex].team2Id || newMatches[gfResetMatchIndex].isBye) { // Only update if reset match wasn't already active or correctly populated
            newMatches[gfResetMatchIndex].team1Id = team1Id; 
            newMatches[gfResetMatchIndex].team2Id = team2Id; 
            newMatches[gfResetMatchIndex].isBye = false; 
            newMatches[gfResetMatchIndex].winnerId = undefined; 
            newMatches[gfResetMatchIndex].score = undefined;
        }
      }
    }
  } else if (bracketType === 'grandFinalReset') {
    // Winner is tournament champion.
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
      newMatches[matchIdx] = {...newMatches[matchIdx], ...updatedMatch};
  } else {
      console.error("Updated match not found in currentMatches array for advancement.");
      return currentMatches; 
  }

  if (tournamentType === 'single') {
    return advanceWinnerSingleElimination(newMatches, newMatches[matchIdx], registrations);
  } else if (tournamentType === 'double_elimination') {
    return advanceWinnerDoubleElimination(newMatches, newMatches[matchIdx], registrations);
  }
  return newMatches; 
}

async function clearSubsequentMatchesSingle(
  matches: Match[], // Already a deep copy from the caller
  sourceMatch: Match // The match whose winner was cleared, state is already updated in `matches`
): Promise<Match[]> {
  let queue: string[] = [sourceMatch.id]; // Start with the ID of the match that was directly modified
  const processedForClearing = new Set<string>(); // To avoid reprocessing

  while (queue.length > 0) {
    const currentSourceMatchId = queue.shift()!;
    if (processedForClearing.has(currentSourceMatchId)) continue;
    processedForClearing.add(currentSourceMatchId);

    // Find matches in the next round that are fed by currentSourceMatchId
    const dependentMatchesIndices = matches
      .map((match, index) => ({ match, index }))
      .filter(({ match }) => 
        match.bracketType === 'winners' &&
        (match.team1FeederMatchId === currentSourceMatchId || match.team2FeederMatchId === currentSourceMatchId)
      )
      .map(({ index }) => index);

    for (const nextMatchIdx of dependentMatchesIndices) {
      const originalNextMatch = { ...matches[nextMatchIdx] };
      let nextMatch = matches[nextMatchIdx]; // Direct reference for modification
      let changed = false;

      if (nextMatch.team1FeederMatchId === currentSourceMatchId && nextMatch.team1Id !== undefined) {
        nextMatch.team1Id = undefined;
        changed = true;
      }
      if (nextMatch.team2FeederMatchId === currentSourceMatchId && nextMatch.team2Id !== undefined) {
        nextMatch.team2Id = undefined;
        changed = true;
      }

      // If a participant was removed or if the match previously had a winner (implying it needs full reset)
      if (changed || nextMatch.winnerId) {
        nextMatch.winnerId = undefined;
        nextMatch.score = undefined;
        
        // A match is only a bye if structurally defined (e.g. one feeder slot is totally empty with no feeder ID)
        if (nextMatch.team1Id && !nextMatch.team2Id && !nextMatch.team2FeederMatchId) {
            nextMatch.isBye = true; nextMatch.winnerId = nextMatch.team1Id;
        } else if (!nextMatch.team1Id && !nextMatch.team1FeederMatchId && nextMatch.team2Id) {
            nextMatch.isBye = true; nextMatch.winnerId = nextMatch.team2Id;
        } else {
            nextMatch.isBye = false;
        }
        
        if (JSON.stringify(originalNextMatch) !== JSON.stringify(nextMatch)) {
            matches[nextMatchIdx] = nextMatch; // Persist changes
            if(!nextMatch.isBye) { 
                 queue.push(nextMatch.id); 
            } else if (nextMatch.isBye && nextMatch.winnerId){
                 // If it became a bye, it should be propagated by advanceWinner.
                 // For SE, this might mean calling advanceWinnerSingleElimination here if we expect immediate propagation.
                 // However, typically the user action of clearing a winner should just clear, and a separate action (or re-evaluation) would propagate byes.
                 // For simplicity of "clear", we stop direct propagation of new byes from here.
            }
        }
      }
    }
  }
  return matches;
}


export async function clearSubsequentMatches (
  currentMatches: Match[],
  fromMatch: Match, 
  tournamentType: TournamentType
): Promise<Match[]> {
  let matchesToUpdate = JSON.parse(JSON.stringify(currentMatches)) as Match[]; 

  const fromMatchIndex = matchesToUpdate.findIndex(m => m.id === fromMatch.id);
  if (fromMatchIndex === -1) return matchesToUpdate;

  // Ensure the source match itself is cleared of winner/score
  matchesToUpdate[fromMatchIndex].winnerId = undefined;
  matchesToUpdate[fromMatchIndex].score = undefined;
  
  if (tournamentType === 'single') {
      if (matchesToUpdate[fromMatchIndex].team1Id && matchesToUpdate[fromMatchIndex].team2Id) {
          matchesToUpdate[fromMatchIndex].isBye = false; 
      }
      return clearSubsequentMatchesSingle(matchesToUpdate, matchesToUpdate[fromMatchIndex]);
  } else if (tournamentType === 'double_elimination') {
    console.warn("Clearing subsequent matches in Double Elimination is currently simplified.");
    
    const { round, matchNumberInRound, bracketType } = matchesToUpdate[fromMatchIndex];

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
            matchesToUpdate[targetIdx].isBye = false; 
        }
    };

    if (bracketType === 'winners') {
        const nextWbRound = round + 1;
        const nextWbMatchNum = Math.ceil(matchNumberInRound / 2);
        clearTargetSlotDE({ bracketType: 'winners', round: nextWbRound, matchNumberInRound: nextWbMatchNum }, matchNumberInRound % 2 === 1 ? 'team1' : 'team2');
    } else if (bracketType === 'losers') {
        const nextLbRound = round + 1;
        const nextLbMatchNum = Math.ceil(matchNumberInRound / 2); 
        clearTargetSlotDE({ bracketType: 'losers', round: nextLbRound, matchNumberInRound: nextLbMatchNum }, matchNumberInRound % 2 === 1 ? 'team1' : 'team2');
    } else if (bracketType === 'grandFinal') {
        const gfResetMatchIdx = matchesToUpdate.findIndex(m => m.bracketType === 'grandFinalReset');
        if (gfResetMatchIdx !== -1) {
            matchesToUpdate[gfResetMatchIdx].team1Id = undefined;
            matchesToUpdate[gfResetMatchIdx].team2Id = undefined;
            matchesToUpdate[gfResetMatchIdx].winnerId = undefined;
            matchesToUpdate[gfResetMatchIdx].score = undefined;
            matchesToUpdate[gfResetMatchIdx].isBye = true; 
        }
    }
  }
  return matchesToUpdate;
}


    