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

// Non-streaming API route
app.post('/api/ask', async (req, res) => {
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
        'anthropic-version': '2023-06-01'
      },
      data: {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        messages: apiMessages,
        system: "You are Arlo, a helpful coding assistant with extended thinking capabilities. Provide detailed, accurate responses to programming questions. I prefer complete code I can copy and paste. I want exact answers, nothing made up. I want enterprise patterns that protect against all vulnerabilities. I always want correct error handling and semantic comments with usage examples."
      }
    });

    // Return the response to the client
    res.json(response.data);
  } catch (error) {
    console.error('Error:', error.message);

    // Log detailed error if available
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);

      // Extract error message safely
      let errorMessage = 'API Error: ' + error.response.status;

      try {
        if (typeof error.response.data === 'string') {
          errorMessage += ' - ' + error.response.data;
        } else if (error.response.data && error.response.data.error) {
          errorMessage += ' - ' + error.response.data.error;
        }
      } catch (e) {
        console.error('Error extracting response data:', e.message);
      }

      res.status(error.response.status).json({ error: errorMessage });
    } else {
      res.status(500).json({ error: error.message });
    }
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