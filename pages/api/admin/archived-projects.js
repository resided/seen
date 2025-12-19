// API route to get all archived projects for admin panel
import { getAllProjects } from '../../../lib/projects';
import { isAuthenticated } from '../../../lib/admin-auth';

const ADMIN_FID = 342433; // Admin FID


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authentication
  if (!(await isAuthenticated(req))) {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  try {
    const projects = await getAllProjects();
    
    // Filter to only show archived projects
    const archivedProjects = projects.filter(p => 
      p.status === 'archived'
    ).sort((a, b) => {
      // Sort by most recently archived first
      return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
    });

    return res.status(200).json({
      success: true,
      projects: archivedProjects,
    });
  } catch (error) {
    console.error('Error fetching archived projects:', error);
    return res.status(500).json({ error: 'Failed to fetch archived projects' });
  }
}
