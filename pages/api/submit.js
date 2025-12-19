// API route to submit a new project
import { submitProject, checkFeaturedPaymentCooldown } from '../../lib/projects'
import { fetchUserByFid } from '../../lib/neynar'
import { getMiniAppCreator } from '../../lib/miniapp-utils'
import { trackMetric, METRIC_TYPES } from '../../lib/analytics'

const MIN_NEYNAR_SCORE = 0.3; // Minimum Neynar user score required to submit

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // EMERGENCY KILL SWITCH - set SUBMISSIONS_DISABLED=true in Vercel env to stop all submissions instantly
  if (process.env.SUBMISSIONS_DISABLED === 'true') {
    return res.status(503).json({ error: 'Submissions temporarily disabled for maintenance' });
  }

  try {
    const {
      name,
      tagline,
      description,
      builder,
      builderFid,
      tokenName,
      tokenContractAddress,
      category,
      submissionType,
      paymentAmount,
      paymentTxHash,
      paymentTimestamp,
      submitterWalletAddress,
      plannedGoLiveDate,
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

    // EMERGENCY KILL SWITCH - set PAYMENTS_DISABLED=true to stop payment processing instantly
    if (submissionType === 'featured' && process.env.PAYMENTS_DISABLED === 'true') {
      return res.status(503).json({ error: 'Payment processing temporarily disabled. Please try again later.' });
    }

    // Validate featured submission has payment
    if (submissionType === 'featured' && (!paymentAmount || paymentAmount <= 0)) {
      return res.status(400).json({ error: 'Featured submissions require payment' })
    }

    // Check 24-hour cooldown for featured submissions
    if (submissionType === 'featured' && submitterFid) {
      const cooldown = await checkFeaturedPaymentCooldown(parseInt(submitterFid));
      if (!cooldown.allowed) {
        return res.status(429).json({
          error: `You can only submit one featured project per 24 hours. Please wait ${cooldown.hoursRemaining} more hour(s) before submitting another featured project.`,
          hoursRemaining: cooldown.hoursRemaining,
        });
      }
    }

    // Verify miniapp ownership if miniapp URL is provided
    if (links?.miniapp && submitterFid) {
      try {
        const creatorInfo = await getMiniAppCreator(links.miniapp);
        
        if (creatorInfo?.fid) {
          const creatorFid = parseInt(creatorInfo.fid);
          const submitterFidInt = parseInt(submitterFid);
          
          // Check if submitter FID matches creator FID
          if (creatorFid !== submitterFidInt) {
            // Also check if builderFid matches (in case they're submitting for someone else)
            const builderFidInt = builderFid ? parseInt(builderFid) : 0;
            
            if (builderFidInt !== creatorFid && builderFidInt !== submitterFidInt) {
              return res.status(403).json({
                error: 'Mini App ownership verification failed. The Mini App must be owned by you or the builder you specified. This prevents tip exploitation.',
                creatorFid: creatorFid,
                submitterFid: submitterFidInt,
                builderFid: builderFidInt,
              });
            }
          }
          
          // If builderFid wasn't provided but we found it from manifest, use it
          if (!builderFid && creatorFid) {
            // We'll use the creator FID as builderFid
            // This will be handled below
          }
        } else {
          // If we can't verify ownership (e.g., Farcaster-hosted app), log a warning
          console.warn(`Could not verify miniapp ownership for ${links.miniapp}. Submitter FID: ${submitterFid}`);
          // For Farcaster-hosted apps, we'll allow but log it
          // You might want to be more strict here
        }
      } catch (error) {
        console.error('Error verifying miniapp ownership:', error);
        // If verification fails, we'll allow submission but log it
        // In production, you might want to reject if verification is critical
      }
    }

    // Fetch builder username from Neynar if we have a FID
    let builderUsername = null;
    const effectiveBuilderFid = builderFid || submitterFid;
    
    if (effectiveBuilderFid) {
      try {
        const neynarResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${effectiveBuilderFid}`, {
          headers: { 'api_key': process.env.NEYNAR_API_KEY }
        });
        
        if (neynarResponse.ok) {
          const neynarData = await neynarResponse.json();
          if (neynarData.users && neynarData.users.length > 0) {
            builderUsername = neynarData.users[0].username; // Clean username without emojis
          }
        }
      } catch (error) {
        console.error('Error fetching builder username:', error);
      }
    }

    const project = await submitProject({
      name: name.toUpperCase(),
      tagline: tagline.toUpperCase(),
      description,
      builder,
      builderUsername, // Clean username from Neynar
      builderFid: effectiveBuilderFid || 0,
      tokenName: tokenName || '',
      tokenContractAddress: tokenContractAddress || '',
      category: category.toLowerCase(),
      submissionType: submissionType || 'queue',
      paymentAmount: paymentAmount || 0,
      paymentTxHash: paymentTxHash || null,
      paymentTimestamp: paymentTimestamp || null,
      submitterWalletAddress: submitterWalletAddress || null,
      plannedGoLiveDate: plannedGoLiveDate || null,
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

    // Track analytics
    await trackMetric(METRIC_TYPES.LISTING_SUBMIT, {
      fid: fidNum,
      projectId: project.id,
      submissionType: project.submissionType,
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

