"""
Vlyzo — Vision + LLM Pipeline Server
=====================================
Vision:  rembg (background removal) → SegFormer (clothing segmentation) → FashionCLIP (classification)
LLM:     Nemotron-Nano-9B-v2 (outfit recommendations from full wardrobe)

Run locally:   python vision_pipeline.py
Run on Brev:   uvicorn vision_pipeline:app --host 0.0.0.0 --port 8000
Skip LLM:      SKIP_LLM=1 python vision_pipeline.py   (for CPU-only testing)

Endpoints:
  GET  /health              → server + GPU status
  POST /process-outfit      → full outfit photo → segmented + classified items
  POST /process-single      → single item photo → classified item
  POST /recommend-outfits   → full wardrobe → outfit recommendations from Nemotron
"""

import os
import io
import json
import base64
import logging
from typing import Optional

import torch
import torch.nn as nn
import numpy as np
from PIL import Image
from rembg import remove
from transformers import (
    SegformerImageProcessor,
    AutoModelForSemanticSegmentation,
    CLIPProcessor,
    CLIPModel,
    AutoTokenizer,
    AutoModelForCausalLM,
)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ──────────────────────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────────────────────

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
PORT = int(os.getenv("PORT", "8000"))
API_KEY = os.getenv("VISION_API_KEY", "")
SKIP_LLM = os.getenv("SKIP_LLM", "").strip() in ("1", "true", "yes")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s  %(message)s",
)
logger = logging.getLogger("vlyzo-vision")

# ──────────────────────────────────────────────────────────────────────────────
# SegFormer Label Map
# ──────────────────────────────────────────────────────────────────────────────
# mattmdjaga/segformer_b2_clothes is trained on the ATR dataset with these labels:

SEGFORMER_LABELS = {
    0: "Background",
    1: "Hat",
    2: "Hair",
    3: "Sunglasses",
    4: "Upper-clothes",
    5: "Skirt",
    6: "Pants",
    7: "Dress",
    8: "Belt",
    9: "Left-shoe",
    10: "Right-shoe",
    11: "Face",
    12: "Left-leg",
    13: "Right-leg",
    14: "Left-arm",
    15: "Right-arm",
    16: "Bag",
    17: "Scarf",
}

# Labels that are actual clothing/accessories (exclude body parts & background)
CLOTHING_LABELS = {
    1: "Hat",
    3: "Sunglasses",
    4: "Upper-clothes",
    5: "Skirt",
    6: "Pants",
    7: "Dress",
    8: "Belt",
    9: "Left-shoe",
    10: "Right-shoe",
    16: "Bag",
    17: "Scarf",
}

# Merge left/right shoe into single "Shoes" item
MERGE_LABELS = {
    "Left-shoe": "Shoes",
    "Right-shoe": "Shoes",
}

# ──────────────────────────────────────────────────────────────────────────────
# FashionCLIP Label Banks
# ──────────────────────────────────────────────────────────────────────────────

CATEGORIES = [
    "T-Shirt", "Shirt", "Blouse", "Tank Top", "Crop Top",
    "Sweater", "Hoodie", "Cardigan",
    "Jacket", "Coat", "Blazer", "Vest",
    "Jeans", "Trousers", "Shorts", "Skirt", "Leggings", "Joggers",
    "Dress", "Jumpsuit", "Romper",
    "Sneakers", "Boots", "Sandals", "Heels", "Loafers", "Flats",
    "Bag", "Backpack", "Clutch", "Tote",
    "Hat", "Cap", "Beanie",
    "Scarf", "Belt", "Watch", "Sunglasses", "Jewelry", "Tie",
]

STYLES = [
    "casual", "formal", "streetwear", "bohemian", "minimalist",
    "sporty", "vintage", "elegant", "preppy", "grunge",
    "smart casual", "athleisure", "romantic", "edgy", "classic",
]

COLORS = [
    "black", "white", "cream", "grey", "charcoal",
    "red", "burgundy", "maroon", "pink", "coral",
    "blue", "navy", "light blue", "royal blue", "teal",
    "green", "olive", "sage", "mint", "emerald",
    "yellow", "mustard", "gold",
    "orange", "rust", "terracotta",
    "purple", "lavender", "plum",
    "brown", "tan", "beige", "camel", "khaki",
    "multicolor",
]

PATTERNS = [
    "solid", "striped", "floral", "plaid", "checkered",
    "polka dot", "geometric", "animal print", "abstract",
    "tie-dye", "camouflage", "paisley", "herringbone",
    "color block", "graphic print",
]

MATERIALS = [
    "cotton", "denim", "leather", "faux leather", "silk", "satin",
    "wool", "cashmere", "polyester", "nylon", "linen",
    "suede", "velvet", "lace", "chiffon", "tweed",
    "fleece", "knit", "mesh", "canvas", "corduroy",
]

SEASONS = ["spring", "summer", "autumn", "winter", "all-season"]

# ──────────────────────────────────────────────────────────────────────────────
# Model Loading
# ──────────────────────────────────────────────────────────────────────────────

logger.info(f"Device: {DEVICE}")
if DEVICE == "cuda":
    logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
    logger.info(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

logger.info("Loading SegFormer B2 (mattmdjaga/segformer_b2_clothes)...")
segformer_processor = SegformerImageProcessor.from_pretrained(
    "mattmdjaga/segformer_b2_clothes"
)
segformer_model = AutoModelForSemanticSegmentation.from_pretrained(
    "mattmdjaga/segformer_b2_clothes"
).to(DEVICE)
segformer_model.eval()

logger.info("Loading FashionCLIP (patrickjohncyh/fashion-clip)...")
fashionclip_processor = CLIPProcessor.from_pretrained("patrickjohncyh/fashion-clip")
fashionclip_model = CLIPModel.from_pretrained("patrickjohncyh/fashion-clip").to(DEVICE)
fashionclip_model.eval()

logger.info("rembg will lazy-load its U2-Net weights on first request.")

# ── Nemotron-Nano-9B-v2 (LLM for outfit recommendations) ──
nemotron_tokenizer = None
nemotron_model = None

if SKIP_LLM:
    logger.info("SKIP_LLM=1 → Skipping Nemotron load (vision-only mode).")
else:
    logger.info("Loading Nemotron-Nano-9B-v2 (nvidia/NVIDIA-Nemotron-Nano-9B-v2)...")
    nemotron_tokenizer = AutoTokenizer.from_pretrained(
        "nvidia/NVIDIA-Nemotron-Nano-9B-v2"
    )
    nemotron_model = AutoModelForCausalLM.from_pretrained(
        "nvidia/NVIDIA-Nemotron-Nano-9B-v2",
        torch_dtype=torch.bfloat16,
        trust_remote_code=True,
        device_map="auto",
    )
    nemotron_model.eval()
    logger.info("Nemotron loaded.")

logger.info("All models ready.")

# ──────────────────────────────────────────────────────────────────────────────
# Image Helpers
# ──────────────────────────────────────────────────────────────────────────────


def decode_base64_image(b64: str) -> Image.Image:
    if "," in b64 and b64.index(",") < 100:
        b64 = b64.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")


def encode_image_base64(img: Image.Image, fmt: str = "PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode()


def to_rgba(img: Image.Image) -> Image.Image:
    return img.convert("RGBA") if img.mode != "RGBA" else img


def rgba_to_white_bg(img: Image.Image) -> Image.Image:
    """Composite RGBA onto white background for CLIP (trained on solid BGs)."""
    if img.mode != "RGBA":
        return img.convert("RGB")
    bg = Image.new("RGB", img.size, (255, 255, 255))
    bg.paste(img, mask=img.split()[3])
    return bg


# ──────────────────────────────────────────────────────────────────────────────
# Step 1 — Background Removal (rembg / U2-Net)
# ──────────────────────────────────────────────────────────────────────────────


def remove_background(image: Image.Image) -> Image.Image:
    logger.info("  [Step 1] Removing background...")
    result = to_rgba(remove(image))
    logger.info(f"  [Step 1] Done. Size: {result.size}")
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Step 2 — Clothing Segmentation (SegFormer B2)
# ──────────────────────────────────────────────────────────────────────────────


def segment_clothing(
    image: Image.Image,
    min_area: float = 0.005,
) -> list[dict]:
    """
    Segment clothing items using SegFormer B2 (trained on ATR dataset).
    Returns pixel-precise masks for each detected garment.

    Unlike CLIPSeg, SegFormer was specifically trained for this task
    and outputs 18 semantic labels with pixel-level accuracy.
    """
    logger.info("  [Step 2] Segmenting with SegFormer...")

    rgb = image.convert("RGB")
    w, h = rgb.size

    # Run SegFormer
    inputs = segformer_processor(images=rgb, return_tensors="pt")
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = segformer_model(**inputs)

    # Upsample logits to original image size
    logits = outputs.logits.cpu()
    upsampled = nn.functional.interpolate(
        logits,
        size=(h, w),
        mode="bilinear",
        align_corners=False,
    )
    seg_map = upsampled.argmax(dim=1)[0].numpy()  # (H, W) with label IDs

    # Extract each clothing item
    found: list[dict] = []
    merge_masks: dict[str, np.ndarray] = {}  # for merging L/R shoes

    for label_id, label_name in CLOTHING_LABELS.items():
        mask = (seg_map == label_id).astype(np.uint8)
        area_ratio = mask.sum() / (h * w)

        if area_ratio < min_area:
            continue

        # Merge left/right shoes into a single "Shoes" entry
        merged_name = MERGE_LABELS.get(label_name, label_name)
        if merged_name in merge_masks:
            merge_masks[merged_name] = np.logical_or(
                merge_masks[merged_name], mask
            ).astype(np.uint8)
        else:
            merge_masks[merged_name] = mask

    # Crop each merged mask
    for label_name, mask in merge_masks.items():
        area_ratio = mask.sum() / (h * w)
        cropped = _crop_mask(image, mask)
        if cropped is None:
            continue

        found.append({
            "label": label_name,
            "mask": mask,
            "cropped": cropped,
            "confidence": 1.0,  # SegFormer is deterministic, no confidence score
            "area": area_ratio,
        })

    labels = [f["label"] for f in found]
    logger.info(f"  [Step 2] Found {len(found)} items: {labels}")
    return found


def _crop_mask(
    image: Image.Image, mask: np.ndarray, pad: int = 10
) -> Optional[Image.Image]:
    """Crop image using the largest connected component of the mask.
    For merged items (e.g. left+right shoes), this gives CLIP a tight
    crop of one shoe rather than a wide sparse image with a gap."""
    from scipy import ndimage

    labeled, n_components = ndimage.label(mask)
    if n_components == 0:
        return None

    # Use the largest connected component for tight cropping
    if n_components > 1:
        component_sizes = ndimage.sum(mask, labeled, range(1, n_components + 1))
        largest_id = int(np.argmax(component_sizes)) + 1
        crop_mask = (labeled == largest_id).astype(np.uint8)
    else:
        crop_mask = mask

    rows = np.any(crop_mask, axis=1)
    cols = np.any(crop_mask, axis=0)
    if not rows.any() or not cols.any():
        return None

    r0, r1 = np.where(rows)[0][[0, -1]]
    c0, c1 = np.where(cols)[0][[0, -1]]

    h, w = mask.shape
    r0 = max(0, r0 - pad)
    r1 = min(h - 1, r1 + pad)
    c0 = max(0, c0 - pad)
    c1 = min(w - 1, c1 + pad)

    rgba = np.array(to_rgba(image))
    alpha = np.zeros((h, w), dtype=np.uint8)
    alpha[crop_mask > 0] = 255
    rgba[:, :, 3] = np.minimum(rgba[:, :, 3], alpha)

    return Image.fromarray(rgba[r0 : r1 + 1, c0 : c1 + 1], "RGBA")


# ──────────────────────────────────────────────────────────────────────────────
# Step 3 — Classification + Embedding (FashionCLIP)
# ──────────────────────────────────────────────────────────────────────────────


def classify_item(image: Image.Image) -> dict:
    # Composite onto white bg — CLIP expects solid backgrounds, not transparency
    rgb = rgba_to_white_bg(image)

    cat = _zs_classify(rgb, CATEGORIES, top_k=3)
    sty = _zs_classify(rgb, STYLES)[0]
    col = _zs_classify(rgb, COLORS)[0]
    pat = _zs_classify(rgb, PATTERNS)[0]
    mat = _zs_classify(rgb, MATERIALS)[0]
    sea = _zs_classify(rgb, SEASONS)[0]

    emb = _embedding(rgb)

    tags = list(
        set(
            [
                cat[0]["label"].lower(),
                sty["label"],
                col["label"],
                pat["label"],
                mat["label"],
                sea["label"],
            ]
        )
    )

    return {
        "category": cat[0],
        "top_categories": cat,
        "style": sty,
        "color": col,
        "pattern": pat,
        "material": mat,
        "season": sea,
        "tags": tags,
        "embedding": emb,
    }


def _zs_classify(img: Image.Image, labels: list[str], top_k: int = 1) -> list[dict]:
    prompts = [f"a photo of {l}" for l in labels]
    inputs = fashionclip_processor(
        text=prompts, images=img, return_tensors="pt", padding=True, truncation=True
    )
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
    with torch.no_grad():
        out = fashionclip_model(**inputs)
    probs = out.logits_per_image.softmax(dim=1)[0]
    idxs = probs.argsort(descending=True)[:top_k]
    return [{"label": labels[i], "confidence": round(probs[i].item(), 4)} for i in idxs]


def _embedding(img: Image.Image) -> list[float]:
    inputs = fashionclip_processor(images=img, return_tensors="pt")
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
    with torch.no_grad():
        output = fashionclip_model.get_image_features(**inputs)
    # Handle both old (raw tensor) and new (structured output) transformers versions
    if hasattr(output, "image_embeds"):
        feat = output.image_embeds
    elif isinstance(output, torch.Tensor):
        feat = output
    else:
        vision_out = fashionclip_model.vision_model(**inputs)
        feat = fashionclip_model.visual_projection(vision_out.pooler_output)
    feat = feat / feat.norm(p=2, dim=-1, keepdim=True)
    return feat[0].cpu().tolist()


# ──────────────────────────────────────────────────────────────────────────────
# Full Pipeline
# ──────────────────────────────────────────────────────────────────────────────


def process_outfit(image: Image.Image) -> dict:
    """Full outfit photo → rembg → SegFormer → FashionCLIP per item."""
    logger.info("Processing outfit photo...")

    clean = remove_background(image)
    segments = segment_clothing(clean)

    if not segments:
        logger.warning("No clothing items detected!")
        return {"items_found": 0, "items": []}

    items = []
    for seg in segments:
        logger.info(f"  [Step 3] Classifying '{seg['label']}'...")
        cls = classify_item(seg["cropped"])

        items.append(
            {
                "segment_label": seg["label"],
                "segment_confidence": round(seg["confidence"], 4),
                "category": cls["category"],
                "top_categories": cls["top_categories"],
                "style": cls["style"],
                "color": cls["color"],
                "pattern": cls["pattern"],
                "material": cls["material"],
                "season": cls["season"],
                "tags": cls["tags"],
                "embedding": cls["embedding"],
                "cropped_image_base64": encode_image_base64(seg["cropped"]),
            }
        )

    logger.info(f"Done! {len(items)} items classified.")
    return {"items_found": len(items), "items": items}


def process_single(image: Image.Image) -> dict:
    """Single item photo → rembg → FashionCLIP (skip SegFormer)."""
    logger.info("Processing single item...")

    clean = remove_background(image)
    cls = classify_item(clean)

    item = {
        "segment_label": "single_item",
        "segment_confidence": 1.0,
        "category": cls["category"],
        "top_categories": cls["top_categories"],
        "style": cls["style"],
        "color": cls["color"],
        "pattern": cls["pattern"],
        "material": cls["material"],
        "season": cls["season"],
        "tags": cls["tags"],
        "embedding": cls["embedding"],
        "cropped_image_base64": encode_image_base64(clean),
    }

    logger.info(f"Done! Classified as: {cls['category']['label']}")
    return {"items_found": 1, "items": [item]}


# ──────────────────────────────────────────────────────────────────────────────
# FastAPI
# ──────────────────────────────────────────────────────────────────────────────


class OutfitRequest(BaseModel):
    image_base64: str


class AttrResult(BaseModel):
    label: str
    confidence: float


class ItemOut(BaseModel):
    segment_label: str
    segment_confidence: float
    category: AttrResult
    top_categories: list[AttrResult]
    style: AttrResult
    color: AttrResult
    pattern: AttrResult
    material: AttrResult
    season: AttrResult
    tags: list[str]
    embedding: list[float]
    cropped_image_base64: str


class OutfitResponse(BaseModel):
    items_found: int
    items: list[ItemOut]


# ──────────────────────────────────────────────────────────────────────────────
# Step 4 — Outfit Recommendations (Nemotron-Nano-9B-v2)
# ──────────────────────────────────────────────────────────────────────────────

RECOMMENDATION_SYSTEM_PROMPT = """You are an expert fashion stylist. The user will give you their complete wardrobe as a list of clothing items, each with an ID, category, color, style, and material.

Your job is to suggest 3 outfit combinations from these items. Each outfit should:
- Be a complete look (top + bottom, or a dress, plus shoes if available)
- Have good color coordination and style cohesion
- Be suitable for the occasion/season if specified

Respond ONLY with valid JSON in this exact format, no other text:
{
  "recommendations": [
    {
      "outfit_items": ["item-id-1", "item-id-2", "item-id-3"],
      "occasion": "casual day out",
      "description": "A brief explanation of why these items work together",
      "style_tags": ["minimalist", "monochrome"]
    }
  ]
}
/no_think"""


def generate_recommendations(
    wardrobe: list[dict],
    occasion: Optional[str] = None,
    season: Optional[str] = None,
) -> dict:
    """Use Nemotron to generate outfit recommendations from the full wardrobe."""
    if nemotron_model is None or nemotron_tokenizer is None:
        raise RuntimeError("Nemotron not loaded. Set SKIP_LLM=0 or run on GPU.")

    # Build the user message with the full wardrobe
    wardrobe_text = json.dumps(wardrobe, indent=2)
    user_msg = f"Here is my complete wardrobe:\n{wardrobe_text}"
    if occasion:
        user_msg += f"\n\nSuggest outfits for: {occasion}"
    if season:
        user_msg += f"\nSeason: {season}"

    messages = [
        {"role": "system", "content": RECOMMENDATION_SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    logger.info(f"  [Nemotron] Generating recommendations for {len(wardrobe)} items...")

    input_ids = nemotron_tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        return_tensors="pt",
    )

    # apply_chat_template may return a BatchEncoding or a plain tensor
    if hasattr(input_ids, "input_ids"):
        input_ids = input_ids.input_ids

    input_ids = input_ids.to(nemotron_model.device)

    with torch.no_grad():
        outputs = nemotron_model.generate(
            input_ids,
            max_new_tokens=1024,
            temperature=0.6,
            top_p=0.95,
            do_sample=True,
            eos_token_id=nemotron_tokenizer.eos_token_id,
        )

    # Decode only the new tokens (skip the input)
    new_tokens = outputs[0][input_ids.shape[1]:]
    response_text = nemotron_tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

    logger.info(f"  [Nemotron] Raw response: {response_text[:200]}...")

    # Parse JSON from the response
    try:
        # Try to extract JSON from the response
        json_start = response_text.find("{")
        json_end = response_text.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            result = json.loads(response_text[json_start:json_end])
        else:
            result = {"recommendations": [], "raw_response": response_text}
    except json.JSONDecodeError:
        logger.warning("  [Nemotron] Failed to parse JSON, returning raw response.")
        result = {"recommendations": [], "raw_response": response_text}

    logger.info(f"  [Nemotron] Generated {len(result.get('recommendations', []))} recommendations.")
    return result


# ──────────────────────────────────────────────────────────────────────────────
# FastAPI
# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Vlyzo Vision + LLM Pipeline",
    description="rembg → SegFormer → FashionCLIP + Nemotron-Nano-9B",
    version="3.0.0",
)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


@app.get("/health")
async def health():
    models = [
        "rembg/u2net",
        "mattmdjaga/segformer_b2_clothes",
        "patrickjohncyh/fashion-clip",
    ]
    if nemotron_model is not None:
        models.append("nvidia/NVIDIA-Nemotron-Nano-9B-v2")
    return {
        "status": "ok",
        "device": DEVICE,
        "gpu": torch.cuda.get_device_name(0) if DEVICE == "cuda" else None,
        "llm_loaded": nemotron_model is not None,
        "models": models,
    }


@app.post("/process-outfit", response_model=OutfitResponse)
async def api_outfit(req: OutfitRequest):
    try:
        img = decode_base64_image(req.image_base64)
        return process_outfit(img)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        raise HTTPException(500, detail=str(e))


@app.post("/process-single", response_model=OutfitResponse)
async def api_single(req: OutfitRequest):
    try:
        img = decode_base64_image(req.image_base64)
        return process_single(img)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        raise HTTPException(500, detail=str(e))


class WardrobeItem(BaseModel):
    id: str
    category: str
    color: str
    style: str = ""
    material: str = ""
    season: str = ""


class RecommendRequest(BaseModel):
    wardrobe: list[WardrobeItem]
    occasion: Optional[str] = None
    season: Optional[str] = None


@app.post("/recommend-outfits")
async def api_recommend(req: RecommendRequest):
    try:
        wardrobe_dicts = [item.model_dump() for item in req.wardrobe]
        result = generate_recommendations(
            wardrobe=wardrobe_dicts,
            occasion=req.occasion,
            season=req.season,
        )
        return result
    except RuntimeError as e:
        raise HTTPException(503, detail=str(e))
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        raise HTTPException(500, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Entry Point
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    logger.info(f"Starting server on http://0.0.0.0:{PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
