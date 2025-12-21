// Battle management for Feature Wars
// Redis schema for storing and managing daily battles

import { getRedisClient } from './redis';

// Battle keys
const BATTLE_KEY_PREFIX = 'battle:';
const CURRENT_BATTLE_KEY = 'battle:current';
const BATTLE_HISTORY_KEY = 'battle:history'; // Sorted set by battle ID
const BET_KEY_PREFIX = 'bet:'; // bet:{battleId}:{userFid}
const USER_BETS_PREFIX = 'user:bets:'; // user:bets:{userFid}

// Battle duration (24 hours)
const BATTLE_DURATION_MS = 24 * 60 * 60 * 1000;

// ============================================
// BATTLE CREATION & MANAGEMENT
// ============================================

/**
 * Create a new battle between two projects
 * @param {Object} projectA - First project
 * @param {Object} projectB - Second project
 * @returns {Object} Created battle
 */
export async function createBattle(projectA, projectB) {
  const redis = await getRedisClient();

  // Generate battle ID (timestamp-based)
  const battleId = Date.now();
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + BATTLE_DURATION_MS);

  const battle = {
    id: battleId,
    projectA: {
      id: projectA.id,
      name: projectA.name,
      tagline: projectA.tagline || '',
    },
    projectB: {
      id: projectB.id,
      name: projectB.name,
      tagline: projectB.tagline || '',
    },
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    status: 'active', // active | ended | resolved
    poolA: 0,
    poolB: 0,
    scoreA: 0,
    scoreB: 0,
    winner: null,
    createdAt: startTime.toISOString(),
  };

  // Save battle
  const battleKey = `${BATTLE_KEY_PREFIX}${battleId}`;
  await redis.hSet(battleKey, {
    id: battle.id.toString(),
    projectA: JSON.stringify(battle.projectA),
    projectB: JSON.stringify(battle.projectB),
    startTime: battle.startTime,
    endTime: battle.endTime,
    status: battle.status,
    poolA: battle.poolA.toString(),
    poolB: battle.poolB.toString(),
    scoreA: battle.scoreA.toString(),
    scoreB: battle.scoreB.toString(),
    winner: battle.winner || '',
    createdAt: battle.createdAt,
  });

  // Set as current battle
  await redis.set(CURRENT_BATTLE_KEY, battleId.toString());

  // Add to history (sorted set by battle ID)
  await redis.zAdd(BATTLE_HISTORY_KEY, {
    score: battleId,
    member: battleId.toString(),
  });

  console.log('[BATTLE] Created new battle:', {
    id: battleId,
    projectA: battle.projectA.name,
    projectB: battle.projectB.name,
    endTime: battle.endTime,
  });

  return battle;
}

/**
 * Get current active battle
 * @returns {Object|null} Current battle or null
 */
export async function getCurrentBattle() {
  const redis = await getRedisClient();

  const currentBattleId = await redis.get(CURRENT_BATTLE_KEY);
  if (!currentBattleId) {
    return null;
  }

  return await getBattleById(parseInt(currentBattleId));
}

/**
 * Get battle by ID
 * @param {number} battleId - Battle ID
 * @returns {Object|null} Battle or null
 */
export async function getBattleById(battleId) {
  const redis = await getRedisClient();
  const battleKey = `${BATTLE_KEY_PREFIX}${battleId}`;

  const data = await redis.hGetAll(battleKey);
  if (!data || !data.id) {
    return null;
  }

  return {
    id: parseInt(data.id),
    projectA: JSON.parse(data.projectA),
    projectB: JSON.parse(data.projectB),
    startTime: data.startTime,
    endTime: data.endTime,
    status: data.status,
    poolA: parseFloat(data.poolA) || 0,
    poolB: parseFloat(data.poolB) || 0,
    scoreA: parseInt(data.scoreA) || 0,
    scoreB: parseInt(data.scoreB) || 0,
    winner: data.winner || null,
    createdAt: data.createdAt,
  };
}

/**
 * Update battle status
 * @param {number} battleId - Battle ID
 * @param {string} status - New status
 */
export async function updateBattleStatus(battleId, status) {
  const redis = await getRedisClient();
  const battleKey = `${BATTLE_KEY_PREFIX}${battleId}`;

  await redis.hSet(battleKey, {
    status,
  });

  console.log(`[BATTLE] Updated battle ${battleId} status to ${status}`);
}

/**
 * Update battle scores
 * @param {number} battleId - Battle ID
 * @param {number} scoreA - Project A score
 * @param {number} scoreB - Project B score
 */
export async function updateBattleScores(battleId, scoreA, scoreB) {
  const redis = await getRedisClient();
  const battleKey = `${BATTLE_KEY_PREFIX}${battleId}`;

  await redis.hSet(battleKey, {
    scoreA: scoreA.toString(),
    scoreB: scoreB.toString(),
  });
}

/**
 * Check if battle has ended (past end time)
 * @param {Object} battle - Battle object
 * @returns {boolean} True if ended
 */
export function isBattleEnded(battle) {
  return new Date() > new Date(battle.endTime);
}

// ============================================
// BETTING OPERATIONS
// ============================================

/**
 * Place a bet on a project in a battle
 * @param {number} battleId - Battle ID
 * @param {number} userFid - User's Farcaster FID
 * @param {string} team - 'A' or 'B'
 * @param {number} amount - Bet amount in $SEEN tokens
 * @param {string} txHash - Transaction hash
 * @returns {Object} Bet details
 */
export async function placeBet(battleId, userFid, team, amount, txHash) {
  const redis = await getRedisClient();

  // Validate team
  if (team !== 'A' && team !== 'B') {
    throw new Error('Invalid team - must be A or B');
  }

  // Get current battle
  const battle = await getBattleById(battleId);
  if (!battle) {
    throw new Error('Battle not found');
  }

  // Check if battle is still active
  if (battle.status !== 'active') {
    throw new Error('Battle is not active');
  }

  if (isBattleEnded(battle)) {
    throw new Error('Battle has ended');
  }

  // Create bet record
  const bet = {
    battleId,
    userFid,
    team,
    amount,
    txHash,
    placedAt: new Date().toISOString(),
    claimed: false,
    winnings: null,
  };

  // Save bet
  const betKey = `${BET_KEY_PREFIX}${battleId}:${userFid}:${Date.now()}`;
  await redis.hSet(betKey, {
    battleId: bet.battleId.toString(),
    userFid: bet.userFid.toString(),
    team: bet.team,
    amount: bet.amount.toString(),
    txHash: bet.txHash,
    placedAt: bet.placedAt,
    claimed: 'false',
    winnings: '',
  });

  // Add to user's bets list
  const userBetsKey = `${USER_BETS_PREFIX}${userFid}`;
  await redis.sAdd(userBetsKey, betKey);

  // Update battle pool
  const battleKey = `${BATTLE_KEY_PREFIX}${battleId}`;
  if (team === 'A') {
    await redis.hIncrBy(battleKey, 'poolA', amount);
  } else {
    await redis.hIncrBy(battleKey, 'poolB', amount);
  }

  console.log('[BATTLE] Bet placed:', {
    battleId,
    userFid,
    team,
    amount,
  });

  return bet;
}

/**
 * Get all bets for a user
 * @param {number} userFid - User's Farcaster FID
 * @returns {Array} Array of bets
 */
export async function getUserBets(userFid) {
  const redis = await getRedisClient();
  const userBetsKey = `${USER_BETS_PREFIX}${userFid}`;

  const betKeys = await redis.sMembers(userBetsKey);
  if (!betKeys || betKeys.length === 0) {
    return [];
  }

  const bets = [];
  for (const betKey of betKeys) {
    const data = await redis.hGetAll(betKey);
    if (data && data.battleId) {
      bets.push({
        battleId: parseInt(data.battleId),
        userFid: parseInt(data.userFid),
        team: data.team,
        amount: parseFloat(data.amount),
        txHash: data.txHash,
        placedAt: data.placedAt,
        claimed: data.claimed === 'true',
        winnings: data.winnings ? parseFloat(data.winnings) : null,
      });
    }
  }

  return bets;
}

/**
 * Get all bets for a battle
 * @param {number} battleId - Battle ID
 * @returns {Object} { teamA: [], teamB: [] }
 */
export async function getBattleBets(battleId) {
  const redis = await getRedisClient();

  // Scan for all bet keys for this battle
  const pattern = `${BET_KEY_PREFIX}${battleId}:*`;
  const bets = { teamA: [], teamB: [] };

  let cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      MATCH: pattern,
      COUNT: 100,
    });
    cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;

    for (const key of keys) {
      const data = await redis.hGetAll(key);
      if (data && data.team) {
        const bet = {
          battleId: parseInt(data.battleId),
          userFid: parseInt(data.userFid),
          team: data.team,
          amount: parseFloat(data.amount),
          txHash: data.txHash,
          placedAt: data.placedAt,
          claimed: data.claimed === 'true',
          winnings: data.winnings ? parseFloat(data.winnings) : null,
        };

        if (data.team === 'A') {
          bets.teamA.push(bet);
        } else {
          bets.teamB.push(bet);
        }
      }
    }
  } while (cursor !== 0);

  return bets;
}

// ============================================
// BATTLE RESOLUTION
// ============================================

/**
 * Resolve a battle - determine winner and calculate winnings
 * @param {number} battleId - Battle ID
 * @returns {Object} Resolution details
 */
export async function resolveBattle(battleId) {
  const redis = await getRedisClient();

  const battle = await getBattleById(battleId);
  if (!battle) {
    throw new Error('Battle not found');
  }

  if (battle.status === 'resolved') {
    return { message: 'Battle already resolved', battle };
  }

  // Determine winner based on scores
  let winner = null;
  if (battle.scoreA > battle.scoreB) {
    winner = 'A';
  } else if (battle.scoreB > battle.scoreA) {
    winner = 'B';
  } else {
    winner = 'tie';
  }

  // Get all bets
  const bets = await getBattleBets(battleId);
  const totalPool = battle.poolA + battle.poolB;

  // Treasury fee (5%)
  const treasuryFee = totalPool * 0.05;
  const winnerPool = totalPool - treasuryFee;

  // Calculate winnings for winners
  if (winner === 'A') {
    const winningBets = bets.teamA;
    const totalWinningBets = battle.poolA;

    for (const bet of winningBets) {
      const share = bet.amount / totalWinningBets;
      const winnings = share * winnerPool;

      // Update bet with winnings
      const betKey = `${BET_KEY_PREFIX}${battleId}:${bet.userFid}:*`;
      // Find exact bet key (simplified - in production use exact key)
      await updateBetWinnings(battleId, bet.userFid, bet.txHash, winnings);
    }
  } else if (winner === 'B') {
    const winningBets = bets.teamB;
    const totalWinningBets = battle.poolB;

    for (const bet of winningBets) {
      const share = bet.amount / totalWinningBets;
      const winnings = share * winnerPool;

      await updateBetWinnings(battleId, bet.userFid, bet.txHash, winnings);
    }
  } else {
    // Tie - refund all bets
    for (const bet of [...bets.teamA, ...bets.teamB]) {
      await updateBetWinnings(battleId, bet.userFid, bet.txHash, bet.amount);
    }
  }

  // Update battle status and winner
  const battleKey = `${BATTLE_KEY_PREFIX}${battleId}`;
  await redis.hSet(battleKey, {
    status: 'resolved',
    winner: winner || '',
  });

  console.log('[BATTLE] Resolved battle:', {
    battleId,
    winner,
    totalPool,
    treasuryFee,
    winnerPool,
  });

  return {
    battleId,
    winner,
    totalPool,
    treasuryFee,
    winnerPool,
    scoreA: battle.scoreA,
    scoreB: battle.scoreB,
  };
}

/**
 * Update bet winnings
 * @param {number} battleId - Battle ID
 * @param {number} userFid - User FID
 * @param {string} txHash - Transaction hash
 * @param {number} winnings - Winnings amount
 */
async function updateBetWinnings(battleId, userFid, txHash, winnings) {
  const redis = await getRedisClient();

  // Scan for bet key with this tx hash
  const pattern = `${BET_KEY_PREFIX}${battleId}:${userFid}:*`;
  let cursor = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      MATCH: pattern,
      COUNT: 100,
    });
    cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;

    for (const key of keys) {
      const data = await redis.hGetAll(key);
      if (data && data.txHash === txHash) {
        await redis.hSet(key, {
          winnings: winnings.toString(),
        });
        return;
      }
    }
  } while (cursor !== 0);
}

// ============================================
// BATTLE HISTORY
// ============================================

/**
 * Get recent battles
 * @param {number} limit - Number of battles to return
 * @returns {Array} Array of battles
 */
export async function getRecentBattles(limit = 10) {
  const redis = await getRedisClient();

  // Get recent battle IDs from sorted set (descending order)
  const battleIds = await redis.zRange(BATTLE_HISTORY_KEY, 0, limit - 1, {
    REV: true,
  });

  const battles = [];
  for (const battleId of battleIds) {
    const battle = await getBattleById(parseInt(battleId));
    if (battle) {
      battles.push(battle);
    }
  }

  return battles;
}
