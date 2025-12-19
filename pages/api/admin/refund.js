// API route to refund payment for a submission (admin only)
import { getRedisClient } from '../../../lib/redis';
import { getAllSubmissionsFromRedis } from '../../../lib/projects';
import { createWalletClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { isAuthenticated } from '../../../lib/admin-auth';

const ADMIN_FID = 342433; // Admin FID
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS; // REQUIRED - must be set in environment variables


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await isAuthenticated(req))) {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Get submission
    const submissions = await getAllSubmissionsFromRedis();
    const submission = submissions.find(s => s.id === parseInt(projectId));

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check if payment was made
    if (!submission.paymentAmount || submission.paymentAmount <= 0) {
      return res.status(400).json({ error: 'No payment to refund' });
    }

    // Check if already refunded
    if (submission.refunded) {
      return res.status(400).json({ error: 'Payment already refunded' });
    }

    // Check if wallet address exists
    if (!submission.submitterWalletAddress) {
      return res.status(400).json({ error: 'No wallet address found for refund' });
    }

    // Validate treasury private key
    if (!TREASURY_PRIVATE_KEY || !TREASURY_PRIVATE_KEY.startsWith('0x')) {
      return res.status(500).json({ 
        error: 'Treasury private key not configured properly' 
      });
    }

    // Send refund
    try {
      const account = privateKeyToAccount(TREASURY_PRIVATE_KEY);
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(),
      });

      const refundAmount = parseEther(submission.paymentAmount.toString());
      const hash = await walletClient.sendTransaction({
        to: submission.submitterWalletAddress,
        value: refundAmount,
      });

      // Update submission with refund info
      const redis = await getRedisClient();
      if (redis) {
        const submissionKey = `submission:${submission.id}`;
        await redis.hSet(submissionKey, {
          refunded: 'true',
          refundTxHash: hash,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Refund sent successfully`,
        refundTxHash: hash,
        amount: submission.paymentAmount,
        recipient: submission.submitterWalletAddress,
      });
    } catch (txError) {
      console.error('Error sending refund:', txError);
      return res.status(500).json({ 
        error: 'Failed to send refund',
        details: txError.message 
      });
    }
  } catch (error) {
    console.error('Error processing refund:', error);
    return res.status(500).json({ error: 'Failed to process refund' });
  }
}
