// Battle engagement tracking and scoring system
// Tracks views, clicks, votes, and shares for projects in active battles

import { getRedisClient } from './redis';
import { getCurrentBattle } from './battles';

// Engagement scoring weights
const WEIGHTS = {
  VIEW: 1,
  CLICK: 3,
  VOTE: 5,
  SHARE: 10,
};

// Redis keys for battle engagement
const BATTLE_ENGAGEMENT_PREFIX = 'battle:engagement:';

/**
 * Track a view for a project in current battle
 * @param {number} projectId - Project ID
 * @param {number} userFid - User FID (optional)
 */
export async function trackBattleView(projectId, userFid = null) {
  const battle = await getCurrentBattle();
  if (!battle || battle.status !== 'active') {
    return { tracked: false, reason: 'No active battle' };
  }

  // Check if this project is in the battle
  const team = getProjectTeam(battle, projectId);
  if (!team) {
    return { tracked: false, reason: 'Project not in battle' };
  }

  await incrementEngagement(battle.id, team, 'views', userFid);

  return {
    tracked: true,
    battleId: battle.id,
    team,
    type: 'view',
  };
}

/**
 * Track a click for a project in current battle
 * @param {number} projectId - Project ID
 * @param {number} userFid - User FID (optional)
 */
export async function trackBattleClick(projectId, userFid = null) {
  const battle = await getCurrentBattle();
  if (!battle || battle.status !== 'active') {
    return { tracked: false, reason: 'No active battle' };
  }

  const team = getProjectTeam(battle, projectId);
  if (!team) {
    return { tracked: false, reason: 'Project not in battle' };
  }

  await incrementEngagement(battle.id, team, 'clicks', userFid);

  return {
    tracked: true,
    battleId: battle.id,
    team,
    type: 'click',
  };
}

/**
 * Track a vote for a project in current battle
 * @param {number} projectId - Project ID
 * @param {number} userFid - User FID
 */
export async function trackBattleVote(projectId, userFid) {
  const battle = await getCurrentBattle();
  if (!battle || battle.status !== 'active') {
    return { tracked: false, reason: 'No active battle' };
  }

  const team = getProjectTeam(battle, projectId);
  if (!team) {
    return { tracked: false, reason: 'Project not in battle' };
  }

  await incrementEngagement(battle.id, team, 'votes', userFid);

  return {
    tracked: true,
    battleId: battle.id,
    team,
    type: 'vote',
  };
}

/**
 * Track a share for a battle or project
 * @param {number} battleId - Battle ID
 * @param {string} team - 'A' or 'B' (null for general battle share)
 * @param {number} userFid - User FID
 */
export async function trackBattleShare(battleId, team = null, userFid) {
  const redis = await getRedisClient();

  if (team) {
    // Project-specific share
    await incrementEngagement(battleId, team, 'shares', userFid);
  } else {
    // General battle share - credit both teams
    await incrementEngagement(battleId, 'A', 'shares', userFid);
    await incrementEngagement(battleId, 'B', 'shares', userFid);
  }

  return {
    tracked: true,
    battleId,
    team: team || 'both',
    type: 'share',
  };
}

/**
 * Get which team a project is on in a battle
 * @param {Object} battle - Battle object
 * @param {number} projectId - Project ID
 * @returns {string|null} 'A', 'B', or null
 */
function getProjectTeam(battle, projectId) {
  if (battle.projectA.id === projectId) return 'A';
  if (battle.projectB.id === projectId) return 'B';
  return null;
}

/**
 * Increment engagement count for a team
 * @param {number} battleId - Battle ID
 * @param {string} team - 'A' or 'B'
 * @param {string} type - 'views', 'clicks', 'votes', 'shares'
 * @param {number} userFid - User FID (optional)
 */
async function incrementEngagement(battleId, team, type, userFid = null) {
  const redis = await getRedisClient();
  const engagementKey = `${BATTLE_ENGAGEMENT_PREFIX}${battleId}:${team}`;

  // Increment the count
  await redis.hIncrBy(engagementKey, type, 1);

  // Track unique users if FID provided
  if (userFid) {
    const uniqueKey = `${engagementKey}:unique:${type}`;
    await redis.sAdd(uniqueKey, userFid.toString());
  }

  console.log(`[BATTLE ENGAGEMENT] ${team} ${type} +1 (Battle ${battleId})`);
}

/**
 * Get engagement stats for a battle
 * @param {number} battleId - Battle ID
 * @returns {Object} Engagement stats for both teams
 */
export async function getBattleEngagement(battleId) {
  const redis = await getRedisClient();

  const teamA = await redis.hGetAll(`${BATTLE_ENGAGEMENT_PREFIX}${battleId}:A`);
  const teamB = await redis.hGetAll(`${BATTLE_ENGAGEMENT_PREFIX}${battleId}:B`);

  return {
    teamA: {
      views: parseInt(teamA.views) || 0,
      clicks: parseInt(teamA.clicks) || 0,
      votes: parseInt(teamA.votes) || 0,
      shares: parseInt(teamA.shares) || 0,
    },
    teamB: {
      views: parseInt(teamB.views) || 0,
      clicks: parseInt(teamB.clicks) || 0,
      votes: parseInt(teamB.votes) || 0,
      shares: parseInt(teamB.shares) || 0,
    },
  };
}

/**
 * Calculate weighted score from engagement stats
 * @param {Object} engagement - Engagement object with views, clicks, votes, shares
 * @returns {number} Weighted score
 */
export function calculateScore(engagement) {
  return (
    (engagement.views || 0) * WEIGHTS.VIEW +
    (engagement.clicks || 0) * WEIGHTS.CLICK +
    (engagement.votes || 0) * WEIGHTS.VOTE +
    (engagement.shares || 0) * WEIGHTS.SHARE
  );
}

/**
 * Calculate and return scores for both teams
 * @param {number} battleId - Battle ID
 * @returns {Object} { scoreA, scoreB, engagement }
 */
export async function calculateBattleScores(battleId) {
  const engagement = await getBattleEngagement(battleId);

  const scoreA = calculateScore(engagement.teamA);
  const scoreB = calculateScore(engagement.teamB);

  return {
    scoreA,
    scoreB,
    engagement,
  };
}

/**
 * Get leaderboard breakdown for a battle
 * @param {number} battleId - Battle ID
 * @returns {Object} Detailed breakdown
 */
export async function getBattleLeaderboard(battleId) {
  const engagement = await getBattleEngagement(battleId);
  const scoreA = calculateScore(engagement.teamA);
  const scoreB = calculateScore(engagement.teamB);

  return {
    teamA: {
      score: scoreA,
      breakdown: {
        views: {
          count: engagement.teamA.views,
          points: engagement.teamA.views * WEIGHTS.VIEW,
        },
        clicks: {
          count: engagement.teamA.clicks,
          points: engagement.teamA.clicks * WEIGHTS.CLICK,
        },
        votes: {
          count: engagement.teamA.votes,
          points: engagement.teamA.votes * WEIGHTS.VOTE,
        },
        shares: {
          count: engagement.teamA.shares,
          points: engagement.teamA.shares * WEIGHTS.SHARE,
        },
      },
    },
    teamB: {
      score: scoreB,
      breakdown: {
        views: {
          count: engagement.teamB.views,
          points: engagement.teamB.views * WEIGHTS.VIEW,
        },
        clicks: {
          count: engagement.teamB.clicks,
          points: engagement.teamB.clicks * WEIGHTS.CLICK,
        },
        votes: {
          count: engagement.teamB.votes,
          points: engagement.teamB.votes * WEIGHTS.VOTE,
        },
        shares: {
          count: engagement.teamB.shares,
          points: engagement.teamB.shares * WEIGHTS.SHARE,
        },
      },
    },
  };
}
