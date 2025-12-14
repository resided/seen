// Simple in-memory storage for projects
// In production, replace with a database (Vercel KV, Supabase, etc.)

let projects = [
  {
    id: 1,
    name: 'ZORA',
    tagline: 'MINT AND COLLECT ONCHAIN MEDIA',
    description: 'The easiest way to create, collect, and earn onchain. Mint NFTs, create splits, and build your collector base directly from Farcaster.',
    builder: 'JACOB.ETH',
    builderFid: 8,
    category: 'nft',
    launchDate: 'DEC 13, 2025',
    status: 'featured', // 'featured', 'queued', 'pending'
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

let submissions = []; // Pending submissions awaiting approval

export function getFeaturedProject() {
  return projects.find(p => p.status === 'featured') || projects[0];
}

export function getQueuedProjects() {
  return projects
    .filter(p => p.status === 'queued')
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
    .slice(0, 10);
}

export function getAllProjects() {
  return projects;
}

export function getProjectById(id) {
  return projects.find(p => p.id === id);
}

export function submitProject(projectData) {
  const { submissionType, paymentAmount, ...rest } = projectData;
  
  const newProject = {
    id: Date.now(),
    ...rest,
    submissionType: submissionType || 'queue', // 'queue' (free) or 'featured' (paid)
    paymentAmount: paymentAmount || 0,
    status: submissionType === 'featured' && paymentAmount > 0 ? 'pending_payment' : 'pending',
    submittedAt: new Date().toISOString(),
    stats: {
      installs: 0,
      dau: 0,
      tips: 0,
    }
  };
  
  submissions.push(newProject);
  return newProject;
}

export function approveProject(projectId) {
  const submission = submissions.find(s => s.id === projectId);
  if (!submission) return null;
  
  // If it's a paid featured submission, verify payment first
  if (submission.submissionType === 'featured' && submission.paymentAmount > 0) {
    // Payment verification would happen here
    // For now, just move to queued
    submission.status = 'queued';
  } else {
    submission.status = 'queued';
  }
  
  projects.push(submission);
  submissions = submissions.filter(s => s.id !== projectId);
  
  return submission;
}

export function verifyPayment(projectId, paymentTxHash) {
  const submission = submissions.find(s => s.id === projectId);
  if (!submission) return null;
  
  // Verify payment transaction
  // For now, just mark as paid
  submission.paymentVerified = true;
  submission.paymentTxHash = paymentTxHash;
  submission.status = 'pending'; // Ready for approval
  
  return submission;
}

export function setFeaturedProject(projectId) {
  // Move current featured to queued
  const currentFeatured = projects.find(p => p.status === 'featured');
  if (currentFeatured) {
    currentFeatured.status = 'queued';
  }
  
  // Set new featured
  const newFeatured = projects.find(p => p.id === projectId);
  if (newFeatured) {
    newFeatured.status = 'featured';
    newFeatured.featuredAt = new Date().toISOString();
  }
  
  return newFeatured;
}

export function getPendingSubmissions() {
  return submissions;
}

