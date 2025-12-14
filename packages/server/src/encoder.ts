import {
  EventType,
  AGUIEvent,
  RunStartedEvent,
  RunFinishedEvent,
  RunErrorEvent,
  StepStartedEvent,
  StepFinishedEvent,
  TextMessageStartEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  TextMessageChunkEvent,
  ToolCallStartEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallResultEvent,
  StateSnapshotEvent,
  StateDeltaEvent,
  CustomEvent,
  MessageRole,
  N8nAgentEvent
} from './types.js';

/**
 * AG-UI Event Encoder
 * Encodes events into Server-Sent Events (SSE) format
 */
export class AGUIEventEncoder {
  private acceptHeader: string;

  constructor(acceptHeader: string = 'text/event-stream') {
    this.acceptHeader = acceptHeader;
  }

  getContentType(): string {
    if (this.acceptHeader.includes('text/event-stream')) {
      return 'text/event-stream';
    }
    return 'text/event-stream';
  }

  /**
   * Encode an AG-UI event to SSE format
   */
  encode(event: AGUIEvent): string {
    const data = JSON.stringify(event);
    return `data: ${data}\n\n`;
  }

  /**
   * Encode a raw n8n agent event to AG-UI format
   */
  encodeN8nEvent(event: N8nAgentEvent): string {
    const aguiEvent = this.translateN8nEvent(event);
    if (aguiEvent) {
      return this.encode(aguiEvent);
    }
    return '';
  }

  /**
   * Translate n8n agent event to AG-UI event
   */
  private translateN8nEvent(event: N8nAgentEvent): AGUIEvent | null {
    const timestamp = event.timestamp || new Date().toISOString();

    switch (event.type) {
      case 'RUN_STARTED':
        return {
          type: EventType.RUN_STARTED,
          runId: event.runId || '',
          threadId: event.threadId || '',
          timestamp
        } as RunStartedEvent;

      case 'RUN_FINISHED':
        return {
          type: EventType.RUN_FINISHED,
          runId: event.runId || '',
          threadId: event.threadId || '',
          status: event.status as 'success' | 'error' || 'success',
          timestamp
        } as RunFinishedEvent;

      case 'STEP_STARTED':
        return {
          type: EventType.STEP_STARTED,
          stepId: event.stepId || '',
          stepName: event.stepName || '',
          stepType: event.stepType,
          timestamp
        } as StepStartedEvent;

      case 'STEP_FINISHED':
        return {
          type: EventType.STEP_FINISHED,
          stepId: event.stepId || '',
          status: (event.status as 'complete' | 'failed' | 'skipped') || 'complete',
          result: event.result as Record<string, unknown>,
          timestamp
        } as StepFinishedEvent;

      case 'TOOL_CALL_START':
        return {
          type: EventType.TOOL_CALL_START,
          toolCallId: event.toolCallId || '',
          toolCallName: event.toolCallName || '',
          timestamp
        } as ToolCallStartEvent;

      case 'TOOL_CALL_RESULT':
        return {
          type: EventType.TOOL_CALL_RESULT,
          toolCallId: event.toolCallId || '',
          result: typeof event.result === 'string' ? event.result : JSON.stringify(event.result),
          timestamp
        } as ToolCallResultEvent;

      case 'STATE_DELTA':
        return {
          type: EventType.STATE_DELTA,
          delta: event.delta || [],
          timestamp
        } as StateDeltaEvent;

      default:
        return {
          type: EventType.CUSTOM,
          name: event.type,
          value: event,
          timestamp
        } as CustomEvent;
    }
  }

  /**
   * Create and encode a RUN_STARTED event
   */
  encodeRunStarted(threadId: string, runId: string): string {
    const event: RunStartedEvent = {
      type: EventType.RUN_STARTED,
      threadId,
      runId,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a RUN_FINISHED event
   */
  encodeRunFinished(threadId: string, runId: string, status: 'success' | 'error' = 'success'): string {
    const event: RunFinishedEvent = {
      type: EventType.RUN_FINISHED,
      threadId,
      runId,
      status,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a RUN_ERROR event
   */
  encodeError(message: string, code?: string): string {
    const event: RunErrorEvent = {
      type: EventType.RUN_ERROR,
      message,
      code,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a STEP_STARTED event
   */
  encodeStepStarted(stepId: string, stepName: string, stepType?: string): string {
    const event: StepStartedEvent = {
      type: EventType.STEP_STARTED,
      stepId,
      stepName,
      stepType,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a STEP_FINISHED event
   */
  encodeStepFinished(
    stepId: string,
    status: 'complete' | 'failed' | 'skipped',
    result?: Record<string, unknown>
  ): string {
    const event: StepFinishedEvent = {
      type: EventType.STEP_FINISHED,
      stepId,
      status,
      result,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a TEXT_MESSAGE_START event
   */
  encodeTextMessageStart(messageId: string, role: MessageRole = 'assistant'): string {
    const event: TextMessageStartEvent = {
      type: EventType.TEXT_MESSAGE_START,
      messageId,
      role,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a TEXT_MESSAGE_CONTENT event
   */
  encodeTextMessageContent(messageId: string, delta: string): string {
    const event: TextMessageContentEvent = {
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId,
      delta,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a TEXT_MESSAGE_END event
   */
  encodeTextMessageEnd(messageId: string): string {
    const event: TextMessageEndEvent = {
      type: EventType.TEXT_MESSAGE_END,
      messageId,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a TEXT_MESSAGE_CHUNK event (convenience wrapper)
   */
  encodeTextMessageChunk(messageId: string, delta: string, role?: MessageRole): string {
    const event: TextMessageChunkEvent = {
      type: EventType.TEXT_MESSAGE_CHUNK,
      messageId,
      delta,
      role,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a TOOL_CALL_START event
   */
  encodeToolCallStart(toolCallId: string, toolCallName: string, parentMessageId?: string): string {
    const event: ToolCallStartEvent = {
      type: EventType.TOOL_CALL_START,
      toolCallId,
      toolCallName,
      parentMessageId,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a TOOL_CALL_ARGS event
   */
  encodeToolCallArgs(toolCallId: string, delta: string): string {
    const event: ToolCallArgsEvent = {
      type: EventType.TOOL_CALL_ARGS,
      toolCallId,
      delta,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a TOOL_CALL_END event
   */
  encodeToolCallEnd(toolCallId: string): string {
    const event: ToolCallEndEvent = {
      type: EventType.TOOL_CALL_END,
      toolCallId,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a TOOL_CALL_RESULT event
   */
  encodeToolCallResult(toolCallId: string, result: string): string {
    const event: ToolCallResultEvent = {
      type: EventType.TOOL_CALL_RESULT,
      toolCallId,
      result,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a STATE_SNAPSHOT event
   */
  encodeStateSnapshot(state: Record<string, unknown>): string {
    const event: StateSnapshotEvent = {
      type: EventType.STATE_SNAPSHOT,
      state,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Create and encode a STATE_DELTA event
   */
  encodeStateDelta(delta: Array<{ op: string; path: string; value?: unknown }>): string {
    const event: StateDeltaEvent = {
      type: EventType.STATE_DELTA,
      delta,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }

  /**
   * Encode a custom event
   */
  encodeCustom(name: string, value: unknown): string {
    const event: CustomEvent = {
      type: EventType.CUSTOM,
      name,
      value,
      timestamp: new Date().toISOString()
    };
    return this.encode(event);
  }
}
