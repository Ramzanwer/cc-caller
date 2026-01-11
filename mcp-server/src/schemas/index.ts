import { z } from "zod";

// Urgency level enum for Zod
export const UrgencyLevelSchema = z.enum(["low", "normal", "high", "critical"]);

// Schema for call_user tool
export const CallUserInputSchema = z.object({
  message: z.string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message too long, max 2000 characters")
    .describe("The message to speak to the user. This will be converted to speech."),
  
  urgency: UrgencyLevelSchema
    .default("normal")
    .describe("Urgency level: 'low' for updates, 'normal' for standard, 'high' for important, 'critical' for urgent"),
  
  context: z.string()
    .max(500)
    .optional()
    .describe("Optional context about what you're working on (shown as text in the call UI)"),
  
  wait_for_response: z.boolean()
    .default(true)
    .describe("Whether to wait for user's verbal response before continuing")
}).strict();

export type CallUserInput = z.infer<typeof CallUserInputSchema>;

// Schema for send_message tool (in an existing call)
export const SendMessageInputSchema = z.object({
  call_id: z.string()
    .min(1)
    .describe("The ID of the active call to send message to"),
  
  message: z.string()
    .min(1)
    .max(2000)
    .describe("The message to speak to the user")
}).strict();

export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

// Schema for wait_for_reply tool
export const WaitForReplyInputSchema = z.object({
  call_id: z.string()
    .min(1)
    .describe("The ID of the call to wait for reply on"),
  
  timeout_seconds: z.number()
    .int()
    .min(5)
    .max(300)
    .default(60)
    .describe("How long to wait for user response (5-300 seconds, default: 60)")
}).strict();

export type WaitForReplyInput = z.infer<typeof WaitForReplyInputSchema>;

// Schema for check_call_status tool
export const CheckCallStatusInputSchema = z.object({
  call_id: z.string()
    .min(1)
    .describe("The ID of the call to check status for")
}).strict();

export type CheckCallStatusInput = z.infer<typeof CheckCallStatusInputSchema>;

// Schema for end_call tool
export const EndCallInputSchema = z.object({
  call_id: z.string()
    .min(1)
    .describe("The ID of the call to end"),
  
  farewell_message: z.string()
    .max(500)
    .optional()
    .describe("Optional goodbye message to speak before ending the call")
}).strict();

export type EndCallInput = z.infer<typeof EndCallInputSchema>;
