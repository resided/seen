// ================================
// MOOD. - Mock Data & Question Bank
// ================================

export const QUICK_BET_AMOUNTS = [10, 25, 50, 100];

// Current active round
export const MOCK_CURRENT_ROUND = {
  id: 1,
  question: "Will $SEEN hit $0.10 by end of week?",
  description: "Based on current trading volume and market sentiment on Base",
  startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Started 2 hours ago
  endsAt: new Date(Date.now() + 22 * 60 * 60 * 1000), // Ends in 22 hours
  totalPool: 15420,
  yepPool: 8230,
  nopePool: 7190,
  yepBettors: 124,
  nopeBettors: 98,
  yepOdds: 1.87,
  nopeOdds: 2.14,
  dataSource: "Dexscreener",
  dataUrl: "https://dexscreener.com",
};

// User stats
export const MOCK_USER_STATS = {
  balance: 250,
  totalProfit: 1250,
  winStreak: 3,
  bestStreak: 7,
  roundsPlayed: 24,
  winRate: 62.5,
};

// Past rounds
export const MOCK_PAST_ROUNDS = [
  {
    won: true,
    profit: 150,
    side: "YEP",
    poolSize: 12500,
    earlyBirdBonus: 15,
  },
  {
    won: true,
    profit: 85,
    side: "NOPE",
    poolSize: 8900,
    earlyBirdBonus: 8,
  },
  {
    won: true,
    profit: 120,
    side: "YEP",
    poolSize: 15200,
    earlyBirdBonus: 20,
  },
  {
    won: false,
    profit: -50,
    side: "NOPE",
    poolSize: 6700,
    earlyBirdBonus: 5,
  },
];

// Leaderboard
export const MOCK_LEADERBOARD = [
  {
    rank: 1,
    username: "degen_king",
    pfpUrl: "/api/placeholder/32/32",
    totalProfit: 5420,
    winRate: 78.5,
    rounds: 45,
  },
  {
    rank: 2,
    username: "moon_trader",
    pfpUrl: "/api/placeholder/32/32",
    totalProfit: 4890,
    winRate: 72.3,
    rounds: 52,
  },
  {
    rank: 3,
    username: "based_better",
    pfpUrl: "/api/placeholder/32/32",
    totalProfit: 3750,
    winRate: 68.9,
    rounds: 38,
  },
  {
    rank: 4,
    username: "you",
    pfpUrl: "/api/placeholder/32/32",
    totalProfit: 1250,
    winRate: 62.5,
    rounds: 24,
  },
];

// Question bank for market browser
export const ALL_QUESTIONS = [
  {
    id: 1,
    question: "Will $SEEN hit $0.10 by end of week?",
    description: "Based on current trading volume and market sentiment on Base",
    category: "Price",
    totalPool: 15420,
    endsAt: new Date(Date.now() + 22 * 60 * 60 * 1000),
  },
  {
    id: 2,
    question: "Will ETH break $4000 this month?",
    description: "Ethereum price prediction based on market trends",
    category: "Price",
    totalPool: 28900,
    endsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  },
  {
    id: 3,
    question: "Will Base TVL exceed $10B this quarter?",
    description: "Total Value Locked on Base network",
    category: "DeFi",
    totalPool: 19500,
    endsAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
  },
  {
    id: 4,
    question: "Will Farcaster DAU hit 100k this month?",
    description: "Daily Active Users metric from Dune Analytics",
    category: "Social",
    totalPool: 12300,
    endsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
  },
  {
    id: 5,
    question: "Will BTC dominance drop below 50%?",
    description: "Bitcoin market cap dominance percentage",
    category: "Crypto",
    totalPool: 31200,
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
];
