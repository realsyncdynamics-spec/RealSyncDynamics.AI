import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Generate a random API key with rsmcp_ prefix
function generateApiKey(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `rsmcp_${randomHex}`;
}

// Hash API key with SHA256
async function hashApiKey(key: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Get key prefix (first 8 chars)
function getKeyPrefix(key: string): string {
  return key.substring(0, 13); // rsmcp_ + 8 chars
}

type KeyAction =
  | "generate"
  | "list"
  | "revoke"
  | "rotate"
  | "get_usage"
  | "validate";

interface KeyRequest {
  action: KeyAction;
  name?: string;
  scopes?: string[];
  key_id?: string;
  key_hash?: string;
}

interface KeyResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

async function handleGenerateKey(req: KeyRequest): Promise<KeyResponse> {
  const authHeader = Deno.env.get("AUTHORIZATION") || "";
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { success: false, error: "Unauthorized" };
  }

  const token = authHeader.substring(7);

  // Get user from token
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return { success: false, error: "Invalid token" };
  }

  // Get tenant
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, error: "No tenant found" };
  }

  // Generate new key
  const plainKey = generateApiKey();
  const keyHash = await hashApiKey(plainKey);
  const keyPrefix = getKeyPrefix(plainKey);
  const scopes = req.scopes || ["evidence.read", "governance.read"];

  // Store key hash (never store plain key)
  const { data: keyData, error: keyError } = await supabase
    .from("mcp_api_keys")
    .insert({
      tenant_id: profile.tenant_id,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      name: req.name || `API Key ${new Date().toISOString()}`,
      scopes,
      created_by: user.id,
    })
    .select()
    .single();

  if (keyError) {
    return { success: false, error: keyError.message };
  }

  // Return plain key ONLY at creation time (never again)
  return {
    success: true,
    data: {
      id: keyData.id,
      key: plainKey, // Only shown once
      key_prefix: keyPrefix,
      name: keyData.name,
      scopes: keyData.scopes,
      created_at: keyData.created_at,
      expires_at: keyData.expires_at,
    },
  };
}

async function handleListKeys(): Promise<KeyResponse> {
  const authHeader = Deno.env.get("AUTHORIZATION") || "";
  if (!authHeader) {
    return { success: false, error: "Unauthorized" };
  }

  const token = authHeader.substring(7);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return { success: false, error: "Invalid token" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, error: "No tenant found" };
  }

  // List keys (without key_hash)
  const { data: keys, error } = await supabase
    .from("mcp_api_keys")
    .select("id, key_prefix, name, scopes, active, created_at, expires_at, last_used_at")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: keys };
}

async function handleRevokeKey(keyId: string): Promise<KeyResponse> {
  const authHeader = Deno.env.get("AUTHORIZATION") || "";
  if (!authHeader) {
    return { success: false, error: "Unauthorized" };
  }

  const token = authHeader.substring(7);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return { success: false, error: "Invalid token" };
  }

  // Verify ownership
  const { data: key } = await supabase
    .from("mcp_api_keys")
    .select("tenant_id")
    .eq("id", keyId)
    .single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!key || key.tenant_id !== profile.tenant_id) {
    return { success: false, error: "Forbidden" };
  }

  // Revoke
  const { error } = await supabase
    .from("mcp_api_keys")
    .update({ active: false })
    .eq("id", keyId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { id: keyId, revoked: true } };
}

async function handleValidateKey(keyHash: string): Promise<KeyResponse> {
  // Called by MCP Server to validate a key
  const { data: result } = await supabase.rpc("mcp_key_is_valid", {
    p_key_hash: keyHash,
  });

  if (!result || result.length === 0) {
    return { success: false, error: "Invalid key" };
  }

  const [row] = result;
  if (!row.valid) {
    return { success: false, error: "Key expired or inactive" };
  }

  return {
    success: true,
    data: {
      valid: true,
      key_id: row.key_id,
      tenant_id: row.tenant_id,
      scopes: row.scopes,
    },
  };
}

serve(async (req: Request) => {
  const requestBody: KeyRequest = await req.json().catch(() => ({}));
  const action = requestBody.action || "list";

  let response: KeyResponse;

  switch (action) {
    case "generate":
      response = await handleGenerateKey(requestBody);
      break;
    case "list":
      response = await handleListKeys();
      break;
    case "revoke":
      response = await handleRevokeKey(requestBody.key_id || "");
      break;
    case "validate":
      response = await handleValidateKey(requestBody.key_hash || "");
      break;
    default:
      response = { success: false, error: `Unknown action: ${action}` };
  }

  return new Response(JSON.stringify(response), {
    headers: { "Content-Type": "application/json" },
    status: response.success ? 200 : 400,
  });
});
