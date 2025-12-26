// Neynar API utilities for fetching Farcaster user data

const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster';

/**
 * Fetch user data from Neynar API by FID
 * @param {number} fid - Farcaster ID
 * @param {string} apiKey - Neynar API key
 * @returns {Promise<Object|null>} - User data or null
 */
export async function fetchUserByFid(fid, apiKey) {
  try {
    const response = await fetch(
      `${NEYNAR_API_URL}/user/bulk?fids=${fid}`,
      {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();
    const users = data?.users || [];
    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Error fetching user by FID:', error);
    return null;
  }
}

/**
 * Fetch user data from Neynar API by username
 * @param {string} username - Farcaster username (without @)
 * @param {string} apiKey - Neynar API key
 * @returns {Promise<Object|null>} - User data or null
 */
export async function fetchUserByUsername(username, apiKey) {
  try {
    // Remove @ if present
    const cleanUsername = username.replace('@', '');
    
    const response = await fetch(
      `${NEYNAR_API_URL}/user/bulk?usernames=${cleanUsername}`,
      {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();
    const users = data?.users || [];
    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Error fetching user by username:', error);
    return null;
  }
}

/**
 * Fetch multiple users by FIDs
 * @param {number[]} fids - Array of Farcaster IDs
 * @param {string} apiKey - Neynar API key
 * @returns {Promise<Object[]>} - Array of user data
 */
export async function fetchUsersByFids(fids, apiKey) {
  try {
    const fidsString = fids.join(',');
    const response = await fetch(
      `${NEYNAR_API_URL}/user/bulk?fids=${fidsString}`,
      {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();
    return data?.users || [];
  } catch (error) {
    console.error('Error fetching users by FIDs:', error);
    return [];
  }
}

/**
 * Verify that a wallet address is connected to a Farcaster account
 * @param {number} fid - Farcaster ID to check
 * @param {string} walletAddress - Wallet address to verify
 * @param {string} apiKey - Neynar API key
 * @returns {Promise<boolean>} - True if wallet is verified for this FID
 */
export async function verifyWalletOwnership(fid, walletAddress, apiKey) {
  try {
    const user = await fetchUserByFid(fid, apiKey);
    if (!user) {
      return false;
    }

    // Check verified addresses (custody + connected wallets)
    const verifiedAddresses = user.verified_addresses?.eth_addresses || [];
    const custodyAddress = user.custody_address;

    // Normalize addresses for comparison
    const normalizedWallet = walletAddress.toLowerCase();
    const normalizedVerified = verifiedAddresses.map(addr => addr.toLowerCase());
    const normalizedCustody = custodyAddress?.toLowerCase();

    // Check if wallet matches any verified address or custody address
    const isVerified = normalizedVerified.includes(normalizedWallet) ||
                      normalizedCustody === normalizedWallet;

    console.log('[NEYNAR] Wallet verification:', {
      fid,
      wallet: walletAddress,
      verifiedAddresses,
      custodyAddress,
      isVerified,
    });

    return isVerified;
  } catch (error) {
    console.error('[NEYNAR] Error verifying wallet ownership:', error);
    return false;
  }
}

/**
 * SECURITY: Verify wallet is the CUSTODY wallet (not just any verified wallet)
 * Custody wallet is created at account signup and cannot be changed - prevents fresh wallet exploit
 * @param {number} fid - Farcaster ID to check
 * @param {string} walletAddress - Wallet address to verify
 * @param {string} apiKey - Neynar API key
 * @returns {Promise<{isCustody: boolean, custodyAddress: string|null, hasPowerBadge: boolean}>}
 */
export async function verifyCustodyWallet(fid, walletAddress, apiKey) {
  try {
    const user = await fetchUserByFid(fid, apiKey);
    if (!user) {
      return { isCustody: false, custodyAddress: null, hasPowerBadge: false };
    }

    const custodyAddress = user.custody_address;
    const normalizedWallet = walletAddress.toLowerCase();
    const normalizedCustody = custodyAddress?.toLowerCase();

    const isCustody = normalizedCustody === normalizedWallet;
    const hasPowerBadge = user.power_badge === true;

    console.log('[NEYNAR] Custody wallet verification:', {
      fid,
      wallet: walletAddress,
      custodyAddress,
      isCustody,
      hasPowerBadge,
    });

    return { 
      isCustody, 
      custodyAddress: custodyAddress || null,
      hasPowerBadge,
    };
  } catch (error) {
    console.error('[NEYNAR] Error verifying custody wallet:', error);
    return { isCustody: false, custodyAddress: null, hasPowerBadge: false };
  }
}

/**
 * Fetch Farcaster miniapp rankings from Neynar Frame Catalog API
 * @param {string} apiKey - Neynar API key
 * @param {number} limit - Number of results (default 20, max 100)
 * @param {string} timeWindow - Trending window: 24h, 7d, 30d (default 7d)
 * @returns {Promise<Object[]>} - Array of miniapp data with rankings
 */
export async function fetchMiniappRankings(apiKey, limit = 20, timeWindow = '7d') {
  try {
    const params = new URLSearchParams({
      limit: Math.min(limit, 100).toString(),
      time_window: timeWindow,
    });

    const response = await fetch(
      `${NEYNAR_API_URL}/frame/catalog/?${params}`,
      {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NEYNAR] API error:', response.status, errorText);
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();

    // LOG THE ACTUAL RESPONSE TO DEBUG
    console.log('[NEYNAR] Response structure:', {
      hasFrames: !!data?.frames,
      frameCount: data?.frames?.length || 0,
      responseKeys: Object.keys(data),
    });

    if (data?.frames?.[0]) {
      console.log('[NEYNAR] First frame fields:', Object.keys(data.frames[0]));
      console.log('[NEYNAR] First frame sample:', JSON.stringify(data.frames[0], null, 2));
    }

    // Neynar catalog returns frames sorted by trending/popularity
    // Response: { frames: [...], cursor: "..." }
    // Each frame: { frame_id, title, image, description, author, manifest, ... }
    const frames = data?.frames || [];

    return frames.map((frame, index) => ({
      ...frame,
      rank: index + 1,
    }));
  } catch (error) {
    console.error('[NEYNAR] Error fetching miniapp rankings:', error);
    return [];
  }
}
