import { WebSocketServer } from 'ws';
import express from 'express';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Store active sessions and their connections
const sessions = new Map();

wss.on('connection', (ws) => {
  let sessionId = null;
  let userId = Math.random().toString(36).substring(2, 15);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'join':
          sessionId = data.sessionId;
          if (!sessions.has(sessionId)) {
            sessions.set(sessionId, new Map());
          }
          sessions.get(sessionId).set(userId, ws);
          
          // Send current document state to new user
          ws.send(JSON.stringify({
            type: 'init',
            content: data.content,
            title: data.title
          }));
          break;

        case 'update':
          if (sessionId && sessions.has(sessionId)) {
            // Broadcast changes to all users in the session except sender
            sessions.get(sessionId).forEach((client, clientId) => {
              if (clientId !== userId && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'update',
                  content: data.content,
                  title: data.title,
                  userId: userId
                }));
              }
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (sessionId && sessions.has(sessionId)) {
      sessions.get(sessionId).delete(userId);
      if (sessions.get(sessionId).size === 0) {
        sessions.delete(sessionId);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
});