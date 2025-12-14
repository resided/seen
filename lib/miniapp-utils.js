// Utility functions for fetching Mini App metadata and creator info

/**
 * Parse a Farcaster Mini App URL to extract app ID and name
 * @param {string} url - Mini App URL (e.g., https://farcaster.xyz/miniapps/yHHGhpKt2LqP/databaseball)
 * @returns {Object|null} - { appId, appName } or null if invalid
 */
export function parseMiniAppUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Handle Farcaster-hosted Mini App URLs
    // Format: https://farcaster.xyz/miniapps/{appId}/{appName}
    if (urlObj.hostname === 'farcaster.xyz' || urlObj.hostname === 'www.farcaster.xyz') {
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'miniapps' && pathParts.length >= 2) {
        return {
          appId: pathParts[1],
          appName: pathParts[2] || pathParts[1],
          isFarcasterHosted: true,
        };
      }
    }
    
    // Handle direct Mini App URLs (the Mini App's own domain)
    return {
      domain: urlObj.hostname,
      isFarcasterHosted: false,
    };
  } catch (error) {
    console.error('Error parsing Mini App URL:', error);
    return null;
  }
}

/**
 * Fetch Mini App manifest from a domain
 * @param {string} domain - The Mini App's domain
 * @returns {Promise<Object|null>} - Manifest data or null
 */
export async function fetchMiniAppManifest(domain) {
  try {
    // Ensure domain has protocol
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    const manifestUrl = `${baseUrl}/.well-known/farcaster.json`;
    
    const response = await fetch(manifestUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.status}`);
    }
    
    const manifest = await response.json();
    return manifest;
  } catch (error) {
    console.error('Error fetching Mini App manifest:', error);
    return null;
  }
}

/**
 * Extract creator FID from Mini App manifest
 * @param {Object} manifest - The Mini App manifest
 * @returns {number|null} - Creator FID or null
 */
export function extractCreatorFid(manifest) {
  try {
    if (!manifest?.accountAssociation?.header) {
      return null;
    }
    
    // Decode the base64url header
    const header = JSON.parse(atob(manifest.accountAssociation.header));
    return header.fid || null;
  } catch (error) {
    console.error('Error extracting creator FID:', error);
    return null;
  }
}

/**
 * Get Mini App creator info from a URL
 * @param {string} url - Mini App URL
 * @returns {Promise<Object|null>} - { fid, profileUrl, manifest } or null
 */
export async function getMiniAppCreator(url) {
  try {
    const parsed = parseMiniAppUrl(url);
    if (!parsed) {
      return null;
    }
    
    // If it's a Farcaster-hosted Mini App, we need to get the homeUrl first
    // For now, we'll try to fetch from the Farcaster API or use the URL structure
    // Note: Farcaster API might have an endpoint for this, but for now we'll use the manifest approach
    
    let manifest = null;
    
    if (parsed.isFarcasterHosted) {
      // For Farcaster-hosted apps, we might need to use an API endpoint
      // Try fetching from Farcaster's API if available
      // For now, return null - this would need Farcaster API access
      // TODO: Implement Farcaster API call to get Mini App metadata
      return null;
    } else {
      // Fetch manifest from the Mini App's domain
      manifest = await fetchMiniAppManifest(parsed.domain);
    }
    
    if (!manifest) {
      return null;
    }
    
    const fid = extractCreatorFid(manifest);
    if (!fid) {
      return null;
    }
    
    return {
      fid,
      profileUrl: `https://farcaster.xyz/profiles/${fid}`,
      manifest,
    };
  } catch (error) {
    console.error('Error getting Mini App creator:', error);
    return null;
  }
}

/**
 * Create a Farcaster profile URL from FID
 * @param {number} fid - Farcaster ID
 * @returns {string} - Profile URL
 */
export function getProfileUrl(fid) {
  return `https://farcaster.xyz/profiles/${fid}`;
}

