import { supabase } from "@/lib/supabase";
import { decode } from "base64-arraybuffer";

export interface Outfit {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  is_public: boolean;
  created_at: string;
}

export const outfitService = {
  /**
   * Fetch public fashion outfits for the feed
   */
  async getPublicOutfits() {
    const { data, error } = await supabase
      .from("outfits")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Outfit[];
  },

  /**
   * Fetch user's private wardrobe items with temporary Signed URLs
   */
  async getMyWardrobe() {
    const { data: items, error } = await supabase
      .from("wardrobe_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!items || items.length === 0) return [];

    // Map through items and create signed URLs for private storage images
    const itemsWithUrls = await Promise.all(
      items.map(async (item) => {
        if (!item.image_url) return item;

        // If it's a storage path, get a signed URL
        const { data, error: urlError } = await supabase.storage
          .from("wardrobe")
          .createSignedUrl(item.image_url, 3600); // URL valid for 1 hour

        return {
          ...item,
          image_url: data?.signedUrl || item.image_url,
        };
      }),
    );

    return itemsWithUrls;
  },

  /**
   * Upload an image to PRIVATE Supabase Storage and create a wardrobe item
   */
  async uploadWardrobeImage(base64: string, fileName: string) {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("No user found");

    const filePath = `${user.data.user.id}/${fileName}`;

    // 1. Upload to Private Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("wardrobe")
      .upload(filePath, decode(base64), {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 2. Add to Database (Store the PATH, not a public URL)
    const { data: dbData, error: dbError } = await supabase
      .from("wardrobe_items")
      .insert({
        user_id: user.data.user.id,
        name: "New Item",
        image_url: filePath, // Storing the path for signed URL generation
      })
      .select()
      .single();

    if (dbError) throw dbError;
    return dbData;
  },

  /**
   * Fetch counts for outfits and wardrobe items
   */
  async getUserStats() {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("No user found");

    const [outfitsCount, wardrobeCount] = await Promise.all([
      supabase
        .from("outfits")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.data.user.id),
      supabase
        .from("wardrobe_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.data.user.id),
    ]);

    return {
      outfits: outfitsCount.count || 0,
      wardrobe: wardrobeCount.count || 0,
    };
  },

  /**
   * Fetch current user profile
   */
  async getProfile() {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("No user found");

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.data.user.id)
      .single();

    if (error) throw error;

    // If there's a full length photo path, generate a signed URL
    if (data.full_length_photo_url) {
      const { data: urlData } = await supabase.storage
        .from("profiles")
        .createSignedUrl(data.full_length_photo_url, 3600);
      data.full_length_photo_url = urlData?.signedUrl || null;
    }

    return data;
  },

  /**
   * Update profile data
   */
  async updateProfile(updates: {
    full_name?: string;
    full_length_photo_url?: string;
  }) {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("No user found");

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.data.user.id);

    if (error) throw error;
  },

  /**
   * Upload user's full length photo
   */
  async uploadProfilePhoto(base64: string) {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("No user found");

    const filePath = `${user.data.user.id}/full_body.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("profiles")
      .upload(filePath, decode(base64), {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Save the PATH to the profile
    await this.updateProfile({ full_length_photo_url: filePath });

    return filePath;
  },

  /**
   * Trigger a custom "Processing" edge function
   * @param imageUri - The image to process
   */
  async processOutfitImage(imageUri: string) {
    // This is where you would call a Supabase Edge Function
    // const { data, error } = await supabase.functions.invoke('process-image', {
    //   body: { image_uri: imageUri },
    // });

    // For now, mirroring a "processing" delay
    return new Promise((resolve) => setTimeout(resolve, 2000));
  },
};
