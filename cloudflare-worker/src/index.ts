import { Container, getContainer } from "@cloudflare/containers";

type Env = {
  CLAUDE_CALLER: unknown;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

export class ClaudeCallerContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "10m";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const containerInstance = getContainer(env.CLAUDE_CALLER, "default");
    await containerInstance.startAndWaitForPorts({
      startOptions: {
        envVars: {
          ...(env.VAPID_PUBLIC_KEY ? { VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY } : {}),
          ...(env.VAPID_PRIVATE_KEY ? { VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY } : {}),
          ...(env.VAPID_SUBJECT ? { VAPID_SUBJECT: env.VAPID_SUBJECT } : {})
        }
      }
    });
    return containerInstance.fetch(request);
  }
};

