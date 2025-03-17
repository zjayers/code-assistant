// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from 'public' directory

// Streaming API route
app.post('/api/ask', async (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { question, history = [] } = req.body;

    // Format messages for the API
    let apiMessages = [];

    // Include chat history if available
    if (history.length) {
      apiMessages = history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    }

    // Add the new user question
    if (!history.length || history[history.length - 1].role !== 'user') {
      apiMessages.push({
        role: 'user',
        content: question
      });
    }

    // Setup axios request
    const response = await axios({
      method: 'post',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-01-01'
      },
      data: {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        stream: true,
        thinking: {
          type: "enabled",
          budget_tokens: 2000
        },
        messages: apiMessages,
        system: "You are Arlo, a helpful coding assistant with extended thinking capabilities. Provide detailed, accurate responses to programming questions. I prefer complete code I can copy and paste. I want exact answers, nothing made up. I want enterprise patterns that protect against all vulnerabilities. I always want correct error handling and semantic comments with usage examples."
      },
      responseType: 'stream'
    });

    // Handle the stream
    response.data.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      const lines = chunkStr.split('\n\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            res.write(`data: [DONE]\n\n`);
            continue;
          }

          try {
            const parsedData = JSON.parse(data);

            // Send different types of events based on content
            if (parsedData.type === 'content_block_start' && parsedData.content_block.type === 'thinking') {
              res.write(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`);
            } else if (parsedData.type === 'content_block_delta' && parsedData.delta.type === 'thinking_delta') {
              res.write(`data: ${JSON.stringify({
                type: 'thinking_delta',
                content: parsedData.delta.thinking
              })}\n\n`);
            } else if (parsedData.type === 'content_block_delta' && parsedData.delta.type === 'text_delta') {
              res.write(`data: ${JSON.stringify({
                type: 'text_delta',
                content: parsedData.delta.text
              })}\n\n`);
            } else if (parsedData.type === 'content_block_stop' && parsedData.content_block.type === 'thinking') {
              res.write(`data: ${JSON.stringify({ type: 'thinking_stop' })}\n\n`);
            } else if (parsedData.type === 'message_stop') {
              res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
            }
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
        }
      }
    });

    response.data.on('end', () => {
      res.end();
    });

    response.data.on('error', (error) => {
      console.error('Stream error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});