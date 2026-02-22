import { supabase } from "@/lib/supabase";

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
        if (!item.image_url) return item;

        // If it's already a full URL (public URL), use it
        if (item.image_url.startsWith("http")) {
          return {
            ...item,
            category: item.category || item.ai_category || "Top",
          };
        }

        // Get public URL from storage
        const { data: urlData } = supabase.storage
          .from("wardrobe")
          .getPublicUrl(item.image_url);

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
    const { data, error } = await supabase.functions.invoke("process-image", {
      body: {
        image_base64: base64,
        mode,
      },
    });

    if (error) {
      console.error("Edge Function Error:", error);
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

    return (
      data || {
        full_name: user.data.user.email?.split("@")[0] || "User",
        avatar_url: null,
        bio: "",
      }
    );
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
};
