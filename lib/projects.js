// Projects and submissions storage using Redis (with in-memory fallback)
import { getRedisClient } from './redis';

const PROJECTS_KEY = 'projects:all';
const SUBMISSIONS_KEY = 'submissions:pending';
const FEATURED_KEY = 'projects:featured';
const PAYMENTS_KEY = 'payments:featured'; // Track featured payments by FID

// In-memory fallback storage
let fallbackProjects = [
  {
    id: 1,
    name: 'ZORA',
    tagline: 'MINT AND COLLECT ONCHAIN MEDIA',
    description: 'The easiest way to create, collect, and earn onchain. Mint NFTs, create splits, and build your collector base directly from Farcaster.',
    builder: 'JACOB.ETH',
    builderFid: 8,
    category: 'nft',
    launchDate: 'DEC 13, 2025',
    status: 'featured',
    submittedAt: new Date('2025-12-10').toISOString(),
    featuredAt: new Date('2025-12-13').toISOString(),
    stats: {
      views: 23847,
      clicks: 0,
      tips: 0,
    },
    links: {
      miniapp: 'https://warpcast.com/~/mini-app/zora',
      website: 'https://zora.co',
      github: 'https://github.com/ourzora',
    }
  }
];

let fallbackSubmissions = [];

/**
 * Get all projects from Redis
 */
async function getAllProjectsFromRedis() {
  const redis = await getRedisClient();
  
  if (!redis) {
    return fallbackProjects;
  }

  try {
    const projectIds = await redis.sMembers(PROJECTS_KEY);
    if (projectIds.length === 0) {
      return fallbackProjects;
    }

    const projects = await Promise.all(
      projectIds.map(async (id) => {
        const data = await redis.hGetAll(`project:${id}`);
        if (!data || Object.keys(data).length === 0) return null;
        return {
          id: parseInt(data.id),
          name: data.name,
          tagline: data.tagline,
          description: data.description,
          builder: data.builder,
          builderFid: parseInt(data.builderFid) || 0,
          tokenName: data.tokenName || '',
          tokenContractAddress: data.tokenContractAddress || '',
          category: data.category,
          status: data.status,
          submittedAt: data.submittedAt,
          featuredAt: data.featuredAt,
          stats: data.stats ? JSON.parse(data.stats) : { views: 0, clicks: 0, tips: 0 },
          links: data.links ? JSON.parse(data.links) : {},
        };
      })
    );

    return projects.filter(Boolean);
  } catch (error) {
    console.error('Error fetching projects from Redis:', error);
    return fallbackProjects;
  }
}

/**
 * Save project to Redis
 */
async function saveProjectToRedis(project) {
  const redis = await getRedisClient();
  
  if (!redis) {
    // Fallback to in-memory
    const existing = fallbackProjects.findIndex(p => p.id === project.id);
    if (existing >= 0) {
      fallbackProjects[existing] = project;
    } else {
      fallbackProjects.push(project);
    }
    return;
  }

  try {
    const projectKey = `project:${project.id}`;
    await redis.hSet(projectKey, {
      id: project.id.toString(),
      name: project.name,
      tagline: project.tagline || '',
      description: project.description || '',
      builder: project.builder || '',
      builderFid: (project.builderFid || 0).toString(),
      tokenName: project.tokenName || '',
      tokenContractAddress: project.tokenContractAddress || '',
      category: project.category || 'main',
      status: project.status || 'queued',
      submittedAt: project.submittedAt || new Date().toISOString(),
      featuredAt: project.featuredAt || '',
      stats: JSON.stringify(project.stats || { views: 0, clicks: 0, tips: 0 }),
      links: JSON.stringify(project.links || {}),
    });
    
    await redis.sAdd(PROJECTS_KEY, project.id.toString());
    
    if (project.status === 'featured') {
      await redis.set(FEATURED_KEY, project.id.toString());
    }
  } catch (error) {
    console.error('Error saving project to Redis:', error);
  }
}

/**
 * Get all submissions from Redis
 */
export async function getAllSubmissionsFromRedis() {
  const redis = await getRedisClient();
  
  if (!redis) {
    return fallbackSubmissions;
  }

  try {
    const submissionIds = await redis.sMembers(SUBMISSIONS_KEY);
    if (submissionIds.length === 0) {
      return [];
    }

    const submissions = await Promise.all(
      submissionIds.map(async (id) => {
        const data = await redis.hGetAll(`submission:${id}`);
        if (!data || Object.keys(data).length === 0) return null;
        return {
          id: parseInt(data.id),
          name: data.name,
          tagline: data.tagline,
          description: data.description,
          builder: data.builder,
          builderFid: parseInt(data.builderFid) || 0,
          tokenName: data.tokenName || '',
          tokenContractAddress: data.tokenContractAddress || '',
          category: data.category,
          status: data.status,
          submissionType: data.submissionType,
          paymentAmount: parseFloat(data.paymentAmount) || 0,
          paymentTxHash: data.paymentTxHash || null,
          paymentTimestamp: data.paymentTimestamp || null,
          submitterWalletAddress: data.submitterWalletAddress || null,
          plannedGoLiveDate: data.plannedGoLiveDate || null,
          refunded: data.refunded === 'true',
          refundTxHash: data.refundTxHash || null,
          submittedAt: data.submittedAt,
          links: data.links ? JSON.parse(data.links) : {},
        };
      })
    );

    return submissions.filter(Boolean).sort((a, b) => 
      new Date(b.submittedAt) - new Date(a.submittedAt)
    );
  } catch (error) {
    console.error('Error fetching submissions from Redis:', error);
    return fallbackSubmissions;
  }
}

/**
 * Save submission to Redis
 */
async function saveSubmissionToRedis(submission) {
  const redis = await getRedisClient();
  
  if (!redis) {
    fallbackSubmissions.push(submission);
    return;
  }

  try {
    const submissionKey = `submission:${submission.id}`;
    await redis.hSet(submissionKey, {
      id: submission.id.toString(),
      name: submission.name,
      tagline: submission.tagline || '',
      description: submission.description || '',
      builder: submission.builder || '',
      builderFid: (submission.builderFid || 0).toString(),
      tokenName: submission.tokenName || '',
      tokenContractAddress: submission.tokenContractAddress || '',
      category: submission.category || 'main',
      status: submission.status || 'pending',
      submissionType: submission.submissionType || 'queue',
      paymentAmount: (submission.paymentAmount || 0).toString(),
      paymentTxHash: submission.paymentTxHash || '',
      paymentTimestamp: submission.paymentTimestamp || '',
      submitterWalletAddress: submission.submitterWalletAddress || '',
      plannedGoLiveDate: submission.plannedGoLiveDate || '',
      refunded: (submission.refunded || false).toString(),
      refundTxHash: submission.refundTxHash || '',
      submittedAt: submission.submittedAt || new Date().toISOString(),
      links: JSON.stringify(submission.links || {}),
    });
    
    await redis.sAdd(SUBMISSIONS_KEY, submission.id.toString());
  } catch (error) {
    console.error('Error saving submission to Redis:', error);
    fallbackSubmissions.push(submission);
  }
}

/**
 * Remove submission from Redis
 */
async function removeSubmissionFromRedis(submissionId) {
  const redis = await getRedisClient();
  
  if (!redis) {
    fallbackSubmissions = fallbackSubmissions.filter(s => s.id !== submissionId);
    return;
  }

  try {
    await redis.del(`submission:${submissionId}`);
    await redis.sRem(SUBMISSIONS_KEY, submissionId.toString());
  } catch (error) {
    console.error('Error removing submission from Redis:', error);
    fallbackSubmissions = fallbackSubmissions.filter(s => s.id !== submissionId);
  }
}

export async function getFeaturedProject() {
  // Check and process any scheduled projects that are due
  await processScheduledFeaturedProjects();
  
  const projects = await getAllProjectsFromRedis();
  const featured = projects.find(p => p.status === 'featured' && p.status !== 'archived');
  
  // If no featured project in Redis, initialize with fallback
  if (!featured && projects.length === 0) {
    const defaultProject = fallbackProjects[0];
    if (defaultProject) {
      await saveProjectToRedis(defaultProject);
      return defaultProject;
    }
  }
  
  return featured || projects.find(p => p.status !== 'archived') || null;
}

export async function getQueuedProjects() {
  const projects = await getAllProjectsFromRedis();
  return projects
    .filter(p => p.status === 'queued' && p.status !== 'archived')
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
    .slice(0, 10);
}

export async function getActiveProjects() {
  const projects = await getAllProjectsFromRedis();
  return projects
    .filter(p => p.status === 'active' && p.status !== 'archived')
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
}

export async function getAllProjects() {
  return await getAllProjectsFromRedis();
}

/**
 * Get top ranked projects by category
 * @param {string} category - Category to filter by
 * @param {number} limit - Number of projects to return (default: 10)
 * @returns {Promise<Array>} - Sorted array of projects by engagement score
 */
export async function getRankedProjectsByCategory(category, limit = 10) {
  const projects = await getAllProjectsFromRedis();
  
  // Filter by category and status (only show active, queued, or featured projects, excluding archived)
  const categoryProjects = projects.filter(p => 
    p.category === category && 
    (p.status === 'active' || p.status === 'queued' || p.status === 'featured') &&
    p.status !== 'archived'
  );

  // Calculate engagement score for each project
  const projectsWithScores = await Promise.all(
    categoryProjects.map(async (project) => {
      const todayStats = await getProjectStatsToday(project.id, project.status === 'featured' ? project.featuredAt : null);
      
      // Engagement score formula: (views * 1) + (clicks * 3) + (tips * 100)
      // This weights clicks and tips more heavily
      const engagementScore = 
        (todayStats.views || project.stats?.views || 0) * 1 +
        (todayStats.clicks || project.stats?.clicks || 0) * 3 +
        (project.stats?.tips || 0) * 100;
      
      return {
        ...project,
        engagementScore,
        todayViews: todayStats.views || 0,
        todayClicks: todayStats.clicks || 0,
      };
    })
  );

  // Sort by engagement score (descending)
  const ranked = projectsWithScores.sort((a, b) => b.engagementScore - a.engagementScore);
  
  // Add ranking position
  return ranked.slice(0, limit).map((project, index) => ({
    ...project,
    rank: index + 1,
    previousRank: null, // Will be set by tracking system
  }));
}

/**
 * Get all categories with their top projects
 * @param {number} limit - Number of projects per category (default: 10)
 * @returns {Promise<Object>} - Object with category as key and ranked projects as value
 */
export async function getAllCategoryRankings(limit = 10) {
  const categories = ['main', 'defi', 'social', 'games', 'tools', 'nft', 'tokens'];
  const rankings = {};
  
  for (const category of categories) {
    rankings[category] = await getRankedProjectsByCategory(category, limit);
  }
  
  return rankings;
}

export async function getProjectById(id) {
  const projects = await getAllProjectsFromRedis();
  return projects.find(p => p.id === id);
}

export async function submitProject(projectData) {
  const { submissionType, paymentAmount, paymentTxHash, paymentTimestamp, submitterWalletAddress, plannedGoLiveDate, ...rest } = projectData;
  
  const newProject = {
    id: Date.now(),
    ...rest,
    submissionType: submissionType || 'queue',
    tokenName: projectData.tokenName || '',
    tokenContractAddress: projectData.tokenContractAddress || '',
    paymentAmount: paymentAmount || 0,
    paymentTxHash: paymentTxHash || null,
    paymentTimestamp: paymentTimestamp || null,
    submitterWalletAddress: submitterWalletAddress || null,
    plannedGoLiveDate: plannedGoLiveDate || null,
    refunded: false,
    refundTxHash: null,
    status: submissionType === 'featured' && paymentAmount > 0 
      ? (paymentTxHash ? 'pending' : 'pending_payment') 
      : 'pending',
    submittedAt: new Date().toISOString(),
    stats: {
      views: 0,
      clicks: 0,
      tips: 0,
    }
  };
  
  await saveSubmissionToRedis(newProject);
  return newProject;
}

export async function approveProject(projectId) {
  // Convert projectId to number if it's a string
  const id = typeof projectId === 'string' ? parseInt(projectId) : projectId;
  
  const submissions = await getAllSubmissionsFromRedis();
  const submission = submissions.find(s => s.id === id || String(s.id) === String(id));
  
  if (!submission) {
    console.error('Submission not found for projectId:', projectId, 'converted:', id);
    return null;
  }
  
  console.log('Approving submission:', submission.id, submission.name);
  
  // Update status to active (approved and live)
  submission.status = 'active';
  
  // Move to projects
  await saveProjectToRedis(submission);
  
  // Remove from submissions
  await removeSubmissionFromRedis(id);
  
  return submission;
}

export async function verifyPayment(projectId, paymentTxHash) {
  const submissions = await getAllSubmissionsFromRedis();
  const submission = submissions.find(s => s.id === projectId);
  
  if (!submission) return null;
  
  submission.paymentVerified = true;
  submission.paymentTxHash = paymentTxHash;
  submission.status = 'pending';
  
  await saveSubmissionToRedis(submission);
  
  return submission;
}

export async function setFeaturedProject(projectId) {
  const projects = await getAllProjectsFromRedis();
  
  // Move current featured to queued
  const currentFeatured = projects.find(p => p.status === 'featured');
  if (currentFeatured) {
    currentFeatured.status = 'queued';
    await saveProjectToRedis(currentFeatured);
  }
  
  // Set new featured
  const newFeatured = projects.find(p => p.id === projectId);
  if (newFeatured) {
    newFeatured.status = 'featured';
    // Only set featuredAt if it doesn't exist - preserves stats across rotations
    // Admin can manually reset featuredAt via update-project API when needed
    if (!newFeatured.featuredAt) {
      newFeatured.featuredAt = new Date().toISOString();
    }
    await saveProjectToRedis(newFeatured);
  }
  
  return newFeatured;
}

export async function getPendingSubmissions() {
  return await getAllSubmissionsFromRedis();
}

export async function rejectProject(projectId) {
  // Get the submission first before removing it
  const submissions = await getAllSubmissionsFromRedis();
  const id = typeof projectId === 'string' ? parseInt(projectId) : projectId;
  const submission = submissions.find(s => s.id === id || String(s.id) === String(projectId));
  
  if (!submission) {
    return null;
  }
  
  // Now remove it
  await removeSubmissionFromRedis(projectId);
  return submission;
}

/**
 * Check if a user (FID) has paid for featured in the last 24 hours
 * @param {number} fid - Farcaster ID
 * @returns {Promise<{ allowed: boolean, lastPayment?: number, hoursRemaining?: number }>}
 */
export async function checkFeaturedPaymentCooldown(fid) {
  const redis = await getRedisClient();
  
  if (!redis || !fid) {
    return { allowed: true }; // Allow if Redis unavailable
  }

  try {
    const paymentKey = `payment:featured:${fid}`;
    const lastPayment = await redis.get(paymentKey);
    
    if (!lastPayment) {
      return { allowed: true };
    }

    const lastPaymentTime = parseInt(lastPayment);
    const now = Date.now();
    const hoursSincePayment = (now - lastPaymentTime) / (1000 * 60 * 60);
    const hoursRemaining = 24 - hoursSincePayment;

    if (hoursSincePayment < 24) {
      return {
        allowed: false,
        lastPayment: lastPaymentTime,
        hoursRemaining: Math.ceil(hoursRemaining),
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking payment cooldown:', error);
    return { allowed: true }; // Fail open
  }
}

/**
 * Record a featured payment for a user (FID)
 * @param {number} fid - Farcaster ID
 * @param {string} txHash - Transaction hash (optional)
 * @returns {Promise<boolean>}
 */
export async function recordFeaturedPayment(fid, txHash = null) {
  const redis = await getRedisClient();
  
  if (!redis || !fid) {
    return false;
  }

  try {
    const paymentKey = `payment:featured:${fid}`;
    const paymentData = {
      timestamp: Date.now().toString(),
      txHash: txHash || '',
    };
    
    // Store payment timestamp (expires in 25 hours to be safe)
    await redis.setEx(paymentKey, 25 * 60 * 60, Date.now().toString());
    
    // Also store full payment record if txHash provided
    if (txHash) {
      await redis.hSet(`payment:record:${fid}:${txHash}`, paymentData);
    }
    
    return true;
  } catch (error) {
    console.error('Error recording payment:', error);
    return false;
  }
}

/**
 * Approve and immediately feature a project
 * @param {number} projectId - Project ID
 * @returns {Promise<Object|null>}
 */
export async function approveAndFeatureProject(projectId) {
  const submissions = await getAllSubmissionsFromRedis();
  const submission = submissions.find(s => s.id === projectId);
  
  if (!submission) return null;
  
  // Update status to featured
  submission.status = 'featured';
  submission.featuredAt = new Date().toISOString();
  
  // Move to projects
  await saveProjectToRedis(submission);
  
  // Remove from submissions
  await removeSubmissionFromRedis(projectId);
  
  // If there's a current featured project, move it to queued
  const projects = await getAllProjectsFromRedis();
  const currentFeatured = projects.find(p => p.status === 'featured' && p.id !== projectId);
  if (currentFeatured) {
    currentFeatured.status = 'queued';
    await saveProjectToRedis(currentFeatured);
  }
  
  return submission;
}

/**
 * Schedule a project to be featured at a specific date/time
 * @param {number} projectId - Project ID to schedule
 * @param {string} scheduledDate - ISO date string for when to feature
 * @returns {Promise<Object>}
 */
export async function scheduleFeaturedProject(projectId, scheduledDate) {
  const redis = await getRedisClient();
  if (!redis) {
    throw new Error('Redis not available');
  }

  const id = typeof projectId === 'string' ? parseInt(projectId) : projectId;
  const projects = await getAllProjectsFromRedis();
  const submissions = await getAllSubmissionsFromRedis();
  
  // Find project in either projects or submissions
  let project = projects.find(p => p.id === id || String(p.id) === String(id));
  if (!project) {
    project = submissions.find(s => s.id === id || String(s.id) === String(id));
  }
  
  if (!project) {
    return null;
  }

  // Store scheduled project info
  const scheduledKey = `scheduled:featured:${id}`;
  const scheduledTimestamp = new Date(scheduledDate).getTime();
  
  await redis.set(scheduledKey, JSON.stringify({
    projectId: id,
    scheduledDate,
    scheduledTimestamp,
  }));

  // If it's in submissions, approve it first (move to projects)
  if (project.status === 'pending' || project.status === 'pending_payment') {
    project.status = 'active';
    await saveProjectToRedis(project);
    await removeSubmissionFromRedis(id);
  }

  // Mark as scheduled (not featured yet)
  project.scheduledFor = scheduledDate;
  await saveProjectToRedis(project);

  return project;
}

/**
 * Check and auto-rotate scheduled featured projects
 * Call this periodically (e.g., via cron or API endpoint)
 * @returns {Promise<Array>} - Array of projects that were auto-featured
 */
export async function processScheduledFeaturedProjects() {
  const redis = await getRedisClient();
  if (!redis) {
    return [];
  }

  const now = Date.now();
  const projects = await getAllProjectsFromRedis();
  const featured = [];
  
  // Get all scheduled projects
  const scheduledKeys = await redis.keys('scheduled:featured:*');
  
  for (const key of scheduledKeys) {
    const data = await redis.get(key);
    if (!data) continue;
    
    const scheduled = JSON.parse(data);
    const scheduledTime = scheduled.scheduledTimestamp;
    
    // If scheduled time has passed, feature it
    if (scheduledTime <= now) {
      const projectId = scheduled.projectId;
      const project = projects.find(p => p.id === projectId);
      
      if (project && project.status !== 'featured') {
        // Move current featured to queued
        const currentFeatured = projects.find(p => p.status === 'featured');
        if (currentFeatured) {
          currentFeatured.status = 'queued';
          await saveProjectToRedis(currentFeatured);
        }
        
        // Feature the scheduled project
        project.status = 'featured';
        // Only set featuredAt if it doesn't exist - preserves stats
        if (!project.featuredAt) {
          project.featuredAt = new Date().toISOString();
        }
        delete project.scheduledFor;
        await saveProjectToRedis(project);
        
        // Remove from scheduled
        await redis.del(key);
        
        featured.push(project);
      }
    }
  }
  
  return featured;
}

/**
 * Create a project directly (admin only, bypasses submission queue)
 * @param {Object} projectData - Project data
 * @param {boolean} setAsFeatured - Whether to set as featured immediately
 * @returns {Promise<Object>}
 */
export async function createProjectDirectly(projectData, setAsFeatured = false) {
  const newProject = {
    id: Date.now(),
    name: projectData.name?.toUpperCase() || '',
    tagline: projectData.tagline?.toUpperCase() || '',
    description: projectData.description || '',
    builder: projectData.builder || '',
    builderFid: parseInt(projectData.builderFid) || 0,
    category: projectData.category?.toLowerCase() || 'main',
    status: setAsFeatured ? 'featured' : 'active',
    submittedAt: new Date().toISOString(),
    featuredAt: setAsFeatured ? new Date().toISOString() : null,
    stats: projectData.stats || {
      views: 0,
      clicks: 0,
      tips: 0,
    },
    links: projectData.links || {},
  };

  // If setting as featured, move current featured to queued
  if (setAsFeatured) {
    const projects = await getAllProjectsFromRedis();
    const currentFeatured = projects.find(p => p.status === 'featured');
    if (currentFeatured) {
      currentFeatured.status = 'queued';
      await saveProjectToRedis(currentFeatured);
    }
  }

  await saveProjectToRedis(newProject);
  return newProject;
}

/**
 * Get today's stats for a project (views, clicks)
 * @param {number} projectId - Project ID
 * @returns {Promise<{ views: number, clicks: number }>}
 */
export async function getProjectStatsToday(projectId, featuredAt = null) {
  const redis = await getRedisClient();
  
  if (!redis) {
    return { views: 0, clicks: 0 };
  }

  try {
    // For featured projects, use 24-hour window from featuredAt instead of calendar date
    // This ensures stats reset after 24 hours, not at midnight
    let windowKey;
    if (featuredAt) {
      const featuredDate = new Date(featuredAt);
      const windowStart = Math.floor(featuredDate.getTime() / 1000);
      // Use the window start timestamp as the key identifier
      windowKey = windowStart.toString();
    } else {
      // For non-featured projects, use calendar date (backward compatibility)
      windowKey = new Date().toISOString().split('T')[0];
    }
    
    const viewsKey = `views:project:${projectId}:${windowKey}`;
    const clicksKey = `clicks:project:${projectId}:${windowKey}`;
    
    const views = await redis.get(viewsKey);
    const clicks = await redis.get(clicksKey);
    
    return {
      views: parseInt(views) || 0,
      clicks: parseInt(clicks) || 0,
    };
  } catch (error) {
    console.error('Error getting project stats:', error);
    return { views: 0, clicks: 0 };
  }
}

/**
 * Update project stats in Redis (merge with existing stats)
 * @param {number} projectId - Project ID
 * @param {Object} statsUpdate - Stats to update
 * @returns {Promise<boolean>}
 */
export async function updateProjectStats(projectId, statsUpdate) {
  const redis = await getRedisClient();
  
  if (!redis) {
    return false;
  }

  try {
    const project = await getProjectById(projectId);
    if (!project) {
      return false;
    }

    // Merge with existing stats
    const updatedStats = {
      ...project.stats,
      ...statsUpdate,
    };

    project.stats = updatedStats;
    await saveProjectToRedis(project);
    
    return true;
  } catch (error) {
    console.error('Error updating project stats:', error);
    return false;
  }
}

/**
 * Update an existing project (admin only)
 * @param {number} projectId - Project ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object|null>}
 */
export async function updateProject(projectId, updateData) {
  const project = await getProjectById(projectId);
  
  if (!project) {
    return null;
  }

  // Merge update data with existing project
  const updatedProject = {
    ...project,
    name: updateData.name !== undefined ? updateData.name.toUpperCase() : project.name,
    tagline: updateData.tagline !== undefined ? updateData.tagline.toUpperCase() : project.tagline,
    description: updateData.description !== undefined ? updateData.description : project.description,
    builder: updateData.builder !== undefined ? updateData.builder : project.builder,
    builderFid: updateData.builderFid !== undefined ? parseInt(updateData.builderFid) || 0 : project.builderFid,
    tokenName: updateData.tokenName !== undefined ? updateData.tokenName : project.tokenName,
    tokenContractAddress: updateData.tokenContractAddress !== undefined ? (updateData.tokenContractAddress.trim() || '') : project.tokenContractAddress,
    category: updateData.category !== undefined ? updateData.category.toLowerCase() : project.category,
    status: updateData.status !== undefined ? updateData.status : project.status,
    links: updateData.links !== undefined ? { ...project.links, ...updateData.links } : project.links,
    stats: updateData.stats !== undefined ? { ...project.stats, ...updateData.stats } : project.stats,
    featuredAt: updateData.featuredAt !== undefined ? updateData.featuredAt : project.featuredAt,
  };

  // If status changed to featured, handle featured rotation
  if (updateData.status === 'featured' && project.status !== 'featured') {
    const projects = await getAllProjectsFromRedis();
    const currentFeatured = projects.find(p => p.status === 'featured' && p.id !== projectId);
    if (currentFeatured) {
      currentFeatured.status = 'queued';
      await saveProjectToRedis(currentFeatured);
    }
    // Only set featuredAt if it doesn't exist - preserves stats
    if (!updatedProject.featuredAt) {
      updatedProject.featuredAt = new Date().toISOString();
    }
  }

  // If status changed to archived and it was featured, move next active/queued to featured
  if (updateData.status === 'archived' && project.status === 'featured') {
    const projects = await getAllProjectsFromRedis();
    const nextActive = projects.find(p => (p.status === 'active' || p.status === 'queued') && p.id !== projectId);
    if (nextActive) {
      nextActive.status = 'featured';
      // Only set featuredAt if it doesn't exist - preserves stats
      if (!nextActive.featuredAt) {
        nextActive.featuredAt = new Date().toISOString();
      }
      await saveProjectToRedis(nextActive);
    }
  }

  await saveProjectToRedis(updatedProject);
  return updatedProject;
}
