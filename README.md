# VentureBridge

> A startup-ecosystem platform where founders build evidence-labelled pitches, mentors give section-level feedback, investors shortlist ventures, and admins keep the community healthy, all under strict row-level access control.

**Live demo:** https://venture-bridge-ruby.vercel.app

---

## 📖 Overview

**VentureBridge** bridges the gap between vision and execution. Early-stage founders often lack structure for their idea and access to advisors and investors, while mentors and investors struggle to find high-signal ventures.

VentureBridge provides one connected ecosystem with four roles:

* **Founders** develop an idea in **IdeaLab 2.0**, a guided workspace with an honest scorecard, share a snapshot of the pitch, and request AI feedback.
* **Mentors** accept connection requests, read the pitches shared with them, and leave feedback on individual sections.
* **Investors** receive pitches in deal flow, keep a shortlist (Portfolio) and write private notes.
* **Admins** audit platform metrics, verify mentors and export data.

---

## ✨ Key Features

### 👨‍💻 For Founders

* **IdeaLab 2.0 workspace:** structured sections (Overview, Market, Business, Blueprint, Execution, Risks, Scorecard, Pitch) with autosave and optimistic concurrency (`row_version`) so two tabs never overwrite each other silently.
* **Evidence labels:** every claim is tagged founder-stated, calculated, experiment-backed, assumption or missing.
* **Deterministic scorecard:** a rule-based readiness score that never marks an idea as "validated".
* **Pitch sharing:** share a snapshot of the pitch with connected mentors and investors only; later edits do not leak.
* **Print-friendly pitch:** a "Save as PDF" button produces a clean, shareable document.
* **AI Pitch Review:** an optional second opinion (strengths, gaps, investor questions, next experiments), saved per venture and limited per day.
* **Private funding ask:** the funding goal lives inside the workspace blueprint and is not readable by other users.
* **Network discovery and connections:** find verified mentors and send, track and manage requests (`pending` / `accepted` / `declined`).
* **Mentor feedback inbox:** new mentor notes appear on the founder dashboard and under the pitch.

### 🧑‍🏫 For Mentors

* **Mentee pitches:** see the pitches shared by accepted founders on the dashboard.
* **Section-level feedback:** write, and delete, notes on a specific pitch section (up to 2,000 characters). Only accepted connections can review.
* **Verification flow:** unverified mentors stay restricted until an admin approves them.

### 💼 For Investors

* **Deal flow:** receive pitches sent by founders.
* **Portfolio shortlist:** tabs for Shortlist, Under review and Passed, with search.
* **Private notes:** per-deal notes visible only to the investor who wrote them.

### 🛡️ For Platform Administrators

* **Dedicated admin gateway:** login validating admin privileges.
* **Operations dashboard:** live counts, a cumulative member-growth chart for the last six months, recent activity and CSV export.
* **Mentor verification queue:** grant or revoke verified badges.

---

## 🛠️ Tech Stack

| Layer                       | Technology                                                       |
| --------------------------- | ---------------------------------------------------------------- |
| **Frontend Framework**      | React with TypeScript                                            |
| **Build Tooling**           | Vite                                                             |
| **Routing**                 | React Router                                                     |
| **Styling & UI Components** | Tailwind CSS, shadcn/ui (Radix UI), Lucide React, framer-motion  |
| **Backend & Database**      | Supabase (PostgreSQL, Realtime, Row Level Security)              |
| **Authentication**          | Supabase Auth (email and password)                               |
| **Serverless**              | Supabase Edge Function (`pitch-review`, Deno)                    |
| **AI (optional)**           | Gemini, Groq, OpenRouter or Anthropic, chosen by a secret        |
| **Notifications**           | Sonner                                                           |
| **Testing**                 | node:test with tsx                                               |
| **Hosting**                 | Vercel (frontend), Supabase (backend)                            |

---

## 🗄️ Database Architecture & Security

VentureBridge uses a PostgreSQL schema on Supabase with 20 tables. Relationships use foreign keys with cascades, and every table is protected by Row Level Security (RLS).

### Core relationships

```text
          auth.users (Supabase Auth)
                │  ON DELETE CASCADE
                ▼
              users  (id, full_name, role)
                │
     ┌──────────┼───────────┐
     ▼          ▼           ▼
  founders    mentors    investors
     │          │           │
     ├── ideas ─┼───────────┤
     │    │     │           │
     │    ├── idea_workspace, idea_risks, idea_milestones,
     │    │   idea_competitors, idea_market_assumptions,
     │    │   experiments, hypotheses, idea_private_notes
     │    ├── idea_pitch_shares  (shared snapshot)
     │    ├── idea_ai_reviews    (saved AI reviews)
     │    └── pitch_feedback     (mentor notes)
     │
     ├── connections  (founder ↔ mentor)
     └── deal_flow ── investor_notes  (founder → investor)

  messages  (direct messages)
```

### Tables

| Group              | Tables                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Identity           | `users`, `founders`, `mentors`, `investors`                                                                             |
| Network            | `connections`, `deal_flow`, `messages`                                                                                  |
| Ventures           | `ideas`, `idea_workspace`, `idea_risks`, `idea_milestones`, `idea_competitors`, `idea_market_assumptions`, `experiments`, `hypotheses`, `idea_private_notes` |
| Sharing & feedback | `idea_pitch_shares`, `pitch_feedback`, `investor_notes`                                                                 |
| AI                 | `idea_ai_reviews`                                                                                                       |

The full, current definition is in `db/schema_current.sql`.

---

## 🔐 Row Level Security (RLS)

* **Owner-only data:** workspace content, private notes, saved AI reviews and investor notes can only be read and written by their owner.
* **Controlled sharing:** a shared pitch is readable only by connected parties, through the helper `idealab_can_view_share(idea, owner)` (investors with a deal-flow row, mentors with a pending or accepted connection).
* **Mentor feedback:** `idealab_mentor_can_review(idea)` requires an **accepted** connection; the author or the idea owner can read a note, only the author can delete it, and notes cannot be edited.
* **Funding privacy:** `ideas.funding_goal` and `use_of_funds` are emptied and write-blocked; the ask lives in the workspace blueprint.
* **Admin policies:** administrators can verify mentors and read platform data for the dashboard.
* **Separate policies** for `SELECT`, `INSERT`, `UPDATE` and `DELETE`, and `auth.uid()` based checks throughout.

---

## 🤖 AI Pitch Review

The review runs server-side so the API key never reaches the browser.

1. The founder clicks **Review my pitch** and confirms that the pitch text will be sent to an AI service.
2. The app calls the `pitch-review` Edge Function with the venture id and the text sections.
3. The function checks the user's session, confirms they own the idea, enforces a daily limit, and calls the configured provider with one retry and an optional fallback model.
4. The structured result is validated, saved in `idea_ai_reviews` with the model name, and shown with the footer "treat it as a second opinion".

The prompt forbids inventing facts, customers, numbers, currencies or units.

Secrets (set in Supabase, never in the repo):

| Secret               | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `LLM_PROVIDER`       | `gemini` (default), `groq`, `openrouter` or `anthropic`  |
| `LLM_API_KEY`        | Provider key                                             |
| `LLM_MODEL`          | Model name, e.g. `openrouter/free`                       |
| `LLM_FALLBACK_MODEL` | Optional second model tried if the first is busy         |
| `DAILY_LIMIT`        | Reviews per user per day (default 10)                    |

---

## 📁 Project Structure

```text
venturebridge/
├── public/
├── db/                             # SQL migrations and schema_current.sql
├── supabase/
│   └── functions/pitch-review/     # AI review Edge Function and tests
├── src/
│   ├── app/                        # AuthProvider, ThemeProvider
│   ├── components/ui/              # shadcn/ui primitives
│   ├── features/
│   │   ├── admin/                  # AdminDashboard, AdminLogin
│   │   ├── auth/                   # Login, Signup, Onboarding
│   │   ├── dashboard/              # Role dashboards, layout, data loaders
│   │   ├── ideas/
│   │   │   ├── IdeaLab.tsx, MyVentures.tsx, PitchView.tsx, ValidationLab.tsx
│   │   │   └── workspace/          # IdeaLab 2.0: sections, scorecard, sharing,
│   │   │                           # mentor feedback, AI review, repos and tests
│   │   ├── investors/              # DealFlow, Portfolio
│   │   ├── matching/               # NetworkDiscovery
│   │   └── profiles/               # ProfileSettings
│   ├── lib/                        # Supabase client, utilities
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── package.json
└── vite.config.ts
```

---

# 🚀 Getting Started

## Prerequisites

* **Node.js** v18 or higher
* **npm**, **pnpm** or **yarn**
* A free **Supabase** project

## 1. Clone and install

```bash
git clone https://github.com/your-username/venturebridge.git
cd venturebridge
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Security:** never commit `.env`, and never put an AI provider key in the frontend or the repo. Provider keys belong only in Supabase secrets. If a key was ever committed, rotate it.

## 3. Database setup

1. Open the **Supabase SQL Editor** and run the base setup in `db/migration.sql`.
2. Run the upgrades in order: `migration2.sql` to `migration7.sql` (IdeaLab 2.0 workspace, pitch sharing, funding privacy, investor notes, mentor feedback, AI reviews). The upgrades are idempotent and safe to re-run.
3. For a fresh project you can instead run the combined `venturebridge_all_upgrades.sql` after the base setup.

`db/schema_current.sql` always shows the latest full schema.

## 4. (Optional) Enable AI Pitch Review

1. In Supabase, create an Edge Function named exactly `pitch-review` and paste `supabase/functions/pitch-review/index.ts`.
2. Turn **Verify JWT** off (the function validates the user itself).
3. Add the secrets listed above, for example `LLM_PROVIDER=openrouter`, `LLM_MODEL=openrouter/free`.

The app works without this step; the AI panel then shows a "not configured" message.

## 5. Run locally

```bash
npm run dev
```

The app is available at `http://localhost:5173`.

## 6. Run the tests

```bash
npx tsx --test supabase/functions/pitch-review/index.test.ts src/features/ideas/workspace/*.test.ts
```

---

# 👑 Creating an Administrator Account

1. Sign up through the normal registration.
2. Open **Supabase Studio → Table Editor → `users`**.
3. Change your row's `role` to `admin`.
4. Sign out, then visit `/admin-login`.

---

# 🗺️ Roadmap

* [x] RLS-protected PostgreSQL schema with cascading deletes
* [x] Multi-role authentication and admin onboarding
* [x] Network discovery, match scoring and two-way connections
* [x] IdeaLab 2.0 workspace with evidence labels and deterministic scorecard
* [x] Pitch sharing snapshots and print-friendly PDF
* [x] Mentor section-level feedback
* [x] Investor deal flow, shortlist and private notes
* [x] Admin dashboard with growth chart and CSV export
* [x] AI Pitch Review via Edge Function with daily limit and provider switch
* [ ] Curated "playbook" guidance the AI review can cite (RAG-lite)
* [ ] Pitch deck attachments using Supabase Storage
* [ ] Calendar scheduling for advisory sessions
* [ ] Profile-level privacy for `founders.funding_goal`

---

# 📄 License

Distributed under the **MIT License**. See the `LICENSE` file for more information.