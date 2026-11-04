import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/server";
import { toolResult, toolError } from "../mcp-context";
import { indiaTaxOutput } from "../tool-output-schemas";
import { READ_ONLY } from "../mcp-annotations";
import { numberArg, booleanArg } from "../../common/tool-schemas";
import { INDIA_TAX_OPERATIONS, runIndiaTax } from "../../tax-india/tax-llm";

@Injectable()
export class McpIndiaTaxTools {
  register(server: McpServer) {
    server.registerTool(
      "india_tax",
      {
        title: "India income tax",
        annotations: READ_ONLY,
        description:
          "Indian income tax from the caller's own figures (nothing is read from the ledger): " +
          "old vs new regime comparison, and remaining 80C/80CCD(1B)/80D headroom. " +
          "Whole rupees. supported:false means the case is outside the modelled rules " +
          "(for example surcharge); never estimate it yourself.",
        inputSchema: z.object({
          operation: z.enum(INDIA_TAX_OPERATIONS),
          financialYear: z
            .string()
            .max(12)
            .optional()
            .describe("e.g. FY2025-26 (default)"),
          grossIncome: numberArg(z.number().min(0).max(1e10))
            .optional()
            .describe("Annual gross income; required for compare_regimes"),
          section80C: numberArg(z.number().min(0).max(1e10)).optional(),
          section80CCD1B: numberArg(z.number().min(0).max(1e10)).optional(),
          section80D: numberArg(z.number().min(0).max(1e10)).optional(),
          seniorCitizen: booleanArg().optional(),
        }),
        outputSchema: indiaTaxOutput,
      },
      async (args) => {
        const result = runIndiaTax(args);
        if ("error" in result) return toolError(result.error as string);
        return toolResult(result);
      },
    );
  }
}
