# Vlyzo 🐝 

> **Your AI-Powered Digital Wardrobe & Personal Stylist**

Vlyzo is a modern, AI-driven fashion and wardrobe management mobile application built with **React Native (Expo)** and **Supabase**. It empowers users to digitize their closets, discover community-curated outfit inspirations, and leverage advanced AI vision models to generate new style pairings and see virtual try-ons.

---

## 🌟 Key Features

- **👗 Digital Wardrobe**: Upload photos of your clothing items and let Vlyzo automatically categorize, analyze, and store them securely.
- **🤖 AI Style Analysis**: Powered by a robust vision pipeline (using `rembg`, `CLIPSeg`, and `FashionCLIP`), the app processes your wardrobe to automatically detect categories, colors, patterns, and materials.
- **✨ Nemotron Outfit Recommendations**: Vlyzo uses NVIDIA's `Nemotron-Nano-9B-v2` to reason over your entire digital wardrobe and suggest smart, personalized outfit combinations based on your existing items.
- **👕 Virtual Try-On**: Try items on virtually! Upload a full-length body photo, and Vlyzo integrates with the `IDM-VTON` model to generate seamless draped visuals of new outfits.
- **🔥 Trending Feed**: Browse the public "Trending Now" feed to see public outfits shared by the community. Like styles and build your curated collection.

---

## 🏗️ Architecture & Tech Stack

Vlyzo is built with a modern, scalable stack designed for AI integration:

### Frontend (Mobile App)
- **Framework**: React Native with Expo (SDK 54, New Architecture enabled)
- **Language**: TypeScript (Strict Mode)
- **Routing**: Expo Router (File-based navigation)
- **UI & Animations**: `react-native-reanimated`, `react-native-gesture-handler`, and custom themed components for Light/Dark mode.

### Backend & Infrastructure
- **BaaS**: Supabase (Postgres Database, Auth, Storage, and Edge Functions)
- **Database**: Supabase Postgres with strict Row Level Security (RLS) policies.
- **AI Infrastructure**: NVIDIA Brev (GPU VM & NIM Deployments) powering our vision and LLM endpoints.

### AI Vision Pipeline
Our ML pipeline runs asynchronously behind Supabase Edge Functions:
1. **Background Removal**: `rembg` (U2-Net) cleans up user uploads.
2. **Segmentation**: `CLIPSeg` isolates individual garments within an outfit photo.
3. **Classification**: `FashionCLIP` zero-shot classifies style, color, pattern, and generates 512-dim embeddings.
4. **Reasoning & Styling**: `Nemotron-Nano-9B-v2` suggests outfit pairings.
5. **Virtual Try-On**: `IDM-VTON` visualizes the selected garments on the user's uploaded body photo.

---

## 🚀 Getting Started

### Prerequisites

- Node.js & npm installed
- An Expo account / Expo Go app on your physical device (or iOS Simulator / Android Emulator)
- A Supabase Project (with credentials)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/Vlyzo-bumbl.git
   cd Vlyzo-bumbl-master
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the app:**
   ```bash
   npx expo start
   ```
   Press `i` to open in the iOS simulator, `a` for Android, or scan the QR code with your Expo Go app.

---

## ☁️ Brev AI Deployment Setup

To run the custom AI services (Vision Pipeline and Nemotron LLM), you will need to start the deployment on an NVIDIA Brev VM (L40S or better recommended).

### 1. Automatic Setup
SSH into your Brev instance, navigate to the `brev/` directory, and run the deployment script. This will set up the Python virtual environment, install all dependencies, and pre-download the heavy vision models (`SegFormer`, `FashionCLIP`, `rembg`):

```bash
cd brev/
bash deploy.sh
```

### 2. Start the AI Services
After setup is complete, you can automatically spin up both the vLLM server (Nemotron-Nano-9B-v2) and the Vision Pipeline (FastAPI) inside a `tmux` session by running the start script:

```bash
bash start.sh
```

This will:
- Launch vLLM on port `8001`
- Wait for the LLM to load into memory
- Launch the Vision Pipeline on port `8000`

You can attach to the session at any time with `tmux attach -t vlyzo`. 

Once both are running, update your `.env` variables with the mapped endpoints to start routing traffic from the mobile app.

---

## 📚 Documentation

For detailed app context, schemas, and project structure, refer to the [Project Context](./context.md).

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
