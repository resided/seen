// Niche Prediction Markets for MOOD.
// Funny and interesting markets that are hard to game
// Examples: global passenger travel, holidays taken, Google searches, etc.

import { getRedisClient } from './redis';

// Market keys
const MARKET_KEY_PREFIX = 'market:';
const ACTIVE_MARKETS_KEY = 'markets:active';
const MARKET_HISTORY_KEY = 'markets:history'; // Sorted set by market ID
const MARKET_BET_PREFIX = 'market:bet:'; // market:bet:{marketId}:{userFid}:{timestamp}
const MARKET_USER_BETS_PREFIX = 'market:user:bets:'; // market:user:bets:{userFid}

// Market types - niche, funny, hard to game
export const MARKET_TYPES = {
  PASSENGERS: 'passengers', // Global passenger travel numbers
  HOLIDAYS: 'holidays', // Holidays taken globally
  GOOGLE_SEARCHES: 'google', // Most Googled terms
  WEATHER: 'weather', // Weather predictions (temperature, rainfall)
  SPORTS: 'sports', // Sports outcomes (not scores, but stats)
  ECONOMICS: 'economics', // Economic indicators
  SOCIAL: 'social', // Social media trends
  CRYPTO: 'crypto', // Crypto price movements
  CUSTOM: 'custom', // Admin-defined markets
};

// ============================================
// MARKET CREATION & MANAGEMENT
// ============================================

/**
 * Create a new prediction market
 * @param {Object} marketData - Market details
 * @returns {Object} Created market
 */
export async function createMarket(marketData) {
  const redis = await getRedisClient();

  const {
    type,
    question,
    description,
    optionA,
    optionB,
    resolveDate, // When to resolve the market
    dataSource, // Where to get resolution data
    category,
  } = marketData;

  // Generate market ID (timestamp-based)
  const marketId = Date.now();
  const startTime = new Date();
  const endTime = new Date(resolveDate);

  const market = {
    id: marketId,
    type,
    question,
    description,
    optionA: {
      label: optionA.label,
      description: optionA.description || '',
    },
    optionB: {
      label: optionB.label,
      description: optionB.description || '',
    },
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    resolveDate: new Date(resolveDate).toISOString(),
    dataSource,
    category: category || type,
    status: 'active', // active | ended | resolved
    poolA: 0,
    poolB: 0,
    winner: null,
    resolutionData: null,
    createdAt: startTime.toISOString(),
  };

  // Save market
  const marketKey = `${MARKET_KEY_PREFIX}${marketId}`;
  await redis.hSet(marketKey, {
    id: market.id.toString(),
    type: market.type,
    question: market.question,
    description: market.description,
    optionA: JSON.stringify(market.optionA),
    optionB: JSON.stringify(market.optionB),
    startTime: market.startTime,
    endTime: market.endTime,
    resolveDate: market.resolveDate,
    dataSource: market.dataSource,
    category: market.category,
    status: market.status,
    poolA: market.poolA.toString(),
    poolB: market.poolB.toString(),
    winner: market.winner || '',
    resolutionData: market.resolutionData || '',
    createdAt: market.createdAt,
  });

  // Add to active markets
  await redis.sAdd(ACTIVE_MARKETS_KEY, marketId.toString());

  // Add to history (sorted set by market ID)
  await redis.zAdd(MARKET_HISTORY_KEY, {
    score: marketId,
    member: marketId.toString(),
  });

  console.log('[MARKET] Created new market:', {
    id: marketId,
    type: market.type,
    question: market.question,
    resolveDate: market.resolveDate,
  });

  return market;
}

/**
 * Get market by ID
 * @param {number} marketId - Market ID
 * @returns {Object|null} Market or null
 */
export async function getMarketById(marketId) {
  const redis = await getRedisClient();
  const marketKey = `${MARKET_KEY_PREFIX}${marketId}`;

  const data = await redis.hGetAll(marketKey);
  if (!data || !data.id) {
    return null;
  }

  return {
    id: parseInt(data.id),
    type: data.type,
    question: data.question,
    description: data.description,
    optionA: JSON.parse(data.optionA),
    optionB: JSON.parse(data.optionB),
    startTime: data.startTime,
    endTime: data.endTime,
    resolveDate: data.resolveDate,
    dataSource: data.dataSource,
    category: data.category,
    status: data.status,
    poolA: parseFloat(data.poolA) || 0,
    poolB: parseFloat(data.poolB) || 0,
    winner: data.winner || null,
    resolutionData: data.resolutionData || null,
    createdAt: data.createdAt,
  };
}

/**
 * Get all active markets
 * @returns {Array} Array of markets
 */
export async function getActiveMarkets() {
  const redis = await getRedisClient();
  const marketIds = await redis.sMembers(ACTIVE_MARKETS_KEY);

  const markets = [];
  for (const marketId of marketIds) {
    const market = await getMarketById(parseInt(marketId));
    if (market) {
      markets.push(market);
    }
  }

  return markets;
}

/**
 * Update market status
 * @param {number} marketId - Market ID
 * @param {string} status - New status
 */
export async function updateMarketStatus(marketId, status) {
  const redis = await getRedisClient();
  const marketKey = `${MARKET_KEY_PREFIX}${marketId}`;

  await redis.hSet(marketKey, { status });

  // If no longer active, remove from active markets
  if (status !== 'active') {
    await redis.sRem(ACTIVE_MARKETS_KEY, marketId.toString());
  }

  console.log(`[MARKET] Updated market ${marketId} status to ${status}`);
}

// ============================================
// BETTING OPERATIONS
// ============================================

/**
 * Place a bet on a market option
 * @param {number} marketId - Market ID
 * @param {number} userFid - User's Farcaster FID
 * @param {string} option - 'A' or 'B'
 * @param {number} amount - Bet amount in $SEEN tokens
 * @param {string} txHash - Transaction hash
 * @returns {Object} Bet details
 */
export async function placeBet(marketId, userFid, option, amount, txHash) {
  const redis = await getRedisClient();

  // Validate option
  if (option !== 'A' && option !== 'B') {
    throw new Error('Invalid option - must be A or B');
  }

  // Get market
  const market = await getMarketById(marketId);
  if (!market) {
    throw new Error('Market not found');
  }

  // Check if market is still active
  if (market.status !== 'active') {
    throw new Error('Market is not active');
  }

  // Check if market has ended
  if (new Date() > new Date(market.resolveDate)) {
    throw new Error('Market has ended');
  }

  // Create bet record
  const bet = {
    marketId,
    userFid,
    option,
    amount,
    txHash,
    placedAt: new Date().toISOString(),
    claimed: false,
    winnings: null,
  };

  // Save bet
  const betKey = `${MARKET_BET_PREFIX}${marketId}:${userFid}:${Date.now()}`;
  await redis.hSet(betKey, {
    marketId: bet.marketId.toString(),
    userFid: bet.userFid.toString(),
    option: bet.option,
    amount: bet.amount.toString(),
    txHash: bet.txHash,
    placedAt: bet.placedAt,
    claimed: 'false',
    winnings: '',
  });

  // Add to user's bets list
  const userBetsKey = `${MARKET_USER_BETS_PREFIX}${userFid}`;
  await redis.sAdd(userBetsKey, betKey);

  // Update market pool
  const marketKey = `${MARKET_KEY_PREFIX}${marketId}`;
  if (option === 'A') {
    await redis.hIncrBy(marketKey, 'poolA', amount);
  } else {
    await redis.hIncrBy(marketKey, 'poolB', amount);
  }

  console.log('[MARKET] Bet placed:', {
    marketId,
    userFid,
    option,
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
  const userBetsKey = `${MARKET_USER_BETS_PREFIX}${userFid}`;

  const betKeys = await redis.sMembers(userBetsKey);
  if (!betKeys || betKeys.length === 0) {
    return [];
  }

  const bets = [];
  for (const betKey of betKeys) {
    const data = await redis.hGetAll(betKey);
    if (data && data.marketId) {
      bets.push({
        marketId: parseInt(data.marketId),
        userFid: parseInt(data.userFid),
        option: data.option,
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
 * Get all bets for a market
 * @param {number} marketId - Market ID
 * @returns {Object} { optionA: [], optionB: [] }
 */
export async function getMarketBets(marketId) {
  const redis = await getRedisClient();

  const pattern = `${MARKET_BET_PREFIX}${marketId}:*`;
  const bets = { optionA: [], optionB: [] };

  let cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      MATCH: pattern,
      COUNT: 100,
    });
    cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;

    for (const key of keys) {
      const data = await redis.hGetAll(key);
      if (data && data.option) {
        const bet = {
          marketId: parseInt(data.marketId),
          userFid: parseInt(data.userFid),
          option: data.option,
          amount: parseFloat(data.amount),
          txHash: data.txHash,
          placedAt: data.placedAt,
          claimed: data.claimed === 'true',
          winnings: data.winnings ? parseFloat(data.winnings) : null,
        };

        if (data.option === 'A') {
          bets.optionA.push(bet);
        } else {
          bets.optionB.push(bet);
        }
      }
    }
  } while (cursor !== 0);

  return bets;
}

// ============================================
// MARKET RESOLUTION
// ============================================

/**
 * Resolve a market - determine winner and calculate winnings
 * @param {number} marketId - Market ID
 * @param {string} winner - 'A' or 'B' or 'tie'
 * @param {Object} resolutionData - Data used to determine winner
 * @returns {Object} Resolution details
 */
export async function resolveMarket(marketId, winner, resolutionData) {
  const redis = await getRedisClient();

  const market = await getMarketById(marketId);
  if (!market) {
    throw new Error('Market not found');
  }

  if (market.status === 'resolved') {
    return { message: 'Market already resolved', market };
  }

  // Validate winner
  if (winner !== 'A' && winner !== 'B' && winner !== 'tie') {
    throw new Error('Invalid winner - must be A, B, or tie');
  }

  // Get all bets
  const bets = await getMarketBets(marketId);
  const totalPool = market.poolA + market.poolB;

  // Treasury fee (5%)
  const treasuryFee = totalPool * 0.05;
  const winnerPool = totalPool - treasuryFee;

  // Calculate winnings for winners
  if (winner === 'A') {
    const winningBets = bets.optionA;
    const totalWinningBets = market.poolA;

    for (const bet of winningBets) {
      const share = bet.amount / totalWinningBets;
      const winnings = share * winnerPool;
      await updateBetWinnings(marketId, bet.userFid, bet.txHash, winnings);
    }
  } else if (winner === 'B') {
    const winningBets = bets.optionB;
    const totalWinningBets = market.poolB;

    for (const bet of winningBets) {
      const share = bet.amount / totalWinningBets;
      const winnings = share * winnerPool;
      await updateBetWinnings(marketId, bet.userFid, bet.txHash, winnings);
    }
  } else {
    // Tie - refund all bets
    for (const bet of [...bets.optionA, ...bets.optionB]) {
      await updateBetWinnings(marketId, bet.userFid, bet.txHash, bet.amount);
    }
  }

  // Update market status and winner
  const marketKey = `${MARKET_KEY_PREFIX}${marketId}`;
  await redis.hSet(marketKey, {
    status: 'resolved',
    winner: winner || '',
    resolutionData: JSON.stringify(resolutionData),
  });

  // Remove from active markets
  await redis.sRem(ACTIVE_MARKETS_KEY, marketId.toString());

  console.log('[MARKET] Resolved market:', {
    marketId,
    winner,
    totalPool,
    treasuryFee,
    winnerPool,
  });

  return {
    marketId,
    winner,
    totalPool,
    treasuryFee,
    winnerPool,
    resolutionData,
  };
}

/**
 * Update bet winnings
 * @param {number} marketId - Market ID
 * @param {number} userFid - User FID
 * @param {string} txHash - Transaction hash
 * @param {number} winnings - Winnings amount
 */
async function updateBetWinnings(marketId, userFid, txHash, winnings) {
  const redis = await getRedisClient();

  const pattern = `${MARKET_BET_PREFIX}${marketId}:${userFid}:*`;
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
// PRE-CONFIGURED NICHE MARKETS
// ============================================

/**
 * Get pre-configured niche market templates
 * Funny, interesting markets that are hard to game
 */
export const NICHE_MARKET_TEMPLATES = [
  {
    type: MARKET_TYPES.PASSENGERS,
    question: 'Will global air passenger traffic exceed 100M trips this month?',
    description: 'Based on IATA (International Air Transport Association) monthly data',
    optionA: { label: 'YES - Over 100M', description: 'Global air passenger traffic will exceed 100 million trips' },
    optionB: { label: 'NO - Under 100M', description: 'Global air passenger traffic will stay below 100 million trips' },
    dataSource: 'IATA Monthly Passenger Statistics',
    category: 'Travel',
  },
  {
    type: MARKET_TYPES.GOOGLE_SEARCHES,
    question: 'Which will be Googled more: "AI" or "Crypto"?',
    description: 'Based on Google Trends data for the next 7 days',
    optionA: { label: 'AI', description: 'AI will have higher search volume' },
    optionB: { label: 'CRYPTO', description: 'Crypto will have higher search volume' },
    dataSource: 'Google Trends API',
    category: 'Search Trends',
  },
  {
    type: MARKET_TYPES.WEATHER,
    question: 'Will it rain in London next Saturday?',
    description: 'Based on verified weather data from Met Office',
    optionA: { label: 'YES - Rain', description: 'Measurable rainfall in London' },
    optionB: { label: 'NO - Dry', description: 'No measurable rainfall in London' },
    dataSource: 'Met Office Weather Data',
    category: 'Weather',
  },
  {
    type: MARKET_TYPES.ECONOMICS,
    question: 'Will Bitcoin volatility be higher than S&P 500 this week?',
    description: 'Comparing 7-day volatility (standard deviation of daily returns)',
    optionA: { label: 'BTC Higher', description: 'Bitcoin will show higher volatility' },
    optionB: { label: 'S&P Higher', description: 'S&P 500 will show higher volatility' },
    dataSource: 'Market Data APIs',
    category: 'Finance',
  },
  {
    type: MARKET_TYPES.SOCIAL,
    question: 'Will "Farcaster" trend on X/Twitter this week?',
    description: 'Based on X/Twitter trending topics data',
    optionA: { label: 'YES - Trending', description: 'Farcaster will appear in trending topics' },
    optionB: { label: 'NO - Not trending', description: 'Farcaster will not trend' },
    dataSource: 'X/Twitter Trends API',
    category: 'Social Media',
  },
  {
    type: MARKET_TYPES.CUSTOM,
    question: 'Will Ethereum gas fees average above 50 gwei this week?',
    description: 'Based on 7-day average gas price from Etherscan',
    optionA: { label: 'YES - Above 50', description: 'Average gas > 50 gwei' },
    optionB: { label: 'NO - Below 50', description: 'Average gas < 50 gwei' },
    dataSource: 'Etherscan Gas Tracker',
    category: 'Crypto',
  },
  {
    type: MARKET_TYPES.CUSTOM,
    question: 'Will more people Google "recipe" or "workout" this weekend?',
    description: 'Saturday + Sunday search volume comparison',
    optionA: { label: 'RECIPE', description: 'Recipe searches will be higher' },
    optionB: { label: 'WORKOUT', description: 'Workout searches will be higher' },
    dataSource: 'Google Trends Weekend Data',
    category: 'Lifestyle',
  },
  {
    type: MARKET_TYPES.HOLIDAYS,
    question: 'Will hotel bookings in Paris exceed Barcelona this month?',
    description: 'Based on major booking platforms data',
    optionA: { label: 'PARIS Wins', description: 'Paris will have more bookings' },
    optionB: { label: 'BARCELONA Wins', description: 'Barcelona will have more bookings' },
    dataSource: 'Booking.com & Airbnb Data',
    category: 'Travel',
  },
];
