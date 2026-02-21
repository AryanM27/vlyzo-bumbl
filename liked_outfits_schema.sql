-- Create liked_outfits table
CREATE TABLE public.liked_outfits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  outfit_id UUID REFERENCES public.outfits ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, outfit_id)
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.liked_outfits ENABLE ROW LEVEL SECURITY;

-- POLICIES for liked_outfits
CREATE POLICY "Users can view their own liked outfits" ON liked_outfits 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add liked outfits" ON liked_outfits 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove liked outfits" ON liked_outfits 
  FOR DELETE USING (auth.uid() = user_id);

-- Instructions:
-- 1. Copy and paste this SQL into the Supabase SQL Editor.
-- 2. This will allow the app to persist "Likes" (swiping right) across sessions.
