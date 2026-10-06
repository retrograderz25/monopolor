# Monopoly Vietnam Online

A multiplayer Monopoly-style board game built with React/Vite + Express + Socket.IO.

## Project structure

```text
monopoly-online-project/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── .gitignore
├── render.yaml
└── README.md
```

## Run locally

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Backend runs on `http://localhost:3001` by default.

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:5173`.

### 3. Play locally

Open the frontend in two or more browser tabs/devices and join the same room ID, for example `ROOM_1`.

## Render deployment

This repository contains a Render Blueprint at the root: `render.yaml`.

It provisions:

- `monopoly-server`: Node.js Web Service for Express + Socket.IO.
- `monopoly-frontend`: Static Site for React/Vite.

### Deploy with Render Blueprint

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repository.
3. Render will read `render.yaml`.
4. When prompted for environment variables:
   - Backend `FRONTEND_URL`: the public URL of the frontend, for example `https://monopoly-frontend.onrender.com`.
   - Frontend `VITE_SOCKET_URL`: the public URL of the backend, for example `https://monopoly-server.onrender.com`.
5. Deploy both services.
6. Open the frontend URL and give the same room ID to your friends.

## Production environment variables

### Backend

```text
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://your-frontend-domain.example
```

`FRONTEND_URL` can contain multiple comma-separated allowed origins if needed.

### Frontend

```text
VITE_SOCKET_URL=https://your-backend-domain.example
```

Vite exposes `VITE_*` variables at build time, so changing `VITE_SOCKET_URL` requires a frontend redeploy.

## Important runtime note

The current game state is stored in Node.js memory (`gameRooms`). A server restart will clear active rooms. This is fine for a small friend-group deployment, but a larger production deployment should move shared room state to Redis/Render Key Value and add a persistence strategy.
