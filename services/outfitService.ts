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

export interface WardrobeItem {
  id: string;
  user_id: string;
  name: string;
  image_url: string;
  cropped_image_url?: string;
  category: string;
  ai_category?: string;
  ai_color?: string;
  ai_style?: string;
  created_at: string;
}

export const outfitService = {
  /**
   * Fetch public fashion outfits for the feed
   */
  async getPublicOutfits() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const [outfitsRes, likedRes] = await Promise.all([
      supabase
        .from("outfits")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false }),
      userId
        ? supabase
            .from("liked_outfits")
            .select("outfit_id")
            .eq("user_id", userId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (outfitsRes.error) throw outfitsRes.error;

    const dbOutfits = outfitsRes.data || [];
    const likedIds = new Set(likedRes.data?.map((l) => l.outfit_id) || []);

    // Filter out any that were already liked
    return dbOutfits.filter((o) => !likedIds.has(o.id)) as Outfit[];
  },

  /**
   * Fetch user's private wardrobe items
   */
  async getMyWardrobe() {
    const { data: items, error } = await supabase
      .from("wardrobe_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!items || items.length === 0) return [];

    return await Promise.all(
      items.map(async (item) => {
        if (!item.image_url && !item.cropped_image_url) return item;

        let storagePath =
          item.cropped_image_url || `${item.user_id}/items/${item.id}.png`;

        // Handle images stored as full Supabase public URLs due to older implementation
        if (storagePath.includes("/object/public/wardrobe/")) {
          storagePath = storagePath.split("/object/public/wardrobe/")[1];
        } else if (storagePath.includes("/public/wardrobe/")) {
          storagePath = storagePath.split("/public/wardrobe/")[1];
        }

        // If it's still a full URL (external), use it
        if (storagePath.startsWith("http")) {
          return {
            ...item,
            image_url: storagePath,
            category: item.category || item.ai_category || "Top",
          };
        }

        // Get public URL from storage for the bucket
        const { data: urlData } = supabase.storage
          .from("wardrobe")
          .getPublicUrl(storagePath);

        return {
          ...item,
          image_url: urlData?.publicUrl || item.image_url,
          category: item.category || item.ai_category || "Top",
        };
      }),
    );
  },

  /**
   * Liked outfits functionality
   */
  async getLikedOutfits() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return [];

    const { data, error } = await supabase
      .from("liked_outfits")
      .select(
        `
        outfit_id,
        outfits (
          id,
          user_id,
          title,
          description,
          image_url,
          is_public,
          created_at
        )
      `,
      )
      .eq("user_id", user.user.id);

    if (error) throw error;

    return (
      (data
        ?.map((item) => {
          const outfit = item.outfits;
          return Array.isArray(outfit) ? outfit[0] : outfit;
        })
        .filter(Boolean) as unknown as Outfit[]) || []
    );
  },

  async toggleLikeOutfit(outfitId: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return false;

    // Check if it's already liked
    const { data: existing } = await supabase
      .from("liked_outfits")
      .select("*")
      .eq("user_id", user.user.id)
      .eq("outfit_id", outfitId)
      .single();

    if (existing) {
      await supabase
        .from("liked_outfits")
        .delete()
        .eq("user_id", user.user.id)
        .eq("outfit_id", outfitId);
    } else {
      const { error } = await supabase.from("liked_outfits").insert({
        user_id: user.user.id,
        outfit_id: outfitId,
      });
      if (error) throw error;
    }
    return true;
  },

  /**
   * Upload an image to the AI Vision Pipeline
   */
  async uploadWardrobeImage(
    base64: string,
    mode: "single" | "outfit" = "single",
  ) {
    const { data: userAuth } = await supabase.auth.getUser();
    const userId = userAuth.user?.id;

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase.functions.invoke("process-image", {
      body: {
        image_base64: base64,
        mode,
        user_id: userId,
      },
    });

    if (error) {
      console.error("Edge Function Error:", error);
      // Try to read the response body from the error
      try {
        if (error.context && typeof error.context.json === "function") {
          const body = await error.context.json();
          console.error("Error response body:", JSON.stringify(body));
        } else if (error.context && typeof error.context.text === "function") {
          const body = await error.context.text();
          console.error("Error response text:", body);
        } else {
          console.error("Error context:", JSON.stringify(error.context));
        }
      } catch (e) {
        console.error("Could not read error body, context:", error.context);
      }
      throw error;
    }

    return data;
  },

  /**
   * Fetch counts for outfits and wardrobe items
   */
  async getUserStats() {
    const userRes = await supabase.auth.getUser();
    const userId = userRes.data.user?.id;
    if (!userId) return { outfits: 0, wardrobe: 0, likes: 0 };

    const [outfitsCount, wardrobeCount, likesCount] = await Promise.all([
      supabase
        .from("outfits")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("wardrobe_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("liked_outfits")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    return {
      outfits: outfitsCount.count || 0,
      wardrobe: wardrobeCount.count || 0,
      likes: likesCount.count || 0,
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

    if (error && error.code !== "PGRST116") throw error;

    const profile = data || {
      full_name: user.data.user.email?.split("@")[0] || "User",
      avatar_url: null,
      bio: "",
    };

    // Add cache buster to full_length_photo_url if it exists
    if (profile.full_length_photo_url) {
      const timestamp = new Date().getTime();
      profile.full_length_photo_url = profile.full_length_photo_url.includes(
        "?",
      )
        ? `${profile.full_length_photo_url}&t=${timestamp}`
        : `${profile.full_length_photo_url}?t=${timestamp}`;
    }

    return profile;
  },

  /**
   * Update profile data
   */
  async updateProfile(updates: any) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        id: user.user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Poll for the status of a processing job
   */
  async getProcessingJobStatus(jobId: string) {
    const { data, error } = await supabase
      .from("processing_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Upload user profile full-length photo
   */
  async uploadProfilePhoto(base64: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Convert base64 to ArrayBuffer
    const arrayBuffer = decode(base64);

    // Use User ID as a folder and profile_pic.png as the filename
    const filePath = `${user.id}/profile_pic.png`;

    // Try updating first (if user already has a photo)
    let { error: uploadError } = await supabase.storage
      .from("wardrobe")
      .update(filePath, arrayBuffer, {
        contentType: "image/png",
        cacheControl: "3600",
      });

    // If file doesn't exist, try initial upload
    if (uploadError && uploadError.message.includes("Object not found")) {
      const { error: initialUploadError } = await supabase.storage
        .from("wardrobe")
        .upload(filePath, arrayBuffer, {
          contentType: "image/png",
        });
      uploadError = initialUploadError;
    }

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("wardrobe")
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) throw new Error("Failed to get public URL");

    // Update profiles table using .update() instead of .upsert()
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_length_photo_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    return urlData.publicUrl;
  },
};
