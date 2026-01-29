# xyren.me Web Application

> **Note:** This repository is named `xyren.me-back` but it's actually a **frontend web application**, not a backend service. Consider renaming to `xyren.me-web` or `xyren.me-frontend` to avoid confusion.

A modern lead management dashboard built with React, TypeScript, and Tailwind CSS.

## Tech Stack

- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + shadcn/ui components
- **Backend:** Lovable Cloud (Supabase)
- **State Management:** TanStack Query
- **Routing:** React Router v6

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── dashboard/    # Dashboard-specific components
│   └── ui/           # shadcn/ui components
├── hooks/            # Custom React hooks
├── integrations/     # External service integrations
├── lib/              # Utility functions
├── pages/            # Route page components
└── test/             # Test configuration and utilities
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm (recommended) or bun

### Environment Setup

1. Copy the example environment file:
   ```sh
   cp .env.example .env
   ```

2. Fill in your environment variables (Lovable Cloud provides these automatically).

### Installation

```sh
npm install
```

### Development

```sh
npm run dev
```

The app will be available at `http://localhost:8080`.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

## Deployment

This project is configured for deployment on Lovable. Simply open [Lovable](https://lovable.dev) and click **Share → Publish**.

### Custom Domain

To connect a custom domain, navigate to **Project → Settings → Domains** and click **Connect Domain**.

## Security

- Never commit `.env` files with real credentials
- Use `.env.example` as a template for required environment variables
- All secrets are managed through Lovable Cloud

## License

Private - All rights reserved.
