# Vlyzo — AI Implementation Guide

> **rembg + CLIPSeg + FashionCLIP + Nemotron-Nano-9B-v2 on NVIDIA Brev**  
> Implementing the Outfit Generation Pipeline from `flow.md`

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [Model Roles](#2-model-roles)
3. [Why NVIDIA Brev](#3-why-nvidia-brev)
4. [Architecture](#4-architecture)
5. [Step-by-Step Implementation](#5-step-by-step-implementation)
   - [Phase 1: Deploy Vision Pipeline on Brev](#phase-1-deploy-vision-pipeline-rembg--clipseg--fashionclip-on-brev)
   - [Phase 2: Deploy Nemotron-Nano-9B-v2 on Brev](#phase-2-deploy-nemotron-nano-9b-v2-on-brev)
   - [Phase 3: Supabase Edge Function (Middleware)](#phase-3-supabase-edge-function-middleware)
   - [Phase 4: Database Schema Migration](#phase-4-database-schema-migration)
   - [Phase 5: React Native Service Layer](#phase-5-react-native-service-layer)
   - [Phase 6: UI Integration](#phase-6-ui-integration)
6. [Pipeline Mapping to flow.md](#6-pipeline-mapping-to-flowmd)
7. [Feedback & Reinforcement Loop Strategy](#7-feedback--reinforcement-loop-strategy)
8. [Future: Embedding-Based Features](#8-future-embedding-based-features)
9. [Cost & Performance Estimates](#9-cost--performance-estimates)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Pipeline Overview

From `flow.md`, the outfit generation pipeline is:

```
User uploads OOTD / daily outfit photos
        │
        ▼
  Step 1: Background Removal (rembg / U2-Net)
        │  → Clean PNG with transparent background
        ▼
  Step 2: Clothing Segmentation (CLIPSeg)
        │  → Separate cropped image per garment
        ▼
  Step 3: Classification (FashionCLIP)
        │  → Category, style, color, pattern, material + embedding per item
        ▼
  Step 4: Save Cropped Items to Supabase S3 Storage
        │  → Each segmented garment → wardrobe/{user_id}/items/{item_id}.png
        │  → Insert wardrobe_items row per garment
        ▼
  Step 5: Outfit Recommendations (Nemotron-Nano-9B-v2)
        │  → Fetch ALL user's wardrobe items from DB
        │  → Send full wardrobe inventory + new items to Nemotron
        │  → Generate outfit combinations across entire wardrobe
        ▼
  User Feedback (swipe left/right)
        │
        ▼
  Reinforcement Learning (adapt to user taste)
        │
        ▼
  Liked Fits → Confirmation → Drape (final visualization)
```

**Four models** power this pipeline, running on a single Brev GPU server:

| Model | Pipeline Step | Role | Size |
|---|---|---|---|
| **rembg (U2-Net)** | Background Removal | Removes background, outputs clean PNG with alpha channel | ~170MB |
| **CLIPSeg** | Clothing Segmentation | Text-guided segmentation — isolates each garment from the outfit photo | ~600MB |
| **FashionCLIP** | Classification + Embedding | Zero-shot category/style/color/material detection + 512-dim embedding | ~400MB |
| **Nemotron-Nano-9B-v2** | Fashion Modeling | Generates descriptions, outfit pairings, occasion suggestions from CLIP output | ~18GB |

> **Total GPU memory**: ~2-3GB for the vision models + separate deployment for Nemotron. All three vision models run on the same Brev VM.

---

## 2. Model Roles

### 🧹 rembg / U2-Net (Background Removal)

[rembg](https://github.com/danielgatis/rembg) is a Python library that uses the U2-Net model to remove backgrounds from images. It outputs a clean RGBA PNG with a transparent background.

**Why it's needed**: Neither CLIP nor CLIPSeg works well when the photo has a cluttered background (bedroom, mirror selfie, street). Removing the background first produces much cleaner segmentation and classification downstream.

```
Input:  Outfit selfie with messy bedroom background
Output: Same photo, transparent background, only person + clothes visible
Speed:  ~100-300ms (GPU) / ~1-2s (CPU)
```

### ✂️ CLIPSeg (Clothing Segmentation)

[CLIPSeg](https://huggingface.co/CIDAS/clipseg-rd64-refined) is a segmentation model **built on top of CLIP**. Unlike vanilla CLIP which only produces a single embedding for the whole image, CLIPSeg produces **pixel-level segmentation masks** guided by text prompts.

You give it an image + a text prompt like `"shirt"`, and it outputs a mask highlighting where the shirt is. Do this for every clothing category, and you get individual cropped images per garment.

**How it works**:
```
Input:  Clean outfit photo (from rembg) + prompts ["shirt", "pants", "shoes", "jacket", ...]
Output: For each prompt, a probability mask showing where that item is in the image

Example:
  "shirt"  → mask highlights the torso area     → crop → shirt image
  "pants"  → mask highlights the legs area       → crop → pants image
  "shoes"  → mask highlights the feet area       → crop → shoes image
  "jacket" → mask score < 0.5 threshold          → not present, skip
```

**Why CLIPSeg over SAM (Segment Anything)**:
- CLIPSeg is **text-guided** — you tell it what to look for, so it only finds clothing
- SAM segments *everything* (face, hands, furniture) and you'd need extra filtering
- CLIPSeg is ~600MB vs SAM's ~2.5GB
- CLIPSeg is faster for this use case (~300ms vs ~1-2s)

### 🔍 FashionCLIP (Classification + Embedding)

[FashionCLIP](https://huggingface.co/patrickjohncyh/fashion-clip) is a version of OpenAI's CLIP fine-tuned specifically on fashion product data. It classifies each **cropped garment image** from CLIPSeg.

**What FashionCLIP does for each cropped item:**

| Task | How | Output |
|---|---|---|
| **Category Classification** | Zero-shot: compare image against labels `["T-Shirt", "Jeans", "Sneakers", ...]` | `category: "T-Shirt"` + confidence |
| **Style Detection** | Zero-shot against `["casual", "formal", "streetwear", ...]` | `style: "casual"` |
| **Color Detection** | Zero-shot against `["black", "navy", "white", ...]` | `color: "navy"` |
| **Pattern Detection** | Zero-shot against `["solid", "striped", "floral", ...]` | `pattern: "solid"` |
| **Material Detection** | Zero-shot against `["cotton", "denim", "leather", ...]` | `material: "denim"` |
| **Embedding** | Generate a 512-dim vector | Used for similarity search & outfit matching |

**Zero-shot classification** means CLIP classifies images into categories it was never explicitly trained on — you provide label text, and CLIP computes the similarity between the image and each label.

**Example — Classifying a cropped garment:**

```
Image: [cropped photo of a navy denim jacket from CLIPSeg]

FashionCLIP computes similarity against category labels:
  "T-Shirt"     → 0.02
  "Jacket"      → 0.87  ← highest
  "Jeans"       → 0.04
  "Sneakers"    → 0.01
  "Dress"       → 0.01
  ...

Result: category = "Jacket" (87% confidence)
```

The same process runs for style, color, pattern, and material — each with their own label bank.

### 🧠 Nemotron-Nano-9B-v2 (LLM — Text Generation)

Nemotron-Nano-9B-v2 is NVIDIA's 9-billion parameter language model with a hybrid Mamba2-Transformer architecture. It's optimized for reasoning tasks and follows the **OpenAI Chat Completions API** format.

Nemotron **never sees the raw image**. It receives the structured text output from the vision pipeline.

**What Nemotron handles:**

| Task | Input (from vision pipeline) | Output |
|---|---|---|
| **Style Descriptions** | Item attributes from FashionCLIP | *"A versatile navy denim jacket, perfect for layering..."* |
| **Outfit Combinations** | All items' attributes from one outfit | *"Pair the jacket with white tee + black jeans"* |
| **Feedback Interpretation** | Swipe data + item attributes | Preference patterns for personalization |
| **Occasion Matching** | Item attributes | *"Best for: Casual Friday, Weekend brunch"* |

**The complete pipeline:**
```
Image → rembg (clean) → CLIPSeg (segment) → FashionCLIP (classify) → Nemotron (reason)
```

---

## 3. Why NVIDIA Brev

**NVIDIA Brev** is a cloud platform for deploying GPU-backed inference endpoints. Here's why it fits:

| Requirement | Brev Solution |
|---|---|
| Vision models (rembg + CLIPSeg + FashionCLIP) need GPU | Brev provides L40S / A100 GPUs — all 3 fit on one VM (~2-3GB total) |
| Nemotron-Nano-9B-v2 is a 9B param model | Brev has pre-built NIM (NVIDIA Inference Microservice) for it |
| Need an HTTPS API endpoint for Supabase Edge Functions to call | Brev exposes deployed models as REST APIs |
| Auto-scaling for production traffic | Brev Deployments support min/max worker scaling |
| Don't want to manage infrastructure | Managed NIM deployment = one-click for Nemotron |

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────┐
│  React Native App (Expo)                             │
│  ────────────────────────────────────────            │
│  1. User uploads outfit / wardrobe photo             │
│  2. Base64-encode the image                          │
│  3. Call aiService.processOutfitImage()               │
│     → invokes Supabase Edge Function                 │
│  4. Display results (items found, categories, etc.)  │
│  5. Collect swipe feedback (like/dislike)             │
└──────────────────────┬───────────────────────────────┘
                       │ HTTPS POST
                       ▼
┌──────────────────────────────────────────────────────┐
│  Supabase Edge Function: "process-image"             │
│  ────────────────────────────────────────            │
│  1. Receive { image_base64, user_id }                │
│  2. POST image to Vision Pipeline on Brev            │
│  3. Receive segmented items + classifications        │
│  4. POST all items' attributes to Nemotron on Brev   │
│  5. Receive style analysis per item                  │
│  6. INSERT wardrobe_items rows in Supabase DB        │
│  7. Return combined result to the app                │
└───────┬──────────────────────────┬───────────────────┘
        │                          │
        ▼                          ▼
┌────────────────────────┐  ┌───────────────────────────┐
│  Brev VM:              │  │  Brev NIM:                │
│  Vision Pipeline       │  │  Nemotron-Nano-9B-v2      │
│  ────────────────────  │  │  ─────────────────────    │
│                        │  │                           │
│  POST /process-outfit  │  │  /v1/chat/completions     │
│                        │  │  (OpenAI-compatible API)  │
│  Step 1: rembg         │  │                           │
│    → remove background │  │  Input: FashionCLIP       │
│                        │  │    attributes for each    │
│  Step 2: CLIPSeg       │  │    segmented item         │
│    → segment each      │  │                           │
│      clothing item     │  │  Output: descriptions,    │
│                        │  │    pairings, occasions    │
│  Step 3: FashionCLIP   │  │                           │
│    → classify each     │  │                           │
│      cropped item      │  │                           │
│    → generate embedding│  │                           │
│                        │  │                           │
│  Output per item:      │  │                           │
│    category, style,    │  │                           │
│    color, pattern,     │  │                           │
│    material, embedding │  │                           │
└────────────────────────┘  └───────────────────────────┘
```

---

## 5. Step-by-Step Implementation

### Phase 1: Deploy Vision Pipeline (rembg + CLIPSeg + FashionCLIP) on Brev

All three vision models run on a **single Brev VM** behind a single FastAPI server. They are not pre-built NIMs, so you deploy them as a **custom container**.

#### Strategy

1. **Create a Brev account** at [brev.nvidia.com](https://brev.nvidia.com)
2. **Launch a GPU VM**: Instances → Create → VM Mode → **L40S 48GB** (recommended) or T4 16GB (budget)
3. **SSH into the VM** using Brev CLI:
   ```bash
   brev shell <instance-name>
   ```
4. **Install dependencies**:
   ```bash
   pip install torch torchvision transformers pillow fastapi uvicorn pydantic rembg
   ```
5. **Create the vision pipeline server** — a FastAPI app that exposes a single `/process-outfit` endpoint:

   **Step 1 inside the server — Background Removal (rembg)**:
   ```python
   from rembg import remove
   from PIL import Image

   clean_image = remove(input_image)  # Returns RGBA with transparent background
   ```
   - Uses U2-Net under the hood (~170MB)
   - Removes cluttered backgrounds (bedroom, mirror selfies, streets)
   - Outputs a clean RGBA PNG — only person + clothing visible
   - Speed: ~100-300ms on GPU

   **Step 2 inside the server — Clothing Segmentation (CLIPSeg)**:
   ```python
   from transformers import CLIPSegProcessor, CLIPSegForImageSegmentation

   clipseg_model = CLIPSegForImageSegmentation.from_pretrained("CIDAS/clipseg-rd64-refined")
   clipseg_processor = CLIPSegProcessor.from_pretrained("CIDAS/clipseg-rd64-refined")

   # Segment each clothing category
   prompts = ["shirt", "pants", "shoes", "jacket", "dress", "skirt", "hat", "bag"]
   inputs = clipseg_processor(text=prompts, images=[clean_image] * len(prompts), return_tensors="pt")
   outputs = clipseg_model(**inputs)

   for i, prompt in enumerate(prompts):
       mask = torch.sigmoid(outputs.logits[i])
       if mask.max() > 0.5:  # item is present
           cropped_item = apply_mask_and_crop(clean_image, mask)
           # → send this cropped image to FashionCLIP in Step 3
   ```
   - Text-guided: you tell it what clothing to look for
   - Returns a probability mask per prompt — threshold at 0.5 to detect presence
   - Only finds items you asked for (no faces, hands, furniture)
   - Speed: ~300ms for all prompts

   **Step 3 inside the server — Classification (FashionCLIP)**:
   ```python
   from transformers import CLIPProcessor, CLIPModel

   clip_model = CLIPModel.from_pretrained("patrickjohncyh/fashion-clip")
   clip_processor = CLIPProcessor.from_pretrained("patrickjohncyh/fashion-clip")

   # For each cropped item from CLIPSeg:
   #   Zero-shot classify against label banks:
   #     Categories: T-Shirt, Shirt, Blouse, Jacket, Jeans, Dress, Sneakers, Bag, Hat, ...
   #     Styles:     casual, formal, streetwear, bohemian, minimalist, sporty, vintage, ...
   #     Colors:     black, white, navy, beige, red, blue, green, ...
   #     Patterns:   solid, striped, floral, plaid, polka dot, geometric, ...
   #     Materials:  cotton, denim, leather, silk, wool, polyester, linen, ...
   #     Seasons:    spring, summer, autumn, winter, all-season
   #   Also generate a 512-dim embedding vector per item
   ```

6. **Run the server**:
   ```bash
   uvicorn vision_server:app --host 0.0.0.0 --port 8000
   ```
7. **Expose port 8000** in the Brev console: Instances → your VM → Ports → Add Port 8000
8. **Note the public URL** — this is your `VISION_API_URL`

#### Docker Alternative

For a more production-ready setup:
```bash
# Build container with all 3 models pre-baked (avoids cold start)
docker build -t vlyzo-vision .
docker run --gpus all -p 8000:8000 vlyzo-vision
```

The Dockerfile should use `nvidia/cuda:12.1.0-runtime-ubuntu22.04` as base and pre-download all three models at build time.

#### Testing the Endpoint

```bash
# Health check
curl https://<your-brev-url>/health

# Process a full outfit photo
curl -X POST https://<your-brev-url>/process-outfit \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "<base64-string>"}'

# Expected response:
# {
#   "items_found": 3,
#   "items": [
#     {
#       "segment_label": "shirt",
#       "category": {"label": "T-Shirt", "confidence": 0.92},
#       "style": {"label": "casual", "confidence": 0.78},
#       "color": {"label": "white", "confidence": 0.90},
#       "pattern": {"label": "solid", "confidence": 0.95},
#       "material": {"label": "cotton", "confidence": 0.82},
#       "season": {"label": "summer", "confidence": 0.70},
#       "tags": ["t-shirt", "casual", "white", "solid", "cotton"],
#       "embedding": [0.12, -0.03, ...],
#       "cropped_image_base64": "..."   // optional
#     },
#     {
#       "segment_label": "pants",
#       "category": {"label": "Jeans", "confidence": 0.88},
#       ...
#     },
#     {
#       "segment_label": "shoes",
#       "category": {"label": "Sneakers", "confidence": 0.85},
#       ...
#     }
#   ]
# }
```

#### GPU Requirements

| Model | Size | Inference Time |
|---|---|---|
| rembg (U2-Net) | ~170MB | ~100-300ms |
| CLIPSeg | ~600MB | ~300ms |
| FashionCLIP | ~400MB | ~200ms per item |
| **Total (all 3)** | **~2-3GB VRAM** | **~1-2s for full outfit** |

Min GPU: **T4 16GB**. Recommended: **L40S 48GB** (headroom for concurrent requests).

---

### Phase 2: Deploy Nemotron-Nano-9B-v2 on Brev

Nemotron **IS** a pre-built NIM on Brev, so deployment is one-click.

#### Strategy

1. Go to **Deployments** → **Create New Deployment**
2. Select model: **`nvidia/Nemotron-Nano-9B-v2`**
3. Select GPU: **L40S 48GB** (minimum) or **A100 80GB** (recommended)
4. Configure scaling: min workers = 1, max workers = 2
5. Name the deployment (e.g., `vlyzo-nemotron`)
6. Click Deploy → wait for status to show "Active"
7. **Copy the API Endpoint URL** and **API Key** from the deployment dashboard

#### API Format

Brev Nemotron follows the **OpenAI Chat Completions API**:

```bash
curl -X POST https://<your-nemotron-url>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-api-key>" \
  -d '{
    "model": "nvidia/nemotron-nano-9b-v2",
    "messages": [
      {"role": "system", "content": "You are a fashion stylist AI."},
      {"role": "user", "content": "Analyze this item: Jacket, casual, navy, denim..."}
    ],
    "temperature": 0.7,
    "max_tokens": 512
  }'
```

#### What Nemotron Receives

Nemotron **never sees images**. It receives the structured text output from the vision pipeline — but crucially, it receives the **entire user's wardrobe**, not just the currently uploaded item. This lets it generate recommendations that work with what the user already owns.

```
── Newly uploaded items (from current CLIP pipeline) ──
Item 1: T-Shirt, casual, white, solid, cotton, summer
Item 2: Jeans, casual, blue, solid, denim, all-season
Item 3: Sneakers, sporty, white, solid, leather, all-season

── Existing wardrobe (fetched from Supabase DB) ──
Item A: Jacket, casual, navy, solid, denim, autumn
Item B: Hoodie, streetwear, black, solid, cotton, winter
Item C: Chinos, smart casual, khaki, solid, cotton, spring
Item D: Boots, casual, brown, solid, leather, autumn
Item E: Scarf, elegant, burgundy, solid, wool, winter
... (all user's items)

→ Nemotron generates:
{
  "new_items_analysis": [
    {
      "item": "T-Shirt (white, cotton)",
      "description": "A clean white cotton tee — the most versatile piece in any wardrobe...",
      "care_tips": "Machine wash cold, tumble dry low."
    },
    ...
  ],
  "outfit_recommendations": [
    {
      "name": "Casual Weekend",
      "items": ["T-Shirt (white)", "Jeans (blue)", "Sneakers (white)"],
      "why": "Classic casual combo — the white tee and sneakers create a clean look against the denim."
    },
    {
      "name": "Layered Autumn",
      "items": ["T-Shirt (white)", "Jacket (navy denim)", "Chinos (khaki)", "Boots (brown)"],
      "why": "The navy jacket over white tee with earth-tone bottoms is a timeless fall look."
    },
    {
      "name": "Street Style",
      "items": ["Hoodie (black)", "Jeans (blue)", "Sneakers (white)"],
      "why": "Black and white contrast with denim — effortless streetwear."
    }
  ]
}
```

#### GPU Requirements

| Model | Min GPU | Recommended | Inference Time |
|---|---|---|---|
| Nemotron-Nano-9B-v2 | L40S 48GB | A100 80GB | ~1-3s/request |

---

### Phase 3: Supabase Edge Function (Middleware)

The Edge Function sits between your React Native app and the two Brev endpoints. It orchestrates the pipeline.

#### Strategy

1. **Create the function**:
   ```bash
   supabase functions new process-image
   ```

2. **The function does this in sequence**:
   ```
   Receive { image_base64, user_id }
       │
       ▼
   POST to Vision Pipeline on Brev (/process-outfit)
     → rembg removes background
     → CLIPSeg segments each clothing item
     → FashionCLIP classifies each item + generates embeddings
     → Returns array of items with cropped_image_base64 per item
       │
       ▼
   For each segmented item:
     → Upload cropped image to Supabase Storage:
         wardrobe/{user_id}/items/{generated_uuid}.png
     → INSERT wardrobe_items row with:
         - category, tags, ai_color, ai_style, etc. (from CLIP)
         - cropped_image_url = storage path
         - image_url = same storage path (for signed URL generation)
       │
       ▼
   Fetch ALL user's wardrobe items from DB
     → SELECT category, ai_color, ai_style, ai_pattern, ai_material
       FROM wardrobe_items WHERE user_id = $1
     → Build a complete wardrobe inventory string
       │
       ▼
   POST to Nemotron on Brev with:
     → Full wardrobe inventory (all items)
     → Highlighted: which items are newly added
     → Get: per-item descriptions + cross-wardrobe outfit recommendations
       │
       ▼
   UPDATE wardrobe_items with Nemotron analysis
   INSERT outfit recommendations into outfits table
       │
       ▼
   Return combined result to the app
   ```

3. **Key implementation details**:
   - Use `fetch()` to call both Brev APIs (Deno runtime supports fetch natively)
   - **Cropped image storage**: Each segmented item's cropped image (base64 from the Vision Pipeline) is decoded and uploaded to Supabase Storage under `wardrobe/{user_id}/items/{uuid}.png`. The path is stored in both `image_url` (for signed URL display) and `cropped_image_url` (for reference).
   - **Full wardrobe context for Nemotron**: After saving new items, query ALL wardrobe_items for the user. Build a text summary of the entire wardrobe and send it to Nemotron in a single prompt. This lets Nemotron generate outfit recommendations that combine new items with existing ones.
   - Build a prompt for Nemotron that includes: (a) new item attributes, (b) full existing wardrobe summary, (c) request for outfit combinations
   - Parse Nemotron's JSON response (handle cases where it wraps in markdown code blocks)
   - Include a fallback if Nemotron returns invalid JSON (construct a basic description from CLIP data)
   - Use `supabase.from("wardrobe_items").insert(...)` with the service role key to create one row per segmented item

4. **Deploy**:
   ```bash
   supabase functions deploy process-image
   ```

5. **Set secrets** (these are the Brev endpoints from Phases 1 & 2):
   ```bash
   supabase secrets set VISION_API_URL=https://<your-brev-vision-url>
   supabase secrets set VISION_API_KEY=<optional-api-key>
   supabase secrets set NEMOTRON_API_URL=https://<your-nemotron-url>/v1/chat/completions
   supabase secrets set NEMOTRON_API_KEY=<your-nemotron-api-key>
   ```

---

### Phase 4: Database Schema Migration

Add columns to `wardrobe_items` to store AI-generated data.

#### New Columns

Run this in Supabase SQL Editor:

```sql
-- Vision pipeline classification results
ALTER TABLE wardrobe_items
  ADD COLUMN IF NOT EXISTS ai_color TEXT,
  ADD COLUMN IF NOT EXISTS ai_style TEXT,
  ADD COLUMN IF NOT EXISTS ai_pattern TEXT,
  ADD COLUMN IF NOT EXISTS ai_material TEXT,
  ADD COLUMN IF NOT EXISTS ai_season TEXT,
  ADD COLUMN IF NOT EXISTS ai_category_confidence REAL;

-- CLIPSeg segmentation metadata
ALTER TABLE wardrobe_items
  ADD COLUMN IF NOT EXISTS segment_label TEXT,         -- which CLIPSeg prompt found this item ("shirt", "pants", etc.)
  ADD COLUMN IF NOT EXISTS source_outfit_id UUID,      -- links back to the original outfit photo
  ADD COLUMN IF NOT EXISTS cropped_image_url TEXT;      -- path to cropped image in Supabase Storage: wardrobe/{user_id}/items/{uuid}.png

-- Nemotron style analysis (per-item)
ALTER TABLE wardrobe_items
  ADD COLUMN IF NOT EXISTS ai_description TEXT,
  ADD COLUMN IF NOT EXISTS ai_pairings TEXT[],
  ADD COLUMN IF NOT EXISTS ai_occasions TEXT[],
  ADD COLUMN IF NOT EXISTS ai_care_tips TEXT;

-- Outfit recommendations table (Nemotron generates these from full wardrobe)
CREATE TABLE IF NOT EXISTS outfit_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,                    -- e.g. "Casual Weekend"
  description TEXT,                      -- why this combination works
  item_ids UUID[] NOT NULL,              -- array of wardrobe_items IDs in this outfit
  occasion TEXT,                         -- e.g. "Weekend brunch"
  season TEXT,                           -- e.g. "autumn"
  is_liked BOOLEAN DEFAULT NULL,         -- null = not rated, true = liked, false = disliked
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE outfit_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own recommendations" ON outfit_recommendations
  FOR ALL USING (auth.uid() = user_id);

-- Processing metadata
ALTER TABLE wardrobe_items
  ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMP WITH TIME ZONE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wardrobe_ai_processed
  ON wardrobe_items (ai_processed_at) WHERE ai_processed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wardrobe_category
  ON wardrobe_items (category) WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wardrobe_source_outfit
  ON wardrobe_items (source_outfit_id) WHERE source_outfit_id IS NOT NULL;
```

#### Optional: pgvector for Similarity Search

After enabling the vector extension in Supabase (Dashboard → Database → Extensions → enable `vector`):

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE wardrobe_items
  ADD COLUMN IF NOT EXISTS clip_embedding VECTOR(512);

CREATE INDEX IF NOT EXISTS idx_wardrobe_clip_embedding
  ON wardrobe_items USING ivfflat (clip_embedding vector_cosine_ops)
  WITH (lists = 100);
```

> Note: The `category` and `tags` columns already exist in the schema and will be populated by the AI pipeline.

---

### Phase 5: React Native Service Layer

Create a new `services/aiService.ts` file (**do not modify** the existing `outfitService.ts`).

#### Strategy

- Create an `aiService` object with methods:
  - `processOutfitImage(imageBase64)` — sends full outfit photo → Edge Function → segments items → saves cropped images to S3 → sends full wardrobe to Nemotron → returns items + outfit recommendations
  - `processSingleItem(imageBase64, wardrobeItemId)` — processes a single wardrobe item (skips segmentation, saves clean image to S3, triggers wardrobe-wide Nemotron recommendations)
  - `getProcessedItems()` — fetch items that have been AI-processed
  - `getUnprocessedItems()` — fetch items pending AI processing
  - `getItemAnalysis(itemId)` — retrieve stored AI analysis for a specific item
  - `getOutfitItems(sourceOutfitId)` — get all items segmented from a single outfit photo
  - `getOutfitRecommendations()` — fetch all Nemotron-generated outfit recommendations for the user
  - `refreshRecommendations()` — re-trigger Nemotron with the full wardrobe to get fresh outfit suggestions

- All methods use `supabase.functions.invoke("process-image", { body: ... })` to call the Edge Function

- Type definitions:
  ```typescript
  interface SegmentedItem {
    segment_label: string;        // "shirt", "pants", etc. (from CLIPSeg)
    category: string;             // "T-Shirt" (from FashionCLIP)
    category_confidence: number;
    style: string;
    color: string;
    pattern: string;
    material: string;
    season: string;
    tags: string[];
    embedding: number[];          // 512-dim vector
    cropped_image_url: string;    // Supabase Storage path: wardrobe/{user_id}/items/{uuid}.png
  }

  interface StyleAnalysis {
    description: string;
    pairings: string[];           // now references actual wardrobe items, not generic suggestions
    occasions: string[];
    care_tips: string;
  }

  interface OutfitRecommendation {
    name: string;                 // e.g. "Casual Weekend"
    description: string;          // why this combination works
    item_ids: string[];           // wardrobe_items UUIDs
    occasion: string;
    season: string;
  }

  interface ProcessOutfitResult {
    success: boolean;
    items_found: number;
    items: Array<{
      classification: SegmentedItem;
      analysis: StyleAnalysis;
    }>;
    outfit_recommendations: OutfitRecommendation[];  // cross-wardrobe outfit combos
  }
  ```

---

### Phase 6: UI Integration

#### Outfit Upload Flow (Full Outfit Photo)

New flow for uploading a complete outfit photo (OOTD):

```
1. Image picker → base64 encode
2. Call aiService.processOutfitImage(base64)
     → Vision pipeline: rembg → CLIPSeg → FashionCLIP
     → Each cropped item saved to Supabase S3: wardrobe/{user_id}/items/{uuid}.png
     → wardrobe_items row inserted per item
     → Nemotron receives FULL wardrobe (existing + new items)
     → Returns outfit recommendations spanning entire wardrobe
3. Show results:
   - "Found 3 items: T-Shirt, Jeans, Sneakers" (with cropped images from S3)
   - "3 new outfit ideas generated from your wardrobe!"
4. Refresh wardrobe grid
```

#### Single Item Upload Flow

Existing flow for uploading a single wardrobe item (close-up photo):

```
1. Image picker → base64 encode
2. Call aiService.processSingleItem(base64, newItem.id)
     → rembg cleans background
     → Clean image saved to Supabase S3: wardrobe/{user_id}/items/{uuid}.png
     → FashionCLIP classifies it
     → Nemotron receives FULL wardrobe including new item
     → Generates updated outfit recommendations
3. Show AI results:
   - Category, Style, Color
   - AI description
   - "2 new outfit ideas with this item + your existing wardrobe"
4. Refresh wardrobe grid
```

#### Home Screen (AI Processing Button)

Replace the mock `processOutfitImage()` in `index.tsx` with a real call:
- Let users select an item from their wardrobe
- Call `aiService.processWardrobeImage()` on it
- Show the style analysis results

#### Item Detail View (New Screen — Optional)

Create a new screen to show full AI analysis for a wardrobe item:
- Item image at top
- Category badge + confidence
- Style / Color / Pattern / Material / Season chips
- AI description paragraph
- Pairing suggestions (link to matching items in wardrobe)
- Occasion tags

---

## 6. Pipeline Mapping to flow.md

Here's exactly how each `flow.md` step maps to the implementation:

| flow.md Step | Model(s) Used | Implementation |
|---|---|---|
| **1. User Input** — Upload OOTD / outfit photos | — | `wardrobe.tsx` → image picker → base64 encode |
| **2. Item Extraction** — Decompose into items | **rembg** + **CLIPSeg** | rembg removes background → CLIPSeg segments each clothing item using text prompts → outputs cropped images per garment |
| **3. Image Processing** — Classification | **FashionCLIP** | Each cropped garment from CLIPSeg is classified: category, style, color, pattern, material, season + 512-dim embedding |
| **4. Fashion Modeling** — Outfit intelligence | **FashionCLIP** + **Nemotron** | FashionCLIP provides embeddings. Nemotron receives the **full wardrobe inventory** and generates outfit combinations from ALL the user's items — not just the newly uploaded ones. |
| **5. Outfit Storage** — Persist results | — | Segmented/cropped images → Supabase S3 Storage (`wardrobe/{user_id}/items/{uuid}.png`). Each garment → `wardrobe_items` row with AI columns. Outfit combos → `outfit_recommendations` table. |
| **6. User Feedback** — Swipe left/right | — | New UI: swipe cards on the home feed. Store feedback in a new `user_feedback` table. |
| **7. Learning Loop** — Personalization | **FashionCLIP** + **Nemotron** | Aggregate swipe data + CLIP attributes → preference profile. Feed preferences into Nemotron prompts. Use CLIP embeddings for similarity-based recommendations. (See section 7.) |
| **8. Liked Fits** — Persist preferences | — | Supabase `liked_outfits` table (or `outfits` table with a `liked` flag) |
| **9. User Confirmation** — Confirm outfits | — | Confirmation screen before saving to "My Outfits" |
| **10. Drape** — Final visualization | — | Full-length body photo from `profiles` + overlay the segmented garment images. (Virtual try-on — future phase.) |

---

## 7. Feedback & Reinforcement Loop Strategy

This is how the **swipe feedback → learning loop** from `flow.md` steps 6-7 works with the models:

### Data Collection

```sql
-- New table for feedback
CREATE TABLE user_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  outfit_id UUID REFERENCES outfits(id),
  wardrobe_item_id UUID REFERENCES wardrobe_items(id),
  action TEXT NOT NULL,  -- 'like', 'dislike', 'save', 'skip'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Learning Strategy

1. **Collect Feedback**: User swipes right (like) or left (dislike) on outfit recommendations
2. **Aggregate Preferences**: Query liked items → extract common CLIP attributes
   ```
   User likes: 80% casual items, 60% navy/black, 70% denim/cotton
   User dislikes: 90% formal items, 80% floral patterns
   ```
3. **Feed to Nemotron**: Include preference summary in the prompt when generating new recommendations:
   ```
   "This user prefers casual denim items in dark colors.
    They dislike formal wear and floral patterns.
    Given their wardrobe of [items], suggest 3 new outfit combinations."
   ```
4. **Embedding Similarity**: Use CLIP embeddings to find items similar to liked items and dissimilar to disliked ones:
   ```sql
   -- Find items similar to what the user likes
   SELECT wi.*, 1 - (wi.clip_embedding <=> liked_avg_embedding) AS score
   FROM wardrobe_items wi
   ORDER BY wi.clip_embedding <=> liked_avg_embedding
   LIMIT 10;
   ```

This is **not** traditional RL, but a **preference-based recommendation** approach that works well with the two-model setup and doesn't require retraining.

---

## 8. Future: Embedding-Based Features

Once CLIP embeddings are stored in pgvector for every wardrobe item:

| Feature | How |
|---|---|
| **"Find Similar Items"** | Cosine similarity query on clip_embedding |
| **"Complete This Outfit"** | Query items whose embeddings are complementary to the current selection |
| **"Style Match Score"** | Compare two items' embeddings → percentage compatibility |
| **"Smart Outfit Builder"** | Nemotron selects items using preferences + occasion + weather |
| **"Visual Search"** | Upload any photo → find closest match in your wardrobe |
| **"Trend Detection"** | Cluster embeddings to find popular style patterns |

---

## 9. Cost & Performance Estimates

| Component | Estimated Cost | Latency |
|---|---|---|
| rembg — background removal (per image) | ~$0.0005 | ~100-300ms |
| CLIPSeg — segmentation (per image) | ~$0.0005 | ~300ms |
| FashionCLIP — classification (per item) | ~$0.001 | ~200ms per item |
| Nemotron-Nano-9B-v2 (per item) | ~$0.002-0.005 | ~1-3s per item |
| Brev GPU — L40S (per hour) | ~$1.50-2.50/hr | — |
| Brev GPU — A100 (per hour) | ~$3.00-4.00/hr | — |
| Supabase Edge Function | Free tier: ~500K invocations/month | ~50ms overhead |

**Example: outfit photo with 3 items detected:**
- Vision pipeline: ~$0.002 + ~1s (rembg + CLIPSeg + 3× FashionCLIP)
- Nemotron (3 items): ~$0.006-0.015 + ~3-9s
- **Total: ~$0.008-0.017 per outfit, ~4-10s latency**

**Single item upload:**
- Vision pipeline: ~$0.0015 + ~500ms (rembg + FashionCLIP, no CLIPSeg)
- Nemotron: ~$0.002-0.005 + ~1-3s
- **Total: ~$0.004-0.007 per item, ~2-4s latency**

---

## 10. Implementation Checklist

### Infrastructure
- [ ] Create NVIDIA Brev account
- [ ] Launch Brev VM with GPU (L40S 48GB recommended)
- [ ] Install rembg, CLIPSeg, FashionCLIP on the VM
- [ ] Build & run the vision pipeline FastAPI server
- [ ] Test `/process-outfit` endpoint with a sample outfit photo
- [ ] Test `/process-single` endpoint with a single item photo
- [ ] Deploy Nemotron-Nano-9B-v2 as a managed NIM on Brev
- [ ] Test Nemotron Chat Completions API endpoint
- [ ] Note all API URLs and keys

### Backend
- [ ] Run schema migration (add AI columns + segmentation columns to `wardrobe_items`)
- [ ] (Optional) Enable pgvector extension + add `clip_embedding` column
- [ ] Create Supabase Edge Function `process-image`
- [ ] Set Supabase secrets (`VISION_API_URL`, `VISION_API_KEY`, `NEMOTRON_API_URL`, `NEMOTRON_API_KEY`)
- [ ] Deploy Edge Function: `supabase functions deploy process-image`
- [ ] Test end-to-end: Edge Function → Vision Pipeline → Nemotron → DB insert

### App
- [ ] Create `services/aiService.ts` (new file, don't modify `outfitService.ts`)
- [ ] Add outfit upload flow (full outfit photo → segmented items)
- [ ] Update single-item upload flow to trigger AI processing
- [ ] Replace mock `processOutfitImage()` call on Home screen
- [ ] Add loading/processing UI states ("Removing background...", "Finding items...", "Analyzing...")
- [ ] Display segmented items with AI results
- [ ] Add error handling + retry logic for API failures

### Feedback Loop (Phase 2)
- [ ] Create `user_feedback` table in Supabase
- [ ] Add swipe UI to outfit feed
- [ ] Store feedback data on swipe
- [ ] Build preference aggregation query
- [ ] Include preferences in Nemotron prompts for personalized recommendations

### Advanced (Phase 3)
- [ ] Enable pgvector for embedding-based similarity search
- [ ] Build "Find Similar Items" feature
- [ ] Build "Smart Outfit Builder" with Nemotron
- [ ] Implement virtual drape / try-on visualization
