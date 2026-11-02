import { AsyncLocalStorage } from "async_hooks";

/**
 * Who initiated a write that ends up in the action history.
 *
 * `user`: the person, through the app. `ai`: an AI Assistant action the person
 * confirmed. `mcp`: a write made through an MCP client. It rides an ambient
 * context rather than a parameter because 44 call sites record history and none
 * of them knows how the request reached it.
 */
export type ActionActorType = "user" | "ai" | "mcp";

export interface ActionActor {
  readonly actorType: ActionActorType;
  readonly toolName: string | null;
}

const USER_ACTOR: ActionActor = { actorType: "user", toolName: null };
const storage = new AsyncLocalStorage<ActionActor>();

export function runAsActor<T>(actor: ActionActor, fn: () => T): T {
  return storage.run(actor, fn);
}

export function currentActor(): ActionActor {
  return storage.getStore() ?? USER_ACTOR;
}
