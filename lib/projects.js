// Projects and submissions storage using Redis (with in-memory fallback)
import { getRedisClient } from './redis';

const PROJECTS_KEY = 'projects:all';
const SUBMISSIONS_KEY = 'submissions:pending';
const FEATURED_KEY = 'projects:featured';

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
      installs: 23847,
      dau: 4201,
      tips: 12.4,
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
          category: data.category,
          status: data.status,
          submittedAt: data.submittedAt,
          featuredAt: data.featuredAt,
          stats: data.stats ? JSON.parse(data.stats) : { installs: 0, dau: 0, tips: 0 },
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
      category: project.category || 'main',
      status: project.status || 'queued',
      submittedAt: project.submittedAt || new Date().toISOString(),
      featuredAt: project.featuredAt || '',
      stats: JSON.stringify(project.stats || { installs: 0, dau: 0, tips: 0 }),
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
async function getAllSubmissionsFromRedis() {
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
          category: data.category,
          status: data.status,
          submissionType: data.submissionType,
          paymentAmount: parseFloat(data.paymentAmount) || 0,
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
      category: submission.category || 'main',
      status: submission.status || 'pending',
      submissionType: submission.submissionType || 'queue',
      paymentAmount: (submission.paymentAmount || 0).toString(),
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
  const projects = await getAllProjectsFromRedis();
  const featured = projects.find(p => p.status === 'featured');
  
  // If no featured project in Redis, initialize with fallback
  if (!featured && projects.length === 0) {
    const defaultProject = fallbackProjects[0];
    if (defaultProject) {
      await saveProjectToRedis(defaultProject);
      return defaultProject;
    }
  }
  
  return featured || projects[0] || null;
}

export async function getQueuedProjects() {
  const projects = await getAllProjectsFromRedis();
  return projects
    .filter(p => p.status === 'queued')
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
    .slice(0, 10);
}

export async function getAllProjects() {
  return await getAllProjectsFromRedis();
}

export async function getProjectById(id) {
  const projects = await getAllProjectsFromRedis();
  return projects.find(p => p.id === id);
}

export async function submitProject(projectData) {
  const { submissionType, paymentAmount, ...rest } = projectData;
  
  const newProject = {
    id: Date.now(),
    ...rest,
    submissionType: submissionType || 'queue',
    paymentAmount: paymentAmount || 0,
    status: submissionType === 'featured' && paymentAmount > 0 ? 'pending_payment' : 'pending',
    submittedAt: new Date().toISOString(),
    stats: {
      installs: 0,
      dau: 0,
      tips: 0,
    }
  };
  
  await saveSubmissionToRedis(newProject);
  return newProject;
}

export async function approveProject(projectId) {
  const submissions = await getAllSubmissionsFromRedis();
  const submission = submissions.find(s => s.id === projectId);
  
  if (!submission) return null;
  
  // Update status
  if (submission.submissionType === 'featured' && submission.paymentAmount > 0) {
    submission.status = 'queued';
  } else {
    submission.status = 'queued';
  }
  
  // Move to projects
  await saveProjectToRedis(submission);
  
  // Remove from submissions
  await removeSubmissionFromRedis(projectId);
  
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
    newFeatured.featuredAt = new Date().toISOString();
    await saveProjectToRedis(newFeatured);
  }
  
  return newFeatured;
}

export async function getPendingSubmissions() {
  return await getAllSubmissionsFromRedis();
}

export async function rejectProject(projectId) {
  await removeSubmissionFromRedis(projectId);
  const submissions = await getAllSubmissionsFromRedis();
  return submissions.find(s => s.id === projectId) || null;
}
