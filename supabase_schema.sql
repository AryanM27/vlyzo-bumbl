-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  full_length_photo_url TEXT, -- URL or path for virtual draping
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wardrobe_items table
CREATE TABLE wardrobe_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT, -- e.g., Top, Bottom, Shoes
  image_url TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create outfits table
CREATE TABLE outfits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;

-- POLICIES for profiles
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- POLICIES for wardrobe_items
CREATE POLICY "Users can manage their own wardrobe" ON wardrobe_items 
  FOR ALL USING (auth.uid() = user_id);

-- POLICIES for outfits
CREATE POLICY "Users can manage their own outfits" ON outfits 
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Everyone can view public outfits" ON outfits 
  FOR SELECT USING (is_public = true);

-- AUTO-SYNC PROFILES ON SIGNUP
-- This function inserts a row into the public.profiles table whenever a new user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STORAGE SETUP
-- Run this in your SQL Editor or through the Supabase Dashboard to create the bucket:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('wardrobe', 'wardrobe', false);

-- STORAGE POLICIES (Strictly private for the owner)
-- These allow users to upload, view, and delete ONLY their own files.
CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'wardrobe' AND auth.role() = 'authenticated');

CREATE POLICY "Allow owners to read their own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'wardrobe' AND auth.uid() = owner);

CREATE POLICY "Allow owners to delete their own files" ON storage.objects
  FOR DELETE USING (bucket_id = 'wardrobe' AND auth.uid() = owner);

-- PROFILES STORAGE SETUP
-- INSERT INTO storage.buckets (id, name, public) VALUES ('profiles', 'profiles', false);

-- PROFILES STORAGE POLICIES
CREATE POLICY "Allow authenticated profile uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'profiles' AND auth.role() = 'authenticated');

CREATE POLICY "Allow owners to read their own profile files" ON storage.objects
  FOR SELECT USING (bucket_id = 'profiles' AND auth.uid() = owner);

CREATE POLICY "Allow owners to update their own profile files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'profiles' AND auth.uid() = owner);
