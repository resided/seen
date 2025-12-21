// Generate frame images for battle frames
// Simple SVG-based images for now

import { getCurrentBattle } from '../../../../lib/battles';
import { getBattleLeaderboard } from '../../../../lib/battle-analytics';

// Format large numbers: 1000 -> 1K, 1000000 -> 1M, 1000000000 -> 1B
const formatAmount = (amount) => {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(1)}B`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`;
  }
  return amount.toString();
};

export default async function handler(req, res) {
  const { battleId, state, team } = req.query;

  try {
    if (state === 'no-battle') {
      return renderNoBattleImage(res);
    }

    const battle = await getCurrentBattle();
    if (!battle) {
      return renderNoBattleImage(res);
    }

    const leaderboard = await getBattleLeaderboard(battle.id);

    if (team) {
      return renderTeamImage(res, battle, leaderboard, team);
    }

    return renderBattleImage(res, battle, leaderboard);

  } catch (error) {
    console.error('[FRAME IMAGE] Error generating image:', error);
    return renderErrorImage(res);
  }
}

function renderNoBattleImage(res) {
  const svg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#000000"/>
  <text x="600" y="250" font-family="Arial, sans-serif" font-size="80" font-weight="900" fill="#ffffff" text-anchor="middle">
    NO ACTIVE BATTLE
  </text>
  <text x="600" y="350" font-family="Arial, sans-serif" font-size="32" fill="#999999" text-anchor="middle">
    Check back soon or join /zankers
  </text>
</svg>`;

  return res.status(200)
    .setHeader('Content-Type', 'image/svg+xml')
    .setHeader('Cache-Control', 'public, max-age=60')
    .send(svg);
}

function renderBattleImage(res, battle, leaderboard) {
  const scoreA = leaderboard.teamA.score;
  const scoreB = leaderboard.teamB.score;
  const poolTotal = formatAmount(battle.poolA + battle.poolB);

  const isAWinning = scoreA > scoreB;
  const isBWinning = scoreB > scoreA;

  const svg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .title { font-family: Arial, sans-serif; font-size: 48px; font-weight: 900; fill: #ffffff; }
      .subtitle { font-family: Arial, sans-serif; font-size: 24px; fill: #999999; }
      .project { font-family: Arial, sans-serif; font-size: 56px; font-weight: 900; }
      .score { font-family: Arial, sans-serif; font-size: 72px; font-weight: 900; }
      .label { font-family: Arial, sans-serif; font-size: 18px; fill: #666666; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#000000"/>

  <!-- Title -->
  <text x="600" y="80" class="title" text-anchor="middle">MOOD.</text>
  <text x="600" y="120" class="subtitle" text-anchor="middle">${poolTotal} $SEEN POOL</text>

  <!-- Divider -->
  <line x1="600" y1="150" x2="600" y2="580" stroke="#333333" stroke-width="2"/>

  <!-- Project A -->
  <rect x="50" y="180" width="480" height="380" fill="${isAWinning ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="3"/>
  <text x="290" y="240" class="label" text-anchor="middle">PROJECT A</text>
  <text x="290" y="320" class="project" text-anchor="middle" fill="${isAWinning ? '#000000' : '#ffffff'}">
    ${truncateText(battle.projectA.name, 12)}
  </text>
  <text x="290" y="450" class="score" text-anchor="middle" fill="${isAWinning ? '#000000' : '#ffffff'}">
    ${scoreA}
  </text>
  <text x="290" y="490" class="label" text-anchor="middle" fill="${isAWinning ? '#000000' : '#666666'}">SCORE</text>

  <!-- Project B -->
  <rect x="670" y="180" width="480" height="380" fill="${isBWinning ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="3"/>
  <text x="910" y="240" class="label" text-anchor="middle">PROJECT B</text>
  <text x="910" y="320" class="project" text-anchor="middle" fill="${isBWinning ? '#000000' : '#ffffff'}">
    ${truncateText(battle.projectB.name, 12)}
  </text>
  <text x="910" y="450" class="score" text-anchor="middle" fill="${isBWinning ? '#000000' : '#ffffff'}">
    ${scoreB}
  </text>
  <text x="910" y="490" class="label" text-anchor="middle" fill="${isBWinning ? '#000000' : '#666666'}">SCORE</text>
</svg>`;

  return res.status(200)
    .setHeader('Content-Type', 'image/svg+xml')
    .setHeader('Cache-Control', 'public, max-age=60')
    .send(svg);
}

function renderTeamImage(res, battle, leaderboard, team) {
  const project = team === 'A' ? battle.projectA : battle.projectB;
  const score = team === 'A' ? leaderboard.teamA.score : leaderboard.teamB.score;
  const pool = team === 'A' ? battle.poolA : battle.poolB;

  const svg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .title { font-family: Arial, sans-serif; font-size: 48px; font-weight: 900; fill: #ffffff; }
      .project { font-family: Arial, sans-serif; font-size: 72px; font-weight: 900; fill: #ffffff; }
      .info { font-family: Arial, sans-serif; font-size: 32px; fill: #999999; }
      .cta { font-family: Arial, sans-serif; font-size: 36px; font-weight: 900; fill: #000000; }
    </style>
  </defs>

  <rect width="1200" height="630" fill="#000000"/>

  <text x="600" y="150" class="title" text-anchor="middle">BET ON PROJECT ${team}</text>
  <text x="600" y="280" class="project" text-anchor="middle">${truncateText(project.name, 15)}</text>

  <text x="600" y="360" class="info" text-anchor="middle">Current Score: ${score}</text>
  <text x="600" y="410" class="info" text-anchor="middle">Pool: ${formatAmount(pool)} $SEEN</text>

  <rect x="350" y="460" width="500" height="80" fill="#ffffff"/>
  <text x="600" y="515" class="cta" text-anchor="middle">100K $SEEN TO BET</text>
</svg>`;

  return res.status(200)
    .setHeader('Content-Type', 'image/svg+xml')
    .setHeader('Cache-Control', 'public, max-age=60')
    .send(svg);
}

function renderErrorImage(res) {
  const svg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#000000"/>
  <text x="600" y="315" font-family="Arial, sans-serif" font-size="48" fill="#ffffff" text-anchor="middle">
    ERROR LOADING BATTLE
  </text>
</svg>`;

  return res.status(200)
    .setHeader('Content-Type', 'image/svg+xml')
    .send(svg);
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
