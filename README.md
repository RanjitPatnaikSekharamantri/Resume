# AI Career OS

A production-grade web application for managing job applications, resumes, and AI-powered document enhancement. Built with Next.js, Tailwind CSS, and PostgreSQL.

## Features

- **Dashboard** — Overview of your job search with key metrics
- **Applications** — Full application management with Kanban board (drag & drop)
- **AI Studio** — Generate tailored resumes and cover letters from job descriptions
- **Resume Library** — Upload and manage base resumes (PDF/DOCX)
- **Analytics** — Funnel visualization, status distribution, weekly activity, conversion rates
- **Profile** — Personal info, links, preferences, EEO fields
- **Settings** — AI provider configuration with encrypted API keys

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui components, Radix UI primitives
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth.js (credentials provider)
- **Storage:** Supabase Storage
- **Drag & Drop:** dnd-kit
- **Charts:** Recharts

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- (Optional) Supabase project for file storage

### Setup

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy the environment file and update values:

```bash
cp .env.example .env
```

3. Set up the database:

```bash
npx prisma generate
npx prisma db push
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) and create an account.

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login & signup pages
│   ├── (dashboard)/     # Protected dashboard pages
│   └── api/             # API routes
├── components/
│   ├── ui/              # Reusable UI components (shadcn/ui style)
│   ├── layout/          # Sidebar, page header, dashboard layout
│   ├── kanban/          # Kanban board components
│   ├── applications/    # Application form & components
│   └── ...
├── lib/                 # Utilities, Prisma client, auth config
└── types/               # TypeScript type definitions
```

## Multi-User Limit

The application supports a maximum of 4 users (configurable in the signup API route). Each user has their own isolated data.

## Security

- Passwords hashed with bcrypt
- API keys encrypted with AES-256-GCM
- Session-based auth with JWT strategy
- Protected routes via middleware
- API keys masked in the UI
