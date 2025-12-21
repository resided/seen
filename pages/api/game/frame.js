// Farcaster Frame for Feature Wars battles
// Displays current battle and allows sharing

import { getCurrentBattle } from '../../../lib/battles';
import { getBattleLeaderboard } from '../../../lib/battle-analytics';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Handle frame button interactions
    return handleFrameAction(req, res);
  }

  // GET request - return frame HTML
  try {
    const battle = await getCurrentBattle();

    if (!battle || battle.status !== 'active') {
      return renderNoBattleFrame(res);
    }

    const leaderboard = await getBattleLeaderboard(battle.id);

    return renderBattleFrame(res, battle, leaderboard);

  } catch (error) {
    console.error('[FRAME] Error rendering frame:', error);
    return res.status(500).send('Error loading battle');
  }
}

async function handleFrameAction(req, res) {
  try {
    const { buttonIndex, fid } = req.body;

    // Track share when user interacts with frame
    if (fid) {
      const { trackBattleShare } = await import('../../../lib/battle-analytics');
      const battle = await getCurrentBattle();

      if (battle) {
        await trackBattleShare(battle.id, null, parseInt(fid));
      }
    }

    // Button actions
    if (buttonIndex === 1) {
      // "View Battle" - redirect to game
      return res.status(302).setHeader('Location', 'https://seen.zankers.eth.limo').send();
    } else if (buttonIndex === 2) {
      // "Bet on A"
      const battle = await getCurrentBattle();
      return renderBetFrame(res, battle, 'A');
    } else if (buttonIndex === 3) {
      // "Bet on B"
      const battle = await getCurrentBattle();
      return renderBetFrame(res, battle, 'B');
    }

    return res.status(200).send('OK');

  } catch (error) {
    console.error('[FRAME] Error handling action:', error);
    return res.status(500).send('Error processing action');
  }
}

function renderNoBattleFrame(res) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${getBaseUrl()}/api/game/frame/image?state=no-battle" />
  <meta property="fc:frame:button:1" content="Check SEEN" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="https://seen.zankers.eth.limo" />
  <title>SEEN - Feature Wars</title>
</head>
<body>
  <h1>NO ACTIVE BATTLE</h1>
  <p>Check back soon or join /zankers channel</p>
</body>
</html>`;

  return res.status(200).setHeader('Content-Type', 'text/html').send(html);
}

function renderBattleFrame(res, battle, leaderboard) {
  const scoreA = leaderboard.teamA.score;
  const scoreB = leaderboard.teamB.score;
  const totalPool = (battle.poolA + battle.poolB) / 1000; // In thousands

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${getBaseUrl()}/api/game/frame/image?battleId=${battle.id}" />
  <meta property="fc:frame:button:1" content="View Battle" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="https://seen.zankers.eth.limo" />
  <meta property="fc:frame:button:2" content="🅰 ${battle.projectA.name}" />
  <meta property="fc:frame:button:3" content="🅱 ${battle.projectB.name}" />
  <meta property="fc:frame:post_url" content="${getBaseUrl()}/api/game/frame" />
  <title>SEEN - Feature Wars</title>
</head>
<body>
  <h1>FEATURE WARS</h1>
  <h2>${battle.projectA.name} vs ${battle.projectB.name}</h2>
  <p>Score: ${scoreA} - ${scoreB}</p>
  <p>Pool: ${totalPool}K $SEEN</p>
</body>
</html>`;

  return res.status(200).setHeader('Content-Type', 'text/html').send(html);
}

function renderBetFrame(res, battle, team) {
  const project = team === 'A' ? battle.projectA : battle.projectB;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${getBaseUrl()}/api/game/frame/image?battleId=${battle.id}&team=${team}" />
  <meta property="fc:frame:button:1" content="Place Bet on SEEN" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="https://seen.zankers.eth.limo" />
  <meta property="fc:frame:button:2" content="Back" />
  <meta property="fc:frame:post_url" content="${getBaseUrl()}/api/game/frame" />
  <title>Bet on ${project.name}</title>
</head>
<body>
  <h1>BET ON ${project.name}</h1>
  <p>100K $SEEN to join</p>
  <p>Click "Place Bet on SEEN" to continue</p>
</body>
</html>`;

  return res.status(200).setHeader('Content-Type', 'text/html').send(html);
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://seen.zankers.eth.limo';
}
