// API route for chat messages
import { getChatMessages, getChatMessagesSince, addChatMessage } from '../../lib/chat'
import { validateMessage } from '../../lib/content-filter'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Fetch messages
    const { since } = req.query;
    
    try {
      let messages;
      if (since) {
        // Get messages since a specific timestamp (for polling)
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
    // Send a new message
    try {
      const { msg, user, username, fid, verified } = req.body;
      
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
        user: user || 'ANON',
        username: username || null,
        fid: fid || 0,
        verified: verified || false,
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
