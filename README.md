# AI Smart Router Planner

An intelligent route optimization web app that combines graph algorithms, weighted scoring, ML-based traffic prediction, account-based saved places, and live AI route assistance.

## What Makes It Different

Traditional maps focus mostly on shortest-path logic. This project combines:

- Dijkstra (baseline shortest path)
- A* (heuristic pathfinding with Haversine)
- Weighted AI scoring across distance, time, traffic, cost, weather, and road type
- ML traffic prediction via a Flask API (`time`, `day` -> traffic level/score)
- JWT auth with MongoDB-backed user profiles, saved places, and route history
- Dynamic route-aware AI responses via OpenAI or Gemini (with OpenRouter compatibility)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React-Leaflet, Framer Motion |
| Backend | Node.js, Express |
| Database | MongoDB Atlas |
| Routing | OpenRouteService + OSRM fallback |
| Weather | OpenWeatherMap (optional) |
| ML Service | Flask + model.pkl |
| Auth | Email validation, bcrypt password hashing, JWT, email verification |
| LLM Messaging | OpenAI Responses API or Gemini API (OpenRouter-compatible fallback) |

## Project Structure

```text
client/      # React frontend
server/      # Express backend
ml-model/    # Flask ML API (predict traffic)
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+

### 1) Install Dependencies

```bash
# From project root (needed for one-command run)
npm install

# Backend
cd server
npm install

# Frontend
cd ../client
npm install

# ML API
cd ../ml-model
pip install -r requirements.txt
```

### 2) Environment Setup

Create `server/.env` (you can copy from `server/.env.example`):

```env
CLIENT_URL=http://localhost:5173
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_long_random_jwt_secret
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5.4-mini
# or
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
ORS_API_KEY=your_openrouteservice_key
WEATHER_API_KEY=your_openweathermap_key
ML_PREDICT_URL=http://localhost:5001/predict
# Optional SMTP for real verification emails
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=AI Route Planner <no-reply@example.com>
```

## Run the System

### Option A: Manual (recommended for demos)

Use 3 terminals:

```bash
# Terminal 1 - ML API (5001)
cd ml-model
python app.py

# Terminal 2 - Backend API (5000)
cd server
npm run dev

# Terminal 3 - Frontend (5173)
cd client
npm run dev
```

Open: `http://localhost:5173`

### Option B: One command

From project root:

```bash
npm run dev
```

This runs ML + backend + frontend together using `concurrently`.

### Pre-demo check (Step 9)

From project root:

```bash
npm run health:check
```

This checks:

- Frontend: `http://localhost:5173/`
- Backend: `http://localhost:5000/api/health`
- ML API: `http://localhost:5001/health`

## Health Checks

- Backend: `http://localhost:5000/api/health`
- ML API: `http://localhost:5001/health`

## API Endpoints (Backend)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/routes/optimize` | Optimize routes |
| POST | `/api/routes/refresh` | Controlled refresh loop |
| POST | `/api/routes/multi-stop` | Multi-stop optimization |
| GET | `/api/routes/geocode?q=` | Geocoding |
| GET | `/api/routes/reverse-geocode?lat=&lon=` | Reverse geocoding |
| POST | `/api/auth/register` | Create account + send verification |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/verify-email` | Verify account email |
| GET | `/api/auth/me` | Current user profile |
| PUT | `/api/auth/profile` | Update profile |
| GET | `/api/history` | Route history |
| GET | `/api/saved` | Saved places |
| GET | `/api/health` | Backend health |

## API Endpoints (ML)

| Method | Endpoint | Description |
|---|---|---|
| POST | `http://localhost:5001/predict` | Predict traffic from `{ time, day }` |
| GET | `http://localhost:5001/health` | ML service health |

## Notes

- Traffic routing falls back safely if ML service is down.
- Email verification uses SMTP when configured, otherwise the backend logs and returns a development preview link.
- OpenAI Responses API usage follows the current text-generation and responses docs: https://developers.openai.com/api/docs/guides/text and https://developers.openai.com/api/reference/resources/responses/methods/create
- Gemini text generation uses the current `models.generateContent` REST flow: https://ai.google.dev/gemini-api/docs/text-generation
- Rotate API keys immediately if they were exposed publicly.

## License

MIT
