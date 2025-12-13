// API route to submit a new project
import { submitProject } from '../../lib/projects'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      name,
      tagline,
      description,
      builder,
      builderFid,
      category,
      submissionType,
      paymentAmount,
      links
    } = req.body

    // Validate required fields
    if (!name || !tagline || !description || !builder || !category) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Validate featured submission has payment
    if (submissionType === 'featured' && (!paymentAmount || paymentAmount <= 0)) {
      return res.status(400).json({ error: 'Featured submissions require payment' })
    }

    const project = submitProject({
      name: name.toUpperCase(),
      tagline: tagline.toUpperCase(),
      description,
      builder,
      builderFid: builderFid || 0,
      category: category.toLowerCase(),
      submissionType: submissionType || 'queue',
      paymentAmount: paymentAmount || 0,
      links: links || {}
    })

    res.status(201).json({
      success: true,
      message: 'Project submitted successfully! It will be reviewed and added to the queue.',
      project
    })
  } catch (error) {
    console.error('Error submitting project:', error)
    res.status(500).json({ error: 'Failed to submit project' })
  }
}

