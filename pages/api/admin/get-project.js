// API route to get a single project by ID (admin only)
import { getProjectById } from '../../../lib/projects';
import { parse } from 'cookie';

const ADMIN_FID = 342433; // Admin FID

function isAuthenticated(req) {
  // Check FID authentication (Farcaster)
  const { fid } = req.body || {};
  if (fid && parseInt(fid) === ADMIN_FID) {
    return true;
  }

  // Check session cookie (web login)
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (sessionToken) {
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
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const project = await getProjectById(parseInt(projectId));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return res.status(500).json({ error: 'Failed to fetch project' });
  }
}
