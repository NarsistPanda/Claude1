import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AGUIEventEncoder } from './encoder.js';
import {
  RunAgentInput,
  Message,
  N8nWebhookResponse,
  N8nAgentEvent,
  N8nMultiAgentResponse
} from './types.js';

/**
 * N8n Agent Bridge
 * Connects n8n webhooks to the AG-UI protocol
 * Supports multi-agent orchestration with ReAct pattern
 */
export class N8nAgentBridge {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  /**
   * Format messages for n8n webhook
   */
  private formatMessagesForN8n(messages: Message[]): { chatInput: string; history: Array<{ role: string; content: string }> } {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const chatInput = lastUserMessage?.content || '';

    const history = messages
      .slice(0, -1)
      .filter(m => m.content)
      .map(m => ({
        role: m.role,
        content: m.content || ''
      }));

    return { chatInput, history };
  }

  /**
   * Stream response from n8n to AG-UI events
   * Supports both simple and multi-agent orchestration responses
   */
  async streamToAGUI(input: RunAgentInput, encoder: AGUIEventEncoder, res: Response): Promise<void> {
    const { threadId, runId, messages, forwardedProps } = input;
    const messageId = uuidv4();

    // Emit RUN_STARTED
    res.write(encoder.encodeRunStarted(threadId, runId));

    try {
      const { chatInput, history } = this.formatMessagesForN8n(messages);

      const requestBody: Record<string, unknown> = {
        chatInput,
        sessionId: threadId,
        ...forwardedProps
      };

      if (history.length > 0) {
        requestBody.history = history;
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`n8n webhook returned ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && response.body) {
        await this.handleStreamingResponse(response, encoder, res, messageId, threadId, runId);
      } else {
        await this.handleJsonResponse(response, encoder, res, messageId, threadId, runId);
      }

    } catch (error) {
      console.error('Error calling n8n webhook:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.write(encoder.encodeError(errorMessage));
      res.write(encoder.encodeRunFinished(threadId, runId, 'error'));
    }
  }

  /**
   * Handle streaming SSE response from n8n
   */
  private async handleStreamingResponse(
    response: globalThis.Response,
    encoder: AGUIEventEncoder,
    res: Response,
    messageId: string,
    threadId: string,
    runId: string
  ): Promise<void> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let textMessageStarted = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              // Check if this is an AG-UI event from n8n
              if (parsed.type && this.isN8nAgentEvent(parsed)) {
                res.write(encoder.encodeN8nEvent(parsed as N8nAgentEvent));
              } else {
                // Regular content chunk
                const content = this.extractContentFromN8nChunk(parsed);
                if (content) {
                  if (!textMessageStarted) {
                    res.write(encoder.encodeTextMessageStart(messageId, 'assistant'));
                    textMessageStarted = true;
                  }
                  res.write(encoder.encodeTextMessageContent(messageId, content));
                }
              }
            } catch {
              if (data) {
                if (!textMessageStarted) {
                  res.write(encoder.encodeTextMessageStart(messageId, 'assistant'));
                  textMessageStarted = true;
                }
                res.write(encoder.encodeTextMessageContent(messageId, data));
              }
            }
          } else if (line.trim() && !line.startsWith(':')) {
            if (!textMessageStarted) {
              res.write(encoder.encodeTextMessageStart(messageId, 'assistant'));
              textMessageStarted = true;
            }
            res.write(encoder.encodeTextMessageContent(messageId, line));
          }
        }
      }

      if (buffer.trim()) {
        if (!textMessageStarted) {
          res.write(encoder.encodeTextMessageStart(messageId, 'assistant'));
          textMessageStarted = true;
        }
        res.write(encoder.encodeTextMessageContent(messageId, buffer));
      }

      if (textMessageStarted) {
        res.write(encoder.encodeTextMessageEnd(messageId));
      }
      res.write(encoder.encodeRunFinished(threadId, runId, 'success'));

    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Handle JSON response from n8n (non-streaming)
   * Supports multi-agent orchestration response format
   */
  private async handleJsonResponse(
    response: globalThis.Response,
    encoder: AGUIEventEncoder,
    res: Response,
    messageId: string,
    threadId: string,
    runId: string
  ): Promise<void> {
    const data = await response.json() as N8nWebhookResponse | N8nWebhookResponse[] | N8nMultiAgentResponse;

    // Handle array response
    const result = Array.isArray(data) ? data[0] : data;

    // Check if this is a multi-agent orchestration response
    if (this.isMultiAgentResponse(result)) {
      await this.handleMultiAgentResponse(result as N8nMultiAgentResponse, encoder, res, messageId, threadId, runId);
    } else {
      // Simple response - just extract content
      res.write(encoder.encodeTextMessageStart(messageId, 'assistant'));

      const content = this.extractContentFromN8nResponse(result as N8nWebhookResponse);
      if (content) {
        const chunkSize = 20;
        for (let i = 0; i < content.length; i += chunkSize) {
          const chunk = content.slice(i, i + chunkSize);
          res.write(encoder.encodeTextMessageContent(messageId, chunk));
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      res.write(encoder.encodeTextMessageEnd(messageId));
      res.write(encoder.encodeRunFinished(threadId, runId, 'success'));
    }
  }

  /**
   * Handle multi-agent orchestration response
   * Emits all events from the orchestration including planning, tool calls, and QC
   */
  private async handleMultiAgentResponse(
    response: N8nMultiAgentResponse,
    encoder: AGUIEventEncoder,
    res: Response,
    messageId: string,
    threadId: string,
    runId: string
  ): Promise<void> {
    // Emit all events from the orchestration
    if (response.events && Array.isArray(response.events)) {
      for (const event of response.events) {
        const encoded = encoder.encodeN8nEvent(event);
        if (encoded) {
          res.write(encoded);
          // Small delay between events for smooth streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }

    // Emit state snapshot with plan and results
    if (response.plan || response.stepResults) {
      res.write(encoder.encodeStateSnapshot({
        plan: response.plan,
        stepResults: response.stepResults,
        qualityScore: response.qualityScore,
        iterations: response.iterations,
        executionTime: response.executionTime
      }));
    }

    // Emit final text message with output
    res.write(encoder.encodeTextMessageStart(messageId, 'assistant'));

    const output = response.output || response.qcResult?.finalSummary || '';
    if (output) {
      const chunkSize = 30;
      for (let i = 0; i < output.length; i += chunkSize) {
        const chunk = output.slice(i, i + chunkSize);
        res.write(encoder.encodeTextMessageContent(messageId, chunk));
        await new Promise(resolve => setTimeout(resolve, 15));
      }
    }

    res.write(encoder.encodeTextMessageEnd(messageId));
    res.write(encoder.encodeRunFinished(threadId, runId, 'success'));
  }

  /**
   * Check if response is from multi-agent orchestration
   */
  private isMultiAgentResponse(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    return (
      Array.isArray(obj.events) ||
      obj.plan !== undefined ||
      obj.stepResults !== undefined ||
      obj.qcResult !== undefined
    );
  }

  /**
   * Check if data is an AG-UI agent event
   */
  private isN8nAgentEvent(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    const eventTypes = [
      'RUN_STARTED', 'RUN_FINISHED', 'RUN_ERROR',
      'STEP_STARTED', 'STEP_FINISHED',
      'TOOL_CALL_START', 'TOOL_CALL_ARGS', 'TOOL_CALL_END', 'TOOL_CALL_RESULT',
      'STATE_SNAPSHOT', 'STATE_DELTA',
      'TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_END'
    ];
    return typeof obj.type === 'string' && eventTypes.includes(obj.type);
  }

  /**
   * Extract content from n8n streaming chunk
   */
  private extractContentFromN8nChunk(chunk: unknown): string {
    if (typeof chunk === 'string') return chunk;

    if (typeof chunk === 'object' && chunk !== null) {
      const obj = chunk as Record<string, unknown>;

      if (typeof obj.content === 'string') return obj.content;
      if (typeof obj.text === 'string') return obj.text;
      if (typeof obj.message === 'string') return obj.message;
      if (typeof obj.output === 'string') return obj.output;
      if (typeof obj.response === 'string') return obj.response;

      // Handle OpenAI-style delta format
      if (obj.choices && Array.isArray(obj.choices)) {
        const choice = obj.choices[0] as Record<string, unknown>;
        if (choice?.delta && typeof choice.delta === 'object') {
          const delta = choice.delta as Record<string, unknown>;
          if (typeof delta.content === 'string') return delta.content;
        }
      }
    }

    return '';
  }

  /**
   * Extract content from n8n JSON response
   */
  private extractContentFromN8nResponse(response: N8nWebhookResponse): string {
    return response.output ||
           response.text ||
           response.message ||
           response.response ||
           (typeof response.data === 'string' ? response.data : '') ||
           JSON.stringify(response);
  }

  /**
   * Call n8n webhook with tool execution
   */
  async executeToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
    threadId: string
  ): Promise<string> {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool: toolName,
        args: toolArgs,
        sessionId: threadId
      })
    });

    if (!response.ok) {
      throw new Error(`Tool execution failed: ${response.status}`);
    }

    const data = await response.json() as N8nWebhookResponse;
    return this.extractContentFromN8nResponse(data);
  }
}
