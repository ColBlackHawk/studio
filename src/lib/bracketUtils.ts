

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
async function createMatchesFromFeeders(
  tournamentId: string,
  round: number,
  startingMatchNumberInRound: number,
  feeders: ({ winnerOfMatchId: string } | { loserOfMatchId: string } | string)[],
  bracketType: 'winners' | 'losers' | 'grandFinal' | 'grandFinalReset'
): Promise<{ matches: Match[], nextRoundFeeders: { winnerOfMatchId: string }[] }> {
  const createdMatches: Match[] = [];
  const nextFeeders: { winnerOfMatchId: string }[] = [];
  let matchNumber = startingMatchNumberInRound;

  for (let i = 0; i < feeders.length; i += 2) {
    const feeder1 = feeders[i];
    const feeder2 = feeders[i + 1]; // Might be undefined if odd number of feeders

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
      if (typeof feeder1 === 'string') {
        newMatch.winnerId = feeder1; // Direct participant wins bye
      } else if (newMatch.team1FeederMatchId && newMatch.team1FeederType) {
        // If feeder1 is a placeholder, the winner is TBD from that feeder match.
        // This match is structurally a bye, winner determined when feeder1 resolves.
        // The advanceWinner logic should propagate this.
      }
    }
    
    createdMatches.push(newMatch);
    // If it's a bye and the winner is already determined (direct participant),
    // that winner is immediately available for the next round of feeders.
    // Otherwise, the match ID itself is the feeder for the winner.
    if (newMatch.isBye && newMatch.winnerId) {
        // This spot is complicated. If a BYE match auto-resolves because its feeder was a direct participant,
        // then `newMatch.winnerId` is the one advancing.
        // However, `createMatchesFromFeeders` returns `winnerOfMatchId` which points to `newMatch.id`.
        // The `advanceWinner` function needs to correctly use `newMatch.winnerId` if `newMatch.isBye` is true.
        // For now, always feed the match ID. `advanceWinner` will pick up the pre-set winner if it's a bye.
    }
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

  const N = participants.length;
  if (N < 2) {
    if (N === 1) { // Single participant auto-wins
      return [{
        id: crypto.randomUUID(), tournamentId, round: 1, matchNumberInRound: 1,
        bracketType: 'winners', team1Id: participants[0].id, isBye: true, winnerId: participants[0].id,
      }];
    }
    return []; // No matches for 0 participants
  }

  const allMatches: Match[] = [];
  let currentRoundNumber = 1;
  
  // Determine play-in round participants and those with byes
  const mainBracketSizeAfterPlayIn = getNextPowerOfTwo(N);
  const numPlayInMatches = N > mainBracketSizeAfterPlayIn / 2 ? N - mainBracketSizeAfterPlayIn / 2 : 0;
  const numParticipantsInPlayIn = numPlayInMatches * 2;
  const numParticipantsWithByes = N - numParticipantsInPlayIn;

  participants.sort(() => Math.random() - 0.5); // Shuffle for fairness if no seeding
  
  const playInParticipantEntries = participants.slice(numParticipantsWithByes);
  const byeParticipantEntries = participants.slice(0, numParticipantsWithByes);

  let feedersForNextRound: (string | { winnerOfMatchId: string })[] = byeParticipantEntries.map(p => p.id);

  // Create Play-In Matches (if necessary)
  if (numPlayInMatches > 0) {
    const { matches: playInMatches, nextRoundFeeders: playInWinnerFeeders } = await createMatchesFromFeeders(
      tournamentId,
      currentRoundNumber,
      1, // Match numbering starts at 1 for this round
      playInParticipantEntries.map(p => p.id),
      'winners'
    );
    allMatches.push(...playInMatches);
    feedersForNextRound.push(...playInWinnerFeeders);
    currentRoundNumber++;
  }
  
  feedersForNextRound.sort(() => Math.random() - 0.5);

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
    if (currentRoundNumber > 20) break; // Safety break
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
  let wbFinalMatchId: string | undefined = undefined;
  let lbFinalMatchId: string | undefined = undefined;

  // --- Winners' Bracket (WB) Generation ---
  let wbRoundCounter = 1;
  participants.sort(() => Math.random() - 0.5); 

  const wbMainBracketSizeAfterPlayIn = getNextPowerOfTwo(N);
  const numWbPlayInMatches = N > wbMainBracketSizeAfterPlayIn / 2 ? N - wbMainBracketSizeAfterPlayIn / 2 : 0;
  const numParticipantsInWbPlayIn = numWbPlayInMatches * 2;
  const numParticipantsWithByesToWbMain = N - numParticipantsInWbPlayIn;

  const wbPlayInParticipantEntries = participants.slice(numParticipantsWithByesToWbMain);
  const wbByeParticipantEntries = participants.slice(0, numParticipantsWithByesToWbMain);
  
  const wbPlayInMatches: Match[] = []; // Store play-in matches separately for clarity if needed

  let wbFeedersForCurrentRound: (string | { winnerOfMatchId: string })[] = wbByeParticipantEntries.map(p => p.id);

  if (numWbPlayInMatches > 0) {
    const { matches: playInMatchesGenerated, nextRoundFeeders: playInWinnerFeeders } = await createMatchesFromFeeders(
      tournamentId, wbRoundCounter, 1, wbPlayInParticipantEntries.map(p => p.id), 'winners'
    );
    allMatches.push(...playInMatchesGenerated);
    wbPlayInMatches.push(...playInMatchesGenerated); // Keep a specific ref if needed for LB drops
    if(playInMatchesGenerated.length > 0) wbMatchesByRound.push([...playInMatchesGenerated]);
    wbFeedersForCurrentRound.push(...playInWinnerFeeders);
    wbRoundCounter++;
  }
  wbFeedersForCurrentRound.sort(() => Math.random() - 0.5);

  while (wbFeedersForCurrentRound.length >= 1) {
     if (wbFeedersForCurrentRound.length === 1 && typeof wbFeedersForCurrentRound[0] !== 'string') {
       wbFinalMatchId = (wbFeedersForCurrentRound[0] as {winnerOfMatchId: string}).winnerOfMatchId;
       break; 
    }
    if (wbFeedersForCurrentRound.length === 1 && typeof wbFeedersForCurrentRound[0] === 'string') {
        // This case means only one participant is left without playing a final match (e.g., N=1, handled above)
        // or byes propagated to a single winner. The last match object should capture this.
        // If wbMatchesByRound is not empty and its last round has one match, that's the final.
        if (wbMatchesByRound.length > 0) {
            const lastRoundMatches = wbMatchesByRound[wbMatchesByRound.length -1];
            if (lastRoundMatches.length === 1 && lastRoundMatches[0].team1Id === wbFeedersForCurrentRound[0] && lastRoundMatches[0].isBye) {
                 wbFinalMatchId = lastRoundMatches[0].id;
                 break;
            }
        }
        // If we reach here with a single string feeder, it implies an issue or a very small N.
        // For N>=2, a match should be created. If N=1, it's handled.
        // Let createMatchesFromFeeders create a bye match if this is the case.
    }


    const { matches: currentRoundWbMatches, nextRoundFeeders: nextWbFeeders } = await createMatchesFromFeeders(
      tournamentId, wbRoundCounter, 1, wbFeedersForCurrentRound, 'winners'
    );
    allMatches.push(...currentRoundWbMatches);
    if(currentRoundWbMatches.length > 0) wbMatchesByRound.push([...currentRoundWbMatches]);
    wbFeedersForCurrentRound = nextWbFeeders;
    
    if (wbFeedersForCurrentRound.length === 1 && typeof wbFeedersForCurrentRound[0] !== 'string') {
         wbFinalMatchId = (wbFeedersForCurrentRound[0] as {winnerOfMatchId: string}).winnerOfMatchId;
    }
    wbRoundCounter++;
    if (wbRoundCounter > 20) break; 
  }
  
  if (!wbFinalMatchId && wbMatchesByRound.length > 0) {
    const lastWbRoundArr = wbMatchesByRound[wbMatchesByRound.length -1];
    if (lastWbRoundArr?.length === 1) wbFinalMatchId = lastWbRoundArr[0].id;
  }


  // --- Losers' Bracket (LB) Generation ---
  let lbRound = 1;
  let advancingLbWinnerFeeders: { winnerOfMatchId: string }[] = []; // From previous LB iteration

  // Iterate through WB rounds to feed losers into LB
  // wbMatchesByRound[0] could be play-ins or WB Round 1
  // wbMatchesByRound[wbMatchesByRound.length - 1] is the WB Final - its loser drops to LB Final

  for (let wbDropRoundIdx = 0; wbDropRoundIdx < wbMatchesByRound.length -1; wbDropRoundIdx++) { // -1 to exclude WB Final
      const currentWbRoundLosersDropFrom = wbMatchesByRound[wbDropRoundIdx];
      const newWbLosersToFeedLb = currentWbRoundLosersDropFrom.filter(m => !m.isBye).map(m => ({ loserOfMatchId: m.id }));

      let currentLbRoundFeeders: ({ loserOfMatchId: string } | { winnerOfMatchId: string })[] = [];

      if (wbDropRoundIdx % 2 === 0) { // Standard pattern: early LB rounds pair WB losers
          currentLbRoundFeeders = [...newWbLosersToFeedLb, ...advancingLbWinnerFeeders];
          advancingLbWinnerFeeders = []; // Reset, will be populated by winners of currentLbRoundFeeders
      } else { // Subsequent LB rounds pair advancing LB winners with new WB losers
          currentLbRoundFeeders = [...advancingLbWinnerFeeders, ...newWbLosersToFeedLb];
          advancingLbWinnerFeeders = [];
      }
      
      if (currentLbRoundFeeders.length === 0) continue;
      currentLbRoundFeeders.sort(() => Math.random() - 0.5);

      const { matches: createdLbMatches, nextRoundFeeders: nextLbWinners } = await createMatchesFromFeeders(
          tournamentId, lbRound, allMatches.filter(m => m.bracketType === 'losers' && m.round === lbRound).length + 1,
          currentLbRoundFeeders, 'losers'
      );
      
      if (createdLbMatches.length > 0) {
          allMatches.push(...createdLbMatches);
          advancingLbWinnerFeeders.push(...nextLbWinners); // Add new winners to the pool for next LB iteration
          lbRound++;
      } else if (currentLbRoundFeeders.length === 1) { 
          // Single feeder got a bye, add them to advancing winners directly
          advancingLbWinnerFeeders.push(currentLbRoundFeeders[0] as { winnerOfMatchId: string } | { loserOfMatchId: string } extends { winnerOfMatchId: string } ? any : never);
      }
  }

  // Consolidate remaining LB winners until one champion for LB
  while (advancingLbWinnerFeeders.length >= 2) {
      const { matches: closingLbMatches, nextRoundFeeders: finalWinnerFeeder } = await createMatchesFromFeeders(
          tournamentId, lbRound, allMatches.filter(m => m.bracketType === 'losers' && m.round === lbRound).length + 1,
          advancingLbWinnerFeeders, 'losers'
      );
      if (closingLbMatches.length > 0) {
          allMatches.push(...closingLbMatches);
          lbRound++;
      }
      advancingLbWinnerFeeders = finalWinnerFeeder;
      if (advancingLbWinnerFeeders.length === 1 && closingLbMatches.length === 0 && N > 2) break; // Single winner from byes
  }

  // LB Final: Winner of consolidated LB plays loser of WB Final
  const wbFinalMatchInfo = wbFinalMatchId ? allMatches.find(m => m.id === wbFinalMatchId) : undefined;
  if (wbFinalMatchInfo && !wbFinalMatchInfo.isBye && advancingLbWinnerFeeders.length === 1) {
      const lbPreFinalWinnerFeeder = advancingLbWinnerFeeders[0];
      const wbFinalLoserFeeder = { loserOfMatchId: wbFinalMatchInfo.id };
      
      const { matches: lbFinalMatchesCreated, nextRoundFeeders: lbFinalWinnerForGfFeeder } = await createMatchesFromFeeders(
          tournamentId, lbRound, 1, 
          [lbPreFinalWinnerFeeder, wbFinalLoserFeeder].sort(() => Math.random() - 0.5), 
          'losers'
      );
      if (lbFinalMatchesCreated.length > 0) {
          allMatches.push(...lbFinalMatchesCreated);
          lbFinalMatchId = lbFinalMatchesCreated[0].id;
      }
  } else if (advancingLbWinnerFeeders.length === 1) {
      // If WB final was a bye, or N is small, the last LB winner is the LB champ for GF
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
      isBye: true, // Initially a bye, populated if LB winner wins GF1
    });
  } else {
    // Fallback for very small N or if logic couldn't determine finalists
    console.warn("DE Gen: Could not determine WB or LB final for Grand Final setup.", {wbFinalMatchId, lbFinalMatchId});
    const gfFallbackId = crypto.randomUUID();
    allMatches.push({ id: gfFallbackId, tournamentId, round: 1, matchNumberInRound: 1, bracketType: 'grandFinal', isBye: true, team1FeederMatchId: wbFinalMatchId, team1FeederType: 'winner' });
    allMatches.push({ id: crypto.randomUUID(), tournamentId, round: 2, matchNumberInRound: 1, bracketType: 'grandFinalReset', isBye: true });
    if(!lbFinalMatchId && wbFinalMatchId && N === 2) { // Special case for N=2, WB winner is overall winner if LB doesn't form
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

  if (uMatchIndex === -1) return currentMatches; // Should not happen if called correctly
  
  newMatches[uMatchIndex] = { ...newMatches[uMatchIndex], ...updatedMatch };
  const matchBeingUpdated = newMatches[uMatchIndex];

  if (!matchBeingUpdated.winnerId && !matchBeingUpdated.isBye) { // Winner cleared, not a structural bye
    return clearSubsequentMatchesSingle(newMatches, matchBeingUpdated);
  }

  if (matchBeingUpdated.winnerId) { // Winner set or confirmed for a bye
    const nextMatchIndex = newMatches.findIndex(m =>
      m.bracketType === 'winners' && 
      (m.team1FeederMatchId === matchBeingUpdated.id || m.team2FeederMatchId === matchBeingUpdated.id)
    );

    if (nextMatchIndex !== -1) {
      let nextMatch = { ...newMatches[nextMatchIndex] };
      let slotAssigned = false;

      if (nextMatch.team1FeederMatchId === matchBeingUpdated.id && nextMatch.team1Id !== matchBeingUpdated.winnerId) {
        nextMatch.team1Id = matchBeingUpdated.winnerId;
        slotAssigned = true;
      } else if (nextMatch.team2FeederMatchId === matchBeingUpdated.id && nextMatch.team2Id !== matchBeingUpdated.winnerId) {
        nextMatch.team2Id = matchBeingUpdated.winnerId;
        slotAssigned = true;
      }
      
      if (slotAssigned) {
        nextMatch.winnerId = undefined; 
        nextMatch.score = undefined;
        
        const team1Present = !!nextMatch.team1Id;
        const team2Present = !!nextMatch.team2Id;
        // A match is a bye if one team is present AND the other slot is NOT expecting a feeder
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
        // If the next match became a bye AND has a winner, recursively advance
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

  if (!currentUpdatedMatchState.winnerId) return newMatches; // No winner set, nothing to advance

  const { id: matchId, winnerId, bracketType, team1Id, team2Id } = currentUpdatedMatchState;
  const loserId = (winnerId === team1Id && team2Id) ? team2Id : (winnerId === team2Id && team1Id) ? team1Id : undefined;


  const findAndAdvanceParticipant = async (
    sourceMatchId: string, 
    participantToAdvanceId: string | undefined, 
    feederTypeOfParticipantFromSource: 'winner' | 'loser' 
  ): Promise<void> => {
    if (!participantToAdvanceId) return;

    // Find next match where one of its feeder slots matches sourceMatchId AND the feederType (winner/loser)
    const nextMatchIdx = newMatches.findIndex(m => 
      (m.team1FeederMatchId === sourceMatchId && m.team1FeederType === feederTypeOfParticipantFromSource) ||
      (m.team2FeederMatchId === sourceMatchId && m.team2FeederType === feederTypeOfParticipantFromSource)
    );

    if (nextMatchIdx !== -1) {
      let nextMatchToUpdate = { ...newMatches[nextMatchIdx] }; // Work with a copy
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
        nextMatchToUpdate.winnerId = undefined; // Reset winner as participants changed
        nextMatchToUpdate.score = undefined;
        
        const team1Present = !!nextMatchToUpdate.team1Id;
        const team2Present = !!nextMatchToUpdate.team2Id;
        // A match is a bye if one team is present AND the other slot is NOT expecting any feeder
        if (team1Present && !team2Present && !nextMatchToUpdate.team2FeederMatchId) {
          nextMatchToUpdate.isBye = true; nextMatchToUpdate.winnerId = nextMatchToUpdate.team1Id;
        } else if (!team1Present && !nextMatchToUpdate.team1FeederMatchId && team2Present) {
          nextMatchToUpdate.isBye = true; nextMatchToUpdate.winnerId = nextMatchToUpdate.team2Id;
        } else {
          nextMatchToUpdate.isBye = false;
        }
        
        newMatches[nextMatchIdx] = nextMatchToUpdate; 
        // If the next match became a bye AND has a winner, recursively advance that winner
        if (nextMatchToUpdate.isBye && nextMatchToUpdate.winnerId && nextMatchToUpdate.id !== sourceMatchId) {
          // Recursive call: pass a fresh copy of newMatches to avoid stale state issues in deep recursion
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
      if (winnerId === team1Id) { // WB winner wins GF, no reset needed (or rather, reset match is a bye for WB winner)
        gfResetMatch.isBye = true;
        gfResetMatch.team1Id = undefined; // No participants needed as it won't be played
        gfResetMatch.team2Id = undefined;
        gfResetMatch.winnerId = undefined; // No winner for an unplayed reset
        gfResetMatch.score = undefined;
      } else if (winnerId === team2Id && team1Id && team2Id) { // LB winner wins GF, reset IS needed
        gfResetMatch.team1Id = team1Id; // WB winner from GF1
        gfResetMatch.team2Id = team2Id; // LB winner from GF1 (who is now team2 in reset)
        gfResetMatch.isBye = false;
        gfResetMatch.winnerId = undefined;
        gfResetMatch.score = undefined;
      } else if (!team1Id || !team2Id) { // If GF itself was a bye (e.g. one finalist TBD)
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
      // Apply updates to the specific match
      newMatchesWorkingCopy[matchIdx] = {...newMatchesWorkingCopy[matchIdx], ...updatedMatch};
  } else {
      // Should not happen if called correctly, but return original if match not found
      return currentMatches; 
  }

  // Use the state of the match *after* updates for advancement logic
  const matchToProcess = newMatchesWorkingCopy[matchIdx];

  if (tournamentType === 'single') {
    return advanceWinnerSingleElimination(newMatchesWorkingCopy, matchToProcess, registrations);
  } else if (tournamentType === 'double_elimination') {
    return advanceWinnerDoubleElimination(newMatchesWorkingCopy, matchToProcess, registrations);
  }
  return newMatchesWorkingCopy; // Should not be reached if type is valid
}


async function clearSubsequentMatchesSingle(
  matches: Match[], 
  sourceMatch: Match // The match from which the winner was cleared
): Promise<Match[]> {
  let queue: string[] = [sourceMatch.id]; 
  const processedForClearing = new Set<string>(); 

  while (queue.length > 0) {
    const currentSourceMatchId = queue.shift()!;
    if (processedForClearing.has(currentSourceMatchId)) continue;
    processedForClearing.add(currentSourceMatchId);

    // Find matches that are fed by the currentSourceMatchId's winner
    const dependentMatchesIndices = matches
      .map((match, index) => ({ match, index }))
      .filter(({ match }) => 
        (match.team1FeederMatchId === currentSourceMatchId && match.team1FeederType === 'winner') ||
        (match.team2FeederMatchId === currentSourceMatchId && match.team2FeederType === 'winner')
      )
      .map(({ index }) => index);

    for (const nextMatchIdx of dependentMatchesIndices) {
      const originalNextMatchStateBeforeClear = JSON.stringify(matches[nextMatchIdx]);
      let nextMatch = { ...matches[nextMatchIdx] }; // Work with a copy
      let participantSlotCleared = false;

      if (nextMatch.team1FeederMatchId === currentSourceMatchId && nextMatch.team1Id !== undefined) {
        nextMatch.team1Id = undefined;
        participantSlotCleared = true;
      }
      if (nextMatch.team2FeederMatchId === currentSourceMatchId && nextMatch.team2Id !== undefined) {
        nextMatch.team2Id = undefined;
        participantSlotCleared = true;
      }

      // If a slot was cleared OR if the match already had a winner (implying it was resolved from the now-cleared path)
      if (participantSlotCleared || nextMatch.winnerId) {
        nextMatch.winnerId = undefined;
        nextMatch.score = undefined;
        
        // Re-evaluate bye state: It's a bye if one team is present and the other slot has NO defined feeder
        const team1Present = !!nextMatch.team1Id;
        const team2Present = !!nextMatch.team2Id;
        const team1FeederDefined = !!nextMatch.team1FeederMatchId;
        const team2FeederDefined = !!nextMatch.team2FeederMatchId;

        if (team1Present && !team2Present && !team2FeederDefined) {
          nextMatch.isBye = true; 
          // nextMatch.winnerId = nextMatch.team1Id; // This auto-advancement should be handled by a subsequent call to advanceWinner if needed
        } else if (!team1Present && !team1FeederDefined && team2Present) {
          nextMatch.isBye = true;
          // nextMatch.winnerId = nextMatch.team2Id;
        } else {
          nextMatch.isBye = false; 
        }
        
        // Only queue if the state actually changed to prevent infinite loops
        if (JSON.stringify(nextMatch) !== originalNextMatchStateBeforeClear) {
            matches[nextMatchIdx] = nextMatch; 
            // If it's not a bye, or it became a bye but isn't auto-resolved, it needs further clearing down the line
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
  fromMatch: Match, // The match whose winner is being cleared
  tournamentType: TournamentType
): Promise<Match[]> {
  let matchesToUpdate = JSON.parse(JSON.stringify(currentMatches)) as Match[]; 

  const fromMatchIndex = matchesToUpdate.findIndex(m => m.id === fromMatch.id);
  if (fromMatchIndex === -1) return matchesToUpdate; // Should not happen

  // Reset the source match itself (winner, score)
  // The `isBye` status for `fromMatch` should reflect its structural state from generation,
  // or if both its participant slots are filled (then not a bye).
  // Do not just set isBye to false here, as it might be a structural bye.
  matchesToUpdate[fromMatchIndex].winnerId = undefined;
  matchesToUpdate[fromMatchIndex].score = undefined;

  // Check if `fromMatch` should revert to being a bye if one participant is present and the other slot has no feeder
  const sourceMatchAfterReset = matchesToUpdate[fromMatchIndex];
  const smTeam1P = !!sourceMatchAfterReset.team1Id;
  const smTeam2P = !!sourceMatchAfterReset.team2Id;
  const smTeam1F = !!sourceMatchAfterReset.team1FeederMatchId;
  const smTeam2F = !!sourceMatchAfterReset.team2FeederMatchId;

  if ( (smTeam1P && !smTeam2P && !smTeam2F) || (!smTeam1P && !smTeam1F && smTeam2P) ) {
      // It could be a structural bye, or become one if a participant was fed.
      // If both team1Id and team2Id are now undefined, but feeders exist, it's not a bye yet.
      // This is complex. For now, rely on the generation logic for initial `isBye`.
      // If both team1Id and team2Id are present, it's definitely not a bye.
      if (smTeam1P && smTeam2P) {
          matchesToUpdate[fromMatchIndex].isBye = false;
      }
      // Further refinement of fromMatch.isBye might be needed here based on its feeders.
  } else if (smTeam1P && smTeam2P) {
      matchesToUpdate[fromMatchIndex].isBye = false;
  }

  // Start clearing subsequent matches based on the tournament type
  if (tournamentType === 'single') {
      return clearSubsequentMatchesSingle(matchesToUpdate, matchesToUpdate[fromMatchIndex]);
  } else if (tournamentType === 'double_elimination') {
    let queue: string[] = [fromMatch.id]; // Start with the match whose outcome changed
    const processedForClearing = new Set<string>();

    while(queue.length > 0) {
        const currentAlteredMatchId = queue.shift()!;
        if (processedForClearing.has(currentAlteredMatchId)) continue;
        processedForClearing.add(currentAlteredMatchId);

        const currentAlteredMatch = matchesToUpdate.find(m => m.id === currentAlteredMatchId);
        if (!currentAlteredMatch) continue; // Should not happen

        // Find all matches that are fed by EITHER the WINNER OR LOSER of currentAlteredMatch
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
            let dependentMatch = { ...matchesToUpdate[idx] }; // Work with a copy
            let participantSlotChanged = false;

            // If dependentMatch was fed by currentAlteredMatch (either winner or loser path),
            // and currentAlteredMatch now has no winner, then the slot in dependentMatch becomes undefined.
            if (dependentMatch.team1FeederMatchId === currentAlteredMatchId && dependentMatch.team1Id !== undefined) {
                dependentMatch.team1Id = undefined; participantSlotChanged = true;
            }
            if (dependentMatch.team2FeederMatchId === currentAlteredMatchId && dependentMatch.team2Id !== undefined) {
                dependentMatch.team2Id = undefined; participantSlotChanged = true;
            }
            
            // If a participant slot was cleared OR the dependent match already had a winner (implying prior resolution)
            if (participantSlotChanged || dependentMatch.winnerId) {
                dependentMatch.winnerId = undefined;
                dependentMatch.score = undefined;
                
                // Re-evaluate bye state for the dependent match
                const depTeam1P = !!dependentMatch.team1Id;
                const depTeam2P = !!dependentMatch.team2Id;
                const depTeam1F = !!dependentMatch.team1FeederMatchId;
                const depTeam2F = !!dependentMatch.team2FeederMatchId;

                if ((depTeam1P && !depTeam2P && !depTeam2F) || (!depTeam1P && !depTeam1F && depTeam2P)) {
                    dependentMatch.isBye = true;
                    // Winner for this bye will be set by advanceWinner if a participant is present
                } else {
                    dependentMatch.isBye = false;
                }
                
                if (JSON.stringify(dependentMatch) !== originalDependentMatchState) {
                    matchesToUpdate[idx] = dependentMatch;
                    // If this dependent match changed and isn't a self-resolved bye, queue it for further clearing
                    if(!dependentMatch.isBye || (dependentMatch.isBye && !dependentMatch.winnerId) ) { 
                         queue.push(dependentMatch.id);
                    }
                }
            }
        }
        
        // Special handling for Grand Final Reset if 'fromMatch' was the Grand Final
        if (currentAlteredMatch.bracketType === 'grandFinal') {
            const gfResetIdx = matchesToUpdate.findIndex(m => m.bracketType === 'grandFinalReset');
            if (gfResetIdx !== -1 && !matchesToUpdate[gfResetIdx].isBye) { // Only reset if it was active
                matchesToUpdate[gfResetIdx].team1Id = undefined;
                matchesToUpdate[gfResetIdx].team2Id = undefined;
                matchesToUpdate[gfResetIdx].winnerId = undefined;
                matchesToUpdate[gfResetIdx].score = undefined;
                matchesToUpdate[gfResetIdx].isBye = true; // Reset to inactive bye state
            }
        }
    }
  }
  return matchesToUpdate;
}
