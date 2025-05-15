

'use server';
/**
 * @fileOverview Utility functions for generating and managing tournament brackets.
 *
 * - generateSingleEliminationBracket - Creates initial matches for a single elimination bracket.
 * - generateDoubleEliminationBracket - Creates initial matches for a double elimination bracket.
 * - advanceWinner - Updates matches when a winner is selected.
 * - clearSubsequentMatches - Resets parts of the bracket.
 */
import type { Match, RegisteredEntry, TournamentType } from './types';

// Helper to get the next power of 2
const getNextPowerOfTwo = (n: number): number => {
  if (n <= 0) return 0;
  let power = 1;
  while (power < n) {
    power *= 2;
  }
  return power;
};

// Helper to create matches from a list of feeders
// Feeders can be direct participant IDs or placeholders for winners/losers of other matches.
async function createMatchesFromFeeders(
  tournamentId: string,
  round: number,
  startingMatchNumberInRound: number,
  feeders: (string | { winnerOfMatchId: string } | { loserOfMatchId: string })[],
  bracketType: 'winners' | 'losers' | 'grandFinal' | 'grandFinalReset'
): Promise<{ matches: Match[], nextRoundFeeders: { winnerOfMatchId: string }[] }> {
  const createdMatches: Match[] = [];
  const nextFeeders: { winnerOfMatchId: string }[] = [];
  let matchNumber = startingMatchNumberInRound;

  // Do NOT shuffle feeders here. Calling function should prepare the list in the desired pairing order.
  // Example: for feeders [A, B, C, D], it will create Match(A,B) and Match(C,D).

  for (let i = 0; i < feeders.length; i += 2) {
    const feeder1 = feeders[i];
    const feeder2 = feeders[i + 1]; // Might be undefined if odd number of feeders (results in a bye)

    const matchId = crypto.randomUUID();
    const newMatch: Match = {
      id: matchId,
      tournamentId,
      round,
      matchNumberInRound: matchNumber++,
      bracketType,
      isBye: false,
    };

    if (typeof feeder1 === 'string') {
      newMatch.team1Id = feeder1;
    } else if ('winnerOfMatchId' in feeder1) {
      newMatch.team1FeederMatchId = feeder1.winnerOfMatchId;
      newMatch.team1FeederType = 'winner';
    } else if ('loserOfMatchId' in feeder1) {
      newMatch.team1FeederMatchId = feeder1.loserOfMatchId;
      newMatch.team1FeederType = 'loser';
    }

    if (feeder2) {
      if (typeof feeder2 === 'string') {
        newMatch.team2Id = feeder2;
      } else if ('winnerOfMatchId' in feeder2) {
        newMatch.team2FeederMatchId = feeder2.winnerOfMatchId;
        newMatch.team2FeederType = 'winner';
      } else if ('loserOfMatchId' in feeder2) {
        newMatch.team2FeederMatchId = feeder2.loserOfMatchId;
        newMatch.team2FeederType = 'loser';
      }
    } else {
      // Feeder2 is undefined, team1 gets a bye IN THIS MATCH
      newMatch.isBye = true;
      if (typeof feeder1 === 'string') { // Direct participant wins bye
        newMatch.winnerId = feeder1;
      } else if (newMatch.team1FeederMatchId) {
        // If feeder1 is a placeholder, the winner is TBD from that feeder match.
        // The match is structurally a bye; winner is determined when feeder1 resolves.
        // `advanceWinner` will propagate this.
      }
    }
    
    createdMatches.push(newMatch);
    nextFeeders.push({ winnerOfMatchId: matchId });
  }
  return { matches: createdMatches, nextRoundFeeders: nextFeeders };
}


export async function generateSingleEliminationBracket(
  tournamentId: string,
  initialRegistrations: RegisteredEntry[],
  maxTeamsCap: number
): Promise<Match[]> {
  let participants = [...initialRegistrations];
  if (participants.length > maxTeamsCap) {
    participants = participants.slice(0, maxTeamsCap);
  }
  participants.sort(() => Math.random() - 0.5); // Shuffle for initial seeding randomness

  const N = participants.length;
  if (N < 2) {
    if (N === 1) { 
      return [{
        id: crypto.randomUUID(), tournamentId, round: 1, matchNumberInRound: 1,
        bracketType: 'winners', team1Id: participants[0].id, isBye: true, winnerId: participants[0].id,
      }];
    }
    return []; 
  }

  const allMatches: Match[] = [];
  let currentRoundNumber = 1;
  
  // Determine play-in round participants and those with byes to the main bracket
  const mainBracketSizeAfterPlayIn = getNextPowerOfTwo(N); // e.g., for N=9, this is 16, which is wrong. Should be next *lower* or specific target.
                                                          // Target size for the first "full" round is S, where S is the smallest power of 2 >= N/2.
                                                          // Let's use S as the size of the first round *after* any necessary play-ins.
                                                          // So, if N=9, S=8. Number of play-ins = N - S = 1.
  
  let targetBracketSizeForMainRound = N;
  if ( (targetBracketSizeForMainRound & (targetBracketSizeForMainRound - 1)) !== 0 ) { // If N is not power of 2
      targetBracketSizeForMainRound = getNextPowerOfTwo(N) / 2; // e.g N=9 -> 16/2=8. N=6 -> 8/2=4. N=5 -> 8/2=4
      if (targetBracketSizeForMainRound < 2 && N > 1) targetBracketSizeForMainRound = 2; // handles N=3 -> target 2
      else if (N <= targetBracketSizeForMainRound) targetBracketSizeForMainRound = getNextPowerOfTwo(N)/2; // if N became small
  }


  const numPlayInMatches = N - targetBracketSizeForMainRound; // e.g., N=9, target=8 -> 1 play-in. N=6, target=4 -> 2 play-ins
  const numParticipantsInPlayIn = numPlayInMatches * 2;
  const numParticipantsWithByesToMain = N - numParticipantsInPlayIn;

  const playInParticipantEntries = participants.slice(numParticipantsWithByesToMain);
  const byeParticipantEntries = participants.slice(0, numParticipantsWithByesToMain);

  let feedersForNextRound: (string | { winnerOfMatchId: string })[] = byeParticipantEntries.map(p => p.id);

  // Create Play-In Matches (if necessary)
  if (numPlayInMatches > 0) {
    const { matches: playInMatches, nextRoundFeeders: playInWinnerFeeders } = await createMatchesFromFeeders(
      tournamentId,
      currentRoundNumber,
      1, 
      playInParticipantEntries.map(p => p.id), // Pass direct participant IDs
      'winners'
    );
    allMatches.push(...playInMatches);
    feedersForNextRound.push(...playInWinnerFeeders); // Winners of play-ins
    currentRoundNumber++;
  }
  
  feedersForNextRound.sort(() => Math.random() - 0.5); // Shuffle feeders for the first main round

  // Main Bracket Rounds
  while (feedersForNextRound.length > 1) {
    const { matches: currentRoundGeneratedMatches, nextRoundFeeders: nextFeederBatch } = await createMatchesFromFeeders(
      tournamentId,
      currentRoundNumber,
      1, 
      feedersForNextRound,
      'winners'
    );
    allMatches.push(...currentRoundGeneratedMatches);
    feedersForNextRound = nextFeederBatch;
    currentRoundNumber++;
    if (currentRoundNumber > 20) break; 
  }
  
  return allMatches;
}


export async function generateDoubleEliminationBracket(
  tournamentId: string,
  initialRegistrations: RegisteredEntry[],
  maxTeamsInput: number
): Promise<Match[]> {
  let participants = [...initialRegistrations];
  if (participants.length > maxTeamsInput) {
    participants = participants.slice(0, maxTeamsInput);
  }
  const N = participants.length;

  if (N < 2) {
    return N === 1 ? [{ id: crypto.randomUUID(), tournamentId, round: 1, matchNumberInRound: 1, bracketType: 'winners', team1Id: participants[0].id, isBye: true, winnerId: participants[0].id }] : [];
  }

  const allMatches: Match[] = [];
  const wbMatchesByRound: Match[][] = []; 
  
  participants.sort(() => Math.random() - 0.5); 

  // --- Winners' Bracket (WB) Generation ---
  let wbRoundCounter = 1;
  let wbTargetSizeForMainRound = N;
   if ( (wbTargetSizeForMainRound & (wbTargetSizeForMainRound - 1)) !== 0 ) { // If N is not power of 2
      wbTargetSizeForMainRound = getNextPowerOfTwo(N) / 2; 
      if (wbTargetSizeForMainRound < 2 && N > 1) wbTargetSizeForMainRound = 2;
  }
  const numWbPlayInMatches = N - wbTargetSizeForMainRound;
  const numParticipantsInWbPlayIn = numWbPlayInMatches * 2;
  const numParticipantsWithByesToWbMain = N - numParticipantsInWbPlayIn;

  const wbPlayInParticipantEntries = participants.slice(numParticipantsWithByesToWbMain);
  const wbByeParticipantEntries = participants.slice(0, numParticipantsWithByesToWbMain);
  
  const wbPlayInMatches: Match[] = []; 

  let wbFeedersForCurrentRound: (string | { winnerOfMatchId: string })[] = wbByeParticipantEntries.map(p => p.id);

  if (numWbPlayInMatches > 0) {
    const { matches: playInMatchesGenerated, nextRoundFeeders: playInWinnerFeeders } = await createMatchesFromFeeders(
      tournamentId, wbRoundCounter, 1, wbPlayInParticipantEntries.map(p => p.id), 'winners'
    );
    allMatches.push(...playInMatchesGenerated);
    wbPlayInMatches.push(...playInMatchesGenerated); 
    if(playInMatchesGenerated.length > 0) wbMatchesByRound.push([...playInMatchesGenerated]);
    wbFeedersForCurrentRound.push(...playInWinnerFeeders);
    wbRoundCounter++;
  }
  
  if (wbFeedersForCurrentRound.length > 1) { // Shuffle only if there's more than one, to avoid error with sort
    wbFeedersForCurrentRound.sort(() => Math.random() - 0.5);
  }


  while (wbFeedersForCurrentRound.length >= 1) {
    if (wbFeedersForCurrentRound.length === 1 && typeof wbFeedersForCurrentRound[0] !== 'string') {
       break; 
    }
    if (wbFeedersForCurrentRound.length === 1 && typeof wbFeedersForCurrentRound[0] === 'string') {
        if (wbMatchesByRound.length > 0) {
            const lastRoundMatches = wbMatchesByRound[wbMatchesByRound.length -1];
            if (lastRoundMatches.length === 1 && lastRoundMatches[0].team1Id === wbFeedersForCurrentRound[0] && lastRoundMatches[0].isBye) {
                 break;
            }
        }
    }

    const { matches: currentRoundWbMatches, nextRoundFeeders: nextWbFeeders } = await createMatchesFromFeeders(
      tournamentId, wbRoundCounter, (wbMatchesByRound[wbRoundCounter-1]?.length || 0) +1, wbFeedersForCurrentRound, 'winners'
    );
    allMatches.push(...currentRoundWbMatches);
    if(currentRoundWbMatches.length > 0) {
        // Ensure round arrays are initialized
        while(wbMatchesByRound.length < wbRoundCounter) wbMatchesByRound.push([]);
        wbMatchesByRound[wbRoundCounter-1].push(...currentRoundWbMatches);
    }
    wbFeedersForCurrentRound = nextWbFeeders;
    wbRoundCounter++;
    if (wbRoundCounter > 20) break; 
  }
  
  const wbFinalMatchId = wbFeedersForCurrentRound.length === 1 && typeof wbFeedersForCurrentRound[0] !== 'string' ? (wbFeedersForCurrentRound[0] as {winnerOfMatchId: string}).winnerOfMatchId : undefined;

  // --- Losers' Bracket (LB) Generation ---
  let lbRound = 1;
  let advancingLbWinnerFeeders: { winnerOfMatchId: string }[] = []; // From previous LB iteration
  let lbFinalMatchId: string | undefined = undefined;

  // Step 1: Initial LB pairings (WB Play-in Losers vs. First Main WB Round Losers)
  const wbPlayInLoserFeeds = wbPlayInMatches.map(m => ({ loserOfMatchId: m.id }));
  
  const idxForFirstMainWbRound = wbPlayInMatches.length > 0 ? 1 : 0; // 0 if no playins, 1 if playins
  const firstMainWbRoundActual = wbMatchesByRound[idxForFirstMainWbRound] || [];
  const firstMainWbRoundLoserFeeds = firstMainWbRoundActual.map(m => ({ loserOfMatchId: m.id }));

  const deterministicInitialLbFeeders: ({ loserOfMatchId: string })[] = [];
  const spillOverFeeders: ({ loserOfMatchId: string })[] = [];
  
  const minLength = Math.min(wbPlayInLoserFeeds.length, firstMainWbRoundLoserFeeds.length);
  for (let i = 0; i < minLength; i++) {
    deterministicInitialLbFeeders.push(wbPlayInLoserFeeds[i]);
    deterministicInitialLbFeeders.push(firstMainWbRoundLoserFeeds[i]);
  }

  if (wbPlayInLoserFeeds.length > firstMainWbRoundLoserFeeds.length) {
    spillOverFeeders.push(...wbPlayInLoserFeeds.slice(minLength));
  } else if (firstMainWbRoundLoserFeeds.length > wbPlayInLoserFeeds.length) {
    spillOverFeeders.push(...firstMainWbRoundLoserFeeds.slice(minLength));
  }

  let matchNumOffset = 1;
  if (deterministicInitialLbFeeders.length > 0) {
    const { matches: genMatches, nextRoundFeeders: nextFeeders } = await createMatchesFromFeeders(
        tournamentId, lbRound, matchNumOffset, deterministicInitialLbFeeders, 'losers'
    );
    allMatches.push(...genMatches);
    advancingLbWinnerFeeders.push(...nextFeeders);
    matchNumOffset += genMatches.length;
  }
  if (spillOverFeeders.length > 0) {
     const { matches: genMatches, nextRoundFeeders: nextFeeders } = await createMatchesFromFeeders(
        tournamentId, lbRound, matchNumOffset, spillOverFeeders, 'losers'
    );
    allMatches.push(...genMatches);
    advancingLbWinnerFeeders.push(...nextFeeders);
  }
  
  if (advancingLbWinnerFeeders.length > 0) lbRound++;


  // Step 2: Subsequent LB rounds (Advancing LB winners vs. new WB losers)
  const startWbRoundForDrops = idxForFirstMainWbRound + 1; 

  for (let wbDropRoundIdx = startWbRoundForDrops; wbDropRoundIdx < wbMatchesByRound.length -1; wbDropRoundIdx++) { // -1 to exclude WB Final
      const currentWbRoundLosersDropFrom = wbMatchesByRound[wbDropRoundIdx] || [];
      const newWbLosersToFeedLb = currentWbRoundLosersDropFrom.filter(m => !m.isBye).map(m => ({ loserOfMatchId: m.id }));

      if (newWbLosersToFeedLb.length === 0 && advancingLbWinnerFeeders.length < 2) continue;
      
      let currentLbRoundFeeders: ({ loserOfMatchId: string } | { winnerOfMatchId: string })[] = [];
      currentLbRoundFeeders.push(...advancingLbWinnerFeeders); // Winners from previous LB round
      currentLbRoundFeeders.push(...newWbLosersToFeedLb);   // Losers from current WB round drop

      advancingLbWinnerFeeders = []; // Reset for this iteration's winners

      if (currentLbRoundFeeders.length === 0) continue;
      if (currentLbRoundFeeders.length > 1) currentLbRoundFeeders.sort(() => Math.random() - 0.5); // Shuffle combined pool

      const { matches: createdLbMatches, nextRoundFeeders: nextLbWinners } = await createMatchesFromFeeders(
          tournamentId, lbRound, 1, currentLbRoundFeeders, 'losers'
      );
      
      if (createdLbMatches.length > 0) {
          allMatches.push(...createdLbMatches);
          advancingLbWinnerFeeders.push(...nextLbWinners);
          lbRound++;
      } else if (currentLbRoundFeeders.length === 1) { 
          // Single feeder got a bye in this conceptual round, pass them through.
          // `createMatchesFromFeeders` handles actual bye match creation if needed.
          // This single feeder should have been processed by createMatchesFromFeeders resulting in a bye match.
          // The winner of that (the feeder itself) will be in nextLbWinners.
          if (nextLbWinners.length === 1) advancingLbWinnerFeeders.push(nextLbWinners[0]);

      }
  }
  
  // Step 3: Consolidate remaining LB winners (if any)
  while (advancingLbWinnerFeeders.length >= 2) {
      const { matches: closingLbMatches, nextRoundFeeders: finalWinnerFeeder } = await createMatchesFromFeeders(
          tournamentId, lbRound, 1, advancingLbWinnerFeeders, 'losers'
      );
      if (closingLbMatches.length > 0) {
          allMatches.push(...closingLbMatches);
          lbRound++;
      }
      advancingLbWinnerFeeders = finalWinnerFeeder;
  }

  // Step 4: LB Final (Last advancing LB winner vs. Loser of WB Final)
  const wbFinalMatchInfo = wbFinalMatchId ? allMatches.find(m => m.id === wbFinalMatchId) : undefined;

  if (wbFinalMatchInfo && !wbFinalMatchInfo.isBye && advancingLbWinnerFeeders.length === 1) {
      const lbPreFinalWinnerFeeder = advancingLbWinnerFeeders[0];
      const wbFinalLoserFeeder = { loserOfMatchId: wbFinalMatchInfo.id };
      
      let lbFinalFeeders = [lbPreFinalWinnerFeeder, wbFinalLoserFeeder];
      // No shuffle for specific pairing of LB Champ vs WB Final Loser
      
      const { matches: lbFinalMatchesCreated, nextRoundFeeders: lbFinalWinnerForGfFeeder } = await createMatchesFromFeeders(
          tournamentId, lbRound, 1, lbFinalFeeders, 'losers'
      );
      if (lbFinalMatchesCreated.length > 0) {
          allMatches.push(...lbFinalMatchesCreated);
          lbFinalMatchId = lbFinalMatchesCreated[0].id;
      }
  } else if (advancingLbWinnerFeeders.length === 1) {
      lbFinalMatchId = advancingLbWinnerFeeders[0].winnerOfMatchId;
  }


  // --- Grand Final (GF) ---
  if (wbFinalMatchId && lbFinalMatchId) {
    allMatches.push({
      id: crypto.randomUUID(), tournamentId, round: 1, matchNumberInRound: 1, bracketType: 'grandFinal',
      team1FeederMatchId: wbFinalMatchId, team1FeederType: 'winner', 
      team2FeederMatchId: lbFinalMatchId, team2FeederType: 'winner', 
    });
    allMatches.push({ 
      id: crypto.randomUUID(), tournamentId, round: 2, matchNumberInRound: 1, bracketType: 'grandFinalReset',
      isBye: true, 
    });
  } else {
    console.warn("DE Gen: Could not determine WB or LB final for Grand Final setup.", {wbFinalMatchId, lbFinalMatchId});
    const gfFallbackId = crypto.randomUUID();
    allMatches.push({ id: gfFallbackId, tournamentId, round: 1, matchNumberInRound: 1, bracketType: 'grandFinal', isBye: true, team1FeederMatchId: wbFinalMatchId, team1FeederType: 'winner' });
    allMatches.push({ id: crypto.randomUUID(), tournamentId, round: 2, matchNumberInRound: 1, bracketType: 'grandFinalReset', isBye: true });
    if(!lbFinalMatchId && wbFinalMatchId && N === 2) { 
       const wbFinalMatch = allMatches.find(m => m.id === wbFinalMatchId);
       const gfMatch = allMatches.find(m=>m.id === gfFallbackId);
       if(wbFinalMatch && wbFinalMatch.winnerId && gfMatch) {
           gfMatch.winnerId = wbFinalMatch.winnerId;
       }
    }
  }

  return allMatches;
}


async function advanceWinnerSingleElimination(
  currentMatches: Match[],
  updatedMatch: Match, 
  registrations: RegisteredEntry[] 
): Promise<Match[]> {
  let newMatches = JSON.parse(JSON.stringify(currentMatches)) as Match[]; 
  const uMatchIndex = newMatches.findIndex(m => m.id === updatedMatch.id);

  if (uMatchIndex === -1) return currentMatches; 
  
  newMatches[uMatchIndex] = { ...newMatches[uMatchIndex], ...updatedMatch };
  const matchBeingUpdated = newMatches[uMatchIndex];

  if (!matchBeingUpdated.winnerId && !matchBeingUpdated.isBye) { 
    return clearSubsequentMatchesSingle(newMatches, matchBeingUpdated);
  }

  if (matchBeingUpdated.winnerId) { 
    const nextMatchIndex = newMatches.findIndex(m =>
      m.bracketType === 'winners' && 
      (m.team1FeederMatchId === matchBeingUpdated.id || m.team2FeederMatchId === matchBeingUpdated.id)
    );

    if (nextMatchIndex !== -1) {
      let nextMatch = { ...newMatches[nextMatchIndex] };
      let slotAssigned = false;

      if (nextMatch.team1FeederMatchId === matchBeingUpdated.id && nextMatch.team1Id !== matchBeingUpdated.winnerId) {
        // Only update if the slot is not already filled by this winner (prevents re-processing)
        // or if the slot is undefined (waiting for this winner)
        if(nextMatch.team1Id === undefined || nextMatch.team1Id !== matchBeingUpdated.winnerId){
            nextMatch.team1Id = matchBeingUpdated.winnerId;
            slotAssigned = true;
        }
      } else if (nextMatch.team2FeederMatchId === matchBeingUpdated.id && nextMatch.team2Id !== matchBeingUpdated.winnerId) {
         if(nextMatch.team2Id === undefined || nextMatch.team2Id !== matchBeingUpdated.winnerId){
            nextMatch.team2Id = matchBeingUpdated.winnerId;
            slotAssigned = true;
        }
      }
      
      if (slotAssigned) {
        nextMatch.winnerId = undefined; 
        nextMatch.score = undefined;
        
        const team1Present = !!nextMatch.team1Id;
        const team2Present = !!nextMatch.team2Id;

        // A match is a bye if one team is present AND the other slot is NOT expecting a feeder from a *different* match
        if (team1Present && !team2Present && !nextMatch.team2FeederMatchId) {
          nextMatch.isBye = true;
          nextMatch.winnerId = nextMatch.team1Id;
        } else if (!team1Present && !nextMatch.team1FeederMatchId && team2Present) {
          nextMatch.isBye = true;
          nextMatch.winnerId = nextMatch.team2Id;
        } else {
          nextMatch.isBye = false;
        }
        
        newMatches[nextMatchIndex] = nextMatch;
        if (nextMatch.isBye && nextMatch.winnerId && matchBeingUpdated.id !== nextMatch.id) { 
             return advanceWinnerSingleElimination(newMatches, nextMatch, registrations);
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
  let newMatches = JSON.parse(JSON.stringify(currentMatches)) as Match[];
  const uMatchOriginalIndex = newMatches.findIndex(m => m.id === updatedMatch.id);

  if (uMatchOriginalIndex === -1) return newMatches;
  
  newMatches[uMatchOriginalIndex] = { ...newMatches[uMatchOriginalIndex], ...updatedMatch };
  const currentUpdatedMatchState = newMatches[uMatchOriginalIndex]; 

  if (!currentUpdatedMatchState.winnerId && !currentUpdatedMatchState.isBye) {
    return clearSubsequentMatches(newMatches, currentUpdatedMatchState, 'double_elimination');
  }

  if (!currentUpdatedMatchState.winnerId) return newMatches; 

  const { id: matchId, winnerId, bracketType, team1Id, team2Id } = currentUpdatedMatchState;
  const loserId = (winnerId === team1Id && team2Id) ? team2Id : (winnerId === team2Id && team1Id) ? team1Id : undefined;


  const findAndAdvanceParticipant = async (
    sourceMatchId: string, 
    participantToAdvanceId: string | undefined, 
    feederTypeOfParticipantFromSource: 'winner' | 'loser' 
  ): Promise<void> => {
    if (!participantToAdvanceId) return;

    const nextMatchIdx = newMatches.findIndex(m => 
      (m.team1FeederMatchId === sourceMatchId && m.team1FeederType === feederTypeOfParticipantFromSource) ||
      (m.team2FeederMatchId === sourceMatchId && m.team2FeederType === feederTypeOfParticipantFromSource)
    );

    if (nextMatchIdx !== -1) {
      let nextMatchToUpdate = { ...newMatches[nextMatchIdx] }; 
      let changed = false;

      if (nextMatchToUpdate.team1FeederMatchId === sourceMatchId && nextMatchToUpdate.team1FeederType === feederTypeOfParticipantFromSource) {
        if (nextMatchToUpdate.team1Id !== participantToAdvanceId) {
           nextMatchToUpdate.team1Id = participantToAdvanceId; changed = true;
        }
      } else if (nextMatchToUpdate.team2FeederMatchId === sourceMatchId && nextMatchToUpdate.team2FeederType === feederTypeOfParticipantFromSource) {
         if (nextMatchToUpdate.team2Id !== participantToAdvanceId) {
            nextMatchToUpdate.team2Id = participantToAdvanceId; changed = true;
         }
      }
      
      if (changed) {
        nextMatchToUpdate.winnerId = undefined; 
        nextMatchToUpdate.score = undefined;
        
        const team1Present = !!nextMatchToUpdate.team1Id;
        const team2Present = !!nextMatchToUpdate.team2Id;

        if (team1Present && !team2Present && !nextMatchToUpdate.team2FeederMatchId) {
          nextMatchToUpdate.isBye = true; nextMatchToUpdate.winnerId = nextMatchToUpdate.team1Id;
        } else if (!team1Present && !nextMatchToUpdate.team1FeederMatchId && team2Present) {
          nextMatchToUpdate.isBye = true; nextMatchToUpdate.winnerId = nextMatchToUpdate.team2Id;
        } else {
          nextMatchToUpdate.isBye = false;
        }
        
        newMatches[nextMatchIdx] = nextMatchToUpdate; 
        if (nextMatchToUpdate.isBye && nextMatchToUpdate.winnerId && nextMatchToUpdate.id !== sourceMatchId) {
          newMatches = await advanceWinnerDoubleElimination(JSON.parse(JSON.stringify(newMatches)), nextMatchToUpdate, registrations);
        }
      }
    }
  };

  if (bracketType === 'winners') {
    await findAndAdvanceParticipant(matchId, winnerId, 'winner'); 
    if (loserId) { 
      await findAndAdvanceParticipant(matchId, loserId, 'loser'); 
    }
  } else if (bracketType === 'losers') {
    await findAndAdvanceParticipant(matchId, winnerId, 'winner'); 
  } else if (bracketType === 'grandFinal') {
    const gfResetMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinalReset');
    if (gfResetMatchIndex !== -1) {
      let gfResetMatch = {...newMatches[gfResetMatchIndex]};
      if (winnerId === team1Id) { 
        gfResetMatch.isBye = true;
        gfResetMatch.team1Id = undefined; 
        gfResetMatch.team2Id = undefined;
        gfResetMatch.winnerId = undefined; 
        gfResetMatch.score = undefined;
      } else if (winnerId === team2Id && team1Id && team2Id) { 
        gfResetMatch.team1Id = team1Id; 
        gfResetMatch.team2Id = team2Id; 
        gfResetMatch.isBye = false;
        gfResetMatch.winnerId = undefined;
        gfResetMatch.score = undefined;
      } else if (!team1Id || !team2Id) { 
         gfResetMatch.isBye = true;
         gfResetMatch.team1Id = undefined;
         gfResetMatch.team2Id = undefined;
         gfResetMatch.winnerId = undefined;
         gfResetMatch.score = undefined;
       }
       newMatches[gfResetMatchIndex] = gfResetMatch;
    }
  }
  return newMatches;
}


export async function advanceWinner (
  currentMatches: Match[],
  updatedMatch: Match,
  registrations: RegisteredEntry[],
  tournamentType: TournamentType
): Promise<Match[]> {
  let newMatchesWorkingCopy = JSON.parse(JSON.stringify(currentMatches)) as Match[];
  const matchIdx = newMatchesWorkingCopy.findIndex(m => m.id === updatedMatch.id);

  if (matchIdx !== -1) {
      newMatchesWorkingCopy[matchIdx] = {...newMatchesWorkingCopy[matchIdx], ...updatedMatch};
  } else {
      return currentMatches; 
  }

  const matchToProcess = newMatchesWorkingCopy[matchIdx];

  if (tournamentType === 'single') {
    return advanceWinnerSingleElimination(newMatchesWorkingCopy, matchToProcess, registrations);
  } else if (tournamentType === 'double_elimination') {
    return advanceWinnerDoubleElimination(newMatchesWorkingCopy, matchToProcess, registrations);
  }
  return newMatchesWorkingCopy; 
}


async function clearSubsequentMatchesSingle(
  matches: Match[], 
  sourceMatch: Match 
): Promise<Match[]> {
  let queue: string[] = [sourceMatch.id]; 
  const processedForClearing = new Set<string>(); 

  while (queue.length > 0) {
    const currentSourceMatchId = queue.shift()!;
    if (processedForClearing.has(currentSourceMatchId)) continue;
    processedForClearing.add(currentSourceMatchId);

    const dependentMatchesIndices = matches
      .map((match, index) => ({ match, index }))
      .filter(({ match }) => 
        (match.team1FeederMatchId === currentSourceMatchId && match.team1FeederType === 'winner') ||
        (match.team2FeederMatchId === currentSourceMatchId && match.team2FeederType === 'winner')
      )
      .map(({ index }) => index);

    for (const nextMatchIdx of dependentMatchesIndices) {
      const originalNextMatchStateBeforeClear = JSON.stringify(matches[nextMatchIdx]);
      let nextMatch = { ...matches[nextMatchIdx] }; 
      let participantSlotCleared = false;

      if (nextMatch.team1FeederMatchId === currentSourceMatchId && nextMatch.team1Id !== undefined) {
        nextMatch.team1Id = undefined;
        participantSlotCleared = true;
      }
      if (nextMatch.team2FeederMatchId === currentSourceMatchId && nextMatch.team2Id !== undefined) {
        nextMatch.team2Id = undefined;
        participantSlotCleared = true;
      }

      if (participantSlotCleared || nextMatch.winnerId) {
        nextMatch.winnerId = undefined;
        nextMatch.score = undefined;
        
        const team1Present = !!nextMatch.team1Id;
        const team2Present = !!nextMatch.team2Id;
        const team1FeederDefined = !!nextMatch.team1FeederMatchId;
        const team2FeederDefined = !!nextMatch.team2FeederMatchId;

        if (team1Present && !team2Present && !team2FeederDefined) {
          nextMatch.isBye = true; 
        } else if (!team1Present && !team1FeederDefined && team2Present) {
          nextMatch.isBye = true;
        } else {
          nextMatch.isBye = false; 
        }
        
        if (JSON.stringify(nextMatch) !== originalNextMatchStateBeforeClear) {
            matches[nextMatchIdx] = nextMatch; 
            if(!nextMatch.isBye || (nextMatch.isBye && !nextMatch.winnerId)) { 
                 queue.push(nextMatch.id); 
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

  matchesToUpdate[fromMatchIndex].winnerId = undefined;
  matchesToUpdate[fromMatchIndex].score = undefined;

  const sourceMatchAfterReset = matchesToUpdate[fromMatchIndex];
  const smTeam1P = !!sourceMatchAfterReset.team1Id;
  const smTeam2P = !!sourceMatchAfterReset.team2Id;
  const smTeam1F = !!sourceMatchAfterReset.team1FeederMatchId;
  const smTeam2F = !!sourceMatchAfterReset.team2FeederMatchId;

  if ( (smTeam1P && !smTeam2P && !smTeam2F) || (!smTeam1P && !smTeam1F && smTeam2P) ) {
      if (smTeam1P && smTeam2P) {
          matchesToUpdate[fromMatchIndex].isBye = false;
      }
  } else if (smTeam1P && smTeam2P) {
      matchesToUpdate[fromMatchIndex].isBye = false;
  }


  if (tournamentType === 'single') {
      return clearSubsequentMatchesSingle(matchesToUpdate, matchesToUpdate[fromMatchIndex]);
  } else if (tournamentType === 'double_elimination') {
    let queue: string[] = [fromMatch.id]; 
    const processedForClearing = new Set<string>();

    while(queue.length > 0) {
        const currentAlteredMatchId = queue.shift()!;
        if (processedForClearing.has(currentAlteredMatchId)) continue;
        processedForClearing.add(currentAlteredMatchId);

        const currentAlteredMatch = matchesToUpdate.find(m => m.id === currentAlteredMatchId);
        if (!currentAlteredMatch) continue; 

        const dependentMatchIndices: number[] = [];
        matchesToUpdate.forEach((potentialDependentMatch, index) => {
            if ( (potentialDependentMatch.team1FeederMatchId === currentAlteredMatchId && (potentialDependentMatch.team1FeederType === 'winner' || potentialDependentMatch.team1FeederType === 'loser')) ||
                 (potentialDependentMatch.team2FeederMatchId === currentAlteredMatchId && (potentialDependentMatch.team2FeederType === 'winner' || potentialDependentMatch.team2FeederType === 'loser')) ) 
            {
                dependentMatchIndices.push(index);
            }
        });

        for (const idx of dependentMatchIndices) {
            const originalDependentMatchState = JSON.stringify(matchesToUpdate[idx]);
            let dependentMatch = { ...matchesToUpdate[idx] }; 
            let participantSlotChanged = false;

            if (dependentMatch.team1FeederMatchId === currentAlteredMatchId && dependentMatch.team1Id !== undefined) {
                dependentMatch.team1Id = undefined; participantSlotChanged = true;
            }
            if (dependentMatch.team2FeederMatchId === currentAlteredMatchId && dependentMatch.team2Id !== undefined) {
                dependentMatch.team2Id = undefined; participantSlotChanged = true;
            }
            
            if (participantSlotChanged || dependentMatch.winnerId) {
                dependentMatch.winnerId = undefined;
                dependentMatch.score = undefined;
                
                const depTeam1P = !!dependentMatch.team1Id;
                const depTeam2P = !!dependentMatch.team2Id;
                const depTeam1F = !!dependentMatch.team1FeederMatchId;
                const depTeam2F = !!dependentMatch.team2FeederMatchId;

                if ((depTeam1P && !depTeam2P && !depTeam2F) || (!depTeam1P && !depTeam1F && depTeam2P)) {
                    dependentMatch.isBye = true;
                } else {
                    dependentMatch.isBye = false;
                }
                
                if (JSON.stringify(dependentMatch) !== originalDependentMatchState) {
                    matchesToUpdate[idx] = dependentMatch;
                    if(!dependentMatch.isBye || (dependentMatch.isBye && !dependentMatch.winnerId) ) { 
                         queue.push(dependentMatch.id);
                    }
                }
            }
        }
        
        if (currentAlteredMatch.bracketType === 'grandFinal') {
            const gfResetIdx = matchesToUpdate.findIndex(m => m.bracketType === 'grandFinalReset');
            if (gfResetIdx !== -1 && !matchesToUpdate[gfResetIdx].isBye) { 
                matchesToUpdate[gfResetIdx].team1Id = undefined;
                matchesToUpdate[gfResetIdx].team2Id = undefined;
                matchesToUpdate[gfResetIdx].winnerId = undefined;
                matchesToUpdate[gfResetIdx].score = undefined;
                matchesToUpdate[gfResetIdx].isBye = true; 
            }
        }
    }
  }
  return matchesToUpdate;
}

