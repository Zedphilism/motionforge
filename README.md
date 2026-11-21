# MOTIONFORGE

**From Idea to Motion** — a modular, browser-based AI video production and multitrack editing studio for deterministic motion graphics and 3D visualization.

MOTIONFORGE combines React, Three.js, GSAP, and the Gemini API to support research, scripting, storyboarding, voice synthesis, media analysis, and visual timeline editing in a single workspace.

## Features

- AI-assisted research, script generation, script transformation, and storyboard creation
- Text-to-speech synthesis and audio transcription
- Multimodal image and media analysis
- Optional Gemini image-generation integration
- Deterministic motion graphics and Three.js-based 3D visualization
- Browser-based multitrack editing workspace
- Local project persistence and reusable media assets
- Express API with Vite development middleware

## Tech Stack

- [React 19](https://react.dev/) and TypeScript
- [Vite 8](https://vite.dev/) with Tailwind CSS 4
- [Three.js](https://threejs.org/) for 3D rendering
- [GSAP](https://gsap.com/) and [Motion](https://motion.dev/) for animation
- [Express](https://expressjs.com/) for API routes and serving
- [Google Gemini API](https://ai.google.dev/) through `@google/genai`
- [Bun](https://bun.sh/) for dependency and lockfile management

## Project Structure

```text
motionforge/
├── src/
│   ├── components/       # UI and editor components
│   ├── data/             # Local data and presets
│   ├── engine/           # Motion and rendering logic
│   ├── server/           # Gemini clients and AI service implementations
│   ├── services/         # Browser-facing application services
│   ├── storage/          # Project and asset persistence
│   ├── types/            # Shared TypeScript types
│   ├── App.tsx           # Main application shell
│   └── main.tsx          # React entry point
├── server.ts             # Express server and AI API routes
├── vite.config.ts        # Vite plugins and asset handling
├── .env.example          # Environment variable template
└── package.json          # Scripts and dependencies
```

## Requirements

- Node.js 20 or newer
- npm, pnpm, yarn, or Bun
- A Gemini API key for AI-powered features

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Zedphilism/motionforge.git
cd motionforge
```

### 2. Install dependencies

Using npm:

```bash
npm install
```

Using Bun:

```bash
bun install
```

### 3. Configure environment variables

Copy the example file:

```bash
cp .env.example .env
```

Set the following values in `.env`:

```dotenv
GEMINI_API_KEY="your_gemini_api_key"
APP_URL="http://localhost:3000"
```

- `GEMINI_API_KEY` is required for Gemini API requests.
- `APP_URL` is used for application links and self-referential endpoints.
- Never commit a real API key or `.env` file.

When deployed in Google AI Studio, secrets and `APP_URL` may be injected automatically.

### 4. Start the development server

```bash
npm run dev
```

The application is available at `http://localhost:3000` by default.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Express server with Vite middleware |
| `npm start` | Start the application server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run TypeScript checks without emitting files |
| `npm run clean` | Remove generated `dist/` and `server.js` files |

## Production Build

```bash
npm run build
NODE_ENV=production npm start
```

In production mode, Express serves the compiled Vite application from `dist/` and exposes the same `/api/ai/*` routes.

## AI API

The server provides endpoints for:

- Model discovery: `GET /api/ai/models`
- Research: `POST /api/ai/research`
- Script generation and transformation
- Storyboard generation
- Voice synthesis
- Audio transcription
- Media analysis
- Optional image generation

API requests should be sent with a JSON body. Gemini-dependent requests require `GEMINI_API_KEY` to be configured on the server.

## Development Notes

- HMR can be disabled with `DISABLE_HMR=true`.
- The server binds to `0.0.0.0` and uses port `3000` unless `PORT` is set.
- API request JSON bodies are limited to 25 MB.
- Generated output should not be trusted without validating paid-usage consent and content-safety requirements in deployed environments.

## Contributing

Contributions are welcome. Please:

1. Fork the repository.
2. Create a descriptive feature branch.
3. Run `npm run lint` and `npm run build` before submitting.
4. Open a pull request with the motivation and testing details.

## License

No license has been declared for this repository. Contact the repository owner before reusing or redistributing the project.
