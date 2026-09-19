# Deployment Guide — PulsePoll

This guide explains how to deploy PulsePoll to free cloud platforms so you have a **public, working live link** for your GUVI / HCL submission.

---

## 🌐 Recommended Free Architecture

| Service | Provider | Free Tier Details |
| :--- | :--- | :--- |
| **Frontend** | **Vercel** or **Render** | Free unlimited static hosting with SSL |
| **Backend** | **Render** or **Railway** | Free web service hosting Docker or Go binary |
| **Database** | **MongoDB Atlas** | 512 MB free M0 cluster with automated backups |
| **Realtime** | **Upstash Redis** | 10,000 commands/day free serverless Redis |

---

## Step 1: Provision MongoDB Atlas (Database)

1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free **M0 Sandbox** cluster.
3. Under **Database Access**, create a database user (e.g. `pulse_user` and secure password).
4. Under **Network Access**, click **Add IP Address** -> select **Allow Access from Anywhere (`0.0.0.0/0`)** so your cloud backend can connect.
5. Click **Connect** -> **Drivers (Go)** -> copy your connection string:
   ```
   mongodb+srv://pulse_user:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```

---

## Step 2: Provision Upstash Redis (Realtime & Pub/Sub)

1. Sign up at [upstash.com](https://upstash.com).
2. Click **Create Database** (Select Primary Region closest to your backend, e.g. Singapore or Frankfurt or US).
3. Scroll down to **REST API / Node / Go** -> copy the **Redis URL**:
   ```
   rediss://default:<password>@<your-upstash-host>.upstash.io:6379
   ```

---

## Step 3: Deploy Backend to Render

1. Push your code to a public GitHub repository.
2. Sign up at [render.com](https://render.com) and click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Set the following settings:
   - **Name**: `pulsepoll-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Go` (or `Docker`)
   - **Build Command**: `go build -o server ./cmd/server`
   - **Start Command**: `./server`
5. Under **Environment Variables**, add:
   - `PORT` = `8080`
   - `MONGO_URI` = `<your-mongodb-atlas-uri>`
   - `MONGO_DB_NAME` = `live_polling_db`
   - `REDIS_URI` = `<your-upstash-redis-uri>`
   - `JWT_SECRET` = `<a-secure-random-string>`
   - `CORS_ORIGIN` = `*`
   - `ENV` = `production`
6. Click **Deploy Web Service**.
7. Once deployed, note down your backend URL, e.g. `https://pulsepoll-backend.onrender.com`.

---

## Step 4: Deploy Frontend to Vercel

1. Sign up at [vercel.com](https://vercel.com) and click **Add New** -> **Project**.
2. Import your GitHub repository.
3. In the project configuration:
   - **Root Directory**: Select `frontend`
   - **Framework Preset**: `Vite`
4. Under **Environment Variables**, add:
   - `VITE_API_URL` = `https://pulsepoll-backend.onrender.com` (Your Render backend URL from Step 3)
   - `VITE_WS_URL` = `wss://pulsepoll-backend.onrender.com`
5. Click **Deploy**.
6. Your live polling frontend will be live on `https://<your-project-name>.vercel.app`!

---

## Step 5: Test the Live URL

1. Open your Vercel URL on your laptop and on your phone.
2. Register an account and create a poll.
3. Scan the QR code with your phone and vote.
4. Verify the laptop results update immediately without refreshing.
5. Copy your Vercel URL and GitHub repository link to your submission email!
