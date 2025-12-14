// API route to get treasury address (public, no auth needed)
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get treasury address from environment variable
    const treasuryAddress = process.env.TREASURY_ADDRESS;
    
    if (!treasuryAddress) {
      return res.status(500).json({ 
        error: 'Treasury address not configured' 
      });
    }

    return res.status(200).json({
      treasuryAddress,
    });
  } catch (error) {
    console.error('Error fetching treasury address:', error);
    return res.status(500).json({ error: 'Failed to fetch treasury address' });
  }
}
