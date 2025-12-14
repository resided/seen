// API route to approve or reject submissions (admin only)
import { approveProject, rejectProject } from '../../../lib/projects'

const ADMIN_FID = 342433; // Admin FID

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check admin authentication
  const { fid, projectId, action } = req.body;
  
  if (!fid || parseInt(fid) !== ADMIN_FID) {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' })
  }

  try {

    if (!projectId || !action) {
      return res.status(400).json({ error: 'Missing projectId or action' })
    }

    if (action === 'approve') {
      const project = approveProject(projectId)
      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }
      res.status(200).json({
        success: true,
        message: 'Project approved and added to queue',
        project
      })
    } else if (action === 'reject') {
      const project = rejectProject(projectId)
      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }
      res.status(200).json({
        success: true,
        message: 'Project rejected',
        project
      })
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "approve" or "reject"' })
    }
  } catch (error) {
    console.error('Error processing submission:', error)
    res.status(500).json({ error: 'Failed to process submission' })
  }
}
