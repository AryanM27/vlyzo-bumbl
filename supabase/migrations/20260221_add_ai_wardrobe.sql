-- ============================================================================
-- Vlyzo AI Vision Pipeline — Database Migration
-- ============================================================================
-- This migration adds AI-specific columns to the existing schema and creates
-- new tables for outfit recommendations.
--
-- Run this in the Supabase SQL Editor after the base schema (supabase_schema.sql).
-- ============================================================================

-- 1. Enable pgvector extension for CLIP embedding similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add AI-specific columns to the existing wardrobe_items table
-- These columns store the output of the Vision Pipeline (SegFormer + FashionCLIP)
ALTER TABLE wardrobe_items
  ADD COLUMN IF NOT EXISTS ai_category TEXT,           -- FashionCLIP category (e.g. "Jeans", "Tank Top")
  ADD COLUMN IF NOT EXISTS ai_category_confidence REAL, -- confidence score 0-1
  ADD COLUMN IF NOT EXISTS ai_style TEXT,              -- e.g. "casual", "formal", "streetwear"
  ADD COLUMN IF NOT EXISTS ai_color TEXT,              -- e.g. "white", "navy", "black"
  ADD COLUMN IF NOT EXISTS ai_pattern TEXT,            -- e.g. "solid", "striped", "floral"
  ADD COLUMN IF NOT EXISTS ai_material TEXT,           -- e.g. "denim", "cotton", "leather"
  ADD COLUMN IF NOT EXISTS ai_season TEXT,             -- e.g. "summer", "all-season"
  ADD COLUMN IF NOT EXISTS segment_label TEXT,         -- SegFormer label (e.g. "Upper-clothes", "Pants", "Shoes")
  ADD COLUMN IF NOT EXISTS cropped_image_url TEXT,     -- S3 path: wardrobe/{user_id}/items/{item_id}.png
  ADD COLUMN IF NOT EXISTS embedding vector(512),      -- FashionCLIP 512-dim embedding for similarity search
  ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ; -- when the AI pipeline processed this item

-- 3. Create outfit_recommendations table
-- Stores Nemotron's outfit combinations from the user's wardrobe
CREATE TABLE IF NOT EXISTS outfit_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  item_ids UUID[] NOT NULL,                            -- array of wardrobe_item IDs that form this outfit
  occasion TEXT,                                       -- e.g. "casual day out", "formal dinner"
  season TEXT,                                         -- e.g. "summer", "all-season"
  description TEXT,                                    -- Nemotron's reasoning for this combo
  style_tags TEXT[],                                   -- e.g. ["minimalist", "monochrome"]
  confidence REAL DEFAULT 0.0,                         -- Nemotron's confidence in this recommendation
  is_liked BOOLEAN DEFAULT NULL,                       -- user feedback: true=liked, false=disliked, null=unseen
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create processing_jobs table
-- Tracks the status of outfit photo processing (for async UI updates)
CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',               -- pending, processing, completed, failed
  input_image_url TEXT,                                -- original uploaded outfit photo
  items_found INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 5. RLS Policies for new tables
ALTER TABLE outfit_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own recommendations"
  ON outfit_recommendations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own processing jobs"
  ON processing_jobs FOR ALL
  USING (auth.uid() = user_id);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_user_id ON wardrobe_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_ai_category ON wardrobe_items(ai_category);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_segment_label ON wardrobe_items(segment_label);
CREATE INDEX IF NOT EXISTS idx_outfit_recs_user_id ON outfit_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_status ON processing_jobs(user_id, status);

-- 7. Create the wardrobe storage bucket (if not exists)
-- NOTE: Supabase doesn't support IF NOT EXISTS for buckets in SQL.
-- Run this manually in the dashboard if it hasn't been created yet:
--   INSERT INTO storage.buckets (id, name, public) VALUES ('wardrobe', 'wardrobe', false);

-- 8. Function to find similar items by CLIP embedding
-- Usage: SELECT * FROM find_similar_items('user-uuid', embedding_vector, 5);
CREATE OR REPLACE FUNCTION find_similar_items(
  p_user_id UUID,
  p_embedding vector(512),
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  item_id UUID,
  item_name TEXT,
  category TEXT,
  color TEXT,
  similarity REAL
)
LANGUAGE sql STABLE
AS $$
  SELECT
    wi.id AS item_id,
    wi.name AS item_name,
    wi.ai_category AS category,
    wi.ai_color AS color,
    1 - (wi.embedding <=> p_embedding)::REAL AS similarity
  FROM wardrobe_items wi
  WHERE wi.user_id = p_user_id
    AND wi.embedding IS NOT NULL
  ORDER BY wi.embedding <=> p_embedding
  LIMIT p_limit;
$$;
