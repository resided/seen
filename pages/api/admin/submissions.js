// API route to get pending submissions (admin only)
import { getPendingSubmissions } from '../../../lib/projects'

const ADMIN_FID = 342433; // Admin FID

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check admin authentication
  const { fid } = req.body;
  
  if (!fid || parseInt(fid) !== ADMIN_FID) {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' })
  }

  try {
    const submissions = getPendingSubmissions()
    res.status(200).json({
      submissions,
      count: submissions.length
    })
  } catch (error) {
    console.error('Error fetching pending submissions:', error)
    res.status(500).json({ error: 'Failed to fetch submissions' })
  }
}
