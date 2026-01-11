import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "crypto";
import { CallUserInputSchema, type CallUserInput } from "../schemas/index.js";
import { getCallerService } from "../services/caller.js";
import { CallStatus, UrgencyLevel } from "../types.js";

export function registerCallUserTool(server: McpServer): void {
  server.registerTool(
    "call_user",
    {
      title: "Call User",
      description: `Initiate a voice call to the user to report progress or ask for help.

This tool makes Claude Code "call" the user through their web/mobile app. The message you provide will be converted to speech and played to the user. The user can respond verbally.

**When to use:**
- Task completed successfully - report what was done
- Encountered a blocker - need user input to proceed  
- Need clarification on requirements
- Found multiple options - ask user to choose
- Warning about potential issues
- Progress update on long-running tasks

**Urgency Levels:**
- "low": Just an FYI, no rush (e.g., "I've finished organizing the files")
- "normal": Standard notification (e.g., "I need to know which database to use")
- "high": Important, needs attention soon (e.g., "Found a security issue in the code")
- "critical": Urgent, immediate action needed (e.g., "Build is failing, blocking deployment")

**Example messages:**
- "Hey! I've finished refactoring the authentication module. All 47 tests are passing."
- "I'm stuck. The API is returning a 403 error and I can't find the credentials. Where should I look?"
- "Quick question - should I use PostgreSQL or MySQL for this project?"

Returns:
- If user answers: Their spoken response as text
- If no answer: Status indicating call was not answered

Args:
  message: What to say to the user (will be spoken via TTS)
  urgency: How urgent this call is (low/normal/high/critical)
  context: Optional text context shown in the call UI
  wait_for_response: Whether to wait for user's reply (default: true)`,
      inputSchema: CallUserInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: CallUserInput) => {
      const callerService = getCallerService();
      const callId = randomUUID();

      try {
        console.error(`[call_user] Initiating call ${callId} with urgency: ${params.urgency}`);

        const result = await callerService.initiateCall({
          callId,
          message: params.message,
          urgency: params.urgency as UrgencyLevel,
          context: params.context,
          requiresResponse: params.wait_for_response,
          timestamp: Date.now()
        });

        // Format response based on call result
        if (result.status === CallStatus.COMPLETED) {
          const output = {
            success: true,
            call_id: callId,
            status: "completed",
            user_response: result.userResponse || null,
            duration_seconds: result.duration ? Math.round(result.duration / 1000) : null
          };

          let textResponse = `✅ Call completed successfully.`;
          if (result.userResponse) {
            textResponse += `\n\n**User said:** "${result.userResponse}"`;
          }
          if (result.duration) {
            textResponse += `\n\nCall duration: ${Math.round(result.duration / 1000)} seconds`;
          }

          return {
            content: [{ type: "text", text: textResponse }],
            structuredContent: output
          };
        } else if (result.status === CallStatus.NO_ANSWER) {
          const output = {
            success: false,
            call_id: callId,
            status: "no_answer",
            error: "User did not answer the call"
          };

          return {
            content: [{
              type: "text",
              text: `📵 Call not answered. The user may be away or busy.\n\nYou can try again later or continue working independently.`
            }],
            structuredContent: output
          };
        } else {
          const output = {
            success: false,
            call_id: callId,
            status: result.status,
            error: result.error || "Call failed"
          };

          return {
            content: [{
              type: "text",
              text: `❌ Call failed: ${result.error || "Unknown error"}\n\nPlease check if the caller service is running.`
            }],
            structuredContent: output
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[call_user] Error:`, errorMessage);

        return {
          content: [{
            type: "text",
            text: `❌ Failed to initiate call: ${errorMessage}\n\nMake sure the cc-caller backend is running and accessible.`
          }],
          structuredContent: {
            success: false,
            call_id: callId,
            status: "error",
            error: errorMessage
          }
        };
      }
    }
  );
}
