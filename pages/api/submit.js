// API route to submit a new project
import { submitProject } from '../../lib/projects'
import { fetchUserByFid } from '../../lib/neynar'

const MIN_NEYNAR_SCORE = 0.62; // Minimum Neynar user score required to submit

export default async function handler(req, res) {
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
      links,
      submitterFid // FID of the person submitting (current user)
    } = req.body

    // Validate required fields
    if (!name || !tagline || !description || !builder || !category) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check Neynar user score if submitterFid is provided
    if (submitterFid) {
      const apiKey = process.env.NEYNAR_API_KEY;
      if (apiKey) {
        try {
          const user = await fetchUserByFid(submitterFid, apiKey);
          if (user) {
            const userScore = user.experimental?.neynar_user_score;
            
            // If score exists and is below threshold, reject submission
            if (userScore !== null && userScore !== undefined) {
              if (userScore < MIN_NEYNAR_SCORE) {
                return res.status(403).json({ 
                  error: `Your Neynar user score (${userScore.toFixed(2)}) is below the required threshold of ${MIN_NEYNAR_SCORE}. Only users with a score of ${MIN_NEYNAR_SCORE} or higher can submit projects.`,
                  userScore: userScore,
                  minScore: MIN_NEYNAR_SCORE
                });
              }
            } else {
              // If score is not available, allow submission but log it
              console.warn(`User ${submitterFid} has no Neynar score available`);
            }
          }
        } catch (error) {
          console.error('Error checking Neynar user score:', error);
          // If we can't check the score, we'll allow submission but log the error
          // You might want to change this to reject if score checking is critical
        }
      }
    }

    // Validate featured submission has payment
    if (submissionType === 'featured' && (!paymentAmount || paymentAmount <= 0)) {
      return res.status(400).json({ error: 'Featured submissions require payment' })
    }

    const project = await submitProject({
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

    // Log submission for debugging
    console.log('New submission received:', {
      id: project.id,
      name: project.name,
      builder: project.builder,
      status: project.status,
      submissionType: project.submissionType
    });

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

