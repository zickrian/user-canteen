/**
 * MCP (Model Context Protocol) Utilities
 * Connection and SQL execution utilities for Supabase MCP server
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Connect to Supabase MCP server via stdio
 */
export async function connectSupabaseMcp() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN is not configured in environment variables. Get your Personal Access Token from https://supabase.com/dashboard/account/tokens");
  }

  // Validate access token format (should start with sbp_)
  if (!accessToken.startsWith('sbp_')) {
    console.warn('SUPABASE_ACCESS_TOKEN format may be invalid. Personal Access Token should start with "sbp_"');
  }

  console.log('Starting MCP connection with access token:', accessToken.substring(0, 10) + '...');

  try {
    const transport = new StdioClientTransport({
      command: "npx",
      args: [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        accessToken,
        "--read-only",
      ],
      env: {
        ...process.env,
        // Ensure PATH is available for npx
        PATH: process.env.PATH || '',
      },
    });

    const client = new Client(
      { name: "e-kantin-app-mcp-host", version: "1.0.0" },
      { capabilities: {} }
    );

    // Add timeout for connection
    const connectPromise = client.connect(transport);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('MCP connection timeout after 30s')), 30000)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    console.log('MCP connection established successfully');
    
    return client;
  } catch (error: any) {
    console.error('Failed to connect to MCP server:', error.message);
    throw new Error(`MCP connection failed: ${error.message}. Make sure npx is available and SUPABASE_ACCESS_TOKEN is valid.`);
  }
}

/**
 * Find the SQL tool from MCP server
 */
export async function pickSqlTool(mcp: Client) {
  const tools = await mcp.listTools();
  const sqlTool =
    tools.tools?.find((t) => (t.name || "").toLowerCase().includes("sql")) ||
    tools.tools?.find((t) => (t.name || "").toLowerCase().includes("query"));

  if (!sqlTool) {
    throw new Error(
      "Tidak menemukan tool SQL/query di MCP Supabase. Cek output listTools()."
    );
  }
  return sqlTool.name;
}

/**
 * Execute SQL query through MCP
 */
export async function callSql(mcp: Client, sqlToolName: string, sql: string) {
  return await mcp.callTool({
    name: sqlToolName,
    arguments: { sql },
  });
}
