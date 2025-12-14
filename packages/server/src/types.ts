import { z } from 'zod';

// AG-UI Event Types
export enum EventType {
  RUN_STARTED = 'RUN_STARTED',
  RUN_FINISHED = 'RUN_FINISHED',
  RUN_ERROR = 'RUN_ERROR',
  STEP_STARTED = 'STEP_STARTED',
  STEP_FINISHED = 'STEP_FINISHED',
  TEXT_MESSAGE_START = 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT = 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END = 'TEXT_MESSAGE_END',
  TEXT_MESSAGE_CHUNK = 'TEXT_MESSAGE_CHUNK',
  TOOL_CALL_START = 'TOOL_CALL_START',
  TOOL_CALL_ARGS = 'TOOL_CALL_ARGS',
  TOOL_CALL_END = 'TOOL_CALL_END',
  TOOL_CALL_RESULT = 'TOOL_CALL_RESULT',
  STATE_SNAPSHOT = 'STATE_SNAPSHOT',
  STATE_DELTA = 'STATE_DELTA',
  MESSAGES_SNAPSHOT = 'MESSAGES_SNAPSHOT',
  RAW = 'RAW',
  CUSTOM = 'CUSTOM'
}

// Message roles
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

// Message schema
export const MessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().nullable().optional(),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
  toolCalls: z.array(z.object({
    id: z.string(),
    type: z.string(),
    function: z.object({
      name: z.string(),
      arguments: z.string()
    })
  })).optional()
});

export type Message = z.infer<typeof MessageSchema>;

// Tool schema
export const ToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.any()).optional()
});

export type Tool = z.infer<typeof ToolSchema>;

// Context item schema
export const ContextItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  value: z.any()
});

export type ContextItem = z.infer<typeof ContextItemSchema>;

// Input schema for AG-UI run agent endpoint
export const RunAgentInputSchema = z.object({
  threadId: z.string(),
  runId: z.string(),
  messages: z.array(MessageSchema),
  tools: z.array(ToolSchema).optional(),
  context: z.array(ContextItemSchema).optional(),
  forwardedProps: z.record(z.any()).optional(),
  state: z.any().optional()
});

export type RunAgentInput = z.infer<typeof RunAgentInputSchema>;

// AG-UI Events
export interface BaseEvent {
  type: EventType;
  timestamp?: string;
}

export interface RunStartedEvent extends BaseEvent {
  type: EventType.RUN_STARTED;
  threadId: string;
  runId: string;
}

export interface RunFinishedEvent extends BaseEvent {
  type: EventType.RUN_FINISHED;
  threadId: string;
  runId: string;
  status?: 'success' | 'error';
}

export interface RunErrorEvent extends BaseEvent {
  type: EventType.RUN_ERROR;
  message: string;
  code?: string;
}

export interface StepStartedEvent extends BaseEvent {
  type: EventType.STEP_STARTED;
  stepId: string;
  stepName: string;
  stepType?: 'planning' | 'execution' | 'review' | 'revision' | string;
}

export interface StepFinishedEvent extends BaseEvent {
  type: EventType.STEP_FINISHED;
  stepId: string;
  status: 'complete' | 'failed' | 'skipped';
  result?: Record<string, unknown>;
}

export interface TextMessageStartEvent extends BaseEvent {
  type: EventType.TEXT_MESSAGE_START;
  messageId: string;
  role: MessageRole;
}

export interface TextMessageContentEvent extends BaseEvent {
  type: EventType.TEXT_MESSAGE_CONTENT;
  messageId: string;
  delta: string;
}

export interface TextMessageEndEvent extends BaseEvent {
  type: EventType.TEXT_MESSAGE_END;
  messageId: string;
}

export interface TextMessageChunkEvent extends BaseEvent {
  type: EventType.TEXT_MESSAGE_CHUNK;
  messageId: string;
  role?: MessageRole;
  delta: string;
}

export interface ToolCallStartEvent extends BaseEvent {
  type: EventType.TOOL_CALL_START;
  toolCallId: string;
  toolCallName: string;
  parentMessageId?: string;
}

export interface ToolCallArgsEvent extends BaseEvent {
  type: EventType.TOOL_CALL_ARGS;
  toolCallId: string;
  delta: string;
}

export interface ToolCallEndEvent extends BaseEvent {
  type: EventType.TOOL_CALL_END;
  toolCallId: string;
}

export interface ToolCallResultEvent extends BaseEvent {
  type: EventType.TOOL_CALL_RESULT;
  toolCallId: string;
  result: string;
}

export interface StateSnapshotEvent extends BaseEvent {
  type: EventType.STATE_SNAPSHOT;
  state: Record<string, unknown>;
}

export interface StateDeltaEvent extends BaseEvent {
  type: EventType.STATE_DELTA;
  delta: Array<{ op: string; path: string; value?: unknown }>;
}

export interface CustomEvent extends BaseEvent {
  type: EventType.CUSTOM;
  name: string;
  value: unknown;
}

export type AGUIEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | StepStartedEvent
  | StepFinishedEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | TextMessageChunkEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent
  | StateSnapshotEvent
  | StateDeltaEvent
  | CustomEvent;

// n8n specific types for multi-agent orchestration
export interface N8nPlanStep {
  id: string;
  description: string;
  tool: string;
  toolInput: string;
  expectedOutput: string;
  dependsOn: string[];
}

export interface N8nPlan {
  goal: string;
  complexity: 'low' | 'medium' | 'high';
  steps: N8nPlanStep[];
  successCriteria: string;
}

export interface N8nQCResult {
  approved: boolean;
  qualityScore: number;
  issues: string[];
  suggestions: string[];
  requiresRevision: boolean;
  revisionInstructions?: string;
  finalSummary: string;
}

export interface N8nAgentEvent {
  type: string;
  runId?: string;
  threadId?: string;
  stepId?: string;
  stepName?: string;
  stepType?: string;
  toolCallId?: string;
  toolCallName?: string;
  delta?: Array<{ op: string; path: string; value?: unknown }>;
  result?: unknown;
  status?: string;
  timestamp?: string;
}

export interface N8nMultiAgentResponse {
  output: string;
  plan?: N8nPlan;
  stepResults?: Array<{
    stepId: string;
    description: string;
    tool: string;
    result: string;
    completedAt: string;
  }>;
  qcResult?: N8nQCResult;
  qualityScore?: number;
  iterations: number;
  events: N8nAgentEvent[];
  executionTime: number;
}

export interface N8nWebhookResponse {
  output?: string;
  text?: string;
  message?: string;
  response?: string;
  data?: unknown;
  // Multi-agent fields
  plan?: N8nPlan;
  stepResults?: unknown[];
  qcResult?: N8nQCResult;
  events?: N8nAgentEvent[];
  executionTime?: number;
  iterations?: number;
}

export interface N8nStreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done' | 'event';
  content?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  error?: string;
  event?: N8nAgentEvent;
}

// Agent state for frontend synchronization
export interface AgentState {
  phase: 'planning' | 'executing' | 'reviewing' | 'revision' | 'complete' | 'error';
  plan?: {
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
