import { TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { ActionHistoryModule } from "@/action-history/action-history.module";
import { ActionHistoryService } from "@/action-history/action-history.service";
import { runAsActor } from "@/action-history/action-actor.context";
import { withUserContext } from "@/common/db/with-context";
import {
  createIntegrationModule,
  cleanTables,
  createTestUserDirect,
} from "../helpers/integration-setup";

// T7: every history entry says who initiated it. Asserted against the real
// table, because a mocked repository records whatever it is handed and cannot
// show the column exists, accepts the value, or defaults for old callers.
describe("Action history actor attribution (integration)", () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: ActionHistoryService;

  beforeAll(async () => {
    module = await createIntegrationModule([ActionHistoryModule]);
    dataSource = module.get(DataSource);
    service = module.get(ActionHistoryService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await cleanTables(dataSource, ["action_history", "users"]);
  });

  const params = (description: string) => ({
    entityType: "payee",
    entityId: null,
    action: "create" as const,
    description,
  });

  async function rows(userId: string) {
    return dataSource.query(
      `SELECT description, actor_type, tool_name FROM action_history WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    );
  }

  it("defaults to the user when nothing sets an actor", async () => {
    const user = await createTestUserDirect(dataSource);
    await withUserContext(user.id, () =>
      service.record(user.id, params("direct")),
    );
    expect(await rows(user.id)).toEqual([
      { description: "direct", actor_type: "user", tool_name: null },
    ]);
  });

  it("records an AI-confirmed action with its tool name", async () => {
    const user = await createTestUserDirect(dataSource);
    await withUserContext(user.id, () =>
      runAsActor({ actorType: "ai", toolName: "create_transaction" }, () =>
        service.record(user.id, params("by ai")),
      ),
    );
    expect(await rows(user.id)).toEqual([
      {
        description: "by ai",
        actor_type: "ai",
        tool_name: "create_transaction",
      },
    ]);
  });

  it("records an MCP write, and the actor does not leak to the next call", async () => {
    const user = await createTestUserDirect(dataSource);
    await withUserContext(user.id, async () => {
      await runAsActor({ actorType: "mcp", toolName: null }, () =>
        service.record(user.id, params("by mcp")),
      );
      await service.record(user.id, params("after"));
    });
    const out = await rows(user.id);
    expect(out.map((r: { actor_type: string }) => r.actor_type).sort()).toEqual(
      ["mcp", "user"],
    );
  });
});
