# AI Career OS — Complete Deployment Guide

This guide walks you through deploying AI Career OS to production using **free tiers only**. Total time: ~20 minutes.

## What You Need to Create

| Service | Purpose | Free Tier | Required? |
|---------|---------|-----------|-----------|
| **Supabase** | Database + File Storage | 500 MB DB, 1 GB storage | Yes |
| **Vercel** | Hosting | Unlimited | Yes |
| **Resend** | Email verification | 3,000 emails/month | Optional |
| **Cloudflare Turnstile** | CAPTCHA on signup | Unlimited | Optional |

You do NOT need to create any API endpoints manually — they are all built into the codebase and deploy automatically with Vercel.

---

## PART 1: Create Supabase Project (Database + Storage)

Supabase provides both the PostgreSQL database AND the file storage for resume uploads.

### 1.1 Create Account

1. Go to [supabase.com](https://supabase.com)
2. Click **Start your project** → sign in with GitHub
3. Click **New Project**
4. Fill in:
   - **Project name:** `ai-career-os`
   - **Database password:** choose a strong password (save it — you'll need it)
   - **Region:** choose the closest to your users
5. Click **Create new project**
6. Wait 1-2 minutes for provisioning

### 1.2 Get Database Connection String

1. In your Supabase dashboard, click **Project Settings** (gear icon, bottom-left)
2. Click **Database** in the left menu
3. Scroll to **Connection string** section
4. Select the **URI** tab
5. Copy the string — it looks like:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
6. **Replace `[YOUR-PASSWORD]`** in the string with the database password you set in step 1.1

**Save this string** — this is your `DATABASE_URL`.

### 1.3 Get Supabase API Keys

1. Still in **Project Settings**, click **API** in the left menu
2. You'll see two sections:

**Project URL:**
```
https://abcdefghijk.supabase.co
```
Save this — this is your `SUPABASE_URL`.

**Project API keys:**
- Find the `service_role` key (the one labeled "secret")
- Click the eye icon to reveal it
- Copy it

Save this — this is your `SUPABASE_SERVICE_ROLE_KEY`.

### 1.4 Create Storage Bucket

1. In the Supabase dashboard, click **Storage** in the left sidebar
2. Click **New bucket**
3. Set:
   - **Name:** `resumes` (exactly this — the code expects this name)
   - **Public bucket:** toggle ON
4. Click **Create bucket**

**Supabase setup is done.** You now have:
- `DATABASE_URL` — the PostgreSQL connection string
- `SUPABASE_URL` — the project URL
- `SUPABASE_SERVICE_ROLE_KEY` — the service role secret key

---

## PART 2: Generate a Secret Key

You need a random secret for session encryption. Run this in your terminal:

```bash
openssl rand -base64 32
```

This outputs something like:
```
K7x2mP9qR4sT8vW1yZ3aB6cD0eF5gH4jL7nQ2rU9wX=
```

**Save this** — this is your `NEXTAUTH_SECRET`.

If you don't have `openssl`, you can use this Node.js one-liner:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## PART 3: Deploy to Vercel

### 3.1 Connect Repository

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub
2. Click **Add New...** → **Project**
3. Find `RanjitPatnaikSekharamantri/Resume` in the list
4. Click **Import**

### 3.2 Configure Project

On the configuration screen:

- **Framework Preset:** Next.js (auto-detected)
- **Root Directory:** `.` (leave as default)
- **Build Command:** `prisma generate && next build` (auto-detected from package.json)

### 3.3 Add Environment Variables

This is the critical step. Click **Environment Variables** and add each one:

| Key | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | `postgresql://postgres.[ref]:[pass]@...` | From Part 1.2 |
| `NEXTAUTH_SECRET` | `K7x2mP9qR4sT8v...` | From Part 2 |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | See note below |
| `SUPABASE_URL` | `https://abcdef.supabase.co` | From Part 1.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJI...` | From Part 1.3 |

**Note about NEXTAUTH_URL:** For the first deploy, set it to `https://example.com` temporarily. After Vercel gives you your real URL, come back and update it (Part 5).

### 3.4 Deploy

Click **Deploy**. Vercel will:
1. Clone your repository
2. Install dependencies (`npm install`)
3. Generate Prisma Client (`prisma generate` via postinstall)
4. Build the Next.js app (`next build`)
5. Deploy to a `.vercel.app` URL

This takes about 1-2 minutes. You'll see a build log.

---

## PART 4: Initialize the Database

The database exists but has no tables yet. You need to push the schema.

### Option A: From Your Local Machine

```bash
# Clone the repo if you haven't
git clone https://github.com/RanjitPatnaikSekharamantri/Resume.git
cd Resume
git checkout cursor/ai-career-os-f7c0
npm install

# Set the production database URL
export DATABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Push schema to create all tables
npx prisma db push
```

You'll see output like:
```
🚀 Your database is now in sync with your Prisma schema.
```

### Option B: Using Vercel CLI

```bash
npx vercel env pull .env.local
npx prisma db push
```

### What Gets Created

This creates 11 tables in your database:
- `User`, `Account`, `Session`, `VerificationToken`
- `Profile`, `BaseResume`, `Application`
- `ResumeVersion`, `CoverLetterVersion`, `Activity`
- `AIProvider`

Plus indexes for performance on `userId`, `applicationId`, `status`, etc.

---

## PART 5: Update NEXTAUTH_URL

1. Go to your Vercel dashboard
2. Click your project
3. Your URL is shown at the top (e.g. `https://resume-abc123.vercel.app`)
4. Go to **Settings** → **Environment Variables**
5. Find `NEXTAUTH_URL` and click **Edit**
6. Change the value to your actual URL: `https://resume-abc123.vercel.app`
7. Click **Save**
8. Go to **Deployments** tab → click the three dots on the latest deployment → **Redeploy**

---

## PART 6: Test Your Deployment

1. Open your Vercel URL in a browser
2. You should see the **Sign in** page
3. Click **Sign up** → create an account
4. You're in! The app is now live.

### Quick Smoke Test

- [ ] Sign up works
- [ ] Dashboard loads with Command Center
- [ ] Can create an application
- [ ] Can upload a resume (PDF or DOCX)
- [ ] Kanban drag-and-drop works
- [ ] AI Studio generates documents
- [ ] Analytics page loads
- [ ] Profile save works
- [ ] Settings page loads

---

## PART 7: Optional Features

These are completely optional. The app works fully without them.

### 7A. Email Verification (Resend)

If you want users to verify their email before signing in:

1. Go to [resend.com](https://resend.com) → create account
2. Go to **API Keys** → **Create API Key**
3. Copy the key (starts with `re_`)
4. In Vercel → Settings → Environment Variables, add:
   - `RESEND_API_KEY` = your key
   - `EMAIL_FROM` = `AI Career OS <noreply@yourdomain.com>`
5. Redeploy

**Dev alternative:** Add `ENABLE_EMAIL_VERIFICATION=true` to see verification links in the Vercel build logs (Functions tab) instead of sending real emails.

### 7B. CAPTCHA (Cloudflare Turnstile)

If you want bot protection on signup:

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → create account if needed
2. Go to **Turnstile** in the sidebar
3. Click **Add site**
4. Set:
   - **Site name:** AI Career OS
   - **Domain:** `your-app.vercel.app`
   - **Widget type:** Managed
5. Copy the **Site Key** and **Secret Key**
6. In Vercel → Settings → Environment Variables, add:
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the site key
   - `TURNSTILE_SECRET_KEY` = the secret key
7. Redeploy

### 7C. User Limit

To restrict signups to a specific number:

1. In Vercel → Settings → Environment Variables, add:
   - `MAX_USERS` = `50` (or any number)
2. Redeploy

Omit this variable for unlimited signups.

### 7D. Custom Domain

1. In Vercel → Settings → **Domains**
2. Add your domain (e.g. `careers.yourdomain.com`)
3. Follow Vercel's DNS instructions
4. Update `NEXTAUTH_URL` to your custom domain
5. Redeploy

---

## Environment Variables Summary

Here's every variable the app uses, in one table:

| Variable | Where to Get It | Required |
|----------|----------------|----------|
| `DATABASE_URL` | Supabase → Settings → Database → URI | Yes |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Yes |
| `NEXTAUTH_URL` | Your Vercel deployment URL | Yes |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key | Yes |
| `RESEND_API_KEY` | resend.com → API Keys | No |
| `EMAIL_FROM` | Your sender email address | No |
| `ENABLE_EMAIL_VERIFICATION` | Set to `true` for dev mode | No |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile → Site Key | No |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile → Secret Key | No |
| `MAX_USERS` | Any number | No |

---

## Troubleshooting

### Build fails with "PrismaClientInitializationError"
Your `DATABASE_URL` is wrong or the database is unreachable. Double-check the connection string and make sure you replaced the password placeholder.

### "Invalid email or password" on login
If you enabled email verification, you need to verify your email first. Check your inbox (or Vercel function logs for the console-logged link).

### Resume upload fails
Make sure you created the `resumes` storage bucket in Supabase (Part 1.4) and that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct.

### "NEXTAUTH_URL" errors
Make sure `NEXTAUTH_URL` matches your actual deployment URL exactly (including `https://`). After updating, you must redeploy.

### Database tables don't exist
You need to run `npx prisma db push` with your production `DATABASE_URL` (Part 4).

---

## Updating the App

When you push changes to the `cursor/ai-career-os-f7c0` branch:
1. Vercel automatically detects the push
2. Builds and deploys the new version
3. Zero-downtime deployment (old version serves until new one is ready)

No manual steps needed after the initial setup.
