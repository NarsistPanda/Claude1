import express, { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { N8nAgentBridge } from './n8n-bridge.js';
import { AGUIEventEncoder } from './encoder.js';
import { RunAgentInput } from './types.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration for CopilotKit frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Main AG-UI compatible endpoint for n8n agents
app.post('/api/agent', async (req: Request, res: Response) => {
  const acceptHeader = req.headers.accept || 'text/event-stream';
  const encoder = new AGUIEventEncoder(acceptHeader);

  // Parse and validate input
  const input: RunAgentInput = {
    threadId: req.body.threadId || uuidv4(),
    runId: req.body.runId || uuidv4(),
    messages: req.body.messages || [],
    tools: req.body.tools || [],
    context: req.body.context || [],
    forwardedProps: req.body.forwardedProps || {},
    state: req.body.state
  };

  // Get n8n webhook URL from request or environment
  const n8nWebhookUrl = req.body.forwardedProps?.n8nWebhookUrl ||
                        process.env.N8N_WEBHOOK_URL;

  if (!n8nWebhookUrl) {
    res.status(400).json({
      error: 'n8n webhook URL not provided. Set N8N_WEBHOOK_URL env var or pass it in forwardedProps.n8nWebhookUrl'
    });
    return;
  }

  // Set up SSE response headers
  res.setHeader('Content-Type', encoder.getContentType());
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const bridge = new N8nAgentBridge(n8nWebhookUrl);

  try {
    // Stream events from n8n through our AG-UI encoder
    await bridge.streamToAGUI(input, encoder, res);
  } catch (error) {
    console.error('Error streaming from n8n:', error);
    const errorEvent = encoder.encodeError(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
    res.write(errorEvent);
  } finally {
    res.end();
  }
});

// Endpoint to list available n8n agent workflows (optional)
app.get('/api/agents', async (_req: Request, res: Response) => {
  // This can be extended to discover n8n workflows
  // For now, return a static list based on environment config
  const agents = process.env.N8N_AGENTS ?
    JSON.parse(process.env.N8N_AGENTS) :
    [{
      id: 'default',
      name: 'Default Agent',
      url: process.env.N8N_WEBHOOK_URL
    }];

  res.json({ agents });
});

app.listen(port, () => {
  console.log(`🚀 AG-UI Bridge Server running on port ${port}`);
  console.log(`📡 Ready to connect n8n agents to CopilotKit`);
  if (process.env.N8N_WEBHOOK_URL) {
    console.log(`🔗 Default n8n webhook: ${process.env.N8N_WEBHOOK_URL}`);
  }
});

export { app };
