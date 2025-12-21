// Create a new battle (admin only)
import { createBattle, getCurrentBattle } from '../../../lib/battles';
import { getActiveProjects } from '../../../lib/projects';
import { isAuthenticated } from '../../../lib/admin-auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin only
  const isAdmin = await isAuthenticated(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Unauthorized - admin only' });
  }

  try {
    // Check if there's already an active battle
    const currentBattle = await getCurrentBattle();
    if (currentBattle && currentBattle.status === 'active') {
      const endTime = new Date(currentBattle.endTime);
      const now = new Date();
      if (endTime > now) {
        return res.status(400).json({
          error: 'Active battle already exists',
          currentBattle,
        });
      }
    }

    // Get two random active projects
    const activeProjects = await getActiveProjects();

    if (!activeProjects || activeProjects.length < 2) {
      return res.status(400).json({
        error: 'Not enough active projects to create a battle',
        required: 2,
        available: activeProjects?.length || 0,
      });
    }

    // Check if specific projects were requested
    const { projectAId, projectBId } = req.body;

    let projectA, projectB;

    if (projectAId && projectBId) {
      // Use specified projects
      projectA = activeProjects.find(p => p.id === parseInt(projectAId));
      projectB = activeProjects.find(p => p.id === parseInt(projectBId));

      if (!projectA || !projectB) {
        return res.status(400).json({
          error: 'One or both specified projects not found',
        });
      }

      if (projectA.id === projectB.id) {
        return res.status(400).json({
          error: 'Cannot create battle with same project',
        });
      }
    } else {
      // Select two random projects
      const shuffled = [...activeProjects].sort(() => Math.random() - 0.5);
      projectA = shuffled[0];
      projectB = shuffled[1];
    }

    // Create the battle
    const battle = await createBattle(projectA, projectB);

    return res.status(200).json({
      success: true,
      message: 'Battle created successfully',
      battle,
    });

  } catch (error) {
    console.error('[BATTLE] Error creating battle:', error);
    return res.status(500).json({
      error: 'Failed to create battle',
      details: error.message,
    });
  }
}
