// Reserve a claim slot BEFORE user signs transaction
// This guarantees that when the transaction confirms, the claim will succeed
// Reservations expire after 2 minutes if not used

import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject, getRotationId } from '../../../lib/projects';
import crypto from 'crypto';

const RESERVATION_TTL_SECONDS = 120; // 2 minutes

const DEFAULT_CLAIM_SETTINGS = {
  baseClaimAmount: 40000,
  claimMultiplier: 1,
  cooldownHours: 24,
  minNeynarScore: 0.6,
  claimsEnabled: true,
};

async function getClaimSettings(redis) {
  try {
    const settingsData = await redis.get('claim:settings');
    if (!settingsData) return DEFAULT_CLAIM_SETTINGS;
    return { ...DEFAULT_CLAIM_SETTINGS, ...JSON.parse(settingsData) };
  } catch (error) {
    return DEFAULT_CLAIM_SETTINGS;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fid, walletAddress } = req.body;

    // Basic validation
    if (!fid || !walletAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'FID and wallet address required' 
      });
    }

    const walletLower = walletAddress.toLowerCase();
    const fidNum = parseInt(fid);
    const redis = await getRedisClient();
    
    if (!redis) {
      return res.status(500).json({ 
        success: false, 
        error: 'Service unavailable' 
      });
    }

    // SECURITY: Check if FID is blocked
    const BLOCKED_FIDS_KEY = 'admin:blocked:fids';
    const blockedFidsJson = await redis.get(BLOCKED_FIDS_KEY);
    if (blockedFidsJson) {
      const blockedFids = JSON.parse(blockedFidsJson);
      if (blockedFids.includes(fidNum)) {
        return res.status(400).json({ 
          success: false, 
          error: 'This account has been blocked from claiming',
          code: 'FID_BLOCKED'
        });
      }
    }

    // Get featured project and settings
    const featuredProject = await getFeaturedProject();
    if (!featuredProject || !featuredProject.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'No featured project available' 
      });
    }

    const claimSettings = await getClaimSettings(redis);
    const { claimsEnabled } = claimSettings;

    if (!claimsEnabled) {
      return res.status(400).json({ 
        success: false, 
        error: 'Claims are currently disabled' 
      });
    }

    // Check expiration
    const featuredAt = featuredProject.featuredAt ? new Date(featuredProject.featuredAt) : new Date();
    const expirationTime = new Date(featuredAt.getTime() + 24 * 60 * 60 * 1000);
    
    if (new Date() > expirationTime) {
      return res.status(400).json({ 
        success: false, 
        error: 'Claim window expired' 
      });
    }

    // SIMPLIFIED: Always one claim per FID per featured project
    const maxClaims = 1;

    // CRITICAL: Key format must match claim/index.js - use getRotationId() for consistency
    const rotationId = await getRotationId();
    const globalWalletClaimCountKey = `claim:wallet:global:${featuredProject.id}:${rotationId}:${walletLower}`;

    // Check current claim count
    const currentCount = parseInt(await redis.get(globalWalletClaimCountKey) || '0');
    
    if (currentCount >= maxClaims) {
      return res.status(400).json({ 
        success: false, 
        error: `Already claimed maximum (${maxClaims}) for this project`,
        claimCount: currentCount,
        maxClaims
      });
    }

    // Create reservation with atomic set (NX = only if not exists)
    const reservationId = crypto.randomUUID();
    const nextClaimNum = currentCount + 1;
    
    // CRITICAL: Use reservation ID in key (not wallet) to match claim/index.js
    const reservationKey = `claim:reserve:${reservationId}`;
    
    const reservation = {
      id: reservationId,
      fid: parseInt(fid),
      walletAddress: walletLower,
      rotationId,
      featuredProjectId: featuredProject.id,
      claimNum: nextClaimNum,
      maxClaims,
      createdAt: Date.now(),
      status: 'pending'
    };

    // Try to set reservation atomically
    const setResult = await redis.set(
      reservationKey, 
      JSON.stringify(reservation), 
      { NX: true, EX: RESERVATION_TTL_SECONDS }
    );

    if (!setResult) {
      // Another request created a reservation first - race condition handled
      // Re-fetch and return that reservation
      const newReservation = await redis.get(reservationKey);
      if (newReservation) {
        const parsed = JSON.parse(newReservation);
        return res.status(200).json({
          success: true,
          reservationId: parsed.id,
          message: 'Concurrent reservation returned',
          existing: true,
          expiresIn: RESERVATION_TTL_SECONDS,
          claimNum: parsed.claimNum,
          maxClaims: parsed.maxClaims
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create reservation. Please try again.' 
      });
    }

    console.log('Claim reservation created:', {
      reservationId,
      fid,
      walletAddress: walletLower.slice(0, 10) + '...',
      claimNum: nextClaimNum,
      maxClaims
    });

    return res.status(200).json({
      success: true,
      reservationId,
      message: 'Claim slot reserved. Sign the transaction to complete.',
      existing: false,
      expiresIn: RESERVATION_TTL_SECONDS,
      claimNum: nextClaimNum,
      maxClaims,
      treasuryAddress: process.env.TREASURY_ADDRESS
    });

  } catch (error) {
    console.error('Reserve error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to reserve claim slot' 
    });
  }
}

