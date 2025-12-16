// API route to get/set bonus token configuration (admin only)
import { getRedisClient } from '../../../lib/redis';
import { parse } from 'cookie';

const ADMIN_FID = 342433;

function isAuthenticated(req) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
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

const BONUS_TOKEN_CONFIG_KEY = 'bonus:token:config';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Get current bonus token config
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return res.status(500).json({ error: 'Redis not available' });
      }

      const configJson = await redis.get(BONUS_TOKEN_CONFIG_KEY);
      if (configJson) {
        const config = JSON.parse(configJson);
        return res.status(200).json({ config });
      }

      // Return default (disabled) config
      return res.status(200).json({
        config: {
          enabled: false,
          contractAddress: '',
          amount: '',
          decimals: 18,
          maxSupply: 0,
          tokenName: '',
        }
      });
    } catch (error) {
      console.error('Error fetching bonus token config:', error);
      return res.status(500).json({ error: 'Failed to fetch bonus token config' });
    }
  }

  if (req.method === 'POST') {
    // Set bonus token config
    if (!isAuthenticated(req)) {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    try {
      const { config } = req.body;

      if (!config) {
        return res.status(400).json({ error: 'Config object is required' });
      }

      // Validate config
      if (config.enabled) {
        if (!config.contractAddress || !config.contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
          return res.status(400).json({ error: 'Valid contract address is required when enabled' });
        }
        if (!config.amount || parseFloat(config.amount) <= 0) {
          return res.status(400).json({ error: 'Valid amount > 0 is required when enabled' });
        }
        if (!config.decimals || config.decimals < 0 || config.decimals > 18) {
          return res.status(400).json({ error: 'Valid decimals (0-18) is required when enabled' });
        }
        if (!config.maxSupply || parseInt(config.maxSupply) <= 0) {
          return res.status(400).json({ error: 'Valid maxSupply > 0 is required when enabled' });
        }
      }

      const redis = await getRedisClient();
      if (!redis) {
        return res.status(500).json({ error: 'Redis not available' });
      }

      // Save config to Redis
      await redis.set(BONUS_TOKEN_CONFIG_KEY, JSON.stringify(config));

      return res.status(200).json({
        success: true,
        message: config.enabled 
          ? `Bonus token configured: ${config.tokenName || config.contractAddress} (${config.amount} per claim, max ${config.maxSupply})`
          : 'Bonus token disabled',
        config
      });
    } catch (error) {
      console.error('Error setting bonus token config:', error);
      return res.status(500).json({ error: 'Failed to set bonus token config', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

