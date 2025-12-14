// API route to fetch Mini App metadata and creator info
import { parseMiniAppUrl, fetchMiniAppManifest, extractCreatorFid, getProfileUrl } from '../../lib/miniapp-utils';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const parsed = parseMiniAppUrl(url);
    
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid Mini App URL' });
    }

    let manifest = null;
    let creatorInfo = null;

    if (parsed.isFarcasterHosted) {
      // For Farcaster-hosted Mini Apps, we'd need API access
      // For now, return the app ID so the frontend can handle it
      return res.status(200).json({
        appId: parsed.appId,
        appName: parsed.appName,
        isFarcasterHosted: true,
        // Note: To get creator info for Farcaster-hosted apps,
        // you'd need to use Farcaster's API or have the homeUrl
      });
    } else {
      // Fetch manifest from the Mini App's domain
      manifest = await fetchMiniAppManifest(parsed.domain);
      
      if (manifest) {
        const fid = extractCreatorFid(manifest);
        if (fid) {
          creatorInfo = {
            fid,
            profileUrl: getProfileUrl(fid),
          };
        }
      }
    }

    return res.status(200).json({
      appId: parsed.appId,
      appName: parsed.appName,
      domain: parsed.domain,
      isFarcasterHosted: parsed.isFarcasterHosted,
      manifest: manifest ? {
        name: manifest.frame?.name,
        homeUrl: manifest.frame?.homeUrl,
        iconUrl: manifest.frame?.iconUrl,
      } : null,
      creator: creatorInfo,
    });
  } catch (error) {
    console.error('Error fetching Mini App info:', error);
    return res.status(500).json({ error: 'Failed to fetch Mini App info' });
  }
}

