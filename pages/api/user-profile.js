// API route to fetch Farcaster user profile from Neynar
import { fetchUserByFid, fetchUserByUsername } from '../../lib/neynar';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fid, username } = req.body;
  const apiKey = process.env.NEYNAR_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Neynar API key not configured' });
  }

  if (!fid && !username) {
    return res.status(400).json({ error: 'Either fid or username is required' });
  }

  try {
    let user = null;

    if (fid) {
      user = await fetchUserByFid(fid, apiKey);
    } else if (username) {
      user = await fetchUserByUsername(username, apiKey);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return formatted user data
    return res.status(200).json({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp?.url || user.pfp_url,
      bio: user.profile?.bio?.text,
      profileUrl: `https://farcaster.xyz/profiles/${user.fid}`,
      verified: user.verified_addresses?.eth_addresses?.length > 0,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

