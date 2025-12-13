import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AGUIEventEncoder } from './encoder.js';
import { RunAgentInput, Message, N8nWebhookResponse } from './types.js';

/**
 * N8n Agent Bridge
 * Connects n8n webhooks to the AG-UI protocol
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
    // Get the last user message as the main input
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const chatInput = lastUserMessage?.content || '';

    // Format history for n8n (excluding the last user message)
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
   */
  async streamToAGUI(input: RunAgentInput, encoder: AGUIEventEncoder, res: Response): Promise<void> {
    const { threadId, runId, messages, forwardedProps } = input;
    const messageId = uuidv4();

    // Emit RUN_STARTED
    res.write(encoder.encodeRunStarted(threadId, runId));

    // Emit TEXT_MESSAGE_START
    res.write(encoder.encodeTextMessageStart(messageId, 'assistant'));

    try {
      const { chatInput, history } = this.formatMessagesForN8n(messages);

      // Build request body for n8n webhook
      const requestBody: Record<string, unknown> = {
        chatInput,
        sessionId: threadId,
        ...forwardedProps
      };

      // Include history if available
      if (history.length > 0) {
        requestBody.history = history;
      }

      // Make request to n8n webhook
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

      // Handle streaming response from n8n
      if (contentType.includes('text/event-stream') && response.body) {
        await this.handleStreamingResponse(response, encoder, res, messageId);
      } else {
        // Handle non-streaming JSON response
        await this.handleJsonResponse(response, encoder, res, messageId);
      }

      // Emit TEXT_MESSAGE_END
      res.write(encoder.encodeTextMessageEnd(messageId));

      // Emit RUN_FINISHED
      res.write(encoder.encodeRunFinished(threadId, runId));

    } catch (error) {
      console.error('Error calling n8n webhook:', error);

      // Emit error message as text
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.write(encoder.encodeTextMessageContent(messageId, `Error: ${errorMessage}`));
      res.write(encoder.encodeTextMessageEnd(messageId));

      // Emit RUN_ERROR
      res.write(encoder.encodeError(errorMessage));
    }
  }

  /**
   * Handle streaming SSE response from n8n
   */
  private async handleStreamingResponse(
    response: globalThis.Response,
    encoder: AGUIEventEncoder,
    res: Response,
    messageId: string
  ): Promise<void> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
              const content = this.extractContentFromN8nChunk(parsed);
              if (content) {
                res.write(encoder.encodeTextMessageContent(messageId, content));
              }
            } catch {
              // If not JSON, treat as plain text
              if (data) {
                res.write(encoder.encodeTextMessageContent(messageId, data));
              }
            }
          } else if (line.trim() && !line.startsWith(':')) {
            // Handle non-SSE formatted streaming text
            res.write(encoder.encodeTextMessageContent(messageId, line));
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        res.write(encoder.encodeTextMessageContent(messageId, buffer));
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Handle JSON response from n8n (non-streaming)
   */
  private async handleJsonResponse(
    response: globalThis.Response,
    encoder: AGUIEventEncoder,
    res: Response,
    messageId: string
  ): Promise<void> {
    const data = await response.json() as N8nWebhookResponse | N8nWebhookResponse[];

    // n8n can return array or single object
    const result = Array.isArray(data) ? data[0] : data;
    const content = this.extractContentFromN8nResponse(result);

    if (content) {
      // Stream the content character by character for better UX
      // Or send it all at once if streaming is not desired
      const chunkSize = 20; // Characters per chunk
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        res.write(encoder.encodeTextMessageContent(messageId, chunk));
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * Extract content from n8n streaming chunk
   */
  private extractContentFromN8nChunk(chunk: unknown): string {
    if (typeof chunk === 'string') return chunk;

    if (typeof chunk === 'object' && chunk !== null) {
      const obj = chunk as Record<string, unknown>;

      // Handle various n8n output formats
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
    // Try various common output field names used by n8n AI agents
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
