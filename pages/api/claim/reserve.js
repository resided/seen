// Reserve a claim slot BEFORE user signs transaction
// This guarantees that when the transaction confirms, the claim will succeed
// Reservations expire after 2 minutes if not used

import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';
import { getTokenBalance } from '../../../lib/token-balance';
import crypto from 'crypto';

const RESERVATION_TTL_SECONDS = 120; // 2 minutes

const DEFAULT_CLAIM_SETTINGS = {
  baseClaimAmount: 80000,
  claimMultiplier: 1,
  holderMultiplier: 2,
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
    const { holderMultiplier, claimsEnabled } = claimSettings;

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

    // Check holder status per FID (not per wallet)
    // First check cached holder status, then check provided wallet as fallback
    let isHolder = false;
    let maxClaims = 1;
    
    // Check if this FID has already been verified as a holder (cached)
    const fidHolderCacheKey = `claim:fid:holder:${parseInt(fid)}`;
    const cachedHolderStatus = await redis.get(fidHolderCacheKey);
    
    if (cachedHolderStatus === 'true') {
      // FID already verified as holder (cached)
      isHolder = true;
      maxClaims = holderMultiplier;
    } else {
      // Not cached - check the provided wallet (main claim will do full check of all wallets)
      try {
        const { isHolder: holderStatus } = await getTokenBalance(walletAddress);
        isHolder = holderStatus;
        if (isHolder) {
          maxClaims = holderMultiplier;
        }
      } catch (e) {
        console.error('Error checking holder status:', e);
      }
    }

    // CRITICAL: Key format must match claim/index.js
    const rotationId = featuredProject.rotationId || `legacy_${featuredProject.id}`;
    const reservationKey = `claim:reservation:${walletLower}`;
    const globalWalletClaimCountKey = `claim:wallet:global:${featuredProject.id}:${rotationId}:${walletLower}`;

    // ATOMIC RESERVATION
    // Use Lua script for atomic check-and-reserve to prevent race conditions
    // This ensures only one reservation can be made at a time
    
    // First, check if there's already a valid reservation
    const existingReservation = await redis.get(reservationKey);
    if (existingReservation) {
      const reservation = JSON.parse(existingReservation);
      const reservationAge = Date.now() - reservation.createdAt;
      
      if (reservationAge < RESERVATION_TTL_SECONDS * 1000) {
        // Return existing reservation (idempotent)
        return res.status(200).json({
          success: true,
          reservationId: reservation.id,
          message: 'Existing reservation returned',
          existing: true,
          expiresIn: Math.floor((RESERVATION_TTL_SECONDS * 1000 - reservationAge) / 1000),
          claimNum: reservation.claimNum,
          maxClaims: reservation.maxClaims
        });
      }
    }

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
    
    const reservation = {
      id: reservationId,
      fid: parseInt(fid),
      walletAddress: walletLower,
      rotationId,
      featuredProjectId: featuredProject.id,
      claimNum: nextClaimNum,
      maxClaims,
      isHolder,
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
      isHolder,
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

