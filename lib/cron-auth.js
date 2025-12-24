// Secure cron authentication to prevent header spoofing
// Vercel cron jobs can be verified using a secret token

/**
 * Verify that a request is from a legitimate Vercel cron job
 * Uses CRON_SECRET environment variable for verification
 *
 * SECURITY: Never trust x-vercel-cron header alone - it can be spoofed!
 *
 * @param {Object} req - Next.js request object
 * @returns {boolean} - True if request is from verified cron
 */
export function verifyCronRequest(req) {
  // Check if x-vercel-cron header is present
  const cronHeader = req.headers['x-vercel-cron'];

  if (!cronHeader || cronHeader !== '1') {
    return false;
  }

  // SECURITY: Verify using secret token
  // Vercel passes this in Authorization header for cron jobs
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is not configured, log warning but allow (backward compatibility)
  // TODO: Make this required after secret is deployed
  if (!cronSecret) {
    console.warn('[CRON AUTH] WARNING: CRON_SECRET not configured - falling back to header-only check');
    console.warn('[CRON AUTH] This is insecure! Set CRON_SECRET environment variable.');
    return true; // Temporary backward compatibility
  }

  // Verify Authorization header matches secret
  // Format: "Bearer <secret>"
  const expectedAuth = `Bearer ${cronSecret}`;

  if (authHeader !== expectedAuth) {
    console.error('[CRON AUTH] SECURITY: Invalid cron authentication attempt', {
      hasHeader: !!authHeader,
      cronHeaderPresent: !!cronHeader,
    });
    return false;
  }

  console.log('[CRON AUTH] Cron request verified with secret');
  return true;
}

/**
 * Check if request is from admin OR verified cron
 * Use this for endpoints that can be triggered by either cron or admin
 *
 * @param {Object} req - Next.js request object
 * @param {Function} isAuthenticated - Admin auth check function
 * @returns {Promise<boolean>} - True if authorized
 */
export async function verifyCronOrAdmin(req, isAuthenticated) {
  // Check admin first (doesn't require env vars)
  const isAdmin = await isAuthenticated(req);
  if (isAdmin) {
    console.log('[CRON AUTH] Request authorized: Admin');
    return true;
  }

  // Then check cron
  const isCron = verifyCronRequest(req);
  if (isCron) {
    console.log('[CRON AUTH] Request authorized: Verified Cron');
    return true;
  }

  console.warn('[CRON AUTH] Request unauthorized: Not admin or cron');
  return false;
}
