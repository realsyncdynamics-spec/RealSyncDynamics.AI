import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase Client
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {
    global: {
      headers: { Authorization: Deno.env.get("REQUEST_AUTH_HEADER") ?? "" },
    },
  }
);

// Helper: Get tenant_id from memberships (NOT from profiles!)
async function getTenantId(userId: string): Promise<string | null> {
  const { data: membership, error } = await supabaseAdmin
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .single();

  if (error || !membership?.tenant_id) {
    console.error("Membership lookup failed:", error);
    return null;
  }
  return membership.tenant_id;
}

// Helper: Store credential in Supabase Vault (NOT in plaintext!)
async function storeCredentialInVault(
  serverId: string,
  credentialName: string,
  credentialValue: string
): Promise<{ vaultKey: string; error?: Error }> {
  const vaultKey = `mcp_credential_${serverId}_${credentialName}`;
  
  const { data: secret, error } = await supabaseAdmin
    .vault
    .createSecret(vaultKey, credentialValue);

  if (error) {
    console.error("Vault secret creation failed:", error);
    return { vaultKey: "", error };
  }

  return { vaultKey: secret.key };
}

// Helper: Retrieve credential from Supabase Vault
async function getCredentialFromVault(vaultKey: string): Promise<string | null> {
  const { data: secret, error } = await supabaseAdmin
    .vault
    .getSecret(vaultKey);

  if (error || !secret) {
    console.error("Vault secret retrieval failed:", error);
    return null;
  }

  return secret.value;
}

// Main Handler
serve(async (req) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize client with user token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get tenant_id from memberships (NOT from profiles!)
    const tenantId = await getTenantId(user.id);
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "User profile not found or no tenant membership" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const { method, url, headers } = req;
    const path = new URL(url).pathname;

    // --- GET /servers - List MCP Servers for Tenant ---
    if (method === "GET" && path === "/servers") {
      const { data: servers, error } = await supabaseAdmin
        .from("mcp_servers")
        .select("*")
        .eq("tenant_id", tenantId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ servers }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // --- POST /servers - Create MCP Server ---
    if (method === "POST" && path === "/servers") {
      const body = await req.json();
      const { name, description, endpoint } = body;

      if (!name || !endpoint) {
        return new Response(
          JSON.stringify({ error: "name and endpoint are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const { data: server, error } = await supabaseAdmin
        .from("mcp_servers")
        .insert({
          tenant_id: tenantId,
          name,
          description,
          endpoint,
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ server }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    // --- POST /servers/:serverId/credentials - Store Credential in Vault ---
    if (method === "POST" && path.match(/\/servers\/([^\/]+)\/credentials/)) {
      const matches = path.match(/\/servers\/([^\/]+)\/credentials/);
      const serverId = matches?.[1];
      if (!serverId) {
        return new Response(
          JSON.stringify({ error: "Invalid server ID" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Verify server belongs to tenant
      const { data: server, error: serverError } = await supabaseAdmin
        .from("mcp_servers")
        .select("tenant_id")
        .eq("id", serverId)
        .single();

      if (serverError || !server || server.tenant_id !== tenantId) {
        return new Response(
          JSON.stringify({ error: "Server not found or not authorized" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { credentialName, credentialValue } = body;

      if (!credentialName || !credentialValue) {
        return new Response(
          JSON.stringify({ error: "credentialName and credentialValue are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Store in Vault (NOT in plaintext!)
      const { vaultKey, error: vaultError } = await storeCredentialInVault(
        serverId,
        credentialName,
        credentialValue
      );

      if (vaultError) {
        return new Response(
          JSON.stringify({ error: "Failed to store credential in vault" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      // Store reference in database
      const { data: credential, error: dbError } = await supabaseAdmin
        .from("mcp_server_credentials")
        .insert({
          server_id: serverId,
          credential_name: credentialName,
          credential_vault_key: vaultKey, // 🟢 Referenz auf Vault, NICHT Klartext!
        })
        .select()
        .single();

      if (dbError) {
        return new Response(
          JSON.stringify({ error: dbError.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ credential }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    // --- GET /servers/:serverId/credentials/:credentialId - Retrieve Credential from Vault ---
    if (method === "GET" && path.match(/\/servers\/([^\/]+)\/credentials\/([^\/]+)/)) {
      const matches = path.match(/\/servers\/([^\/]+)\/credentials\/([^\/]+)/);
      const serverId = matches?.[1];
      const credentialId = matches?.[2];

      if (!serverId || !credentialId) {
        return new Response(
          JSON.stringify({ error: "Invalid server or credential ID" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Verify server belongs to tenant
      const { data: server, error: serverError } = await supabaseAdmin
        .from("mcp_servers")
        .select("tenant_id")
        .eq("id", serverId)
        .single();

      if (serverError || !server || server.tenant_id !== tenantId) {
        return new Response(
          JSON.stringify({ error: "Server not found or not authorized" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      // Get credential reference
      const { data: credential, error: credError } = await supabaseAdmin
        .from("mcp_server_credentials")
        .select("credential_vault_key")
        .eq("id", credentialId)
        .eq("server_id", serverId)
        .single();

      if (credError || !credential?.credential_vault_key) {
        return new Response(
          JSON.stringify({ error: "Credential not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Retrieve from Vault
      const credentialValue = await getCredentialFromVault(credential.credential_vault_key);

      if (!credentialValue) {
        return new Response(
          JSON.stringify({ error: "Failed to retrieve credential from vault" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ credentialValue }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // --- DELETE /servers/:serverId ---
    if (method === "DELETE" && path.match(/\/servers\/([^\/]+)/)) {
      const matches = path.match(/\/servers\/([^\/]+)/);
      const serverId = matches?.[1];

      if (!serverId) {
        return new Response(
          JSON.stringify({ error: "Invalid server ID" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Verify server belongs to tenant
      const { data: server, error: serverError } = await supabaseAdmin
        .from("mcp_servers")
        .select("tenant_id")
        .eq("id", serverId)
        .single();

      if (serverError || !server || server.tenant_id !== tenantId) {
        return new Response(
          JSON.stringify({ error: "Server not found or not authorized" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      // Delete server (cascades to credentials and usage)
      const { error: deleteError } = await supabaseAdmin
        .from("mcp_servers")
        .delete()
        .eq("id", serverId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ message: "Server deleted successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Unknown route
    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
