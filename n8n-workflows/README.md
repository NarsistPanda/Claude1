# n8n Multi-Agent ReAct Orchestration Workflows

This documentation provides a comprehensive guide to the n8n workflow architecture for multi-agent AI orchestration using the ReAct (Reason + Act) pattern.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Main Orchestrator Workflow](#main-orchestrator-workflow)
3. [Agent-as-a-Tool Sub-Workflows](#agent-as-a-tool-sub-workflows)
4. [Production Readiness Guide](#production-readiness-guide)
5. [Environment Configuration](#environment-configuration)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Multi-Agent ReAct System                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │   Planning  │───▶│   Manager   │───▶│   Quality   │            │
│  │    Agent    │    │    Agent    │    │   Control   │            │
│  └─────────────┘    └──────┬──────┘    └─────────────┘            │
│                            │                                       │
│         ┌──────────────────┼──────────────────┐                   │
│         │                  │                  │                    │
│         ▼                  ▼                  ▼                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│  │   Browser   │    │    Code     │    │    Web      │           │
│  │    Agent    │    │ Interpreter │    │   Search    │           │
│  └─────────────┘    └─────────────┘    └─────────────┘           │
│         │                                     │                    │
│         ▼                                     ▼                    │
│  ┌─────────────┐                       ┌─────────────┐           │
│  │    Deep     │                       │     RAG     │           │
│  │  Research   │                       │   Search    │           │
│  └─────────────┘                       └─────────────┘           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### ReAct Pattern Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Receive │────▶│  Plan   │────▶│ Execute │────▶│ Review  │
│ Request │     │  Steps  │     │  Steps  │     │ Quality │
└─────────┘     └─────────┘     └────┬────┘     └────┬────┘
                                     │               │
                                     │ Loop          │ Pass/Fail
                                     ▼               ▼
                              ┌─────────────┐  ┌─────────────┐
                              │ More Steps? │  │  Revision   │
                              │             │  │   Needed?   │
                              └──────┬──────┘  └──────┬──────┘
                                     │ No             │ Yes
                                     ▼                ▼
                              ┌─────────────┐  ┌─────────────┐
                              │   QC Agent  │  │  Re-execute │
                              └─────────────┘  └─────────────┘
```

---

## Main Orchestrator Workflow

**File:** `multi-agent-react.json`

### Overview

The main orchestrator implements the ReAct pattern with three specialized agents:

1. **Planning Agent** - Analyzes requests and creates execution plans
2. **Manager Agent** - Orchestrates tool execution using agent-as-a-tool pattern
3. **Quality Control Agent** - Reviews results and determines if revision is needed

### Node Structure

```
Webhook → Validate Input → Initialize State → Planning Agent →
  Parse Plan → Plan Valid? →
    ├─ Yes: More Steps? →
    │    ├─ Yes: Manager Agent → Process Result → (loop back)
    │    └─ No: QC Agent → Parse QC → Needs Revision? →
    │         ├─ No: Generate Response → Respond
    │         └─ Yes: Prepare Revision → (loop back to More Steps?)
    └─ No: Handle Error → Respond
```

### Key Components

#### 1. Webhook Configuration

```javascript
{
  "httpMethod": "POST",
  "path": "multi-agent-chat",
  "authentication": "headerAuth",  // API key authentication
  "responseMode": "responseNode"    // Custom response handling
}
```

**Headers set:**
- `Access-Control-Allow-Origin` - CORS support
- `Content-Type: application/json`
- `X-Request-ID` - Execution tracking

#### 2. Input Validation

The workflow validates:
- `chatInput` - Required, non-empty string
- `sessionId` - Optional, defaults to execution ID
- `history` - Optional array of previous messages

#### 3. State Management

```javascript
const state = {
  sessionId,           // Unique session identifier
  userQuery,           // Sanitized user input
  history,             // Conversation history
  phase,               // Current execution phase
  plan,                // Generated execution plan
  currentStep,         // Current step index
  stepResults,         // Results from executed steps
  iterations,          // Number of revision cycles
  maxIterations,       // Maximum revision attempts (env configurable)
  maxStepsPerPlan,     // Maximum steps in a plan (env configurable)
  events,              // AG-UI events for frontend
  errors,              // Error tracking
  startTime,           // Execution timing
  executionId          // n8n execution ID
};
```

#### 4. AG-UI Events Emitted

| Event Type | When Emitted |
|------------|--------------|
| `RUN_STARTED` | Workflow begins |
| `STEP_STARTED` | Planning, execution, or QC begins |
| `STEP_FINISHED` | Step completes |
| `TOOL_CALL_START` | Tool agent invoked |
| `TOOL_CALL_RESULT` | Tool returns result |
| `STATE_DELTA` | State changes |
| `RUN_FINISHED` | Workflow completes |

---

## Agent-as-a-Tool Sub-Workflows

Each agent sub-workflow follows a standard pattern:

```
Execute Workflow Trigger → Validate Input → Input Valid? →
  ├─ Yes: Agent Node → Format Output → Merge Output
  └─ No: Format Error → Merge Output
```

### 1. Browser Automation Agent

**File:** `agents/browser-agent.json`

**Capabilities:**
- Navigate to URLs
- Click elements, fill forms
- Take screenshots
- Extract data from pages
- Handle JavaScript-rendered content

**MCP Configuration:**
```javascript
{
  "serverUrl": "={{ $env.PLAYWRIGHT_MCP_URL || 'http://playwright-mcp:3000' }}",
  "timeout": 90000
}
```

**Docker Setup:**
```bash
# Pull and run Playwright MCP server
docker pull mcr.microsoft.com/playwright/mcp
docker run -d \
  --name playwright-mcp \
  -p 3000:3000 \
  mcr.microsoft.com/playwright/mcp
```

**Security Guidelines:**
- Never navigate to `file://` URLs
- Don't execute arbitrary JavaScript from user input
- Respect `robots.txt` when scraping

### 2. Code Interpreter Agent

**File:** `agents/code-interpreter-agent.json`

**Capabilities:**
- Execute Python code
- Data analysis with pandas, numpy
- Generate visualizations
- Process JSON/CSV data
- Mathematical computations

**Security Rules (Enforced):**
```javascript
// Blocked patterns:
- os.system, subprocess
- eval(), exec()
- Access to /etc, /proc, /sys
- ctypes imports
- Internal network requests (10.x, 192.168.x, 172.x)
```

**Execution Limits:**
- Maximum execution time: 30 seconds
- Maximum memory: 256MB
- Maximum output: 10MB

### 3. Web Search Agent

**File:** `agents/web-search-agent.json`

**Tools:**
- **SerpAPI** - Web search for current information
- **Wikipedia** - Background/encyclopedic information

**Source Quality Indicators:**
| Type | Quality |
|------|---------|
| .gov, .edu, company sites | High |
| Established news outlets | Medium-High |
| Wikipedia | Medium |
| Forums/blogs | Low |

**Limitations:**
- Maximum 5 searches per request
- Cannot access paywalled content

### 4. Deep Research Agent

**File:** `agents/deep-research-agent.json`

**Research Methodology:**
1. **UNDERSTAND** - Identify key concepts and scope
2. **PLAN** - Use Think tool to structure approach
3. **GATHER** - Search multiple sources
4. **VERIFY** - Cross-reference critical facts
5. **SYNTHESIZE** - Create coherent analysis

**Tools:**
- Think Tool (planning)
- SerpAPI (current information)
- Wikipedia (background)
- HTTP Request (fetch specific URLs)

**Output Format:**
```markdown
## Executive Summary
[2-3 sentence overview]

## Key Findings
1. [Finding with source]
2. [Finding with source]

## Detailed Analysis
[Organized by topic]

## Source Assessment
- High confidence: [list]
- Medium confidence: [list]
- Requires verification: [list]

## Limitations & Further Research
[What couldn't be determined]
```

### 5. RAG Search Agent

**File:** `agents/rag-agent.json`

**Memory Types:**
| Type | Use Case | Query Indicators |
|------|----------|------------------|
| Semantic | Facts, knowledge | "What is...", "Explain..." |
| Episodic | Past sessions | "Previously...", "Last time..." |
| Procedural | Workflows | "How to...", "Steps to..." |

**Vector Store Configuration:**
```javascript
{
  "qdrantCollection": "={{ $env.QDRANT_COLLECTION || 'agent_long_term_memory' }}",
  "qdrantUrl": "={{ $env.QDRANT_URL || 'http://localhost:6333' }}",
  "embeddings": "text-embedding-3-small"
}
```

---

## Production Readiness Guide

### Agents-as-a-Tool Production Checklist

#### 1. Input Validation

Every agent workflow must validate inputs:

```javascript
// Required validation pattern
if (!input.task || typeof input.task !== 'string' || input.task.trim().length === 0) {
  return {
    json: {
      success: false,
      error: 'Invalid input: task is required',
      errorCode: 'INVALID_INPUT'
    }
  };
}
```

**Best Practices:**
- Check for required fields
- Validate data types
- Sanitize strings (remove HTML, limit length)
- Return structured error responses

#### 2. Error Handling

Configure nodes with error handling:

```javascript
{
  "onError": "continueRegularOutput"  // Don't stop workflow on errors
}
```

**Error Response Format:**
```javascript
{
  success: false,
  agentType: 'agent_name',
  error: 'Human-readable message',
  errorCode: 'MACHINE_READABLE_CODE',
  metadata: {
    executionId: $execution.id
  }
}
```

#### 3. Timeout Configuration

Set appropriate timeouts for each node:

| Agent Type | Recommended Timeout |
|------------|---------------------|
| Browser Agent | 120,000ms |
| Code Interpreter | 90,000ms |
| Web Search | 60,000ms |
| Deep Research | 180,000ms |
| RAG Search | 60,000ms |

```javascript
{
  "options": {
    "timeout": 120000
  }
}
```

#### 4. Security Measures

**Code Interpreter Security:**
```javascript
const dangerousPatterns = [
  /os\.system/i,
  /subprocess\./i,
  /eval\(/i,
  /exec\(/i,
  /open\(['"][^'"]*\/(etc|proc|sys)/i,
  /import\s+ctypes/i
];
```

**Browser Agent Security:**
- Block file:// URLs
- Validate target domains
- Rate limit requests

#### 5. Output Standardization

All agents must return structured output:

```javascript
{
  success: true,
  agentType: 'browser',
  output: 'Human-readable result',
  // Agent-specific data
  metadata: {
    executionTime,
    toolCalls,
    executionId
  }
}
```

#### 6. Workflow Settings

Required settings for production:

```javascript
{
  "settings": {
    "executionOrder": "v1",
    "saveManualExecutions": true,
    "callerPolicy": "workflowsFromSameOwner"  // Security: only same-owner workflows can call
  }
}
```

---

### Main Workflow Production Checklist

#### 1. Authentication

Configure webhook authentication:

```javascript
{
  "authentication": "headerAuth",
  "credentials": {
    "httpHeaderAuth": {
      "id": "HEADER_AUTH_CREDENTIAL_ID",
      "name": "API Key Auth"
    }
  }
}
```

**Setup in n8n:**
1. Go to Credentials
2. Create "Header Auth" credential
3. Set header name (e.g., `X-API-Key`)
4. Set expected value
5. Reference in webhook node

#### 2. Rate Limiting

Implement at infrastructure level:
- Use reverse proxy (nginx, Traefik)
- Configure rate limits per IP/API key
- Add request queuing for high traffic

#### 3. Iteration Limits

Configure via environment variables:

```bash
MAX_ITERATIONS=5          # Maximum revision cycles
MAX_STEPS_PER_PLAN=10     # Maximum steps per plan
```

#### 4. Error Workflow

Configure global error handling:

```javascript
{
  "settings": {
    "errorWorkflow": "={{ $env.ERROR_WORKFLOW_ID }}"
  }
}
```

Create an error workflow that:
- Logs errors to monitoring system
- Sends alerts for critical failures
- Records metrics for analysis

#### 5. Response Codes

Dynamic response codes based on outcome:

```javascript
{
  "responseCode": "={{ $json.success ? 200 : ($json.phase === 'error' ? 500 : 207) }}"
}
```

| Code | Meaning |
|------|---------|
| 200 | Success |
| 207 | Partial success |
| 400 | Invalid input |
| 500 | Server error |

#### 6. Structured Output Parsers

Use output parsers for consistent LLM responses:

```javascript
{
  "type": "@n8n/n8n-nodes-langchain.outputParserStructured",
  "parameters": {
    "schemaType": "fromJson",
    "jsonSchemaExample": "{ \"goal\": \"string\", \"steps\": [...] }"
  }
}
```

---

## Environment Configuration

### Required Environment Variables

```bash
# n8n Workflow IDs
BROWSER_AGENT_WORKFLOW_ID=<workflow-id>
CODE_AGENT_WORKFLOW_ID=<workflow-id>
SEARCH_AGENT_WORKFLOW_ID=<workflow-id>
RESEARCH_AGENT_WORKFLOW_ID=<workflow-id>
RAG_AGENT_WORKFLOW_ID=<workflow-id>
ERROR_WORKFLOW_ID=<workflow-id>

# Execution Limits
MAX_ITERATIONS=5
MAX_STEPS_PER_PLAN=10

# External Services
PLAYWRIGHT_MCP_URL=http://playwright-mcp:3000
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=agent_long_term_memory

# CORS
ALLOWED_ORIGINS=*
```

### Credential Requirements

| Credential | Node Type | Required For |
|------------|-----------|--------------|
| OpenAI API | lmChatOpenAi, embeddingsOpenAi | All agents |
| SerpAPI | toolSerpApi | Web Search, Deep Research |
| Qdrant | vectorStoreQdrant | RAG Agent |
| Header Auth | webhook | Main workflow authentication |

---

## Best Practices

### 1. Node Naming

Use clear, descriptive names:
- ✅ "Validate Input", "Parse Plan", "Format Output"
- ❌ "Code", "Function", "Node1"

### 2. Code Organization

Structure JavaScript nodes consistently:

```javascript
// 1. Input extraction
const input = $input.first().json;

// 2. Validation
if (!input.field) {
  return { json: { error: '...' } };
}

// 3. Processing
const result = processData(input);

// 4. Output formatting
return { json: { success: true, ...result } };
```

### 3. Logging

Use console.log for debugging (visible in execution logs):

```javascript
console.log('Processing step:', stepId);
console.log('Tool result:', JSON.stringify(result).slice(0, 200));
```

### 4. Memory Management

- Use short-term memory (Window Buffer) for context
- Use long-term memory (Qdrant) for knowledge persistence
- Clear session memory after completion if needed

### 5. Testing

Before production:
1. Test each agent workflow independently
2. Test with edge cases (empty input, very long input)
3. Test error handling paths
4. Load test with concurrent requests
5. Monitor execution times

---

## Troubleshooting

### Common Issues

#### 1. "Workflow not found" error

**Cause:** Invalid workflow ID in tool configuration

**Fix:**
1. Check workflow ID in environment variables
2. Ensure workflow is active
3. Verify `callerPolicy` settings

#### 2. Timeout errors

**Cause:** Operation takes longer than configured timeout

**Fix:**
1. Increase timeout in node options
2. Add retry logic with exponential backoff
3. Break complex tasks into smaller steps

#### 3. "Invalid JSON" from LLM

**Cause:** LLM output doesn't match expected schema

**Fix:**
1. Use structured output parser
2. Add fallback JSON extraction with regex
3. Improve prompt with explicit format instructions

#### 4. Memory/context issues

**Cause:** Context window exceeded or memory not shared

**Fix:**
1. Check memory node configuration
2. Use consistent session IDs
3. Clear old context periodically

#### 5. Credential errors

**Cause:** Missing or invalid credentials

**Fix:**
1. Verify all credentials in n8n Credentials page
2. Test credentials individually
3. Check API key expiration

### Debug Mode

Enable detailed logging:

```javascript
// Add at workflow start
console.log('=== Execution Start ===');
console.log('Input:', JSON.stringify($json, null, 2));
console.log('Execution ID:', $execution.id);
```

### Monitoring Recommendations

1. **Execution Metrics**
   - Track execution time per workflow
   - Monitor failure rates
   - Alert on repeated failures

2. **Resource Monitoring**
   - Memory usage
   - API call counts
   - Database connection pools

3. **Business Metrics**
   - Successful completions
   - Average iterations per request
   - Quality scores distribution

---

## File Structure

```
n8n-workflows/
├── README.md                       # This documentation
├── multi-agent-react.json          # Main orchestrator workflow
└── agents/
    ├── browser-agent.json          # Playwright browser automation
    ├── code-interpreter-agent.json # Python code execution
    ├── web-search-agent.json       # SerpAPI + Wikipedia search
    ├── deep-research-agent.json    # Multi-source research
    └── rag-agent.json              # Qdrant vector search
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12 | Initial production-ready release |

---

## Support

For issues and questions:
- Review this documentation
- Check n8n community forums
- Review n8n official documentation for node-specific questions
