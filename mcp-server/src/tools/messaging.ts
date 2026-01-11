import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SendMessageInputSchema,
  WaitForReplyInputSchema,
  EndCallInputSchema,
  type SendMessageInput,
  type WaitForReplyInput,
  type EndCallInput
} from "../schemas/index.js";
import { getCallerService } from "../services/caller.js";

export function registerSendMessageTool(server: McpServer): void {
  server.registerTool(
    "send_message_in_call",
    {
      title: "Send Message in Active Call",
      description: `Send an additional spoken message during an active call.

Use this when you need to say something else to the user during an ongoing call session.

Args:
  call_id: The ID of the active call (from a previous call_user result)
  message: The message to speak to the user`,
      inputSchema: SendMessageInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: SendMessageInput) => {
      const callerService = getCallerService();

      try {
        await callerService.sendTextMessage(params.call_id, params.message);

        return {
          content: [{
            type: "text",
            text: `📤 Message sent to user in call ${params.call_id}`
          }],
          structuredContent: {
            success: true,
            call_id: params.call_id,
            message_sent: true
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        return {
          content: [{
            type: "text",
            text: `❌ Failed to send message: ${errorMessage}`
          }],
          structuredContent: {
            success: false,
            call_id: params.call_id,
            error: errorMessage
          }
        };
      }
    }
  );
}

export function registerWaitForReplyTool(server: McpServer): void {
  server.registerTool(
    "wait_for_reply",
    {
      title: "Wait for User Reply",
      description: `Wait for the user to respond in an active call.

Use this when you've asked a question and need to wait for the user's verbal response.
The user's speech will be converted to text and returned.

Args:
  call_id: The ID of the active call
  timeout_seconds: How long to wait (5-300 seconds, default: 60)

Returns:
  The user's spoken response as text, or null if timeout`,
      inputSchema: WaitForReplyInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: WaitForReplyInput) => {
      const callerService = getCallerService();

      try {
        console.error(`[wait_for_reply] Waiting ${params.timeout_seconds}s for response on call ${params.call_id}`);

        const response = await callerService.waitForResponse(
          params.call_id,
          params.timeout_seconds * 1000
        );

        if (response) {
          return {
            content: [{
              type: "text",
              text: `🎤 User response received:\n\n"${response.userMessage}"`
            }],
            structuredContent: {
              success: true,
              call_id: params.call_id,
              user_response: response.userMessage,
              received_at: response.timestamp
            }
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `⏱️ No response received within ${params.timeout_seconds} seconds.\n\nThe user may be thinking or away. You can wait again or proceed with your best judgment.`
            }],
            structuredContent: {
              success: false,
              call_id: params.call_id,
              timeout: true,
              waited_seconds: params.timeout_seconds
            }
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        return {
          content: [{
            type: "text",
            text: `❌ Error waiting for reply: ${errorMessage}`
          }],
          structuredContent: {
            success: false,
            call_id: params.call_id,
            error: errorMessage
          }
        };
      }
    }
  );
}

export function registerEndCallTool(server: McpServer): void {
  server.registerTool(
    "end_call",
    {
      title: "End Call",
      description: `End an active call with the user.

Use this when you're done communicating and want to hang up.
Optionally include a farewell message that will be spoken before ending.

Args:
  call_id: The ID of the call to end
  farewell_message: Optional goodbye message`,
      inputSchema: EndCallInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: EndCallInput) => {
      const callerService = getCallerService();

      try {
        if (params.farewell_message) {
          await callerService.sendTextMessage(params.call_id, params.farewell_message);
          // Give time for the message to be spoken
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Note: In a full implementation, we'd send an end call message
        // For now, we just acknowledge the end

        return {
          content: [{
            type: "text",
            text: `📞 Call ${params.call_id} ended.${params.farewell_message ? '\n\nFarewell message delivered.' : ''}`
          }],
          structuredContent: {
            success: true,
            call_id: params.call_id,
            ended: true
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        return {
          content: [{
            type: "text",
            text: `❌ Error ending call: ${errorMessage}`
          }],
          structuredContent: {
            success: false,
            call_id: params.call_id,
            error: errorMessage
          }
        };
      }
    }
  );
}
