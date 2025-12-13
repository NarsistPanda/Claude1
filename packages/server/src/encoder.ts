import {
  EventType,
  AGUIEvent,
  RunStartedEvent,
  RunFinishedEvent,
  RunErrorEvent,
  TextMessageStartEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  TextMessageChunkEvent,
  ToolCallStartEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallResultEvent,
  MessageRole
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
    // Default to SSE format
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
   * Create and encode a RUN_STARTED event
   */
  encodeRunStarted(threadId: string, runId: string): string {
    const event: RunStartedEvent = {
      type: EventType.RUN_STARTED,
      threadId,
      runId
    };
    return this.encode(event);
  }

  /**
   * Create and encode a RUN_FINISHED event
   */
  encodeRunFinished(threadId: string, runId: string): string {
    const event: RunFinishedEvent = {
      type: EventType.RUN_FINISHED,
      threadId,
      runId
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
      code
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
      role
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
      delta
    };
    return this.encode(event);
  }

  /**
   * Create and encode a TEXT_MESSAGE_END event
   */
  encodeTextMessageEnd(messageId: string): string {
    const event: TextMessageEndEvent = {
      type: EventType.TEXT_MESSAGE_END,
      messageId
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
      role
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
      parentMessageId
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
      delta
    };
    return this.encode(event);
  }

  /**
   * Create and encode a TOOL_CALL_END event
   */
  encodeToolCallEnd(toolCallId: string): string {
    const event: ToolCallEndEvent = {
      type: EventType.TOOL_CALL_END,
      toolCallId
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
      result
    };
    return this.encode(event);
  }

  /**
   * Encode a custom event
   */
  encodeCustom(name: string, value: unknown): string {
    return this.encode({
      type: EventType.CUSTOM,
      name,
      value
    });
  }
}
