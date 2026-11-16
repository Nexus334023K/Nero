# NERO — Your AI. Your World.

NERO is a Windows desktop AI companion built with Electron + React (frontend) and FastAPI (backend). It features a sleek dark UI, real-time WebSocket communication, persistent memory, and extensible AI provider support.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 33 |
| UI Framework | React 18 + TypeScript |
| Styling | Tailwind CSS 3 + Framer Motion |
| State Management | Zustand |
| Build Tool | Vite 5 |
| Backend | FastAPI (Python 3.11+) |
| Database | SQLite via SQLAlchemy (async) |
| Transport | WebSocket + REST |

## Project Structure

```
nero/
├── apps/
│   ├── desktop/          # Electron + React app
│   │   ├── electron/     # Main & preload scripts
│   │   ├── src/          # React source
│   │   └── ...
│   └── backend/          # FastAPI Python backend
│       ├── app/
│       └── ...
├── package.json          # Root workspace config
├── .env.example          # Environment template
└── README.md
```

## Prerequisites

- Node.js 20+
- Python 3.11+
- npm 10+

## Setup

### 1. Clone & install frontend deps

```bash
git clone <repo-url>
cd nero
npm install
```

### 2. Set up Python backend

```bash
cd apps/backend
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 4. Run in development

**Terminal 1 — Backend:**
```bash
cd apps/backend
.venv\Scripts\activate
python run.py
```

**Terminal 2 — Desktop app:**
```bash
npm run electron:dev
```

## Build for production

```bash
# Build desktop app
npm run build

# Package installer
cd apps/desktop
npm run electron:build
```

The installer will be output to `apps/desktop/release/`.

## License

MIT
