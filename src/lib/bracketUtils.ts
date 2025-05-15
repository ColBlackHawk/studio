

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

// Helper to create matches from a list of feeders (either direct participant IDs or feeder match objects)
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
       // Check if the feeder match was a bye itself, if so, this slot might become a bye.
      // This specific check might be better handled after all matches are structured,
      // or by ensuring the `feeders` array only contains actual potential participants.
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
        newMatch.winnerId = feeder1;
      } else {
        // If feeder1 is itself a placeholder, the winner is TBD from that feeder match.
        // This match is structurally a bye, winner determined when feeder1 resolves.
      }
    }
    
    // If a team slot is fed by a match that was a bye (and thus has a winner), pre-populate that winner.
    // This needs access to the full list of matches, so it's tricky to do here.
    // The advanceWinner logic should handle this propagation when the feeder match is "resolved".

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
  
  // Determine play-in round participants and those with byes
  const mainBracketSizeAfterPlayIn = getNextPowerOfTwo(N); // Size of the first "full" round
  const numPlayInMatches = N - mainBracketSizeAfterPlayIn / 2;
  const numParticipantsInPlayIn = numPlayInMatches * 2;
  const numParticipantsWithByes = N - numParticipantsInPlayIn;

  // Lowest N players for play-in (participants are assumed to be somewhat sorted or will be shuffled)
  // For more deterministic seeding, sorting by seed/ranking would happen here.
  // For now, slice from the end for play-ins.
  participants.sort(() => Math.random() - 0.5); // Shuffle for fairness if no seeding
  
  const playInParticipants = participants.slice(numParticipantsWithByes);
  const byeParticipants = participants.slice(0, numParticipantsWithByes);

  let feedersForNextRound: (string | { winnerOfMatchId: string })[] = byeParticipants.map(p => p.id);

  // Create Play-In Matches (if necessary)
  if (numPlayInMatches > 0) {
    const { matches: playInMatches, nextRoundFeeders: playInWinnerFeeders } = await createMatchesFromFeeders(
      tournamentId,
      currentRoundNumber,
      1, // Match numbering starts at 1 for this round
      playInParticipants.map(p => p.id), // Play-in participants are direct feeders
      'winners'
    );
    allMatches.push(...playInMatches);
    feedersForNextRound.push(...playInWinnerFeeders);
    currentRoundNumber++;
  }
  
  // Shuffle feeders before the first main round to distribute play-in winners and bye recipients
  feedersForNextRound.sort(() => Math.random() - 0.5);

  // Main Bracket Rounds
  while (feedersForNextRound.length > 1) {
    const { matches: currentRoundGeneratedMatches, nextRoundFeeders: nextFeederBatch } = await createMatchesFromFeeders(
      tournamentId,
      currentRoundNumber,
      1, // Match numbering starts at 1 for each new round
      feedersForNextRound,
      'winners'
    );
    allMatches.push(...currentRoundGeneratedMatches);
    feedersForNextRound = nextFeederBatch;
    currentRoundNumber++;
    if (currentRoundNumber > 20) break; // Safety break
  }
  
  // At this point, feedersForNextRound contains the winner of the final match.
  // The bracket is complete.

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
  const wbMatchesByRound: Match[][] = []; // To store WB matches round by round

  // --- Winners' Bracket (WB) Generation ---
  let wbRoundCounter = 1;
  participants.sort(() => Math.random() - 0.5); // Shuffle for fairness

  const wbMainBracketSize = getNextPowerOfTwo(N);
  const numWbPlayInMatches = N - wbMainBracketSize / 2;
  const numParticipantsInWbPlayIn = numWbPlayInMatches * 2;
  const numParticipantsWithByesToWbMain = N - numParticipantsInWbPlayIn;

  const wbPlayInParticipants = participants.slice(numParticipantsWithByesToWbMain);
  const wbByeParticipants = participants.slice(0, numParticipantsWithByesToWbMain);

  let wbFeedersForCurrentRound: (string | { winnerOfMatchId: string })[] = wbByeParticipants.map(p => p.id);

  if (numWbPlayInMatches > 0) {
    const { matches: playInMatches, nextRoundFeeders: playInWinnerFeeders } = await createMatchesFromFeeders(
      tournamentId, wbRoundCounter, 1, wbPlayInParticipants.map(p => p.id), 'winners'
    );
    allMatches.push(...playInMatches);
    wbMatchesByRound.push([...playInMatches]);
    wbFeedersForCurrentRound.push(...playInWinnerFeeders);
    wbRoundCounter++;
  }
  wbFeedersForCurrentRound.sort(() => Math.random() - 0.5);

  let wbFinalMatchId: string | undefined = undefined;
  while (wbFeedersForCurrentRound.length >= 1) {
    if (wbFeedersForCurrentRound.length === 1 && typeof wbFeedersForCurrentRound[0] !== 'string') {
       // This means the final match has been created, its ID is in the feeder.
       wbFinalMatchId = (wbFeedersForCurrentRound[0] as {winnerOfMatchId: string}).winnerOfMatchId;
       break;
    }
     if (wbFeedersForCurrentRound.length === 1 && typeof wbFeedersForCurrentRound[0] === 'string') {
      // Single participant remaining means they are the winner if N=1, or something went wrong if N > 1
      // This case should be handled by N < 2 check, or if bracket logic leads to single feeder unexpectedly.
      // For WB, if only one feeder remains and it's a participant ID, they won by byes.
      // However, the createMatchesFromFeeders should handle this by creating a bye match.
      // If this point is reached, it means the loop condition might need adjustment or prior logic is flawed.
      console.warn("WB generation ended with a single direct participant feeder:", wbFeedersForCurrentRound[0]);
      // Potentially, this participant is the WB winner.
      // A Match object representing their win might be needed if not already created by `createMatchesFromFeeders`.
      break;
    }


    const { matches: currentRoundWbMatches, nextRoundFeeders: nextWbFeeders } = await createMatchesFromFeeders(
      tournamentId, wbRoundCounter, 1, wbFeedersForCurrentRound, 'winners'
    );
    allMatches.push(...currentRoundWbMatches);
    wbMatchesByRound.push([...currentRoundWbMatches]);
    wbFeedersForCurrentRound = nextWbFeeders;
    
    if (wbFeedersForCurrentRound.length === 1 && typeof wbFeedersForCurrentRound[0] !== 'string') {
         wbFinalMatchId = (wbFeedersForCurrentRound[0] as {winnerOfMatchId: string}).winnerOfMatchId;
    }
    wbRoundCounter++;
    if (wbRoundCounter > 20) break; // Safety
  }
  
  if (!wbFinalMatchId && wbMatchesByRound.length > 0) {
    const lastWbRound = wbMatchesByRound[wbMatchesByRound.length -1];
    if (lastWbRound.length === 1) wbFinalMatchId = lastWbRound[0].id;
  }


  // --- Losers' Bracket (LB) Generation ---
  let lbRoundCounter = 1;
  let advancingLbWinners: { winnerOfMatchId: string }[] = []; // Winners from the current set of LB matches being processed
  let lbFinalMatchId: string | undefined = undefined;

  // Iterate through WB rounds to drop losers.
  // Losers from WB play-ins and WB Round 1 typically play each other first.
  // Then, winners of those LB matches play losers from WB Round 2, and so on.

  let wbLoserDropRoundIndex = 0; // Index for wbMatchesByRound

  while(true) {
    const currentLbFeeders: ( {loserOfMatchId: string} | {winnerOfMatchId: string} )[] = [];
    
    // Determine how many WB losers drop at this LB stage
    const wbRoundForCurrentDrop = wbMatchesByRound[wbLoserDropRoundIndex];
    if (wbRoundForCurrentDrop) {
        wbRoundForCurrentDrop.forEach(wbMatch => {
            // Only add losers from non-bye matches. If a WB match was a bye, its "loser" doesn't exist.
            // The `createMatchesFromFeeders` will handle a feeder that points to a bye match correctly
            // by creating a bye for the opponent in the LB match.
             if (!wbMatch.isBye) { // Only non-bye matches produce a loser to drop
                currentLbFeeders.push({ loserOfMatchId: wbMatch.id });
            }
        });
    }
    
    // Add advancing LB winners from the previous LB processing iteration
    currentLbFeeders.push(...advancingLbWinners);
    advancingLbWinners = []; // Reset for the next batch of LB matches

    if (currentLbFeeders.length === 0) {
        // This can happen if all WB losers have dropped and all LB winners have been processed through pairings.
        // If advancingLbWinners from the very last LB match creation was one, that's the LB final winner.
        break; 
    }
    if (currentLbFeeders.length === 1 && wbLoserDropRoundIndex >= wbMatchesByRound.length) {
        // All WB losers dropped, only one LB participant remains. They are the LB winner.
        if (typeof currentLbFeeders[0] !== 'string' && 'winnerOfMatchId' in currentLbFeeders[0]) {
             lbFinalMatchId = currentLbFeeders[0].winnerOfMatchId;
        }
        break;
    }
    
    currentLbFeeders.sort(() => Math.random() - 0.5); // Shuffle to mix WB losers and LB winners if strategy demands

    const { matches: createdLbMatches, nextRoundFeeders: nextLbWinnerFeeders } = await createMatchesFromFeeders(
        tournamentId, lbRoundCounter, 1, currentLbFeeders, 'losers'
    );

    if (createdLbMatches.length > 0) {
        allMatches.push(...createdLbMatches);
        advancingLbWinners = nextLbWinnerFeeders;
        if (advancingLbWinners.length === 1 && wbLoserDropRoundIndex >= wbMatchesByRound.length -1) {
            // If only one winner emerges from this LB round AND all or most WB losers have dropped
            // this winner is likely the LB champion, or feeds into the final LB match.
             const lastLbMatchCreated = createdLbMatches[createdLbMatches.length -1];
             const allWbLosersProcessed = wbLoserDropRoundIndex >= wbMatchesByRound.length;

             // A more robust check for LB final:
             // The LB final typically happens when there's one feeder from WB final loser,
             // and one feeder from the winner of the penultimate LB stage.
             // The current logic might make the LB final earlier if shapes align.
             // This loop structure will create matches as long as there are >= 2 feeders.
             // If `nextLbWinnerFeeders` has 1, that's the winner of this batch.

            if (nextLbWinnerFeeders.length === 1) {
                 lbFinalMatchId = nextLbWinnerFeeders[0].winnerOfMatchId;
                 // If this is the LB final winner, and all WB losers are done, break.
                 // The exception is the loser of WB Final, who plays this LB winner.
                 const wbFinal = allMatches.find(m => m.id === wbFinalMatchId);
                 if (wbFinal && wbFinal.round === (wbMatchesByRound.length + (numWbPlayInMatches > 0 ? 1 : 0))) { // Check if WB final loser has dropped
                     // This means `lbFinalMatchId` is the true LB winner to go to GF.
                 } else {
                     // Still waiting for WB Final loser to drop. The current lbFinalMatchId might be for a penultimate LB match.
                 }
            }
        }
        lbRoundCounter++;
    } else if (advancingLbWinners.length === 1) {
        // No new matches created, but one LB winner remains from previous iteration. This is the LB champ.
        lbFinalMatchId = advancingLbWinners[0].winnerOfMatchId;
        break;
    } else {
        // No matches and no single winner, implies processing is done or an issue.
        break;
    }

    wbLoserDropRoundIndex++;
    if (lbRoundCounter > 30) break; // Safety break
  }
  
  // Check if the loser of the WB final needs to play the current LB champ
  const wbFinalLoserFeeder = wbFinalMatchId ? { loserOfMatchId: wbFinalMatchId } : undefined;
  if (wbFinalLoserFeeder && lbFinalMatchId) {
      const lbWinnerFeeder = {winnerOfMatchId: lbFinalMatchId};
      const {matches: finalLbStageMatches, nextRoundFeeders: finalLbWinner} = await createMatchesFromFeeders(
          tournamentId, lbRoundCounter, 1, [wbFinalLoserFeeder, lbWinnerFeeder], 'losers'
      );
      if (finalLbStageMatches.length > 0) {
          allMatches.push(...finalLbStageMatches);
          if (finalLbWinner.length === 1) {
              lbFinalMatchId = finalLbWinner[0].winnerOfMatchId;
          }
      }
  }


  // --- Grand Final (GF) ---
  if (wbFinalMatchId && lbFinalMatchId) {
    allMatches.push({
      id: crypto.randomUUID(), tournamentId, round: 1, matchNumberInRound: 1, bracketType: 'grandFinal',
      team1FeederMatchId: wbFinalMatchId, team1FeederType: 'winner', // WB Winner
      team2FeederMatchId: lbFinalMatchId, team2FeederType: 'winner', // LB Winner
    });
    allMatches.push({ // GF Reset Match (initially a bye, populated if LB winner wins GF1)
      id: crypto.randomUUID(), tournamentId, round: 2, matchNumberInRound: 1, bracketType: 'grandFinalReset',
      isBye: true,
    });
  } else {
    console.warn("DE Gen: Could not determine WB or LB final for Grand Final setup.", {wbFinalMatchId, lbFinalMatchId});
    allMatches.push({ id: crypto.randomUUID(), tournamentId, round: 1, matchNumberInRound: 1, bracketType: 'grandFinal', isBye: true });
    allMatches.push({ id: crypto.randomUUID(), tournamentId, round: 2, matchNumberInRound: 1, bracketType: 'grandFinalReset', isBye: true });
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
  const matchBeingUpdated = newMatches[uMatchIndex]; // Use this for consistent state

  if (!matchBeingUpdated.winnerId && !matchBeingUpdated.isBye) { 
    return clearSubsequentMatches(newMatches, matchBeingUpdated, 'single');
  }

  if (matchBeingUpdated.winnerId) {
    const nextMatchIndex = newMatches.findIndex(m =>
      m.bracketType === 'winners' && // SE uses 'winners' type
      (m.team1FeederMatchId === matchBeingUpdated.id || m.team2FeederMatchId === matchBeingUpdated.id)
    );

    if (nextMatchIndex !== -1) {
      let nextMatch = { ...newMatches[nextMatchIndex] }; 
      let changed = false;

      if (nextMatch.team1FeederMatchId === matchBeingUpdated.id) {
        if (nextMatch.team1Id !== matchBeingUpdated.winnerId) {
          nextMatch.team1Id = matchBeingUpdated.winnerId;
          changed = true;
        }
      } else if (nextMatch.team2FeederMatchId === matchBeingUpdated.id) {
        if (nextMatch.team2Id !== matchBeingUpdated.winnerId) {
          nextMatch.team2Id = matchBeingUpdated.winnerId;
          changed = true;
        }
      }
      
      if (changed) {
        nextMatch.winnerId = undefined; 
        nextMatch.score = undefined;
        
        // A match is a bye if one team is present and the other slot has NO defined feeder and NO direct participant
        if (nextMatch.team1Id && !nextMatch.team2Id && !nextMatch.team2FeederMatchId) {
          nextMatch.isBye = true;
          nextMatch.winnerId = nextMatch.team1Id;
        } else if (!nextMatch.team1Id && !nextMatch.team1FeederMatchId && nextMatch.team2Id) {
          nextMatch.isBye = true;
          nextMatch.winnerId = nextMatch.team2Id;
        } else {
          nextMatch.isBye = !!(nextMatch.team1Id && !nextMatch.team2Id && !nextMatch.team2FeederMatchId) || 
                           !!(!nextMatch.team1Id && !nextMatch.team1FeederMatchId && nextMatch.team2Id);
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

  if (!currentUpdatedMatchState.winnerId) return newMatches; 

  const { id: matchId, winnerId, bracketType, team1Id, team2Id } = currentUpdatedMatchState;
  const loserId = (winnerId === team1Id) ? team2Id : team1Id;

  const findAndUpdateNext = async (
    sourceMatchId: string, 
    participantToAdvanceId: string | undefined, 
    feederTypeForNextSlot: 'winner' | 'loser' // Type of participant we are advancing
  ): Promise<void> => {
    if (!participantToAdvanceId) return;

    const nextMatchIdx = newMatches.findIndex(m => 
      (m.team1FeederMatchId === sourceMatchId && m.team1FeederType === feederTypeForNextSlot) ||
      (m.team2FeederMatchId === sourceMatchId && m.team2FeederType === feederTypeForNextSlot)
    );

    if (nextMatchIdx !== -1) {
      let nextMatchToUpdate = newMatches[nextMatchIdx];
      let changed = false;

      if (nextMatchToUpdate.team1FeederMatchId === sourceMatchId && nextMatchToUpdate.team1FeederType === feederTypeForNextSlot) {
        if (nextMatchToUpdate.team1Id !== participantToAdvanceId) {
           nextMatchToUpdate.team1Id = participantToAdvanceId; changed = true;
        }
      } else if (nextMatchToUpdate.team2FeederMatchId === sourceMatchId && nextMatchToUpdate.team2FeederType === feederTypeForNextSlot) {
         if (nextMatchToUpdate.team2Id !== participantToAdvanceId) {
            nextMatchToUpdate.team2Id = participantToAdvanceId; changed = true;
         }
      }
      
      if (changed) {
        nextMatchToUpdate.winnerId = undefined;
        nextMatchToUpdate.score = undefined;
        
        const team1Present = !!nextMatchToUpdate.team1Id;
        const team2Present = !!nextMatchToUpdate.team2Id;
        const team1FeederDefined = !!nextMatchToUpdate.team1FeederMatchId;
        const team2FeederDefined = !!nextMatchToUpdate.team2FeederMatchId;

        if (team1Present && !team2Present && !team2FeederDefined) {
          nextMatchToUpdate.isBye = true; nextMatchToUpdate.winnerId = nextMatchToUpdate.team1Id;
        } else if (!team1Present && !team1FeederDefined && team2Present) {
          nextMatchToUpdate.isBye = true; nextMatchToUpdate.winnerId = nextMatchToUpdate.team2Id;
        } else {
          nextMatchToUpdate.isBye = false;
        }
        
        newMatches[nextMatchIdx] = nextMatchToUpdate; 
        if (nextMatchToUpdate.isBye && nextMatchToUpdate.winnerId && nextMatchToUpdate.id !== sourceMatchId) {
          // Important: Pass a copy of newMatches to avoid stale states in recursion
          newMatches = await advanceWinnerDoubleElimination(JSON.parse(JSON.stringify(newMatches)), nextMatchToUpdate, registrations);
        }
      }
    }
  };

  if (bracketType === 'winners') {
    await findAndUpdateNext(matchId, winnerId, 'winner'); 
    if (loserId) { // Only advance loser if there was one (not a bye match)
      await findAndUpdateNext(matchId, loserId, 'loser'); 
    }
  } else if (bracketType === 'losers') {
    await findAndUpdateNext(matchId, winnerId, 'winner'); 
  } else if (bracketType === 'grandFinal') {
    const gfResetMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinalReset');
    if (gfResetMatchIndex !== -1) {
      if (winnerId === team1Id) { // WB winner wins GF, no reset needed
        newMatches[gfResetMatchIndex].isBye = true;
        newMatches[gfResetMatchIndex].team1Id = undefined;
        newMatches[gfResetMatchIndex].team2Id = undefined;
        newMatches[gfResetMatchIndex].winnerId = undefined; 
        newMatches[gfResetMatchIndex].score = undefined;
      } else if (winnerId === team2Id && team1Id && team2Id) { // LB winner wins GF, reset IS needed
        newMatches[gfResetMatchIndex].team1Id = team1Id; 
        newMatches[gfResetMatchIndex].team2Id = team2Id; 
        newMatches[gfResetMatchIndex].isBye = false;
        newMatches[gfResetMatchIndex].winnerId = undefined;
        newMatches[gfResetMatchIndex].score = undefined;
      }
       // If GF itself was a bye (e.g. one finalist TBD), reset should also be bye.
       else if (!team1Id || !team2Id) {
         newMatches[gfResetMatchIndex].isBye = true;
         newMatches[gfResetMatchIndex].team1Id = undefined;
         newMatches[gfResetMatchIndex].team2Id = undefined;
         newMatches[gfResetMatchIndex].winnerId = undefined;
         newMatches[gfResetMatchIndex].score = undefined;
       }
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

  if (tournamentType === 'single') {
    return advanceWinnerSingleElimination(newMatchesWorkingCopy, newMatchesWorkingCopy[matchIdx], registrations);
  } else if (tournamentType === 'double_elimination') {
    return advanceWinnerDoubleElimination(newMatchesWorkingCopy, newMatchesWorkingCopy[matchIdx], registrations);
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
      const originalNextMatchState = JSON.stringify(matches[nextMatchIdx]);
      let nextMatch = matches[nextMatchIdx]; 
      let changedInThisIteration = false;

      if (nextMatch.team1FeederMatchId === currentSourceMatchId && nextMatch.team1Id !== undefined) {
        nextMatch.team1Id = undefined;
        changedInThisIteration = true;
      }
      if (nextMatch.team2FeederMatchId === currentSourceMatchId && nextMatch.team2Id !== undefined) {
        nextMatch.team2Id = undefined;
        changedInThisIteration = true;
      }

      // If either participant slot was cleared, or if the match had a winner (implying it was resolved based on prior state)
      // then we need to reset its winner/score and re-evaluate its bye state.
      if (changedInThisIteration || nextMatch.winnerId) {
        nextMatch.winnerId = undefined;
        nextMatch.score = undefined;
        
        const team1Present = !!nextMatch.team1Id;
        const team2Present = !!nextMatch.team2Id;
        const team1FeederDefined = !!nextMatch.team1FeederMatchId;
        const team2FeederDefined = !!nextMatch.team2FeederMatchId;

        if (team1Present && !team2Present && !team2FeederDefined) {
          nextMatch.isBye = true; nextMatch.winnerId = nextMatch.team1Id; // This winnerId will be processed by advanceWinner if needed
        } else if (!team1Present && !team1FeederDefined && team2Present) {
          nextMatch.isBye = true; nextMatch.winnerId = nextMatch.team2Id;
        } else {
          nextMatch.isBye = false; 
        }
        
        // Only queue if the state actually changed to prevent infinite loops on stable states
        if (JSON.stringify(nextMatch) !== originalNextMatchState) {
            matches[nextMatchIdx] = nextMatch; 
             // If it became a bye and an auto-winner was set, that winner needs to propagate.
             // However, advanceWinner should be called separately for that.
             // For clearing, we just queue if it's not a resolved bye.
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

  // Reset the source match itself (winner, score)
  matchesToUpdate[fromMatchIndex].winnerId = undefined;
  matchesToUpdate[fromMatchIndex].score = undefined;
  // Re-evaluate its bye state only if it's not structurally a bye from generation
  const sourceIsStructurallyBye = (!matchesToUpdate[fromMatchIndex].team1Id && !matchesToUpdate[fromMatchIndex].team1FeederMatchId && matchesToUpdate[fromMatchIndex].team2Id) ||
                                 (matchesToUpdate[fromMatchIndex].team1Id && !matchesToUpdate[fromMatchIndex].team2Id && !matchesToUpdate[fromMatchIndex].team2FeederMatchId);
  if (!sourceIsStructurallyBye && matchesToUpdate[fromMatchIndex].team1Id && matchesToUpdate[fromMatchIndex].team2Id) {
      matchesToUpdate[fromMatchIndex].isBye = false; 
  }
  
  if (tournamentType === 'single') {
      return clearSubsequentMatchesSingle(matchesToUpdate, matchesToUpdate[fromMatchIndex]);
  } else if (tournamentType === 'double_elimination') {
    let queue: string[] = [fromMatch.id];
    const processed = new Set<string>();

    while(queue.length > 0) {
        const currentSourceMatchId = queue.shift()!;
        if (processed.has(currentSourceMatchId)) continue;
        processed.add(currentSourceMatchId);

        const sourceMatchForQueueLoop = matchesToUpdate.find(m => m.id === currentSourceMatchId);
        if (!sourceMatchForQueueLoop) continue;

        // Find matches fed by this match's winner OR loser
        const dependentMatchIndices: number[] = [];
        matchesToUpdate.forEach((potentialDependentMatch, index) => {
            if ( (potentialDependentMatch.team1FeederMatchId === currentSourceMatchId && (potentialDependentMatch.team1FeederType === 'winner' || potentialDependentMatch.team1FeederType === 'loser')) ||
                 (potentialDependentMatch.team2FeederMatchId === currentSourceMatchId && (potentialDependentMatch.team2FeederType === 'winner' || potentialDependentMatch.team2FeederType === 'loser')) ) 
            {
                dependentMatchIndices.push(index);
            }
        });


        for (const idx of dependentMatchIndices) {
            const originalNextMatchState = JSON.stringify(matchesToUpdate[idx]);
            let dependentMatch = matchesToUpdate[idx];
            let participantSlotCleared = false;

            if (dependentMatch.team1FeederMatchId === currentSourceMatchId) {
                if(dependentMatch.team1Id !== undefined) { dependentMatch.team1Id = undefined; participantSlotCleared = true;}
            }
            if (dependentMatch.team2FeederMatchId === currentSourceMatchId) {
                 if(dependentMatch.team2Id !== undefined) { dependentMatch.team2Id = undefined; participantSlotCleared = true;}
            }
            
            // If a participant slot was cleared OR if the dependent match already had a winner (implying it was resolved)
            if (participantSlotCleared || dependentMatch.winnerId) {
                dependentMatch.winnerId = undefined;
                dependentMatch.score = undefined;
                
                const depTeam1Present = !!dependentMatch.team1Id;
                const depTeam2Present = !!dependentMatch.team2Id;
                const depTeam1FeederDefined = !!dependentMatch.team1FeederMatchId;
                const depTeam2FeederDefined = !!dependentMatch.team2FeederMatchId;

                if (depTeam1Present && !depTeam2Present && !depTeam2FeederDefined) {
                    dependentMatch.isBye = true; // Winner TBD if depTeam1Id came from another feeder
                } else if (!depTeam1Present && !depTeam1FeederDefined && depTeam2Present) {
                    dependentMatch.isBye = true;
                } else {
                    dependentMatch.isBye = false;
                }
                
                if (JSON.stringify(dependentMatch) !== originalNextMatchState) {
                    matchesToUpdate[idx] = dependentMatch;
                    if (!dependentMatch.isBye || (dependentMatch.isBye && !dependentMatch.winnerId) ) { // only queue if not a resolved bye
                         queue.push(dependentMatch.id);
                    }
                }
            }
        }
        // Special handling for Grand Final Reset if 'fromMatch' was the Grand Final
        if (sourceMatchForQueueLoop.bracketType === 'grandFinal') {
            const gfResetIdx = matchesToUpdate.findIndex(m => m.bracketType === 'grandFinalReset');
            if (gfResetIdx !== -1 && !matchesToUpdate[gfResetIdx].isBye) { // Only reset if it was active
                matchesToUpdate[gfResetIdx].team1Id = undefined;
                matchesToUpdate[gfResetIdx].team2Id = undefined;
                matchesToUpdate[gfResetIdx].winnerId = undefined;
                matchesToUpdate[gfResetIdx].score = undefined;
                matchesToUpdate[gfResetIdx].isBye = true; // Reset to inactive bye state
                // No need to queue gfReset further as it's an end-point or activated by GF winner
            }
        }
    }
  }
  return matchesToUpdate;
}

