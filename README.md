# AI Career OS

A production-grade SaaS platform for managing job applications, enhancing resumes with AI, and generating tailored cover letters. Built for job seekers who want a structured, data-driven approach to their career search.

## Overview

AI Career OS combines application tracking, document management, and AI-powered content generation into a single platform. It provides a Kanban-style pipeline for tracking applications across stages, an AI engine that enhances existing resumes based on job descriptions, and analytics to measure your job search performance.

**Who it's for:** Job seekers, career changers, and professionals managing multiple applications simultaneously.

## Features

### Application Tracking
- Kanban board with drag-and-drop (8 status columns)
- List view with sorting and filtering
- Application detail pages with tabs: Overview, Notes, Documents
- Activity timeline tracking all changes

### Resume Enhancement Engine
- Upload DOCX resumes and enhance them against job descriptions
- Section-aware parsing: summary, skills, experience, projects, education, certifications
- Rule engine: control rewrite intensity, preserve length, prevent new skill additions
- Side-by-side diff viewer with word-level change highlighting
- Download enhanced resumes as DOCX or PDF

### Cover Letter Generation
- Generate cover letters from job description + resume + profile data
- Inline editing with version management
- Save as new version or overwrite existing
- Version comparison with side-by-side diff
- Download as PDF or DOCX

### AI Studio
- Standalone workspace for document generation
- Generate mode: create resume + cover letter from scratch
- Enhance mode: improve an existing DOCX resume
- Before/after match score comparison
- Save results directly as a new application

### Resume Library
- Upload and manage base resumes (PDF/DOCX)
- Organize by role category (15 preset categories)
- Drag-and-drop upload with file validation
- Secure downloads via signed URLs
- See which applications reference each resume

### Match Scoring
- 4-dimension weighted scoring: Skills (40%), Experience (30%), Keywords (20%), Domain (10%)
- Auto-calculated when creating applications with a job description
- Color-coded badges on Kanban cards and detail pages
- Before/after comparison in AI Studio

### Analytics Dashboard
- Application funnel with stage-to-stage conversion rates
- Status distribution donut chart
- Weekly activity area chart (timezone-aware)
- Conversion metrics with progress bars
- Daily application streak and weekly goals
- Milestone tracking (6 achievements)
- Top companies ranking

### Reminder System
- Set follow-up dates on any application
- Dashboard alerts for upcoming follow-ups
- Activity log entries for reminder changes

### Profile System
- Personal information, links, work authorization
- Equal opportunity fields (optional)
- Per-section edit/save with view mode
- Profile completeness indicator

### Authentication & Security
- Email + password authentication
- Email verification with secure token (24-hour expiry)
- Cloudflare Turnstile CAPTCHA on signup
- JWT sessions with 7-day expiry
- Middleware-protected routes (pages and API)
- Configurable user limit via environment variable

### AI Provider Management
- Add multiple AI providers (OpenAI, Anthropic, etc.)
- Encrypted API key storage
- Test connection validation
- Active/inactive toggle per provider

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui (Radix UI primitives) |
| Backend | Next.js API Routes |
| Database | PostgreSQL with Prisma 5 ORM |
| Auth | NextAuth.js 4 (Credentials provider) |
| Storage | Supabase Storage |
| Drag & Drop | dnd-kit |
| Charts | Recharts |
| DOCX Processing | mammoth (parse), docx (build) |
| PDF Generation | PDFKit |
| Date Handling | date-fns, date-fns-tz |
| Icons | Lucide React |

## Architecture

```
User → Next.js Frontend (App Router)
       ├── Pages (12 routes)
       ├── API Routes (23 endpoints)
       │   ├── Prisma ORM → PostgreSQL
       │   └── Supabase SDK → Supabase Storage
       └── Middleware (auth + route protection)
```

All timestamps stored in UTC. User timezone detected via `Intl.DateTimeFormat` and applied at display time and for analytics grouping.

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Supabase project (for file storage)

### Installation

```bash
git clone <repository-url>
cd ai-career-os
npm install
```

### Database Setup

```bash
npx prisma generate
npx prisma db push
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create a `.env` file in the project root. See `.env.example` for reference.

### Required

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Session encryption key (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` for development) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |

### Optional

| Variable | Purpose |
|----------|---------|
| `MAX_USERS` | Maximum allowed signups (omit for unlimited) |
| `RESEND_API_KEY` | Resend API key for email verification |
| `EMAIL_FROM` | Sender address for verification emails |
| `ENABLE_EMAIL_VERIFICATION` | Set to `true` to enable verification with console-logged links |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (client-side) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key (server-side) |
| `OPENAI_API_KEY` | OpenAI API key (for future external AI integration) |

## API Keys Setup

### Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Create a storage bucket named `resumes`
3. Copy the project URL and service role key to your `.env`

### Email Verification (Optional)

1. Create an account at [resend.com](https://resend.com)
2. Generate an API key
3. Add `RESEND_API_KEY` and `EMAIL_FROM` to your `.env`

Alternatively, set `ENABLE_EMAIL_VERIFICATION=true` to use console-logged verification links during development.

### CAPTCHA (Optional)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile
2. Create a site widget
3. Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to your `.env`

### AI Providers (Optional)

AI providers are managed in-app via Settings. API keys are encrypted before storage. You can add providers for OpenAI, Anthropic, or other services through the UI.

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, signup, email verification pages
│   ├── (dashboard)/         # Protected dashboard pages (7 sections)
│   │   ├── dashboard/       # Command center
│   │   ├── applications/    # Kanban + list + detail pages
│   │   ├── ai-studio/       # Generate + enhance workspace
│   │   ├── resume-library/  # Upload and manage resumes
│   │   ├── analytics/       # Charts and metrics
│   │   ├── profile/         # Personal info and preferences
│   │   └── settings/        # Account, timezone, AI providers
│   └── api/                 # 23 API route files
│       ├── auth/            # Signup, login, email verification
│       ├── applications/    # CRUD + reorder
│       ├── resumes/         # Upload, download, CRUD
│       ├── resume-versions/ # Version CRUD
│       ├── cover-letters/   # CRUD + download
│       ├── ai/              # Generate, enhance, match-score
│       ├── ai-providers/    # CRUD + test connection
│       ├── analytics/       # Aggregated metrics
│       └── profile/         # Profile CRUD
├── components/
│   ├── ui/                  # Shared UI primitives (shadcn/ui style)
│   ├── layout/              # Sidebar, page header, dashboard layout
│   ├── kanban/              # Board, column, card components
│   ├── applications/        # Form, match score, cover letter, resume version
│   ├── ai-studio/           # Enhance resume component
│   └── profile/             # Profile section component
├── lib/
│   ├── prisma.ts            # Database client
│   ├── auth.ts              # NextAuth configuration
│   ├── supabase.ts          # Storage client + file validation
│   ├── match-scoring.ts     # 4-dimension scoring engine
│   ├── docx-engine.ts       # DOCX parse, enhance, rebuild
│   ├── pdf-engine.ts        # PDF generation
│   ├── text-diff.ts         # Word-level diff algorithm
│   ├── analytics-tz.ts      # Timezone-aware date utilities
│   ├── timezone.ts          # Client timezone detection
│   ├── encryption.ts        # API key encryption
│   ├── email.ts             # Verification email delivery
│   └── api-auth.ts          # Request authentication helper
└── types/
    └── next-auth.d.ts       # Session type extensions
```

## User Flow

1. **Sign up** → complete CAPTCHA → receive verification email → verify
2. **Set up profile** → personal info, links, work authorization
3. **Upload resumes** → add base resumes to the library with role categories
4. **Create application** → fill in job details, link a base resume
5. **Enhance resume** → paste job description, configure rules, generate tailored version
6. **Generate cover letter** → from application detail or AI Studio
7. **Track progress** → drag applications across Kanban columns
8. **Set reminders** → add follow-up dates for timely outreach
9. **Review analytics** → monitor funnel, streaks, conversion rates

## Deployment

### Vercel (Recommended)

1. Push your repository to GitHub
2. Import the project in [vercel.com](https://vercel.com)
3. Add all environment variables in Project Settings → Environment Variables
4. Deploy

### Database

Use any PostgreSQL provider (Supabase, Neon, Railway, etc.). Run `npx prisma db push` to create tables.

### Build

```bash
npm run build
npm start
```

The production build compiles to 33 routes with zero errors.

## Design System

- **Colors:** Primary blue (#2563EB), neutral greys, white backgrounds
- **Components:** Cards (rounded-xl), inputs (rounded-lg), consistent spacing (p-4, p-6)
- **Typography:** Inter font, clear hierarchy with bold headings and muted secondary text
- **Interactions:** Smooth drag-and-drop, subtle hover states, animated progress bars
- **Charts:** Muted blue palette, gradient area fills, clean axis styling

## Known Limitations

- **DOCX formatting:** Enhancement works at the text level (via mammoth extraction). Original Word styles, custom fonts, and multi-column layouts are not preserved in the rebuilt document.
- **AI generation:** Uses a deterministic template engine. When external AI provider keys are configured, the system is provider-aware but currently uses built-in generation logic.
- **PDF fidelity:** Generated PDFs use Helvetica with clean formatting. They do not replicate the exact layout of the original DOCX.

## License

This project is proprietary. All rights reserved.
