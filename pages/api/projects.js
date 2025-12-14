// API route to fetch projects
import { getFeaturedProject, getQueuedProjects } from '../../lib/projects'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const featured = await getFeaturedProject()
    const queue = await getQueuedProjects()

    res.status(200).json({
      featured,
      queue
    })
  } catch (error) {
    console.error('Error fetching projects:', error)
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
}

