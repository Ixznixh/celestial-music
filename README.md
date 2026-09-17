# Celestial Music

A modern, ad-free music player Progressive Web App (PWA) inspired by the sleek visual language of premium iOS applications. Built with React, TypeScript, Tailwind CSS, Express, and `youtubei.js` on the server backend.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or later (Node.js 20+ recommended)
- **npm** or **bun** / **yarn**

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server (Full-Stack)
```bash
npm run dev
```
This starts both the Express backend API and the Vite development server on port `3000`.

### 4. Open Local URL
Visit `http://localhost:3000` in your web browser or iOS Safari.

---

## 🏗️ Production Build & Deployment

### Build the Application
```bash
npm run build
```
This builds the client assets into `dist/` with Vite and bundles the server into `dist/server.cjs` with `esbuild`.

### Start Production Server
```bash
npm start
```
Starts `node dist/server.cjs` listening on port `3000` (and `0.0.0.0` for container ingress).

---

## 🛠️ Architecture & Music Provider

- **Backend**: Express + `youtubei.js` running on the Node server.
- **Client**: React PWA communicating with `/api/*` endpoints.
- **Provider Isolation**: Provider internals are strictly isolated to the server. The client never imports `youtubei.js` directly and consumes only normalized JSON.
- **Zero API Keys Required**: No YouTube Data API key or Google API key is needed for standard operation.

### Endpoints
- `GET /api/home` - Real home feed sections (Quick Picks, Recommended, Trending, Charts)
- `GET /api/search?q=:query` - Search songs, artists, albums, and playlists
- `GET /api/search/suggestions?q=:query` - Real search auto-complete suggestions
- `GET /api/song/:id` - Normalized track metadata
- `GET /api/song/:id/audio` - Real audio streaming with HTTP 206 Byte Range support
- `GET /api/album/:id` - Album metadata and full tracklist
- `GET /api/artist/:id` - Artist overview, top songs, albums, and singles
- `GET /api/playlist/:id` - Playlist metadata and items
- `GET /api/lyrics/:id` - Synced/plain lyrics via LRCLIB and YouTube Music
- `GET /api/queue/:id` - Contextual recommendations and up next queue

---

## 🧪 Demo Mode (Testing / Development)

By default, Celestial Music operates exclusively in **Real Music Mode** (`VITE_DEMO_MODE=false`).

To enable offline/mock test data:
```env
VITE_DEMO_MODE=true
```

---

## ⚠️ Provider Limitations & Policy Compliance

- **No Ads or Analytics**: Zero tracking pixels, advertisements, or third-party tracking scripts.
- **DRM & Access Restrictions**: Only audio streams made legitimately accessible by the provider are streamed. If a track is geoblocked or restricted by YouTube, the app gracefully reports status without crashing.
- **Local Persistence**: User playlists, favorites, custom library tracks, and recently played history are persisted locally in the browser via IndexedDB.
