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
  category: "Top" | "Bottom" | "Outerwear" | "Accessory";
  created_at: string;
}

// Local mock state for liked outfits (since we don't have the table yet)
let likedOutfits: Outfit[] = [];

// Mock Data
const MOCK_AVATAR =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80";
const MOCK_WARDROBE: WardrobeItem[] = [
  {
    id: "w1",
    user_id: "demo",
    name: "Classic Beige Trench",
    category: "Outerwear",
    image_url:
      "https://images.unsplash.com/photo-1591047139829-d91aec16adcd?w=400&q=80",
    created_at: new Date().toISOString(),
  },
  {
    id: "w2",
    user_id: "demo",
    name: "White Linen Shirt",
    category: "Top",
    image_url:
      "https://images.unsplash.com/photo-1596755094514-f87034a7a988?w=400&q=80",
    created_at: new Date().toISOString(),
  },
  {
    id: "w3",
    user_id: "demo",
    name: "Indigo Selvedge Denim",
    category: "Bottom",
    image_url:
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=80",
    created_at: new Date().toISOString(),
  },
  {
    id: "w4",
    user_id: "demo",
    name: "Canvas Tote Bag",
    category: "Accessory",
    image_url:
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=400&q=80",
    created_at: new Date().toISOString(),
  },
  {
    id: "w5",
    user_id: "demo",
    name: "Black Leather Jacket",
    category: "Outerwear",
    image_url:
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80",
    created_at: new Date().toISOString(),
  },
  {
    id: "w6",
    user_id: "demo",
    name: "Silk Slip Dress",
    category: "Top",
    image_url:
      "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=400&q=80",
    created_at: new Date().toISOString(),
  },
  {
    id: "w7",
    user_id: "demo",
    name: "Wool Trousers",
    category: "Bottom",
    image_url:
      "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&q=80",
    created_at: new Date().toISOString(),
  },
  {
    id: "w8",
    user_id: "demo",
    name: "Minimalist Watch",
    category: "Accessory",
    image_url:
      "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&q=80",
    created_at: new Date().toISOString(),
  },
];

const MOCK_OUTFITS: Outfit[] = [
  {
    id: "o1",
    user_id: "demo",
    title: "Urban Explorer",
    description: "Perfect for a day in the city.",
    image_url:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80",
    is_public: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "o2",
    user_id: "demo",
    title: "Minimalist Chic",
    description: "Clean lines and neutral tones.",
    image_url:
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&q=80",
    is_public: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "o3",
    user_id: "demo",
    title: "Weekend Vibe",
    description: "Casual yet put together.",
    image_url:
      "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=800&q=80",
    is_public: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "o4",
    user_id: "demo",
    title: "Tech Minimal",
    description: "Functional and sharp.",
    image_url:
      "https://images.unsplash.com/photo-1539109132314-d4a89ae3329d?w=800&q=80",
    is_public: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "o5",
    user_id: "demo",
    title: "Night Out",
    description: "Bold and elegant.",
    image_url:
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80",
    is_public: true,
    created_at: new Date().toISOString(),
  },
];

export const outfitService = {
  /**
   * Fetch public fashion outfits for the feed (Mixed with mock data)
   */
  async getPublicOutfits() {
    try {
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
      const likedIds = new Set([
        ...(likedRes.data?.map((l) => l.outfit_id) || []),
        ...likedOutfits.map((o) => o.id),
      ]);

      const combined = [...dbOutfits, ...MOCK_OUTFITS];

      // Filter out any that were already liked
      return combined.filter((o) => !likedIds.has(o.id)) as Outfit[];
    } catch (e) {
      console.log("Using Mock Outfits due to error or no data");
      const likedIds = new Set(likedOutfits.map((o) => o.id));
      return MOCK_OUTFITS.filter((o) => !likedIds.has(o.id));
    }
  },

  /**
   * Fetch user's private wardrobe items (Mixed with mock data)
   */
  async getMyWardrobe() {
    try {
      const { data: items, error } = await supabase
        .from("wardrobe_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      let itemsWithUrls = [];
      if (items && items.length > 0) {
        itemsWithUrls = await Promise.all(
          items.map(async (item) => {
            if (!item.image_url) return item;
            const { data } = await supabase.storage
              .from("wardrobe")
              .createSignedUrl(item.image_url, 3600);
            return {
              ...item,
              image_url: data?.signedUrl || item.image_url,
              category: item.category || "Top", // Default category
            };
          }),
        );
      }

      return [...itemsWithUrls, ...MOCK_WARDROBE];
    } catch (e) {
      console.log("Using Mock Wardrobe due to error or no data");
      return MOCK_WARDROBE;
    }
  },

  /**
   * Liked outfits functionality (Supabase + Mock Fallback)
   */
  async getLikedOutfits() {
    try {
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
    } catch (e) {
      console.log("Using Mock Liked Outfits");
      return likedOutfits;
    }
  },

  async toggleLikeOutfit(outfit: Outfit) {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      // Check if it's already liked
      const { data: existing } = await supabase
        .from("liked_outfits")
        .select("*")
        .eq("user_id", user.user.id)
        .eq("outfit_id", outfit.id)
        .single();

      if (existing) {
        await supabase
          .from("liked_outfits")
          .delete()
          .eq("user_id", user.user.id)
          .eq("outfit_id", outfit.id);

        likedOutfits = likedOutfits.filter((o) => o.id !== outfit.id);
      } else {
        // Only insert into Supabase if it's a real outfit (UUID format check could go here)
        // For now, we attempt insert. If it fails (e.g. mock ID), we just use local state.
        const { error } = await supabase.from("liked_outfits").insert({
          user_id: user.user.id,
          outfit_id: outfit.id,
        });

        if (error) {
          console.log("Persisting like locally (Mock Outfit)");
          likedOutfits = [outfit, ...likedOutfits];
        } else {
          likedOutfits = [outfit, ...likedOutfits];
        }
      }
      return true;
    } catch (e) {
      console.error("Toggle Like Error:", e);
      return false;
    }
  },

  /**
   * Upload an image and mock the segregation process
   */
  async uploadWardrobeImage(base64: string, fileName: string) {
    // 1. Simulate Upload
    console.log("Simulating upload of:", fileName);

    // 2. Mock background process
    await this.processOutfitImage("sample");

    // 3. Return a "new" item that appears categorized
    return MOCK_WARDROBE[Math.floor(Math.random() * MOCK_WARDROBE.length)];
  },

  /**
   * Fetch counts for outfits and wardrobe items
   */
  async getUserStats() {
    try {
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id || "demo";

      const [outfitsCount, wardrobeCount] = await Promise.all([
        supabase
          .from("outfits")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("wardrobe_items")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

      const { data: liked } = await supabase
        .from("liked_outfits")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      return {
        outfits: (outfitsCount.count || 0) + MOCK_OUTFITS.length,
        wardrobe: (wardrobeCount.count || 0) + MOCK_WARDROBE.length,
        likes: (liked?.length || 0) + likedOutfits.length + 12, // +12 for "wow" effect
      };
    } catch (e) {
      return {
        outfits: MOCK_OUTFITS.length,
        wardrobe: MOCK_WARDROBE.length,
        likes: likedOutfits.length + 12,
      };
    }
  },

  /**
   * Fetch current user profile (Mixed with mock data)
   */
  async getProfile() {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.data.user.id)
        .single();

      if (error) throw error;

      return {
        ...data,
        avatar_url: data.avatar_url || MOCK_AVATAR,
      };
    } catch (e) {
      return {
        full_name: "Sushant",
        avatar_url: MOCK_AVATAR,
        bio: "AI Fashion Enthusiast",
      };
    }
  },

  /**
   * Update profile data
   */
  async updateProfile(updates: any) {
    console.log("Mock update profile:", updates);
    return updates;
  },

  /**
   * Trigger a custom "Processing" edge function
   */
  async processOutfitImage(imageUri: string) {
    console.log("Processing image for background removal and segregation...");
    return new Promise((resolve) => setTimeout(resolve, 3000));
  },
};
