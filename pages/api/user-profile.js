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

    // Extract Twitter/X username from user data
    // Neynar returns social links in various formats
    let twitter = null;
    if (user.profile?.social_links) {
      const twitterLink = user.profile.social_links.find(
        link => link.type === 'twitter' || link.type === 'x' || link.url?.includes('twitter.com') || link.url?.includes('x.com')
      );
      if (twitterLink) {
        twitter = twitterLink.url || twitterLink.username;
      }
    }
    // Also check legacy fields
    if (!twitter && user.twitter) {
      twitter = user.twitter;
    }
    if (!twitter && user.profile?.twitter) {
      twitter = user.profile.twitter;
    }

    // Get wallet addresses (prefer verified addresses)
    const walletAddresses = user.verified_addresses?.eth_addresses || [];
    const primaryWallet = walletAddresses.length > 0 ? walletAddresses[0] : null;
    
    // Return formatted user data
    return res.status(200).json({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp?.url || user.pfp_url,
      bio: user.profile?.bio?.text,
      profileUrl: user.username ? `https://farcaster.xyz/${user.username}` : `https://farcaster.xyz/profiles/${user.fid}`,
      verified: walletAddresses.length > 0,
      neynarUserScore: user.experimental?.neynar_user_score || null,
      twitter: twitter, // Add Twitter/X link
      walletAddress: primaryWallet, // Primary wallet address for tips
      walletAddresses: walletAddresses, // All wallet addresses
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

