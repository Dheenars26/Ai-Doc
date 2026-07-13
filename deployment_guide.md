# AI Document Assistant Deployment Guide

This guide walks you through deploying the AI Document Assistant project. 

The application is split into two components:
1. **Backend (server)**: A Node.js/Express server that handles document uploading, parsing, AI generation (Gemini/OpenAI), and real-time collaboration using WebSockets (Socket.io). We will deploy this to **Render** because it supports persistent WebSocket connections.
2. **Frontend (client)**: A React/Vite web application. We will deploy this to **Vercel** for fast static hosting.

---

## Prerequisites
- A **GitHub** account with your code pushed to a repository (e.g., `https://github.com/Dheenars26/Ai-Doc.git`).
- A **Vercel** account (connected to your GitHub).
- A **Render** account (connected to your GitHub).
- API Keys for your AI provider:
  - **Gemini API Key** (from Google AI Studio) OR **OpenAI API Key**.

---

## Step 1: Deploy the Backend on Render

Render will host the Node/Express server and handle the Socket.io WebSocket connections.

1. Log in to [Render](https://dashboard.render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository (`Ai-Doc`).
4. In the creation form, configure the following:
   - **Name**: `ai-doc-backend` (or any name you prefer)
   - **Region**: Choose the region closest to you
   - **Branch**: `main` (or whichever branch you push your changes to)
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/server.js`
   - **Instance Type**: Select the **Free** tier (or paid if you prefer no spin-downs)
5. Expand the **Environment** section and add your Environment Variables:
   - `PORT`: `10000` (Render defaults to assigning its own port, but setting this is a good practice)
   - `AI_PROVIDER`: `gemini` (or `openai`)
   - `GEMINI_API_KEY`: *Your Google Gemini API Key* (if using Gemini)
   - `OPENAI_API_KEY`: *Your OpenAI API Key* (if using OpenAI)
6. Click **Deploy Web Service**.
7. Once deployed, note down the URL provided by Render (e.g., `https://ai-doc-backend.onrender.com`). **This is your Backend URL.**

> [!NOTE]
> On Render's Free tier, the server spins down after 15 minutes of inactivity. When a new user opens the website, it may take 50–90 seconds for the server to spin back up.

---

## Step 2: Deploy the Frontend on Vercel

Vercel will host the React client and serve it statically.

1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New** > **Project**.
3. Import your GitHub repository (`Ai-Doc`).
4. In the **Configure Project** section:
   - **Project Name**: `ai-doc-assistant`
   - **Framework Preset**: `Vite` (Vercel will automatically detect this)
   - **Root Directory**: Click *Edit* and select **`client`**.
5. Expand the **Build and Development Settings**:
   - Keep the default Build Command (`npm run build`) and Output Directory (`dist`).
6. Expand the **Environment Variables** section and add:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://YOUR-RENDER-BACKEND-URL/api` (e.g. `https://ai-doc-backend.onrender.com/api` — **make sure it ends with `/api`**)
7. Click **Deploy**.
8. Once deployment is complete, Vercel will give you your Frontend URL (e.g., `https://ai-doc-assistant.vercel.app`).

---

## Step 3: Verification

1. Open your Vercel frontend URL in a browser.
2. Open the browser console (F12) to monitor logs.
3. Check the collaborative session:
   - Under the hood, the client will connect to the socket server at your Render URL.
   - If the Render service is spinning up, you may see some temporary socket connection errors in the console. They will disappear once the backend becomes active.
4. Try uploading a document and asking the AI a question to verify that the end-to-end flow works successfully.
