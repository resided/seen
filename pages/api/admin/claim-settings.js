// API route to manage claim settings (admin only)
import { getRedisClient } from '../../../lib/redis';
import { parse } from 'cookie';

const ADMIN_FID = 342433;
const CLAIM_SETTINGS_KEY = 'claim:settings';

// Default settings
const DEFAULT_SETTINGS = {
  baseClaimAmount: 40000, // Base amount of tokens per claim
  claimMultiplier: 1, // Multiplier (1x, 2x, 3x, etc.)
  cooldownHours: 24, // Personal cooldown in hours (not used - one claim per featured project)
  minNeynarScore: 0.6, // Minimum Neynar score to claim
  claimsEnabled: true, // Master switch for claims
};

function isAuthenticated(req) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('ADMIN_SECRET not configured - admin endpoints disabled');
    return false;
  }
  
  const providedSecret = req.headers['x-admin-secret'] || req.body?.adminSecret;
  if (providedSecret && providedSecret === adminSecret) {
    return true;
  }

  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (sessionToken && process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== 'changeme123') {
    return true;
  }

  return false;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Get current claim settings (no auth required for reading)
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return res.status(200).json({ settings: DEFAULT_SETTINGS });
      }

      const settingsData = await redis.get(CLAIM_SETTINGS_KEY);
      if (!settingsData) {
        return res.status(200).json({ settings: DEFAULT_SETTINGS });
      }

      const settings = JSON.parse(settingsData);
      return res.status(200).json({ settings: { ...DEFAULT_SETTINGS, ...settings } });
    } catch (error) {
      console.error('Error fetching claim settings:', error);
      return res.status(200).json({ settings: DEFAULT_SETTINGS });
    }
  }

  if (req.method === 'POST') {
    // Update claim settings (admin only)
    if (!isAuthenticated(req)) {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    try {
      const { settings } = req.body;
      
      if (!settings) {
        return res.status(400).json({ error: 'Settings object is required' });
      }

      const redis = await getRedisClient();
      if (!redis) {
        return res.status(500).json({ error: 'Redis not available' });
      }

      // Get current settings and merge with new ones
      const currentData = await redis.get(CLAIM_SETTINGS_KEY);
      const currentSettings = currentData ? JSON.parse(currentData) : DEFAULT_SETTINGS;
      
      const updatedSettings = {
        ...currentSettings,
        ...settings,
        // Ensure numeric values
        baseClaimAmount: parseInt(settings.baseClaimAmount) || currentSettings.baseClaimAmount,
        claimMultiplier: parseFloat(settings.claimMultiplier) || currentSettings.claimMultiplier,
        cooldownHours: parseInt(settings.cooldownHours) || currentSettings.cooldownHours,
        minNeynarScore: parseFloat(settings.minNeynarScore) || currentSettings.minNeynarScore,
        claimsEnabled: settings.claimsEnabled !== undefined ? settings.claimsEnabled : currentSettings.claimsEnabled,
      };

      await redis.set(CLAIM_SETTINGS_KEY, JSON.stringify(updatedSettings));

      console.log('Claim settings updated:', updatedSettings);

      return res.status(200).json({
        success: true,
        message: 'Claim settings updated successfully',
        settings: updatedSettings,
      });
    } catch (error) {
      console.error('Error updating claim settings:', error);
      return res.status(500).json({ error: 'Failed to update claim settings' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

