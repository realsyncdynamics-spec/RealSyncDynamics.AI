import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface UploadRequest {
  tenant_id: string;
  evidence_type: string;
  filename: string;
  content: string;
  mime_type: string;
}

interface EvidenceResponse {
  success: boolean;
  message: string;
  object_url?: string;
  error?: string;
}

async function uploadToR2(
  request: UploadRequest,
  r2Bucket: R2Bucket
): Promise<EvidenceResponse> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const key = `tenant/${request.tenant_id}/${request.evidence_type}/${year}/${month}/${request.filename}`;

    const buffer = new TextEncoder().encode(request.content);

    await r2Bucket.put(key, buffer, {
      httpMetadata: {
        contentType: request.mime_type,
      },
      customMetadata: {
        "uploaded-at": new Date().toISOString(),
        "tenant-id": request.tenant_id,
      },
    });

    return {
      success: true,
      message: `Evidence stored at ${key}`,
      object_url: `https://realsyncdynamics-evidence-vault.r2.cloudflarestorage.com/${key}`,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to upload evidence",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function retrieveFromR2(
  tenant_id: string,
  evidence_type: string,
  filename: string,
  r2Bucket: R2Bucket
): Promise<EvidenceResponse> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const key = `tenant/${tenant_id}/${evidence_type}/${year}/${month}/${filename}`;

    const object = await r2Bucket.get(key);

    if (!object) {
      return {
        success: false,
        message: "Evidence not found",
        error: "Object does not exist",
      };
    }

    const content = await object.text();

    return {
      success: true,
      message: "Evidence retrieved",
      object_url: `https://realsyncdynamics-evidence-vault.r2.cloudflarestorage.com/${key}`,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to retrieve evidence",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const r2Bucket = Deno.env.get("EVIDENCE_VAULT_BUCKET") as unknown as R2Bucket;

  if (!r2Bucket) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "R2 bucket binding not configured",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/api/evidence-vault-r2/upload") {
      const payload = (await req.json()) as UploadRequest;
      const result = await uploadToR2(payload, r2Bucket);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && url.pathname === "/api/evidence-vault-r2/retrieve") {
      const tenant_id = url.searchParams.get("tenant_id");
      const evidence_type = url.searchParams.get("evidence_type");
      const filename = url.searchParams.get("filename");

      if (!tenant_id || !evidence_type || !filename) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Missing required query parameters",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const result = await retrieveFromR2(
        tenant_id,
        evidence_type,
        filename,
        r2Bucket
      );
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: "Endpoint not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
