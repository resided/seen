// API route to get pending submissions (admin only)
import { getPendingSubmissions } from '../../../lib/projects'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // TODO: Add admin authentication here
  // For now, this is open - you should add auth before going live
  // Example: Check for admin API key or session

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
