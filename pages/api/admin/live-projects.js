// API route to get all live projects (featured + queued) for admin panel
import { getAllProjects, getProjectStatsToday } from '../../../lib/projects';
import { parse } from 'cookie';

const ADMIN_FID = 342433; // Admin FID

function isAuthenticated(req) {
  // SECURITY: Require ADMIN_SECRET for all admin operations
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('ADMIN_SECRET not configured - admin endpoints disabled');
    return false;
  }
  
  // Check for secret in header or body
  const providedSecret = req.headers['x-admin-secret'] || req.body?.adminSecret;
  if (providedSecret && providedSecret === adminSecret) {
    return true;
  }

  // Check session cookie (web login) - only if ADMIN_PASSWORD is properly set
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (sessionToken && process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== 'changeme123') {
    return true;
  }

  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authentication
  if (!isAuthenticated(req)) {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  try {
    const projects = await getAllProjects();
    
    // Filter to only show live projects (featured, active, or queued, excluding archived)
    const liveProjects = projects.filter(p => 
      (p.status === 'featured' || p.status === 'active' || p.status === 'queued') && p.status !== 'archived'
    ).sort((a, b) => {
      // Featured first, then active, then queued, then by submitted date
      const statusOrder = { featured: 1, active: 2, queued: 3 };
      const aOrder = statusOrder[a.status] || 99;
      const bOrder = statusOrder[b.status] || 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
    });

    // Attach window stats (using rotationId for featured, calendar day otherwise) to mirror miniapp
    const projectsWithWindowStats = await Promise.all(
      liveProjects.map(async (p) => {
        const windowStats = await getProjectStatsToday(
          p.id,
          p.status === 'featured' ? p.rotationId : null
        );
        return {
          ...p,
          windowStats,
        };
      })
    );

    return res.status(200).json({
      success: true,
      projects: projectsWithWindowStats,
    });
  } catch (error) {
    console.error('Error fetching live projects:', error);
    return res.status(500).json({ error: 'Failed to fetch live projects' });
  }
}
