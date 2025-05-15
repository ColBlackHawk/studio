
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
function getMaxRoundForBracket(matches: Match[], bracketType: Match['bracketType']): number {
    const bracketMatches = matches.filter(m => m.bracketType === bracketType);
    if (bracketMatches.length === 0) return 0;
    return Math.max(...bracketMatches.map(m => m.round), 0);
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
  if (N < 2) { // Handle 0 or 1 participant case
    if (N === 1) {
      return [{
        id: crypto.randomUUID(),
        tournamentId,
        round: 1,
        matchNumberInRound: 1,
        bracketType: 'winners', // Single elimination uses 'winners' as its main bracket type
        team1Id: participants[0].id,
        isBye: true,
        winnerId: participants[0].id,
      }];
    }
    return []; // No matches for 0 participants
  }

  // Shuffle participants for random pairings if no seeding exists.
  // For now, we'll use registration order or assume seeding is handled elsewhere.
  // participants.sort(() => Math.random() - 0.5);

  const allMatches: Match[] = [];
  let roundCounter = 1;
  type Feeder = string | { winnerOfMatchId: string }; // string is participantId
  let feedersForCurrentRound: Feeder[];


  const numParticipants = N;
  const mainBracketSize = getNextPowerOfTwo(numParticipants);
  const numPlayInMatches = numParticipants - (mainBracketSize / 2); // Number of matches to get to power of 2 for next round
  const numParticipantsInPlayIn = numPlayInMatches * 2;
  const numParticipantsWithByes = numParticipants - numParticipantsInPlayIn;

  const participantsForPlayIn = participants.slice(numParticipantsWithByes); // Lowest N players for play-in
  const participantsWithByesToRound2 = participants.slice(0, numParticipantsWithByes); // Top N players get byes

  feedersForCurrentRound = participantsWithByesToRound2.map(p => p.id as Feeder);
  
  if (numPlayInMatches > 0) {
    let matchNumberInPlayInRound = 1;
    for (let i = 0; i < participantsForPlayIn.length; i += 2) {
      const team1Entry = participantsForPlayIn[i];
      const team2Entry = participantsForPlayIn[i + 1]; // Should always exist due to numPlayInMatches logic

      const matchId = crypto.randomUUID();
      const playInMatch: Match = {
        id: matchId,
        tournamentId,
        round: roundCounter, // Play-in round is Round 1
        matchNumberInRound: matchNumberInPlayInRound++,
        bracketType: 'winners',
        team1Id: team1Entry.id,
        team2Id: team2Entry.id, // Assuming pair for play-in
        isBye: false, 
      };
      allMatches.push(playInMatch);
      feedersForCurrentRound.push({ winnerOfMatchId: matchId });
    }
    roundCounter++;
  } else {
    // If no play-in matches, all participants are direct feeders for the first round
    feedersForCurrentRound = participants.map(p => p.id as Feeder);
  }
  
  // Shuffle feeders for the first main round to ensure byes are distributed if any exist at this stage
  // (e.g., if N=3, 1 bye to R2, 2 play in R1. Winner of R1 plays the bye in R2)
  feedersForCurrentRound.sort(() => Math.random() - 0.5);

  // Main bracket generation
  while (feedersForCurrentRound.length > 1 || (feedersForCurrentRound.length === 1 && typeof feedersForCurrentRound[0] !== 'string')) {
    if (feedersForCurrentRound.length === 1 && typeof feedersForCurrentRound[0] !== 'string') {
      // This means the final match has been created, and its winner is the tournament winner
      // No more matches to generate. The last entry in `feedersForCurrentRound` is {winnerOfMatchId: finalMatchId}
      break;
    }
    
    const currentRoundMatches: Match[] = [];
    const nextRoundFeeders: Feeder[] = [];
    let matchNumberInCurrentRound = 1;

    for (let i = 0; i < feedersForCurrentRound.length; i += 2) {
      const feeder1 = feedersForCurrentRound[i];
      const feeder2 = feedersForCurrentRound[i + 1]; // This might be undefined if odd number of feeders (bye)

      const matchId = crypto.randomUUID();

      const newMatch: Match = {
        id: matchId,
        tournamentId,
        round: roundCounter,
        matchNumberInRound: matchNumberInCurrentRound++,
        bracketType: 'winners',
        isBye: false,
      };

      if (typeof feeder1 === 'string') {
        newMatch.team1Id = feeder1;
      } else {
        newMatch.team1FeederMatchId = feeder1.winnerOfMatchId;
        newMatch.team1FeederType = 'winner';
      }

      if (feeder2) {
        if (typeof feeder2 === 'string') {
          newMatch.team2Id = feeder2;
        } else {
          newMatch.team2FeederMatchId = feeder2.winnerOfMatchId;
          newMatch.team2FeederType = 'winner';
        }
      } else {
        // Feeder2 is undefined, so team1 gets a bye in this match
        newMatch.isBye = true;
        newMatch.winnerId = newMatch.team1Id; // If team1Id is direct participant
        // If team1Id is from a feeder match, its winner is not yet known, so newMatch.winnerId remains undefined.
        // This case (bye because feeder2 is missing, but feeder1 is also a placeholder) is complex.
        // It implies a structural bye earlier. For SE, this logic means team1 advanced.
        if (!newMatch.team1Id && newMatch.team1FeederMatchId) {
           // This should ideally not happen if play-ins are structured correctly to make main bracket power-of-2
           // If it does, it means a feeder match leads to a bye slot.
           // The winner of that feederMatchId would get the bye here.
           // This will be resolved when advanceWinner is called for that feeder match.
           newMatch.isBye = true; // It's a bye structurally.
        }
      }
      
      currentRoundMatches.push(newMatch);
      nextRoundFeeders.push({ winnerOfMatchId: matchId });
    }
    
    allMatches.push(...currentRoundMatches);
    feedersForCurrentRound = nextRoundFeeders;
    roundCounter++;

    if (roundCounter > 20) break; // Safety break for unexpected loops
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
  if (N < 2) return N === 1 ? [{ id: crypto.randomUUID(), tournamentId, round: 1, matchNumberInRound: 1, bracketType: 'winners', team1Id: participants[0].id, isBye: true, winnerId: participants[0].id }] : [];

  const allMatches: Match[] = [];

  // --- Winners' Bracket (WB) Generation ---
  let wbRoundCounter = 1;
  type WBFeeder = string | { winnerOfMatchId: string };
  let wbFeedersForCurrentRound: WBFeeder[];

  const wbMainBracketSize = getNextPowerOfTwo(N);
  const numWbPlayInMatches = N - (wbMainBracketSize / 2);
  const numParticipantsInWbPlayIn = numWbPlayInMatches * 2;
  const numParticipantsWithByesToWbRound2 = N - numParticipantsInWbPlayIn;

  const participantsForWbPlayIn = participants.slice(numParticipantsWithByesToWbRound2);
  const participantsWithByesWb = participants.slice(0, numParticipantsWithByesToWbRound2);

  wbFeedersForCurrentRound = participantsWithByesWb.map(p => p.id as WBFeeder);

  const wbPlayInMatches: Match[] = [];
  if (numWbPlayInMatches > 0) {
    let matchNum = 1;
    for (let i = 0; i < participantsForWbPlayIn.length; i += 2) {
      const team1 = participantsForWbPlayIn[i];
      const team2 = participantsForWbPlayIn[i + 1];
      const matchId = crypto.randomUUID();
      const playInMatch: Match = {
        id: matchId, tournamentId, round: wbRoundCounter, matchNumberInRound: matchNum++,
        bracketType: 'winners', team1Id: team1.id, team2Id: team2.id,
      };
      wbPlayInMatches.push(playInMatch);
      wbFeedersForCurrentRound.push({ winnerOfMatchId: matchId });
    }
    allMatches.push(...wbPlayInMatches);
    wbRoundCounter++;
  } else {
    wbFeedersForCurrentRound = participants.map(p => p.id as WBFeeder);
  }
  wbFeedersForCurrentRound.sort(() => Math.random() - 0.5); // Shuffle for main bracket

  let wbMatchesGeneratedInRound: Match[] = [];
  while (wbFeedersForCurrentRound.length > 1 || (wbFeedersForCurrentRound.length === 1 && typeof wbFeedersForCurrentRound[0] !== 'string')) {
    if (wbFeedersForCurrentRound.length === 1 && typeof wbFeedersForCurrentRound[0] !== 'string') break;
    
    const currentWbRoundMatches: Match[] = [];
    const nextWbRoundFeeders: WBFeeder[] = [];
    let matchNum = 1;
    for (let i = 0; i < wbFeedersForCurrentRound.length; i += 2) {
      const feeder1 = wbFeedersForCurrentRound[i];
      const feeder2 = wbFeedersForCurrentRound[i + 1];
      const matchId = crypto.randomUUID();
      const newMatch: Match = {
        id: matchId, tournamentId, round: wbRoundCounter, matchNumberInRound: matchNum++,
        bracketType: 'winners', isBye: false,
      };
      if (typeof feeder1 === 'string') newMatch.team1Id = feeder1;
      else { newMatch.team1FeederMatchId = feeder1.winnerOfMatchId; newMatch.team1FeederType = 'winner'; }
      if (feeder2) {
        if (typeof feeder2 === 'string') newMatch.team2Id = feeder2;
        else { newMatch.team2FeederMatchId = feeder2.winnerOfMatchId; newMatch.team2FeederType = 'winner'; }
      } else {
        newMatch.isBye = true; newMatch.winnerId = newMatch.team1Id;
      }
      currentWbRoundMatches.push(newMatch);
      nextWbRoundFeeders.push({ winnerOfMatchId: matchId });
    }
    allMatches.push(...currentWbRoundMatches);
    wbMatchesGeneratedInRound = currentWbRoundMatches; // Keep track of matches in the last generated WB round
    wbFeedersForCurrentRound = nextWbRoundFeeders;
    wbRoundCounter++;
    if (wbRoundCounter > 20) break;
  }
  const wbFinalMatchId = wbMatchesGeneratedInRound.length === 1 ? wbMatchesGeneratedInRound[0].id : undefined;

  // --- Losers' Bracket (LB) Generation (Structured Placeholder) ---
  // This is a simplified LB structure generation. A fully dynamic one is much more complex.
  // It roughly mirrors the WB structure but offset.
  const numWbMainRounds = wbRoundCounter - (numWbPlayInMatches > 0 ? 2:1) ; // Number of rounds in WB after play-ins.
  let lbRoundCounter = 1;
  
  // LB matches fed by losers of WB play-in matches (if any)
  const wbPlayInLoserMatches: Match[] = [];
  if (numWbPlayInMatches > 0) {
    let matchNum = 1;
    for(let i = 0; i < wbPlayInMatches.length; i+=2) {
        const feederMatch1 = wbPlayInMatches[i];
        const feederMatch2 = wbPlayInMatches[i+1]; // Might be undefined

        const lbMatchId = crypto.randomUUID();
        const newLbMatch: Match = {
            id: lbMatchId, tournamentId, round: lbRoundCounter, matchNumberInRound: matchNum++,
            bracketType: 'losers', team1FeederMatchId: feederMatch1.id, team1FeederType: 'loser'
        };
        if (feederMatch2) {
            newLbMatch.team2FeederMatchId = feederMatch2.id;
            newLbMatch.team2FeederType = 'loser';
        } else { // Only one play-in match means its loser gets a bye in this first LB "pairing" round
            newLbMatch.isBye = true;
            // Winner is TBD based on feederMatch1 loser
        }
        wbPlayInLoserMatches.push(newLbMatch);
    }
    if(wbPlayInLoserMatches.length > 0) {
        allMatches.push(...wbPlayInLoserMatches);
        lbRoundCounter++;
    }
  }


  // For a more standard pairing, the LB often has rounds where WB losers meet LB winners.
  // This is where it gets very tricky to generalize for all N.
  // Let's assume an N that's a power of 2 for simpler LB structure after WB play-ins.
  // The number of effective participants for main WB is `wbMainBracketSize / 2` matches in first main round.
  const firstMainWbRoundNumber = (numWbPlayInMatches > 0 ? 2 : 1);
  const firstMainWbMatches = allMatches.filter(m => m.bracketType === 'winners' && m.round === firstMainWbRoundNumber);

  let lbFeeders: ({winnerOfMatchId: string} | {loserOfMatchId: string})[] = [];
  
  // Initial feeders for LB are losers of the first main WB round
  firstMainWbMatches.forEach(m => lbFeeders.push({loserOfMatchId: m.id}));
  
  // If there were play-in matches, their losers also feed into the LB.
  // The winners of wbPlayInLoserMatches (if any) also need to be incorporated.
  // This part needs a very robust algorithm based on N.
  // For simplification: create a basic LB structure matching WB rounds count.
  
  let lbMatchesLastRound: Match[] = [];

  for (let r = 0; r < numWbMainRounds * 2 - 2; r++) { // Approximation of LB rounds
    if (lbFeeders.length < 2 && r > 0 && lbFeeders.length ===1 ) { // LB final match might have been created
        // check if this single feeder is for the LB final
        const potentialLbFinalFeeder = lbFeeders[0];
        if ('winnerOfMatchId' in potentialLbFinalFeeder) {
            const feederMatch = allMatches.find(m => m.id === potentialLbFinalFeeder.winnerOfMatchId);
            if (feederMatch && feederMatch.bracketType === 'losers') {
                 lbMatchesLastRound = [feederMatch]; // This is likely the LB final winner feeder
                 break;
            }
        }
    }
    if (lbFeeders.length < 1) break;


    const currentLbRoundMatches: Match[] = [];
    const nextLbFeeders: ({winnerOfMatchId: string})[] = [];
    let matchNumLb = 1;
    
    for (let i = 0; i < lbFeeders.length; i += 2) {
        const feeder1Lb = lbFeeders[i];
        const feeder2Lb = lbFeeders[i+1]; // Might be undefined
        const lbMatchId = crypto.randomUUID();
        const newLbMatch: Match = {
            id: lbMatchId, tournamentId, round: lbRoundCounter, matchNumberInRound: matchNumLb++,
            bracketType: 'losers', isBye: false,
        };

        if ('winnerOfMatchId' in feeder1Lb) {
            newLbMatch.team1FeederMatchId = feeder1Lb.winnerOfMatchId; newLbMatch.team1FeederType = 'winner';
        } else {
            newLbMatch.team1FeederMatchId = feeder1Lb.loserOfMatchId; newLbMatch.team1FeederType = 'loser';
        }

        if (feeder2Lb) {
            if ('winnerOfMatchId' in feeder2Lb) {
                newLbMatch.team2FeederMatchId = feeder2Lb.winnerOfMatchId; newLbMatch.team2FeederType = 'winner';
            } else {
                newLbMatch.team2FeederMatchId = feeder2Lb.loserOfMatchId; newLbMatch.team2FeederType = 'loser';
            }
        } else {
            newLbMatch.isBye = true; // Winner is TBD from feeder1
        }
        currentLbRoundMatches.push(newLbMatch);
        nextLbFeeders.push({winnerOfMatchId: lbMatchId});
    }
    if (currentLbRoundMatches.length > 0) {
        allMatches.push(...currentLbRoundMatches);
        lbMatchesLastRound = currentLbRoundMatches;
    }
    lbFeeders = nextLbFeeders as any; // Cast because next round only has winners
    lbRoundCounter++;
    if (lbRoundCounter > 20) break;
  }
  const lbFinalMatchId = lbMatchesLastRound.length === 1 ? lbMatchesLastRound[0].id : undefined;


  // --- Grand Final (GF) ---
  if (wbFinalMatchId && lbFinalMatchId) {
    allMatches.push({
      id: crypto.randomUUID(), tournamentId, round: 1, matchNumberInRound: 1, bracketType: 'grandFinal',
      team1FeederMatchId: wbFinalMatchId, team1FeederType: 'winner', // WB Winner
      team2FeederMatchId: lbFinalMatchId, team2FeederType: 'winner', // LB Winner
    });
    allMatches.push({ // GF Reset Match (initially a bye)
      id: crypto.randomUUID(), tournamentId, round: 2, matchNumberInRound: 1, bracketType: 'grandFinalReset',
      isBye: true, 
    });
  } else {
    console.warn("Could not determine WB or LB final for Grand Final setup.", {wbFinalMatchId, lbFinalMatchId});
    // Fallback: create placeholder GF matches if structure is incomplete
     allMatches.push({
      id: crypto.randomUUID(), tournamentId, round: 1, matchNumberInRound: 1, bracketType: 'grandFinal',
      isBye: true,
    });
     allMatches.push({
      id: crypto.randomUUID(), tournamentId, round: 2, matchNumberInRound: 1, bracketType: 'grandFinalReset',
      isBye: true,
    });
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
  if (uMatchIndex === -1) {
    console.error("Updated match not found for SE advancement start.");
    return currentMatches;
  }
  newMatches[uMatchIndex] = { ...newMatches[uMatchIndex], ...updatedMatch };
  
  if (!updatedMatch.winnerId && !updatedMatch.isBye) { 
    return clearSubsequentMatches(newMatches, updatedMatch, 'single');
  }

  if (updatedMatch.winnerId) {
    const nextMatchIndex = newMatches.findIndex(m =>
      m.bracketType === 'winners' &&
      (m.team1FeederMatchId === updatedMatch.id || m.team2FeederMatchId === updatedMatch.id)
    );

    if (nextMatchIndex !== -1) {
      let nextMatch = { ...newMatches[nextMatchIndex] }; 
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
        nextMatch.winnerId = undefined; 
        nextMatch.score = undefined;
        
        if (nextMatch.team1Id && !nextMatch.team2Id && !nextMatch.team2FeederMatchId) {
          nextMatch.isBye = true;
          nextMatch.winnerId = nextMatch.team1Id;
        } else if (!nextMatch.team1Id && !nextMatch.team1FeederMatchId && nextMatch.team2Id) {
          nextMatch.isBye = true;
          nextMatch.winnerId = nextMatch.team2Id;
        } else {
          nextMatch.isBye = false; 
        }
        
        newMatches[nextMatchIndex] = nextMatch;
        if (nextMatch.isBye && nextMatch.winnerId && updatedMatch.id !== nextMatch.id) { // Prevent self-recursion if updatedMatch was already setting a bye
             return advanceWinnerSingleElimination(newMatches, nextMatch, registrations);
        }
      }
    }
  }
  return newMatches;
}


async function advanceWinnerDoubleElimination(
  currentMatches: Match[], // This is already a deep copy from `advanceWinner`
  updatedMatch: Match,
  registrations: RegisteredEntry[]
): Promise<Match[]> {
  let newMatches = JSON.parse(JSON.stringify(currentMatches)) as Match[];
  const uMatchOriginalIndex = newMatches.findIndex(m => m.id === updatedMatch.id);

  if (uMatchOriginalIndex === -1) {
    console.error("DE: Updated match not found", updatedMatch.id);
    return newMatches;
  }
  // Apply the update to our working copy
  newMatches[uMatchOriginalIndex] = { ...newMatches[uMatchOriginalIndex], ...updatedMatch };
  const currentUpdatedMatchState = newMatches[uMatchOriginalIndex]; // Use this for consistent state

  if (!currentUpdatedMatchState.winnerId && !currentUpdatedMatchState.isBye) {
    // If winner was cleared, handle subsequent match clearing
    return clearSubsequentMatches(newMatches, currentUpdatedMatchState, 'double_elimination');
  }

  if (!currentUpdatedMatchState.winnerId) return newMatches; // No winner to advance

  const { id: matchId, winnerId, bracketType, team1Id, team2Id } = currentUpdatedMatchState;
  const loserId = winnerId === team1Id ? team2Id : team1Id;

  // Function to find and update the next match
  const findAndUpdateNext = async (
    sourceMatchId: string, 
    participantToAdvanceId: string | undefined, 
    feederType: 'winner' | 'loser'
  ): Promise<void> => {
    if (!participantToAdvanceId) return;

    const nextMatchIdx = newMatches.findIndex(m => 
      (m.team1FeederMatchId === sourceMatchId && m.team1FeederType === feederType) ||
      (m.team2FeederMatchId === sourceMatchId && m.team2FeederType === feederType)
    );

    if (nextMatchIdx !== -1) {
      const originalNextMatch = {...newMatches[nextMatchIdx]};
      let nextMatchToUpdate = newMatches[nextMatchIdx];
      let changed = false;

      if (nextMatchToUpdate.team1FeederMatchId === sourceMatchId && nextMatchToUpdate.team1FeederType === feederType) {
        if (nextMatchToUpdate.team1Id !== participantToAdvanceId) {
           nextMatchToUpdate.team1Id = participantToAdvanceId; changed = true;
        }
      } else if (nextMatchToUpdate.team2FeederMatchId === sourceMatchId && nextMatchToUpdate.team2FeederType === feederType) {
         if (nextMatchToUpdate.team2Id !== participantToAdvanceId) {
            nextMatchToUpdate.team2Id = participantToAdvanceId; changed = true;
         }
      }
      
      if (changed) {
        nextMatchToUpdate.winnerId = undefined;
        nextMatchToUpdate.score = undefined;

        // Check if this next match becomes a bye
        if (nextMatchToUpdate.team1Id && !nextMatchToUpdate.team2Id && !nextMatchToUpdate.team2FeederMatchId) {
          nextMatchToUpdate.isBye = true; nextMatchToUpdate.winnerId = nextMatchToUpdate.team1Id;
        } else if (!nextMatchToUpdate.team1Id && !nextMatchToUpdate.team1FeederMatchId && nextMatchToUpdate.team2Id) {
          nextMatchToUpdate.isBye = true; nextMatchToUpdate.winnerId = nextMatchToUpdate.team2Id;
        } else {
          nextMatchToUpdate.isBye = false;
        }
        
        newMatches[nextMatchIdx] = nextMatchToUpdate; // Persist change
        // If it became a bye AND has a winner, recursively advance
        if (nextMatchToUpdate.isBye && nextMatchToUpdate.winnerId && nextMatchToUpdate.id !== sourceMatchId) {
          newMatches = await advanceWinnerDoubleElimination(newMatches, nextMatchToUpdate, registrations);
        }
      }
    }
  };

  if (bracketType === 'winners') {
    await findAndUpdateNext(matchId, winnerId, 'winner'); // Advance winner in WB
    if (loserId) {
      await findAndUpdateNext(matchId, loserId, 'loser'); // Send loser to LB
    }
  } else if (bracketType === 'losers') {
    await findAndUpdateNext(matchId, winnerId, 'winner'); // Advance winner in LB
  } else if (bracketType === 'grandFinal') {
    const gfResetMatchIndex = newMatches.findIndex(m => m.bracketType === 'grandFinalReset');
    if (gfResetMatchIndex !== -1) {
      if (winnerId === team1Id) { // WB winner wins GF
        newMatches[gfResetMatchIndex].isBye = true;
        newMatches[gfResetMatchIndex].team1Id = undefined;
        newMatches[gfResetMatchIndex].team2Id = undefined;
        newMatches[gfResetMatchIndex].winnerId = undefined; 
      } else if (winnerId === team2Id && team1Id && team2Id) { // LB winner wins GF, reset is needed
        newMatches[gfResetMatchIndex].team1Id = team1Id; // WB Winner
        newMatches[gfResetMatchIndex].team2Id = team2Id; // LB Winner (who won GF1)
        newMatches[gfResetMatchIndex].isBye = false;
        newMatches[gfResetMatchIndex].winnerId = undefined;
        newMatches[gfResetMatchIndex].score = undefined;
      }
    }
  }
  // For grandFinalReset, no further advancement within this function. Winner is overall champ.
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
      // Ensure the most recent state of the updatedMatch (including score) is in our working copy
      newMatchesWorkingCopy[matchIdx] = {...newMatchesWorkingCopy[matchIdx], ...updatedMatch};
  } else {
      console.error("Updated match not found in currentMatches array for advancement start.");
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
      const originalNextMatch = { ...matches[nextMatchIdx] };
      let nextMatch = matches[nextMatchIdx]; 
      let changed = false;

      if (nextMatch.team1FeederMatchId === currentSourceMatchId && nextMatch.team1Id !== undefined) {
        nextMatch.team1Id = undefined;
        changed = true;
      }
      if (nextMatch.team2FeederMatchId === currentSourceMatchId && nextMatch.team2Id !== undefined) {
        nextMatch.team2Id = undefined;
        changed = true;
      }

      if (changed || nextMatch.winnerId) {
        nextMatch.winnerId = undefined;
        nextMatch.score = undefined;
        
        if (nextMatch.team1Id && !nextMatch.team2Id && !nextMatch.team2FeederMatchId) {
            nextMatch.isBye = true; nextMatch.winnerId = nextMatch.team1Id;
        } else if (!nextMatch.team1Id && !nextMatch.team1FeederMatchId && nextMatch.team2Id) {
            nextMatch.isBye = true; nextMatch.winnerId = nextMatch.team2Id;
        } else {
            nextMatch.isBye = false;
        }
        
        if (JSON.stringify(originalNextMatch) !== JSON.stringify(nextMatch)) {
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
  
  if (matchesToUpdate[fromMatchIndex].team1Id && matchesToUpdate[fromMatchIndex].team2Id) {
      matchesToUpdate[fromMatchIndex].isBye = false; 
  }
  
  if (tournamentType === 'single') {
      return clearSubsequentMatchesSingle(matchesToUpdate, matchesToUpdate[fromMatchIndex]);
  } else if (tournamentType === 'double_elimination') {
    // For DE, clearing is more complex. We'll clear direct dependents.
    let queue: string[] = [fromMatch.id];
    const processed = new Set<string>();

    while(queue.length > 0) {
        const currentMatchId = queue.shift()!;
        if (processed.has(currentMatchId)) continue;
        processed.add(currentMatchId);

        const sourceMatchForQueue = matchesToUpdate.find(m => m.id === currentMatchId);
        if (!sourceMatchForQueue) continue;

        // Find matches fed by this match's winner
        const winnerFedIndices = matchesToUpdate
            .map((m, i) => ((m.team1FeederMatchId === currentMatchId && m.team1FeederType === 'winner') || (m.team2FeederMatchId === currentMatchId && m.team2FeederType === 'winner')) ? i : -1)
            .filter(i => i !== -1);

        for (const idx of winnerFedIndices) {
            if (matchesToUpdate[idx].team1FeederMatchId === currentMatchId && matchesToUpdate[idx].team1FeederType === 'winner') matchesToUpdate[idx].team1Id = undefined;
            if (matchesToUpdate[idx].team2FeederMatchId === currentMatchId && matchesToUpdate[idx].team2FeederType === 'winner') matchesToUpdate[idx].team2Id = undefined;
            
            if (matchesToUpdate[idx].winnerId) { // If it had a winner, it needs to be cleared and its dependents queued
                matchesToUpdate[idx].winnerId = undefined;
                matchesToUpdate[idx].score = undefined;
                matchesToUpdate[idx].isBye = false; // Re-evaluate bye state if structure allows
                queue.push(matchesToUpdate[idx].id);
            }
        }

        // If it's a WB match, also find LB match fed by its loser
        if (sourceMatchForQueue.bracketType === 'winners') {
            const loserFedIndices = matchesToUpdate
                .map((m, i) => ((m.team1FeederMatchId === currentMatchId && m.team1FeederType === 'loser') || (m.team2FeederMatchId === currentMatchId && m.team2FeederType === 'loser')) ? i : -1)
                .filter(i => i !== -1);
            for (const idx of loserFedIndices) {
                if (matchesToUpdate[idx].team1FeederMatchId === currentMatchId && matchesToUpdate[idx].team1FeederType === 'loser') matchesToUpdate[idx].team1Id = undefined;
                if (matchesToUpdate[idx].team2FeederMatchId === currentMatchId && matchesToUpdate[idx].team2FeederType === 'loser') matchesToUpdate[idx].team2Id = undefined;

                 if (matchesToUpdate[idx].winnerId) {
                    matchesToUpdate[idx].winnerId = undefined;
                    matchesToUpdate[idx].score = undefined;
                    matchesToUpdate[idx].isBye = false;
                    queue.push(matchesToUpdate[idx].id);
                }
            }
        }
        // Special handling for Grand Final Reset
        if (sourceMatchForQueue.bracketType === 'grandFinal') {
            const gfResetIdx = matchesToUpdate.findIndex(m => m.bracketType === 'grandFinalReset');
            if (gfResetIdx !== -1) {
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
