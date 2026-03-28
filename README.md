# ⚡ Aegis Nova — Elite Serverless Engineering Suite

> Four elite browser-native tools. Zero data leaves your machine. Ever.

## 🛠 Tools

| Tool | Purpose | Tech |
|------|---------|------|
| **The Vault** | Security auditor — scans code for secrets, weak crypto, injection vectors | 20+ regex AST rules, Worker thread |
| **Data Titan** | 1GB+ CSV/JSON ETL with client-side SQL filtering | Streams API, Web Workers |
| **Opti-Neural** | Perceptual image compression (WebP, up to 90% reduction) | Canvas API, WebP encoding |
| **Logic Flow** | Auto-generate call graphs and Mermaid flowcharts from code | Regex AST parser, inline SVG |

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/aegis-nova.git
cd aegis-nova

# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

## 📦 Project Structure

```
aegis-nova/
├── src/
│   ├── App.tsx                  # Router, Spotlight (⌘K), Navbar, all pages
│   ├── ToolGrid.tsx             # 4 tool cards with full client-side logic
│   ├── ContactPage.tsx          # Contact form → mailto:Gxplcp@gmail.com
│   ├── ScannerEngine.worker.ts  # Web Worker: security scan + CSV/SQL engines
│   ├── main.tsx                 # React entry point
│   └── index.css                # Tailwind + global styles
├── .github/workflows/deploy.yml # GitHub Actions → GitHub Pages CI/CD
├── index.html                   # HTML shell
├── vite.config.ts               # Vite config with chunk splitting
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 🌐 GitHub Pages Deployment

### Automatic (recommended)

1. Push to `main` — GitHub Actions builds and deploys automatically.
2. Go to **Settings → Pages → Source → GitHub Actions**.

### Manual

```bash
npm run build
# Upload `dist/` folder to GitHub Pages via Settings → Pages → Deploy from branch
```

### Configure Base URL

Edit `vite.config.ts`:
```ts
const base = "/aegis-nova/";          // Project page: github.io/aegis-nova
// const base = "/";                   // User page:    username.github.io
```

## 🔒 Privacy Architecture

- **Zero backend** — 100% static files, no server processes requests
- **Zero tracking** — no analytics, pixels, or session recorders
- **Zero storage** — no cookies or localStorage written by default
- **Worker isolation** — all code scanning runs in a sandboxed Worker thread
- **Client-side only** — file parsing, compression, and SQL filtering happen in your browser

## 📧 Contact

Email: **Gxplcp@gmail.com**  
Response time: within 72 hours

## 📄 License

MIT — use freely, contribute openly.
