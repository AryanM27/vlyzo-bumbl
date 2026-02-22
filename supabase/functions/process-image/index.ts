// supabase/functions/process-image/index.ts
// ============================================================================
// Vlyzo — Process Outfit Image Edge Function
// ============================================================================
// This is the orchestrator between:
//   1. Mobile App (sends base64 image)
//   2. Brev GPU Server (rembg → SegFormer → FashionCLIP)
//   3. Supabase Storage (saves cropped garment PNGs)
//   4. Supabase DB (saves classifications + embeddings)
//
// Flow:
//   App → POST /process-image → Brev Vision Pipeline → Save crops to S3
//       → Insert wardrobe_items rows → Return results to app
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Config ──────────────────────────────────────────────────────────────────

const BREV_VISION_URL = Deno.env.get("BREV_VISION_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface VisionItem {
    segment_label: string;
    segment_confidence: number;
    category: { label: string; confidence: number };
    top_categories: { label: string; confidence: number }[];
    style: { label: string; confidence: number };
    color: { label: string; confidence: number };
    pattern: { label: string; confidence: number };
    material: { label: string; confidence: number };
    season: { label: string; confidence: number };
    tags: string[];
    embedding: number[];
    cropped_image_base64: string;
}

interface VisionResponse {
    items_found: number;
    items: VisionItem[];
}

interface SavedItem {
    id: string;
    segment_label: string;
    category: string;
    category_confidence: number;
    style: string;
    color: string;
    pattern: string;
    material: string;
    season: string;
    tags: string[];
    cropped_image_url: string;
}

// ─── Base64 Helpers ──────────────────────────────────────────────────────────

function base64ToUint8Array(base64: string): Uint8Array {
    // Strip data URI prefix if present
    const cleaned = base64.includes(",") ? base64.split(",")[1] : base64;
    const binaryStr = atob(cleaned);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
}

// ─── Response Helpers ────────────────────────────────────────────────────────

function jsonOk(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

function jsonError(message: string, status = 400): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Debug: log env var status
        console.log("SUPABASE_URL set:", !!SUPABASE_URL, "length:", SUPABASE_URL.length);
        console.log("SUPABASE_SERVICE_ROLE_KEY set:", !!SUPABASE_SERVICE_ROLE_KEY, "length:", SUPABASE_SERVICE_ROLE_KEY.length);

        // 1. Authenticate the user
        const authHeader = req.headers.get("Authorization");
        console.log("Authorization header present:", !!authHeader);

        if (!authHeader) {
            return jsonError("Missing Authorization header", 401);
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Verify the JWT token
        const token = authHeader.replace("Bearer ", "");
        console.log("Token length:", token.length);
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser(token);

        console.log("Auth result - user:", !!user, "error:", authError?.message || "none");

        if (authError || !user) {
            return jsonError(`Unauthorized: ${authError?.message || "no user"}`, 401);
        }

        const userId = user.id;

        // 2. Parse request body
        const body = await req.json();
        const { image_base64, mode = "outfit" } = body;

        if (!image_base64) {
            return jsonError("Missing image_base64 field", 400);
        }

        // 3. Create a processing job for async tracking
        const { data: job, error: jobError } = await supabase
            .from("processing_jobs")
            .insert({
                user_id: userId,
                status: "processing",
            })
            .select("id")
            .single();

        if (jobError) {
            console.error("Failed to create processing job:", jobError);
            return jsonError("Failed to create processing job", 500);
        }

        const jobId = job.id;

        try {
            // 4. Send image to Brev Vision Pipeline
            const endpoint =
                mode === "single" ? "/process-single" : "/process-outfit";
            console.log(`Sending to Brev: ${BREV_VISION_URL}${endpoint}`);

            const visionRes = await fetch(`${BREV_VISION_URL}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_base64 }),
            });

            if (!visionRes.ok) {
                const errText = await visionRes.text();
                throw new Error(
                    `Vision pipeline error (${visionRes.status}): ${errText}`
                );
            }

            const visionData: VisionResponse = await visionRes.json();
            console.log(
                `Vision pipeline returned ${visionData.items_found} items`
            );

            // 5. For each detected item: upload crop to Storage + insert DB row
            const savedItems: SavedItem[] = [];

            for (const item of visionData.items) {
                const itemId = crypto.randomUUID();

                // 5a. Upload cropped image to Supabase Storage
                const storagePath = `${userId}/items/${itemId}.png`;
                const imageBytes = base64ToUint8Array(item.cropped_image_base64);

                const { error: uploadError } = await supabase.storage
                    .from("wardrobe")
                    .upload(storagePath, imageBytes, {
                        contentType: "image/png",
                        upsert: false,
                    });

                if (uploadError) {
                    console.error(
                        `Storage upload failed for ${storagePath}:`,
                        uploadError
                    );
                    // Continue processing other items even if one upload fails
                    continue;
                }

                // 5b. Get the public URL for the cropped image
                const { data: urlData } = supabase.storage
                    .from("wardrobe")
                    .getPublicUrl(storagePath);

                const croppedImageUrl = urlData?.publicUrl ?? storagePath;

                // 5c. Insert wardrobe item into database
                const itemRow = {
                    id: itemId,
                    user_id: userId,
                    name: `${item.color.label} ${item.category.label}`,
                    category: item.segment_label,
                    image_url: croppedImageUrl,
                    tags: item.tags,
                    ai_category: item.category.label,
                    ai_category_confidence: item.category.confidence,
                    ai_style: item.style.label,
                    ai_color: item.color.label,
                    ai_pattern: item.pattern.label,
                    ai_material: item.material.label,
                    ai_season: item.season.label,
                    segment_label: item.segment_label,
                    cropped_image_url: croppedImageUrl,
                    embedding: JSON.stringify(item.embedding),
                    ai_processed_at: new Date().toISOString(),
                };

                const { error: insertError } = await supabase
                    .from("wardrobe_items")
                    .insert(itemRow);

                if (insertError) {
                    console.error(`DB insert failed for ${itemId}:`, insertError);
                    continue;
                }

                savedItems.push({
                    id: itemId,
                    segment_label: item.segment_label,
                    category: item.category.label,
                    category_confidence: item.category.confidence,
                    style: item.style.label,
                    color: item.color.label,
                    pattern: item.pattern.label,
                    material: item.material.label,
                    season: item.season.label,
                    tags: item.tags,
                    cropped_image_url: croppedImageUrl,
                });
            }

            // 6. Update processing job as completed
            await supabase
                .from("processing_jobs")
                .update({
                    status: "completed",
                    items_found: savedItems.length,
                    completed_at: new Date().toISOString(),
                })
                .eq("id", jobId);

            // 7. Return results to the app
            return jsonOk({
                job_id: jobId,
                items_found: savedItems.length,
                items: savedItems,
            });
        } catch (pipelineError) {
            // Mark job as failed
            await supabase
                .from("processing_jobs")
                .update({
                    status: "failed",
                    error_message: String(pipelineError),
                    completed_at: new Date().toISOString(),
                })
                .eq("id", jobId);

            throw pipelineError;
        }
    } catch (error) {
        console.error("Error:", error);
        return jsonError(String(error), 500);
    }
});
