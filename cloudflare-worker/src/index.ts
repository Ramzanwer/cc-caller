import { Container, getContainer } from "@cloudflare/containers";

type Env = {
  CLAUDE_CALLER: unknown;
};

export class ClaudeCallerContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "10m";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const containerInstance = getContainer(env.CLAUDE_CALLER, "default");
    await containerInstance.startAndWaitForPorts();
    return containerInstance.fetch(request);
  }
};

