// API route to process scheduled featured projects (call via cron)
import { processScheduledFeaturedProjects } from '../../../lib/projects';
import { parse } from 'cookie';

const ADMIN_FID = 342433;

function isAuthenticated(req) {
  // SECURITY: Require ADMIN_SECRET or CRON_SECRET for all admin operations
  const adminSecret = process.env.ADMIN_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  
  // Check for admin secret in header or body
  const providedSecret = req.headers['x-admin-secret'] || req.body?.adminSecret;
  if (adminSecret && providedSecret && providedSecret === adminSecret) {
    return true;
  }
  
  // Check for cron secret (for automated cron jobs)
  const providedCronSecret = req.headers['x-cron-secret'] || req.headers['authorization'];
  if (cronSecret && providedCronSecret && (providedCronSecret === cronSecret || providedCronSecret === `Bearer ${cronSecret}`)) {
    return true;
  }

  // Check session cookie (web login) - only if ADMIN_PASSWORD is properly set
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (sessionToken && process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== 'changeme123') {
    return true;
  }

  // If no secrets configured, deny access (fail secure)
  if (!adminSecret && !cronSecret) {
    console.error('Neither ADMIN_SECRET nor CRON_SECRET configured - endpoint disabled');
  }
  
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Check for cron secret token
  // const cronSecret = req.headers['x-cron-secret'];
  // if (cronSecret !== process.env.CRON_SECRET) {
  //   return res.status(403).json({ error: 'Unauthorized' });
  // }

  try {
    const featured = await processScheduledFeaturedProjects();
    
    return res.status(200).json({
      success: true,
      message: `Processed ${featured.length} scheduled project(s)`,
      featured,
    });
  } catch (error) {
    console.error('Error processing scheduled projects:', error);
    return res.status(500).json({ error: 'Failed to process scheduled projects' });
  }
}

