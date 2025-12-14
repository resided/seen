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

