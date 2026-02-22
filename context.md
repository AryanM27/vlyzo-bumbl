# Vlyzo — Project Context

> **Last Updated:** 2026-02-21  
> **Version:** 1.0.0  
> **Platform:** iOS · Android · Web (Expo universal)

---

## 1. Overview

**Vlyzo** (package name: `vlyzo-bumbl`) is a **fashion & wardrobe management** mobile application built with **React Native (Expo)**. It lets users:

- **Build a digital wardrobe** by uploading photos of clothing items.
- **Browse a public outfit feed** ("Trending Now") of outfits shared by other users.
- **Save / like outfits** into a curated personal collection.
- **Manage their profile**, including uploading a full-length body photo for **virtual draping** (trying wardrobe items on their photo).
- **Trigger AI-powered style analysis** via Supabase Edge Functions (currently a placeholder/mock).

The backend is entirely powered by **Supabase** (Postgres DB + Auth + Storage + Edge Functions).

---

## 2. Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| **Framework** | Expo (Managed Workflow) | SDK 54 (`expo@~54.0.33`) |
| **Language** | TypeScript | `~5.9.2`, strict mode enabled |
| **UI Library** | React Native | `0.81.5` (New Architecture enabled) |
| **Navigation** | Expo Router (file-based routing) | `~6.0.23` — uses typed routes |
| **State** | React `useState` / `useEffect` | No external state management lib |
| **Backend / BaaS** | Supabase | `@supabase/supabase-js@^2.97.0` |
| **Auth** | Supabase Auth (email + password) | Session stored in `expo-secure-store` |
| **Database** | Supabase Postgres | Row Level Security (RLS) enabled |
| **Storage** | Supabase Storage | Two private buckets: `wardrobe`, `profiles` |
| **Image Handling** | `expo-image` + `expo-image-picker` | Base64 upload via `base64-arraybuffer` |
| **Animations** | `react-native-reanimated` | `~4.1.1` |
| **Gestures** | `react-native-gesture-handler` | `~2.28.0` |
| **Haptics** | `expo-haptics` | Used in tab bar |

### Dev Dependencies

- **ESLint** (`^9.25.0`) with `eslint-config-expo`
- **TypeScript** (`~5.9.2`)
- `@types/react` (`~19.1.0`)

---

## 3. Project Structure

```
Vlyzo-bumbl-master/
├── app/                        # Expo Router — file-based routes
│   ├── _layout.tsx             # Root layout (auth guard, theme provider)
│   ├── modal.tsx               # Generic modal screen
│   ├── profile-info.tsx        # Profile editing (name, full-body photo, stats)
│   ├── settings.tsx            # Settings menu (account, app, sign-out)
│   ├── (auth)/                 # Auth route group (unauthenticated users)
│   │   ├── _layout.tsx         # Auth stack (headerless, slide animation)
│   │   ├── login.tsx           # Login screen (email + password)
│   │   └── signup.tsx          # Signup screen (name + email + password)
│   └── (tabs)/                 # Main app route group (authenticated users)
│       ├── _layout.tsx         # Bottom tab bar config
│       ├── index.tsx           # Home / Feed screen (public outfits + AI trigger)
│       ├── wardrobe.tsx        # Private wardrobe (upload + grid view)
│       ├── liked.tsx           # Liked outfits (placeholder)
│       └── profile.tsx         # Profile tab (placeholder, hidden from nav)
├── components/                 # Reusable React components
│   ├── ui/
│   │   ├── Button.tsx          # Themed button (primary / secondary / outline)
│   │   ├── Input.tsx           # Themed text input with label & error
│   │   ├── collapsible.tsx     # Collapsible section
│   │   ├── icon-symbol.tsx     # Cross-platform SF Symbol / Material icon
│   │   └── icon-symbol.ios.tsx # iOS-specific icon implementation
│   ├── external-link.tsx       # Opens URLs in browser
│   ├── haptic-tab.tsx          # Tab bar button with haptic feedback
│   ├── hello-wave.tsx          # Animated wave emoji
│   ├── parallax-scroll-view.tsx# Parallax scrolling header
│   ├── themed-text.tsx         # Text with theme colors
│   └── themed-view.tsx         # View with theme colors
├── constants/
│   └── theme.ts                # Color palette (light/dark) + font families
├── hooks/
│   ├── use-color-scheme.ts     # Native color scheme hook
│   ├── use-color-scheme.web.ts # Web color scheme hook
│   └── use-theme-color.ts     # Resolves theme colors
├── lib/
│   └── supabase.ts             # Supabase client init (SecureStore adapter)
├── services/
│   └── outfitService.ts        # All Supabase data access (CRUD, uploads, stats)
├── assets/                     # Images, icons, fonts
├── scripts/
│   └── reset-project.js        # Expo starter code reset utility
├── supabase_schema.sql         # Full database schema + RLS policies + triggers
├── .env                        # Environment variables (currently empty)
├── app.json                    # Expo configuration
├── package.json                # Dependencies + scripts
├── tsconfig.json               # TypeScript config
└── eslint.config.js            # ESLint config
```

---

## 4. Navigation Architecture

The app uses **Expo Router's file-based routing** with the following flow:

```
RootLayout (_layout.tsx)
├── (auth)/                     ← Shown when NOT authenticated
│   ├── login                   ← Default entry for unauthenticated
│   └── signup
├── (tabs)/                     ← Shown when authenticated
│   ├── wardrobe                ← Tab 1 (left)
│   ├── index (Home)            ← Tab 2 (center, elevated FAB-style button)
│   ├── liked                   ← Tab 3 (right)
│   └── profile                 ← Hidden from tab bar (href: null)
├── settings                    ← Stack-pushed from Home header
├── profile-info                ← Stack-pushed from Settings
└── modal                       ← Presented as modal
```

### Auth Guard (Root `_layout.tsx`)

- Listens to `supabase.auth.onAuthStateChange`.
- If a session exists and the user is in the `(auth)` group → redirect to `/(tabs)`.
- If no session and the user is NOT in the `(auth)` group → redirect to `/(auth)/login`.

---

## 5. Database Schema (Supabase Postgres)

### Tables

#### `profiles`
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK, FK → `auth.users`) | User ID |
| `full_name` | TEXT | Display name |
| `avatar_url` | TEXT | Avatar image path |
| `full_length_photo_url` | TEXT | Full-body photo path (for virtual draping) |
| `updated_at` | TIMESTAMPTZ | Auto-set to `NOW()` |

#### `wardrobe_items`
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK, auto-generated) | Item ID |
| `user_id` | UUID (FK → `auth.users`) | Owner |
| `name` | TEXT (NOT NULL) | Item name |
| `category` | TEXT | e.g. "Top", "Bottom", "Shoes" |
| `image_url` | TEXT | Storage path (signed URL generated at read time) |
| `tags` | TEXT[] | Array of tags |
| `created_at` | TIMESTAMPTZ | Auto-set |

#### `outfits`
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK, auto-generated) | Outfit ID |
| `user_id` | UUID (FK → `auth.users`) | Creator |
| `title` | TEXT (NOT NULL) | Outfit title |
| `description` | TEXT | Optional description |
| `image_url` | TEXT | Outfit image path |
| `is_public` | BOOLEAN | Default `false`; `true` = visible in feed |
| `created_at` | TIMESTAMPTZ | Auto-set |

### Row Level Security (RLS)

| Table | Policy |
|---|---|
| `profiles` | Users can SELECT/UPDATE **their own** profile only |
| `wardrobe_items` | Users can do ALL operations on **their own** items only |
| `outfits` | Users can do ALL on **their own** outfits; **everyone** can SELECT public outfits |

### Triggers

- **`on_auth_user_created`**: After a new user signs up, a row is automatically inserted into `profiles` with `full_name` and `avatar_url` from the signup metadata.

### Storage Buckets

| Bucket | Visibility | Purpose |
|---|---|---|
| `wardrobe` | Private | Stores wardrobe item images (`{user_id}/{filename}`) |
| `profiles` | Private | Stores full-body photos (`{user_id}/full_body.jpg`) |

Storage policies enforce that only authenticated owners can upload, read, and delete/update their own files.

---

## 6. Services Layer (`services/outfitService.ts`)

All Supabase data access is centralized in a single service object:

| Method | Description |
|---|---|
| `getPublicOutfits()` | Fetch all public outfits, ordered by newest first |
| `getMyWardrobe()` | Fetch user's wardrobe items with **signed URLs** (valid 1 hour) |
| `uploadWardrobeImage(base64, fileName)` | Upload image to `wardrobe` bucket + insert DB row |
| `getUserStats()` | Returns `{ outfits: number, wardrobe: number }` counts |
| `getProfile()` | Fetch profile with signed URL for full-length photo |
| `updateProfile(updates)` | Update `full_name` or `full_length_photo_url` |
| `uploadProfilePhoto(base64)` | Upload full-body photo to `profiles` bucket + update profile |
| `processOutfitImage(imageUri)` | **Placeholder** — simulates 2s AI processing delay |

### Key Patterns

- **Images are stored as paths**, not public URLs. Signed URLs (1-hour TTL) are generated on read.
- **Base64 encoding** is used for uploads (`base64-arraybuffer` for decoding).
- File paths follow the pattern: `{user_id}/{filename}`.

---

## 7. Theming

Defined in `constants/theme.ts`. The app supports **light** and **dark** modes (auto-detected).

### Color Palette

| Token | Light | Dark |
|---|---|---|
| `text` | `#022b3a` (Jet Black) | `#ffffff` (White) |
| `background` | `#ffffff` (White) | `#022b3a` (Jet Black) |
| `tint` | `#1f7a8c` (Teal) | `#1f7a8c` (Teal) |
| `icon` | `#1f7a8c` (Teal) | `#bfdbf7` (Pale Sky) |
| `secondary` | `#e1e5f2` (Lavender) | `#1f7a8c` (Teal) |
| `border` | `#bfdbf7` (Pale Sky) | `#1f7a8c` (Teal) |
| `tabIconDefault` | `#bfdbf7` | `#1f7a8c` |
| `tabIconSelected` | `#1f7a8c` | `#bfdbf7` |

### Font Families

Platform-specific system fonts: `sans`, `serif`, `rounded`, `mono`.

---

## 8. Reusable Components

### `<Button />`
- **Variants:** `primary` (teal fill), `secondary` (muted fill), `outline` (bordered)
- **Props:** `title`, `onPress`, `loading`, `variant`, `style`, `textStyle`, `disabled`
- Shows `ActivityIndicator` when loading.

### `<Input />`
- Themed text input with optional `label` and `error` message.
- Focus border color changes to `tint`.
- Extends all `TextInputProps`.

### `<IconSymbol />`
- Cross-platform icon component.
- Uses SF Symbols on iOS (`icon-symbol.ios.tsx`) and Material Design Icons elsewhere (`icon-symbol.tsx`).

### `<ThemedText />` / `<ThemedView />`
- Automatically apply theme-aware text/background colors.

### `<HapticTab />`
- Tab bar button that triggers a light haptic impact on press (iOS).

---

## 9. Environment Variables

The app expects these environment variables (via `.env` or Expo config):

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public API key |

> ⚠️ The `.env` file is currently **empty**. These must be set before the app can connect to Supabase.

---

## 10. Authentication Flow

1. **Signup** (`/(auth)/signup`):
   - Collects `full_name`, `email`, `password`.
   - Calls `supabase.auth.signUp()` with `full_name` in `options.data`.
   - On success without immediate session → shows "check email" alert.
   - The `on_auth_user_created` trigger automatically creates a `profiles` row.

2. **Login** (`/(auth)/login`):
   - Collects `email`, `password`.
   - Calls `supabase.auth.signInWithPassword()`.
   - On success → auth state change listener redirects to `/(tabs)`.

3. **Session Persistence**:
   - Sessions are securely stored via `expo-secure-store` (not AsyncStorage).
   - `autoRefreshToken` and `persistSession` are enabled.

4. **Sign Out** (`/settings`):
   - Confirmation alert → `supabase.auth.signOut()` → redirect to `/(auth)/login`.

---

## 11. Screen-by-Screen Breakdown

### Home (`/(tabs)/index`)
- Header with "Vlyzo" title + wave animation + settings gear icon.
- **AI Processing Section**: Dashed border card with "Start AI Process" button (mock 2s delay).
- **Trending Now Feed**: FlatList of public outfits (pull-to-refresh).
- Each outfit card shows image + title.

### Wardrobe (`/(tabs)/wardrobe`)
- Header: "Wardrobe — Manage your digital closet".
- **Add Item**: Dashed border card → opens image picker → uploads to Supabase Storage.
- **Item Grid**: 2-column FlatList with `(width - 64) / 2` item sizing.
- Each item shows image + name.

### Liked (`/(tabs)/liked`)
- Header: "Liked Outfits — Your curated collection".
- **Currently a placeholder** with a dashed border empty state message.

### Profile (`/(tabs)/profile`)
- Header: "Profile — Manage your style identity".
- **Currently a placeholder** with sign-out button (not connected).
- Hidden from tab bar (`href: null`).

### Settings (`/settings`)
- Stack screen with back navigation.
- **Account section**: Profile Information (→ `/profile-info`), Security (stub), Notifications (stub).
- **App section**: Appearance (stub), Help & Support (stub), About Vlyzo (stub).
- **Sign Out**: Destructive action with confirmation.

### Profile Info (`/profile-info`)
- **Full-Length Photo**: Upload area for virtual draping photo (2:3 aspect ratio).
- **Stats**: Cards showing outfit count + wardrobe item count.
- **Details**: Editable full name field + "Save Changes" button.

### Modal (`/modal`)
- Generic modal screen with a link back to home.

---

## 12. Expo Configuration Highlights

| Setting | Value |
|---|---|
| **Orientation** | Portrait only |
| **UI Style** | Automatic (follows system) |
| **New Architecture** | Enabled |
| **Typed Routes** | Enabled |
| **React Compiler** | Enabled (experimental) |
| **URL Scheme** | `vlyzobumbl` |
| **Edge-to-Edge (Android)** | Enabled |

---

## 13. Scripts

| Script | Command | Description |
|---|---|---|
| `start` | `expo start` | Start Expo dev server |
| `android` | `expo start --android` | Start on Android |
| `ios` | `expo start --ios` | Start on iOS |
| `web` | `expo start --web` | Start on Web |
| `lint` | `expo lint` | Run ESLint |
| `reset-project` | `node ./scripts/reset-project.js` | Move starter code, create blank `app/` |

---

## 14. Key Architectural Decisions

1. **No external state management**: The app uses plain React state (`useState`/`useEffect`). No Redux, Zustand, or Context API wrappers are present.
2. **Centralized service layer**: All Supabase interactions go through `outfitService.ts`, keeping screens data-agnostic.
3. **Private storage with signed URLs**: Images are not publicly accessible. Signed URLs with 1-hour TTL are generated on demand.
4. **Secure session storage**: `expo-secure-store` is used instead of AsyncStorage for auth tokens.
5. **File-based routing**: Expo Router maps the filesystem to navigation structure, with route groups `(auth)` and `(tabs)`.
6. **Path alias**: `@/*` maps to the project root (configured in `tsconfig.json`).
