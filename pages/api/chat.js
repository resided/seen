// API route for chat messages
import { getChatMessages, getChatMessagesSince, addChatMessage } from '../../lib/chat'
import { validateMessage } from '../../lib/content-filter'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Fetch messages
    const { since } = req.query;
    
    // Rate limiting: 60 requests per IP per minute
    const { checkRateLimit, getClientIP } = await import('../../lib/rate-limit');
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(`chat:get:${clientIP}`, 60, 60000);
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Too many requests. Please slow down.',
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      });
    }
    
    try {
      let messages;
      if (since) {
        // Get messages since a specific timestamp (for polling)
        // since can be ISO timestamp string or number - getChatMessagesSince handles both
        messages = await getChatMessagesSince(since);
      } else {
        // Get all messages
        messages = await getChatMessages(100);
      }
      
      res.status(200).json({
        messages,
        count: messages.length,
      });
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  } else if (req.method === 'POST') {
    // Rate limiting: 10 messages per IP per minute
    const { checkRateLimit, getClientIP } = await import('../../lib/rate-limit');
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(`chat:post:${clientIP}`, 10, 60000);
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Too many messages. Please slow down.',
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      });
    }

    // Send a new message
    try {
      const { msg, user, username, fid, verified } = req.body;
      
      // Validate fid if provided
      if (fid !== undefined && fid !== null) {
        const fidNum = parseInt(fid);
        if (isNaN(fidNum) || fidNum <= 0) {
          return res.status(400).json({ error: 'Invalid FID' });
        }
      }
      
      // Validate required fields
      if (!msg || !msg.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      // Validate message length
      if (msg.length > 100) {
        return res.status(400).json({ error: 'Message too long (max 100 characters)' });
      }
      
      // Content moderation - check for profanity and links
      const validation = validateMessage(msg);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: validation.reason || 'Message contains blocked content' 
        });
      }
      
      const newMessage = await addChatMessage({
        msg: msg.trim(),
        user: (user && typeof user === 'string' && user.length <= 50) ? user.substring(0, 50) : 'ANON',
        username: (username && typeof username === 'string' && username.length <= 50) ? username.substring(0, 50) : null,
        fid: fid ? parseInt(fid) : 0,
        verified: verified === true,
      });
      
      res.status(201).json({
        success: true,
        message: newMessage,
      });
    } catch (error) {
      console.error('Error sending chat message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
