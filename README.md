# n8n Agent Chat UI

A production-ready chat interface for n8n AI agents using the AG-UI protocol, CopilotKit, and advanced multi-agent orchestration with ReAct planning patterns.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Headless Agent Pattern](#headless-agent-pattern)
- [Middleware Bridge Architecture](#middleware-bridge-architecture)
- [Multi-Agent Orchestration](#multi-agent-orchestration)
- [Memory System](#memory-system)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)

---

## Architecture Overview

This system implements a sophisticated three-tier architecture that separates concerns between user interface, protocol translation, and agent orchestration:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   PRESENTATION LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                        React Application (Port 3000)                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │    │
│  │  │  CopilotKit  │  │   Execution  │  │   Planning   │  │    State     │     │    │
│  │  │   Sidebar    │  │   Timeline   │  │   Viewer     │  │   Inspector  │     │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │    │
│  │                              │                                                │    │
│  │                    ┌─────────▼─────────┐                                     │    │
│  │                    │   useAgentState   │  Real-time state subscription       │    │
│  │                    │   useToolStream   │  Tool execution streaming           │    │
│  │                    │   usePlanViewer   │  Plan progress tracking             │    │
│  │                    └───────────────────┘                                     │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ AG-UI Protocol (SSE)
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              MIDDLEWARE BRIDGE LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                    AG-UI Bridge Server (Port 3001)                           │    │
│  │                                                                               │    │
│  │  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐             │    │
│  │  │  Event Encoder │    │ Protocol Trans │    │  State Manager │             │    │
│  │  │                │    │                │    │                │             │    │
│  │  │ • RUN_STARTED  │    │ • HTTP → SSE   │    │ • Session Mgmt │             │    │
│  │  │ • TOOL_CALL_*  │    │ • JSON → AGUI  │    │ • Thread State │             │    │
│  │  │ • STATE_DELTA  │    │ • Streaming    │    │ • Persistence  │             │    │
│  │  │ • STEP_*       │    │                │    │                │             │    │
│  │  └────────────────┘    └────────────────┘    └────────────────┘             │    │
│  │                                                                               │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐    │    │
│  │  │                        n8n Bridge Adapter                            │    │    │
│  │  │  • Webhook request formatting    • Response stream parsing           │    │    │
│  │  │  • Tool call translation         • Error handling & recovery         │    │    │
│  │  │  • State synchronization         • Event multiplexing                │    │    │
│  │  └─────────────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ HTTP/Webhook + Streaming
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              AGENT ORCHESTRATION LAYER                               │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         n8n Workflow Engine                                   │    │
│  │                                                                               │    │
│  │    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐          │    │
│  │    │   PLANNING  │────────▶│   MANAGER   │────────▶│   QUALITY   │          │    │
│  │    │    AGENT    │         │    AGENT    │         │   CONTROL   │          │    │
│  │    └─────────────┘         └──────┬──────┘         └─────────────┘          │    │
│  │           │                       │                       │                  │    │
│  │           │                       ▼                       │                  │    │
│  │           │         ┌─────────────────────────┐          │                  │    │
│  │           │         │    AGENT-AS-A-TOOL      │          │                  │    │
│  │           │         │      TOOL AGENTS        │          │                  │    │
│  │           │         │  ┌─────┐ ┌─────┐ ┌─────┐│          │                  │    │
│  │           │         │  │Brows│ │Code │ │Rsrch││          │                  │    │
│  │           │         │  │ er  │ │Exec │ │ RAG ││          │                  │    │
│  │           │         │  └─────┘ └─────┘ └─────┘│          │                  │    │
│  │           │         └─────────────────────────┘          │                  │    │
│  │           │                       │                       │                  │    │
│  │           ▼                       ▼                       ▼                  │    │
│  │    ┌─────────────────────────────────────────────────────────────────┐      │    │
│  │    │                      MEMORY SYSTEM                               │      │    │
│  │    │  ┌──────────────────┐              ┌──────────────────┐         │      │    │
│  │    │  │   SHORT-TERM     │              │    LONG-TERM     │         │      │    │
│  │    │  │  (Window Buffer) │              │  (Vector Store)  │         │      │    │
│  │    │  │  • Recent turns  │              │  • Semantic RAG  │         │      │    │
│  │    │  │  • Working memory│              │  • Episodic      │         │      │    │
│  │    │  │  • Tool results  │              │  • Procedural    │         │      │    │
│  │    │  └──────────────────┘              └──────────────────┘         │      │    │
│  │    └─────────────────────────────────────────────────────────────────┘      │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Headless Agent Pattern

### What is the Headless Agent Pattern?

The **Headless Agent Pattern** is an architectural approach where the AI agent's logic and execution are completely decoupled from its user interface. The agent operates as a "headless" backend service that can be connected to any frontend through a standardized protocol.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HEADLESS AGENT PATTERN                                │
│                                                                              │
│   Traditional Approach:              Headless Pattern:                       │
│   ┌─────────────────┐               ┌─────────────────┐                     │
│   │  Tightly Coupled│               │   Any Frontend  │                     │
│   │   UI + Agent    │               │  (React, Vue,   │                     │
│   │                 │               │   Mobile, CLI)  │                     │
│   └─────────────────┘               └────────┬────────┘                     │
│          │                                   │                               │
│          │                          ┌────────▼────────┐                     │
│          │                          │   AG-UI Protocol│  ← Standardized     │
│          │                          │   (The "Neck")  │    Interface        │
│          │                          └────────┬────────┘                     │
│          │                                   │                               │
│          ▼                          ┌────────▼────────┐                     │
│   Single Platform                   │  Headless Agent │  ← Any Backend      │
│   Only                              │   (n8n, LangGraph│    Framework       │
│                                     │    CrewAI, etc) │                     │
│                                     └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Principles

#### 1. Protocol-First Design
The agent communicates exclusively through the AG-UI protocol, emitting standardized events:

```typescript
// Agent emits events, not UI updates
interface AgentEvents {
  RUN_STARTED:        { runId, threadId }
  STEP_STARTED:       { stepId, stepName }      // Planning step visibility
  TOOL_CALL_START:    { toolCallId, toolName }  // Tool execution begins
  TOOL_CALL_ARGS:     { toolCallId, delta }     // Streaming arguments
  TOOL_CALL_RESULT:   { toolCallId, result }    // Tool output
  STATE_DELTA:        { delta: JSONPatch[] }    // State changes
  TEXT_MESSAGE_CHUNK: { messageId, delta }      // Response streaming
  RUN_FINISHED:       { runId }
}
```

#### 2. State Externalization
All agent state is externalized and observable:

```typescript
interface AgentState {
  currentPhase: 'planning' | 'executing' | 'reviewing';
  plan: {
    steps: PlanStep[];
    currentStepIndex: number;
    completedSteps: string[];
  };
  toolExecutions: {
    active: ToolExecution[];
    completed: ToolExecution[];
  };
  memory: {
    shortTerm: Message[];
    workingContext: Record<string, unknown>;
  };
}
```

#### 3. UI Subscription Model
Frontends subscribe to state changes rather than polling:

```typescript
// React component subscribes to agent state
function ExecutionTimeline() {
  const { toolExecutions, currentPhase } = useAgentState();
  const toolStream = useToolStream();  // Real-time tool updates

  return (
    <Timeline>
      {toolExecutions.map(exec => (
        <ToolExecutionCard
          key={exec.id}
          status={exec.status}
          streaming={toolStream.activeId === exec.id}
        />
      ))}
    </Timeline>
  );
}
```

### Benefits in This Implementation

| Benefit | How It's Achieved |
|---------|-------------------|
| **Framework Agnostic** | n8n workflows can connect to any AG-UI compatible frontend |
| **Real-time Visibility** | Tool calls, planning steps, and state changes stream live |
| **Horizontal Scaling** | Multiple frontends can connect to one agent backend |
| **Testing & Debugging** | Agent can be tested without UI using protocol inspection |
| **Progressive Enhancement** | Start with chat, add execution timeline, planning viewer |

---

## Middleware Bridge Architecture

### The Bridge Pattern

The **Middleware Bridge** acts as a protocol translator and state synchronizer between the frontend (CopilotKit/AG-UI) and backend (n8n workflows). It's more than a simple proxy—it's a semantic adapter.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MIDDLEWARE BRIDGE ARCHITECTURE                          │
│                                                                              │
│  ┌──────────────┐                                      ┌──────────────┐     │
│  │   Frontend   │                                      │    n8n       │     │
│  │  (AG-UI)     │                                      │  Workflows   │     │
│  └──────┬───────┘                                      └──────┬───────┘     │
│         │                                                      │             │
│         │  AG-UI Events (SSE)                    HTTP/Webhook  │             │
│         │  • Standardized                        • n8n-specific│             │
│         │  • Streaming                           • Varied formats            │
│         │                                                      │             │
│         ▼                                                      ▼             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        BRIDGE SERVER                                 │    │
│  │                                                                      │    │
│  │   ┌────────────────────────────────────────────────────────────┐   │    │
│  │   │                    INGRESS LAYER                            │   │    │
│  │   │  • Parse AG-UI RunAgentInput                               │   │    │
│  │   │  • Validate message history                                │   │    │
│  │   │  • Extract thread context                                  │   │    │
│  │   └────────────────────────────────────────────────────────────┘   │    │
│  │                              │                                      │    │
│  │                              ▼                                      │    │
│  │   ┌────────────────────────────────────────────────────────────┐   │    │
│  │   │                  TRANSFORMATION LAYER                       │   │    │
│  │   │                                                             │   │    │
│  │   │   AG-UI Format          ───────▶        n8n Format          │   │    │
│  │   │   {                                     {                    │   │    │
│  │   │     messages: [...],                      chatInput: "...", │   │    │
│  │   │     threadId: "...",     TRANSFORM        sessionId: "...", │   │    │
│  │   │     tools: [...],        ─────────▶       history: [...],   │   │    │
│  │   │     state: {...}                          context: {...}    │   │    │
│  │   │   }                                     }                    │   │    │
│  │   └────────────────────────────────────────────────────────────┘   │    │
│  │                              │                                      │    │
│  │                              ▼                                      │    │
│  │   ┌────────────────────────────────────────────────────────────┐   │    │
│  │   │                   STREAMING LAYER                           │   │    │
│  │   │                                                             │   │    │
│  │   │   n8n Response             ───────▶      AG-UI Events       │   │    │
│  │   │   {                                                          │   │    │
│  │   │     "output": "...",        ENCODE       RUN_STARTED        │   │    │
│  │   │     "toolCalls": [...],    ────────▶     TOOL_CALL_START    │   │    │
│  │   │     "plan": {...}                        STATE_DELTA        │   │    │
│  │   │   }                                      TEXT_MESSAGE_*     │   │    │
│  │   │                                          RUN_FINISHED       │   │    │
│  │   └────────────────────────────────────────────────────────────┘   │    │
│  │                              │                                      │    │
│  │                              ▼                                      │    │
│  │   ┌────────────────────────────────────────────────────────────┐   │    │
│  │   │                    EGRESS LAYER                             │   │    │
│  │   │  • SSE formatting (data: {...}\n\n)                        │   │    │
│  │   │  • Chunked transfer encoding                               │   │    │
│  │   │  • Connection keep-alive                                   │   │    │
│  │   └────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Bridge Responsibilities

#### 1. Protocol Translation
Converts between AG-UI's event-based protocol and n8n's request/response model:

```typescript
class N8nBridge {
  // Translate AG-UI input to n8n webhook format
  formatForN8n(input: RunAgentInput): N8nWebhookRequest {
    return {
      chatInput: this.extractLatestUserMessage(input.messages),
      sessionId: input.threadId,
      history: this.formatMessageHistory(input.messages),
      tools: this.formatToolDefinitions(input.tools),
      state: input.state
    };
  }

  // Parse n8n response and emit AG-UI events
  async streamToAGUI(n8nResponse: Response, encoder: AGUIEventEncoder) {
    // Emit lifecycle events
    yield encoder.encodeRunStarted(threadId, runId);

    // Parse and transform streaming chunks
    for await (const chunk of n8nResponse.body) {
      const parsed = this.parseN8nChunk(chunk);

      if (parsed.type === 'tool_call') {
        yield encoder.encodeToolCallStart(parsed.id, parsed.name);
        yield encoder.encodeToolCallArgs(parsed.id, parsed.args);
        yield encoder.encodeToolCallEnd(parsed.id);
      }

      if (parsed.type === 'plan_update') {
        yield encoder.encodeStateDelta(this.createPlanPatch(parsed));
      }

      if (parsed.type === 'text') {
        yield encoder.encodeTextMessageContent(messageId, parsed.content);
      }
    }

    yield encoder.encodeRunFinished(threadId, runId);
  }
}
```

#### 2. State Synchronization
Maintains bidirectional state sync between frontend and n8n:

```typescript
interface BridgeState {
  sessions: Map<string, SessionState>;
  activeRuns: Map<string, RunState>;
}

interface SessionState {
  threadId: string;
  messageHistory: Message[];
  agentState: Record<string, unknown>;
  lastActivity: Date;
}

// State delta events for frontend synchronization
function emitStateDelta(change: StateChange): StateDeltaEvent {
  return {
    type: EventType.STATE_DELTA,
    delta: [
      { op: 'replace', path: '/currentPhase', value: change.phase },
      { op: 'add', path: '/plan/steps/-', value: change.newStep },
      { op: 'replace', path: '/plan/currentStepIndex', value: change.stepIndex }
    ]
  };
}
```

#### 3. Event Multiplexing
Handles multiple concurrent streams and event types:

```typescript
class EventMultiplexer {
  private streams: Map<string, EventStream> = new Map();

  // Multiplex events from different sources
  async *multiplex(sources: AsyncIterable<N8nEvent>[]): AsyncIterable<AGUIEvent> {
    for await (const event of merge(sources)) {
      switch (event.source) {
        case 'planner':
          yield* this.handlePlannerEvent(event);
          break;
        case 'executor':
          yield* this.handleExecutorEvent(event);
          break;
        case 'tool':
          yield* this.handleToolEvent(event);
          break;
      }
    }
  }
}
```

---

## Multi-Agent Orchestration

### ReAct Planning Pattern

The system implements the **ReAct (Reason + Act)** pattern with a multi-agent architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ReAct PLANNING LOOP                                     │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │     ┌──────────┐      ┌──────────┐      ┌──────────┐               │   │
│   │     │ THOUGHT  │─────▶│  ACTION  │─────▶│OBSERVATION│              │   │
│   │     │ (Plan)   │      │ (Execute)│      │ (Review)  │              │   │
│   │     └──────────┘      └──────────┘      └─────┬─────┘              │   │
│   │          ▲                                     │                    │   │
│   │          │                                     │                    │   │
│   │          └─────────────────────────────────────┘                    │   │
│   │                    Loop until goal achieved                         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Implementation with Separate Agents:                                       │
│                                                                              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│   │  PLANNING   │     │   MANAGER   │     │   QUALITY   │                  │
│   │   AGENT     │     │    AGENT    │     │   CONTROL   │                  │
│   │             │     │             │     │    AGENT    │                  │
│   │ • Analyze   │     │ • Dispatch  │     │ • Validate  │                  │
│   │   task      │────▶│   to tools  │────▶│   output    │                  │
│   │ • Create    │     │ • Coordinate│     │ • Check     │                  │
│   │   plan      │     │   execution │     │   quality   │                  │
│   │ • Adjust    │◀────│ • Aggregate │◀────│ • Request   │                  │
│   │   strategy  │     │   results   │     │   revision  │                  │
│   └─────────────┘     └─────────────┘     └─────────────┘                  │
│                              │                                              │
│                              ▼                                              │
│         ┌─────────────────────────────────────────────────────┐            │
│         │              AGENT-AS-A-TOOL LAYER                   │            │
│         │                                                      │            │
│         │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│            │
│         │  │ Browser  │ │  Code    │ │   Web    │ │   RAG    ││            │
│         │  │Automation│ │Interpreter│ │ Research │ │  Search  ││            │
│         │  │(Playwright)│ │ (Python) │ │          │ │(Qdrant) ││            │
│         │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│            │
│         └─────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Roles

| Agent | Responsibility | Tools Available |
|-------|----------------|-----------------|
| **Planning Agent** | Analyzes user request, creates step-by-step plan, adjusts strategy based on feedback | None (reasoning only) |
| **Manager Agent** | Orchestrates execution, dispatches to tool agents, aggregates results | All tool agents |
| **Quality Control** | Validates outputs, checks for errors, ensures response quality | Validation tools |
| **Browser Agent** | Web automation, scraping, form filling | Playwright MCP |
| **Code Agent** | Python execution, data processing, calculations | Python Interpreter |
| **Research Agent** | Deep web research, multi-source synthesis | Web Search, Scraper |
| **RAG Agent** | Semantic search over knowledge base | Qdrant Vector DB |

---

## Memory System

### Dual-Memory Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MEMORY ARCHITECTURE                                 │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      SHORT-TERM MEMORY                               │   │
│   │                    (Window Buffer - Redis)                           │   │
│   │                                                                      │   │
│   │   Scope: Current conversation session                               │   │
│   │   Retention: Until session ends or window exceeded                  │   │
│   │                                                                      │   │
│   │   ┌─────────────────────────────────────────────────────────────┐   │   │
│   │   │  Recent Messages    │  Working Context   │  Tool Results    │   │   │
│   │   │  ─────────────────  │  ───────────────   │  ─────────────   │   │   │
│   │   │  • Last N turns     │  • Current plan    │  • Pending       │   │   │
│   │   │  • Conversation     │  • Active step     │  • Completed     │   │   │
│   │   │    context          │  • Variables       │  • References    │   │   │
│   │   └─────────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      │ Consolidation (on session end)        │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                       LONG-TERM MEMORY                               │   │
│   │                    (Vector Store - Qdrant)                           │   │
│   │                                                                      │   │
│   │   ┌───────────────────┐  ┌───────────────────┐  ┌────────────────┐  │   │
│   │   │    SEMANTIC       │  │    EPISODIC       │  │  PROCEDURAL    │  │   │
│   │   │    MEMORY         │  │    MEMORY         │  │   MEMORY       │  │   │
│   │   │                   │  │                   │  │                │  │   │
│   │   │ • Facts learned   │  │ • Past sessions   │  │ • Successful   │  │   │
│   │   │ • User prefs      │  │ • Task outcomes   │  │   patterns     │  │   │
│   │   │ • Domain knowledge│  │ • Error history   │  │ • Tool combos  │  │   │
│   │   │                   │  │                   │  │ • Workflows    │  │   │
│   │   │ Retrieval: RAG    │  │ Retrieval: Time + │  │ Retrieval:     │  │   │
│   │   │ similarity search │  │ context matching  │  │ Task matching  │  │   │
│   │   └───────────────────┘  └───────────────────┘  └────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Memory Operations

```typescript
interface MemorySystem {
  shortTerm: {
    // Window buffer for recent context
    addMessage(sessionId: string, message: Message): void;
    getRecentMessages(sessionId: string, limit: number): Message[];
    setWorkingContext(sessionId: string, key: string, value: unknown): void;
    getWorkingContext(sessionId: string): Record<string, unknown>;
  };

  longTerm: {
    // Semantic memory - RAG-based retrieval
    storeKnowledge(content: string, metadata: KnowledgeMetadata): void;
    searchSemantic(query: string, limit: number): KnowledgeResult[];

    // Episodic memory - past experiences
    storeEpisode(session: SessionSummary): void;
    recallSimilarEpisodes(context: string): Episode[];

    // Procedural memory - learned patterns
    storePattern(pattern: ExecutionPattern): void;
    findApplicablePatterns(task: string): ExecutionPattern[];
  };

  // Memory consolidation (runs periodically)
  consolidate(sessionId: string): Promise<void>;
}
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- n8n instance (v1.106.3+ for streaming)
- Qdrant vector database (for long-term memory)
- Redis (optional, for distributed short-term memory)

### Installation

```bash
# Clone and install
git clone <repository>
cd n8n-agent-chat-ui
npm install

# Configure environment
cp packages/server/.env.example packages/server/.env
# Edit .env with your n8n webhook URLs

# Start development
npm run dev
```

### n8n Workflow Import

1. Import `n8n-workflows/multi-agent-react.json` into n8n
2. Configure credentials (OpenAI, Qdrant, etc.)
3. Activate the workflow
4. Copy webhook URL to server `.env`

---

## Configuration

### Environment Variables

#### Server (`packages/server/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `N8N_WEBHOOK_URL` | Main orchestrator webhook | Yes |
| `N8N_PLANNER_URL` | Planning agent webhook | Yes |
| `N8N_MANAGER_URL` | Manager agent webhook | Yes |
| `N8N_QC_URL` | Quality control webhook | Yes |
| `QDRANT_URL` | Qdrant vector DB URL | Yes |
| `QDRANT_API_KEY` | Qdrant API key | No |
| `REDIS_URL` | Redis URL for sessions | No |

#### Client (`packages/client/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_AGENT_URL` | Bridge server endpoint | `/api/agent` |
| `VITE_SHOW_PLANNING` | Show planning panel | `true` |
| `VITE_SHOW_TOOLS` | Show tool execution | `true` |

---

## API Reference

### AG-UI Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `RUN_STARTED` | Request begins | `{ runId, threadId }` |
| `STEP_STARTED` | Plan step begins | `{ stepId, stepName, stepType }` |
| `STEP_FINISHED` | Plan step ends | `{ stepId, status, result }` |
| `TOOL_CALL_START` | Tool invocation | `{ toolCallId, toolName }` |
| `TOOL_CALL_ARGS` | Tool arguments streaming | `{ toolCallId, delta }` |
| `TOOL_CALL_RESULT` | Tool output | `{ toolCallId, result }` |
| `STATE_DELTA` | State change | `{ delta: JSONPatch[] }` |
| `TEXT_MESSAGE_*` | Response text | `{ messageId, delta/content }` |
| `RUN_FINISHED` | Request complete | `{ runId, status }` |

### State Schema

```typescript
interface AgentState {
  phase: 'planning' | 'executing' | 'reviewing' | 'complete';
  plan: {
    id: string;
    goal: string;
    steps: Array<{
      id: string;
      description: string;
      status: 'pending' | 'active' | 'complete' | 'failed';
      tool?: string;
      result?: unknown;
    }>;
    currentStepIndex: number;
  };
  tools: {
    active: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
      startedAt: string;
    }>;
    completed: Array<{
      id: string;
      name: string;
      result: unknown;
      duration: number;
    }>;
  };
  qualityScore?: number;
  iterations: number;
}
```

---

## Resources

- [AG-UI Protocol Specification](https://docs.ag-ui.com/introduction)
- [CopilotKit Documentation](https://docs.copilotkit.ai/)
- [n8n AI Agent Node](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/)
- [n8n Streaming Responses](https://docs.n8n.io/workflows/streaming/)
- [Qdrant Vector Database](https://qdrant.tech/documentation/)
- [ReAct Pattern Paper](https://arxiv.org/abs/2210.03629)

## License

MIT
