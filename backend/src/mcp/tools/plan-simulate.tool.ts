import { Injectable } from "@nestjs/common";
import { McpServer } from "@modelcontextprotocol/server";
import { toolResult, toolError } from "../mcp-context";
import { planSimulateOutput } from "../tool-output-schemas";
import { READ_ONLY } from "../mcp-annotations";
import {
  planSimulateSchema,
  runPlanSimulation,
} from "../../finance-simulators/simulate-llm";

@Injectable()
export class McpPlanSimulateTools {
  register(server: McpServer) {
    server.registerTool(
      "plan_simulate",
      {
        title: "Plan simulator",
        annotations: READ_ONLY,
        description:
          "What-if planning from figures the user states (nothing is read from the ledger): " +
          "debt payoff (snowball and avalanche side by side) and FIRE corpus/timeline with an " +
          "optional extra monthly saving. Quote the numbers as returned; a status other than " +
          "paid_off/reachable means the goal is not met under those inputs.",
        inputSchema: planSimulateSchema,
        outputSchema: planSimulateOutput,
      },
      async (args) => {
        const result = runPlanSimulation(args);
        if ("error" in result) return toolError(result.error as string);
        return toolResult(result);
      },
    );
  }
}
