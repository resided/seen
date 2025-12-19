// API route to trace a wallet address to find associated FIDs (admin only)
import { getRedisClient } from '../../../lib/redis';
import { isAuthenticated } from '../../../lib/admin-auth';

const ADMIN_FID = 342433;


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await isAuthenticated(req))) {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    const walletLower = walletAddress.toLowerCase().trim();
    if (!walletLower.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    // Helper function to scan Redis keys with v5 compatibility
    const scanKeys = async (pattern) => {
      const foundKeys = [];
      let cursor = '0';
      
      try {
        // Check if scanIterator exists (node-redis v5)
        if (typeof redis.scanIterator === 'function') {
          try {
            for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
              foundKeys.push(key);
            }
            return foundKeys;
          } catch (iterError) {
            console.warn('scanIterator failed, falling back to manual scan:', iterError.message);
            // Fall through to manual scan
          }
        }
        
        // Manual scan (works with all versions)
        do {
          let result;
          try {
            result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
          } catch (scanError) {
            // Try older API format
            result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          }
          
          // Handle both object and array return formats
          if (typeof result === 'object') {
            if (Array.isArray(result)) {
              // Old format: [cursor, keys]
              cursor = String(result[0] || '0');
              const keys = result[1] || [];
              if (keys.length > 0) foundKeys.push(...keys);
            } else {
              // New format: { cursor, keys }
              cursor = String(result.cursor ?? '0');
              const keys = result.keys || [];
              if (keys.length > 0) foundKeys.push(...keys);
            }
          } else {
            cursor = '0';
          }
        } while (cursor !== '0');
      } catch (error) {
        console.error('Error scanning Redis keys:', error);
        throw error;
      }
      
      return foundKeys;
    };

    // Search for all claim-related keys containing this wallet address
    const results = {
      walletAddress: walletLower,
      foundFIDs: [],
      claimRecords: [],
      transactionHashes: [],
      allKeys: []
    };

    // Pattern 1: claim:wallet:global:${projectId}:${rotationId}:${wallet}
    const globalWalletPattern = `claim:wallet:global:*:*:${walletLower}`;
    const globalWalletKeys = await scanKeys(globalWalletPattern);
    
    for (const key of globalWalletKeys) {
      const count = parseInt(await redis.get(key) || '0');
      // Extract projectId and rotationId from key: claim:wallet:global:${projectId}:${rotationId}:${wallet}
      const parts = key.split(':');
      if (parts.length >= 6) {
        const projectId = parts[3];
        const rotationId = parts[4];
        results.claimRecords.push({
          key,
          type: 'global_wallet_claim',
          projectId,
          rotationId,
          claimCount: count
        });
      }
    }

    // Pattern 2: claim:wallet:${projectId}:${rotationId}:${wallet}
    const walletPattern = `claim:wallet:*:*:${walletLower}`;
    const walletKeys = await scanKeys(walletPattern);
    
    for (const key of walletKeys) {
      const count = parseInt(await redis.get(key) || '0');
      // Extract projectId and rotationId from key: claim:wallet:${projectId}:${rotationId}:${wallet}
      const parts = key.split(':');
      if (parts.length >= 5) {
        const projectId = parts[2];
        const rotationId = parts[3];
        results.claimRecords.push({
          key,
          type: 'wallet_claim',
          projectId,
          rotationId,
          claimCount: count
        });
      }
    }

    // Pattern 3: claim:tx:${wallet} - transaction hashes
    const txPattern = `claim:tx:${walletLower}*`;
    const txKeys = await scanKeys(txPattern);
    
    for (const key of txKeys) {
      const txHash = await redis.get(key);
      if (txHash) {
        results.transactionHashes.push({
          key,
          txHash
        });
      }
    }

    // Pattern 4: claim:lock:${wallet} - claim locks
    const lockPattern = `claim:lock:${walletLower}`;
    const lockKey = await redis.get(lockPattern);
    if (lockKey) {
      results.claimLock = {
        key: lockPattern,
        exists: true
      };
    }

    // Now, for each project/rotation combination, find the FID that claimed
    // The key insight: if a wallet has claims for a rotation, we need to find
    // which FID also has claims for that same rotation - they're likely the same person
    
    const uniqueProjectRotations = new Set();
    results.claimRecords.forEach(record => {
      uniqueProjectRotations.add(`${record.projectId}:${record.rotationId}`);
    });

    // For each project/rotation where this wallet has claims, find matching FIDs
    for (const projectRotation of uniqueProjectRotations) {
      const [projectId, rotationId] = projectRotation.split(':');
      
      // Get wallet claim count for this rotation
      const walletClaimKey = `claim:wallet:global:${projectId}:${rotationId}:${walletLower}`;
      const walletClaimCount = parseInt(await redis.get(walletClaimKey) || '0');
      
      if (walletClaimCount === 0) continue; // Skip if no wallet claims
      
      // Scan all claim:count:${projectId}:${rotationId}:${fid} keys
      // If an FID has the same claim count as the wallet, they're likely the same person
      const countPattern = `claim:count:${projectId}:${rotationId}:*`;
      const countKeys = await scanKeys(countPattern);
      
      for (const key of countKeys) {
        const parts = key.split(':');
        if (parts.length >= 5) {
          const fid = parseInt(parts[4]);
          const fidClaimCount = parseInt(await redis.get(key) || '0');
          
          // If FID claim count matches wallet claim count, they're the same person
          // Also check if both have claims (even if counts don't match exactly due to timing)
          if (fidClaimCount > 0 && walletClaimCount > 0) {
            // Check transaction hashes to see if we can find a direct link
            let foundTxLink = false;
            
            // Check claim:tx:${projectId}:${rotationId}:${fid}:${count} keys
            for (let i = 1; i <= fidClaimCount; i++) {
              const txKey = `claim:tx:${projectId}:${rotationId}:${fid}:${i}`;
              const txHash = await redis.get(txKey);
              
              if (txHash) {
                // If we have a transaction hash, we could verify it on-chain
                // For now, we'll match by claim count correlation
                results.allKeys.push({
                  key: txKey,
                  fid,
                  projectId,
                  rotationId,
                  claimNumber: i,
                  txHash,
                  type: 'transaction'
                });
              }
            }
            
            // Strong match: FID and wallet have same claim count for this rotation
            if (fidClaimCount === walletClaimCount) {
              if (!results.foundFIDs.includes(fid)) {
                results.foundFIDs.push(fid);
              }
              results.allKeys.push({
                key: `claim:count:${projectId}:${rotationId}:${fid}`,
                fid,
                projectId,
                rotationId,
                fidClaimCount,
                walletClaimCount,
                matchStrength: 'exact', // Exact count match
                foundTxLink
              });
            } else if (fidClaimCount > 0 && walletClaimCount > 0) {
              // Partial match: both have claims but counts differ (could be timing issue)
              if (!results.foundFIDs.includes(fid)) {
                results.foundFIDs.push(fid);
              }
              results.allKeys.push({
                key: `claim:count:${projectId}:${rotationId}:${fid}`,
                fid,
                projectId,
                rotationId,
                fidClaimCount,
                walletClaimCount,
                matchStrength: 'partial', // Both have claims but counts differ
                foundTxLink
              });
            }
          }
        }
      }
    }

    // Sort FIDs
    results.foundFIDs.sort((a, b) => a - b);

    return res.status(200).json({
      success: true,
      ...results,
      summary: {
        totalFIDs: results.foundFIDs.length,
        totalClaimRecords: results.claimRecords.length,
        totalTransactions: results.transactionHashes.length,
        uniqueProjectRotations: uniqueProjectRotations.size
      }
    });
  } catch (error) {
    console.error('Error tracing wallet:', error);
    return res.status(500).json({ error: 'Failed to trace wallet', details: error.message });
  }
}

