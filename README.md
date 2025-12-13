# n8n Agent Chat UI

A complete chat interface for n8n AI agents using the AG-UI protocol and CopilotKit.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   React App     │────▶│  AG-UI Bridge   │────▶│  n8n Workflow   │
│  (CopilotKit)   │◀────│    Server       │◀────│   (AI Agent)    │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Port 3000              Port 3001            Your n8n instance
```

- **React App**: CopilotKit-powered chat interface
- **AG-UI Bridge Server**: Translates between AG-UI protocol and n8n webhooks
- **n8n Workflow**: Your AI agent workflow with webhook trigger

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- An n8n instance with an AI Agent workflow

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure n8n Webhook

1. Create a new workflow in n8n with:
   - **Webhook** trigger node (set Response Mode to "Streaming" for best results)
   - **AI Agent** node connected to your preferred LLM
   - **Respond to Webhook** node to return the response

2. Copy the webhook URL from n8n (e.g., `https://your-n8n.com/webhook/xxxx`)

3. Create `.env` file in `packages/server/`:

```bash
cp packages/server/.env.example packages/server/.env
```

4. Edit `.env` and set your webhook URL:

```env
N8N_WEBHOOK_URL=https://your-n8n.com/webhook/xxxx
```

### 3. Start Development Servers

```bash
npm run dev
```

This starts:
- AG-UI Bridge Server on `http://localhost:3001`
- React App on `http://localhost:3000`

### 4. Chat with Your Agent

Open `http://localhost:3000` and start chatting!

## n8n Workflow Setup

### Basic AI Agent Workflow

```
[Webhook] → [AI Agent] → [Respond to Webhook]
```

#### Webhook Node Configuration
- **HTTP Method**: POST
- **Response Mode**: "Using 'Respond to Webhook' node" (for streaming, select "Streaming")
- **Path**: Choose your webhook path

#### AI Agent Node Configuration
- Connect to your preferred LLM (OpenAI, Anthropic, etc.)
- Add any tools/functions you want the agent to use
- Configure system prompt

#### Respond to Webhook Node
- **Response Mode**: "Using 'Respond to Webhook' node"
- Connect the AI Agent output

### Enabling Streaming

For real-time streaming responses:

1. In the **Webhook** node, enable "Streaming Response"
2. In the **AI Agent** node, ensure streaming is enabled
3. Make sure your n8n version is 1.106.3 or higher

### Sample Workflow JSON

Import this into n8n to get started quickly:

```json
{
  "name": "AI Agent Chat",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "agent-chat",
        "responseMode": "responseNode",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "webhookId": "agent-chat"
    },
    {
      "parameters": {
        "options": {}
      },
      "name": "AI Agent",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "position": [470, 300]
    },
    {
      "parameters": {
        "respondWith": "text",
        "responseBody": "={{ $json.output }}"
      },
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "position": [690, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{"node": "AI Agent", "type": "main", "index": 0}]]
    },
    "AI Agent": {
      "main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]
    }
  }
}
```

## Configuration Options

### Server Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `N8N_WEBHOOK_URL` | n8n webhook URL | Required |
| `N8N_AGENTS` | JSON array of multiple agents | Optional |

### Client Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_AGENT_URL` | AG-UI bridge endpoint | `/api/agent` |

### Multiple Agents

To configure multiple n8n agents:

```env
N8N_AGENTS=[
  {"id":"research","name":"Research Agent","url":"https://n8n.example.com/webhook/research"},
  {"id":"code","name":"Code Assistant","url":"https://n8n.example.com/webhook/code"},
  {"id":"data","name":"Data Analyst","url":"https://n8n.example.com/webhook/data"}
]
```

## AG-UI Protocol Events

The bridge server implements these AG-UI events:

| Event | Description |
|-------|-------------|
| `RUN_STARTED` | Agent execution begins |
| `RUN_FINISHED` | Agent execution completes |
| `RUN_ERROR` | Error occurred |
| `TEXT_MESSAGE_START` | New message begins |
| `TEXT_MESSAGE_CONTENT` | Message content chunk |
| `TEXT_MESSAGE_END` | Message complete |
| `TOOL_CALL_*` | Tool invocation events |

## CopilotKit Features

This integration supports:

- **Streaming Chat**: Real-time response streaming
- **Message History**: Conversation context maintained
- **Custom Actions**: Frontend actions callable by agent
- **Readable Context**: Share app state with agent

## Project Structure

```
n8n-agent-chat-ui/
├── packages/
│   ├── server/           # AG-UI Bridge Server
│   │   ├── src/
│   │   │   ├── index.ts      # Express server
│   │   │   ├── n8n-bridge.ts # n8n webhook adapter
│   │   │   ├── encoder.ts    # AG-UI event encoder
│   │   │   └── types.ts      # TypeScript types
│   │   └── package.json
│   │
│   └── client/           # React Frontend
│       ├── src/
│       │   ├── App.tsx           # Main app with CopilotKit
│       │   ├── components/       # UI components
│       │   ├── providers/        # React context providers
│       │   └── hooks/            # Custom hooks
│       └── package.json
│
├── package.json          # Workspace root
└── README.md
```

## Development

### Build for Production

```bash
npm run build
```

### Run Production Build

```bash
npm start
```

## Troubleshooting

### "n8n webhook URL not provided"

Set the `N8N_WEBHOOK_URL` environment variable or pass it in the request body.

### No streaming response

1. Ensure n8n version is 1.106.3+
2. Enable streaming in both Webhook and AI Agent nodes
3. Check that "Respond to Webhook" is properly configured

### CORS errors

Update `FRONTEND_URL` in server `.env` to match your frontend URL.

## Resources

- [n8n AI Agent Documentation](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/)
- [n8n Streaming Documentation](https://docs.n8n.io/workflows/streaming/)
- [AG-UI Protocol](https://docs.ag-ui.com/introduction)
- [CopilotKit Documentation](https://docs.copilotkit.ai/)

## License

MIT
