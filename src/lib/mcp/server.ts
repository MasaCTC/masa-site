// The MCP server behind /api/mcp: the five planner tools, wired to mcp-handler
// and gated by owner-only bearer auth. The route file only calls handleMcp.
// Plain Request/Response, so node:test can drive it in-process.
//
// mcp-handler 2.x serves Streamable HTTP only (no SSE, no Redis) and ignores
// the request path, so routing is the route file's job (static /api/mcp).
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { requestOrigin, SCOPE, MCP_RESOURCE_PATH } from "./oauth.ts";
import {
  addTaskTool,
  completeTaskTool,
  getTodaysPlanTool,
  listTasksTool,
  updateTaskTool,
  type ToolCtx,
  type ToolOutput,
} from "./tools.ts";
import { verifyAccess } from "./verify.ts";

export const RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${MCP_RESOURCE_PATH}`;

// Input schemas advertised to the client. Plain JSON types, no transforms or
// defaults, so the args the SDK hands back are the caller's own values (an
// omitted field stays omitted; update_task relies on that). The tool
// functions re-validate with the planner's own schemas (trim, nulls, etc.).
const isoDate = z.iso.date();
const taskId = z.uuid().describe("Task id (UUID) as returned by list_tasks or get_todays_plan.");
const title = z.string().min(1).max(300).describe("Task title (1-300 characters).");
const estMinutes = z.number().int().min(1).max(1440).describe("Estimated minutes, a whole number from 1 to 1440.");

const listInput = z.object({
  day: isoDate
    .optional()
    .describe("Only tasks due on this date, YYYY-MM-DD (planner time zone). Omit for all dates."),
  class: z
    .string()
    .optional()
    .describe("Only tasks in this class or category, by name (case-insensitive, e.g. \"CS 101\") or by id."),
  status: z
    .enum(["open", "done", "all"])
    .optional()
    .describe("open (default) = not done, done = completed, all = both."),
});
const addInput = z.object({
  title,
  class: z
    .string()
    .optional()
    .describe("Class or category, by name (case-insensitive) or id. Omit for no class."),
  dueDate: isoDate.optional().describe("Due date, YYYY-MM-DD. Omit for no due date."),
  estMinutes: estMinutes.optional(),
  onToday: z
    .boolean()
    .optional()
    .describe("Put the task on today's plan. Defaults to true; pass false to only add it to the backlog."),
});
const updateInput = z.object({
  id: taskId,
  title: title.optional(),
  class: z
    .string()
    .nullable()
    .optional()
    .describe("New class or category, by name (case-insensitive) or id; null removes the class."),
  dueDate: isoDate.nullable().optional().describe("New due date, YYYY-MM-DD; null clears it."),
  estMinutes: estMinutes.nullable().optional().describe("New estimate in minutes (1-1440); null clears it."),
  onToday: z.boolean().optional().describe("true adds the task to today's plan, false removes it from today."),
});
const completeInput = z.object({
  id: taskId,
  done: z.boolean().optional().describe("true (default) marks the task done; false reopens it."),
});

const GENERIC_ERROR = "The planner could not complete this request. Try again later.";

/**
 * Runs a tool for the authenticated caller. githubId comes ONLY from the
 * verified bearer token (never from tool input). Any throw (e.g. a database
 * failure) becomes a generic isError result; details are logged, not returned.
 */
async function run(
  name: string,
  ctx: ServerContext,
  fn: (c: ToolCtx) => Promise<ToolOutput>,
): Promise<ToolOutput> {
  const githubId = ctx.http?.authInfo?.extra?.githubId;
  const c: ToolCtx = { githubId: typeof githubId === "string" ? githubId : undefined };
  try {
    return await fn(c);
  } catch (err) {
    console.error(`mcp tool ${name} failed:`, err instanceof Error ? err.name : "unknown");
    return { content: [{ type: "text", text: GENERIC_ERROR }], isError: true };
  }
}

export function registerPlannerTools(server: McpServer): void {
  server.registerTool(
    "list_tasks",
    {
      title: "List planner tasks",
      description:
        "List tasks from Masa's planner, ordered by priority. Use this to look up tasks (and their ids) before updating or completing them. Filters: day (YYYY-MM-DD due date), class (name or id), status (open/done/all; default open). Read-only.",
      inputSchema: listInput,
      annotations: { title: "List planner tasks", readOnlyHint: true, openWorldHint: false },
    },
    (args, ctx) => run("list_tasks", ctx, (c) => listTasksTool(c, args)),
  );
  server.registerTool(
    "get_todays_plan",
    {
      title: "Get today's plan",
      description:
        "Get today's checklist in Masa's planner: today's date (YYYY-MM-DD), done/total counts and the tasks on today's plan. Use this when asked what is planned or left for today. Read-only.",
      annotations: { title: "Get today's plan", readOnlyHint: true, openWorldHint: false },
    },
    (ctx) => run("get_todays_plan", ctx, (c) => getTodaysPlanTool(c)),
  );
  server.registerTool(
    "add_task",
    {
      title: "Add a task",
      description:
        "Create a new task in Masa's planner (changes planner data). Give a title; optionally a class or category by name, a due date (YYYY-MM-DD) and an estimate in minutes. The task goes on today's plan unless onToday is false.",
      inputSchema: addInput,
      annotations: {
        title: "Add a task",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (args, ctx) => run("add_task", ctx, (c) => addTaskTool(c, args)),
  );
  server.registerTool(
    "update_task",
    {
      title: "Update a task",
      description:
        "Edit an existing task in Masa's planner (changes planner data). Pass the task id (from list_tasks) and only the fields to change: title, class (name or id; null clears), dueDate (YYYY-MM-DD; null clears), estMinutes (null clears), onToday (add to / remove from today's plan). Omitted fields are left unchanged.",
      inputSchema: updateInput,
      annotations: {
        title: "Update a task",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (args, ctx) => run("update_task", ctx, (c) => updateTaskTool(c, args)),
  );
  server.registerTool(
    "complete_task",
    {
      title: "Complete a task",
      description:
        "Mark a task in Masa's planner as done, or reopen it with done=false (changes planner data). Pass the task id from list_tasks or get_todays_plan.",
      inputSchema: completeInput,
      annotations: {
        title: "Complete a task",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (args, ctx) => run("complete_task", ctx, (c) => completeTaskTool(c, args)),
  );
}

const mcpHandler = createMcpHandler(registerPlannerTools, {
  serverInfo: { name: "masa-planner", version: "1.0.0" },
});

/**
 * The /api/mcp handler. Auth is required for every request and method. The
 * origin for the 401 challenge's resource_metadata URL is derived with
 * requestOrigin (validated forwarded headers), not the adapter's own
 * unvalidated x-forwarded-host logic, so it is wrapped per request.
 */
export function handleMcp(req: Request): Promise<Response> {
  return withMcpAuth(mcpHandler, verifyAccess, {
    required: true,
    requiredScopes: [SCOPE],
    resourceUrl: requestOrigin(req),
    resourceMetadataPath: RESOURCE_METADATA_PATH,
  })(req);
}
