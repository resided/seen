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

    // Get PRIMARY verified Farcaster wallet address from Neynar
    // Neynar returns verified_addresses.eth_addresses as an array
    // The first address is typically the primary Farcaster wallet
    const verifiedAddresses = user.verified_addresses?.eth_addresses || [];
    
    // Use only verified addresses (not custody addresses or other wallets)
    // The first verified address is the primary Farcaster wallet
    const primaryWallet = verifiedAddresses.length > 0 ? verifiedAddresses[0] : null;
    
    // Log for debugging if no verified wallet found
    if (!primaryWallet) {
      console.warn(`No verified wallet address found for FID ${user.fid}`);
    }
    
    // Determine the best display name: prefer .eth name from display_name, otherwise use username
    // display_name often contains .eth names like "jacob.eth" or "protardio.eth"
    // If display_name doesn't have .eth, it might just be a display name, so check if it ends with .eth
    let bestDisplayName = user.display_name;
    const hasEthInDisplayName = bestDisplayName && bestDisplayName.toLowerCase().endsWith('.eth');
    
    // If display_name has .eth, use it (uppercase for consistency)
    // Otherwise, if username exists, prefer that (it's the actual Farcaster username)
    // Fallback to display_name if no username
    if (!hasEthInDisplayName && user.username) {
      // If display_name doesn't have .eth, username is more reliable for Farcaster accounts
      // But still use display_name as the primary if it's set
      bestDisplayName = bestDisplayName || user.username;
    } else if (hasEthInDisplayName) {
      // If it has .eth, uppercase it for consistency
      bestDisplayName = bestDisplayName.toUpperCase();
    }
    
    // Return formatted user data
    return res.status(200).json({
      fid: user.fid,
      username: user.username, // Always return the actual Farcaster username
      displayName: bestDisplayName, // Best display name (.eth if available, otherwise display_name or username)
      pfpUrl: user.pfp?.url || user.pfp_url,
      bio: user.profile?.bio?.text,
      profileUrl: user.username ? `https://farcaster.xyz/${user.username}` : `https://farcaster.xyz/profiles/${user.fid}`,
      verified: verifiedAddresses.length > 0,
      neynarUserScore: user.experimental?.neynar_user_score || null,
      twitter: twitter, // Add Twitter/X link
      walletAddress: primaryWallet, // PRIMARY verified Farcaster wallet address (from Neynar)
      walletAddresses: verifiedAddresses, // All verified wallet addresses
      isPrimaryWallet: true, // Flag to indicate this is the primary wallet
      followerCount: user.follower_count || user.followers?.follower_count || user.followers || 0, // Follower count
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

