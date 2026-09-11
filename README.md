# VentureBridge

> An intelligent matchmaking platform connecting early-stage startup founders with verified industry mentors, backed by structured venture diagnostics and robust access control.

---

## 📖 Overview

**VentureBridge** bridges the gap between vision and execution. Early-stage founders often lack access to experienced advisory networks, while seasoned industry mentors struggle to discover high-signal venture hypotheses.

VentureBridge provides a unified ecosystem where:

* **Founders** can structure their business hypotheses, including problem, solution, market size, and tech stack, run automated validation, and discover tailored mentors.
* **Mentors** can filter through vetted startup pitches, evaluate founder hypotheses, and accept advisory connection requests.
* **Admins** manage platform integrity by auditing system metrics and manually vetting and verifying mentor credentials.

---

## ✨ Key Features

### 👨‍💻 For Founders

* **IdeaLab & Venture Pitching:** Structured multi-step venture formulation covering core pain points, solution dynamics, target addressable market, and technical architecture.
* **Network Discovery:** Filter verified mentors by domain expertise, years of experience, and industry focus.
* **Match Compatibility Scoring:** Algorithmic alignment score matching founder market and technology needs with mentor proficiencies.
* **Connection Lifecycle:** Send, monitor (`Pending` / `Accepted` / `Declined`), and manage connection requests.

### 🧑‍🏫 For Mentors

* **Curated Deal Flow:** Review incoming founder pitches with granular problem and solution breakdowns without inbox clutter.
* **Advisory Workspace:** Accept or decline connection requests from founders in real time.
* **Verification Flow:** Built-in verification status safeguards platform quality. Unverified accounts remain restricted until vetted.

### 🛡️ For Platform Administrators

* **Dedicated Admin Gateway:** Hardened login interface strictly validating superuser privileges.
* **System Operations Panel:** Live analytics tracking total founders, mentors, pitches, and active network connections.
* **Mentor Verification Queue:** Review pending mentor profiles and grant or revoke verified badges.

---

## 🛠️ Tech Stack

| Layer                       | Technology                                          |
| --------------------------- | --------------------------------------------------- |
| **Frontend Framework**      | React 18 with TypeScript                            |
| **Build Tooling**           | Vite                                                |
| **Routing**                 | React Router v6                                     |
| **Styling & UI Components** | Tailwind CSS, Radix UI (Shadcn UI), Lucide React    |
| **Backend & Database**      | Supabase (PostgreSQL, Realtime, Row Level Security) |
| **Authentication**          | Supabase Auth (Email & Password, OAuth-ready)       |
| **Notifications**           | Sonner                                              |

---

## 🗄️ Database Architecture & Security

VentureBridge utilizes a normalized PostgreSQL schema hosted on Supabase. Relational integrity is enforced using foreign key cascades, while data access is protected through Row Level Security (RLS) policies.

### Database Relationship

```text
       auth.users (Supabase Auth)
             │
             ├── ON DELETE CASCADE
             ▼
          users
     (id, full_name, role)
             │
    ┌────────┴────────┐
    ▼                 ▼
 founders          mentors
                    (is_verified)
    │                 │
    ├──────┐          │
    ▼      ▼          ▼
  ideas  connections ◄─┘
```

---

## 📋 Table Definitions

### `users`

Base identity table referencing `auth.users(id)`.

| Column       | Type      | Description                     |
| ------------ | --------- | ------------------------------- |
| `id`         | UUID, PK  | References `auth.users(id)`     |
| `full_name`  | Text      | User's full name                |
| `role`       | Text      | `founder`, `mentor`, or `admin` |
| `created_at` | Timestamp | Account creation time           |

### `founders`

Profile details for founders.

| Column          | Type         |
| --------------- | ------------ |
| `id`            | UUID, PK, FK |
| `full_name`     | Text         |
| `industry`      | Text         |
| `startup_stage` | Text         |
| `funding_goal`  | Text         |
| `skills`        | Text         |
| `created_at`    | Timestamp    |

### `mentors`

Profile details and verification status for mentors.

| Column             | Type         |
| ------------------ | ------------ |
| `id`               | UUID, PK, FK |
| `full_name`        | Text         |
| `industry`         | Text         |
| `skills`           | Text         |
| `experience_years` | Integer      |
| `is_verified`      | Boolean      |
| `created_at`       | Timestamp    |

### `ideas`

Venture hypotheses submitted by founders.

| Column           | Type      |
| ---------------- | --------- |
| `id`             | UUID, PK  |
| `elevator_pitch` | Text      |
| `problem`        | Text      |
| `solution`       | Text      |
| `target_market`  | Text      |
| `market`         | Text      |
| `tech_stack`     | Text      |
| `owner_id`       | UUID, FK  |
| `created_at`     | Timestamp |
| `updated_at`     | Timestamp |

### `connections`

Matchmaking and advisory requests.

| Column       | Type                                 |
| ------------ | ------------------------------------ |
| `id`         | UUID, PK                             |
| `founder_id` | UUID, FK                             |
| `mentor_id`  | UUID, FK                             |
| `status`     | `pending`, `accepted`, or `declined` |
| `created_at` | Timestamp                            |

A unique constraint prevents duplicate founder-to-mentor connections.

---

## 🔐 Row Level Security (RLS)

VentureBridge uses PostgreSQL Row Level Security to control access to application data.

### RLS Principles

* **Static Context Checks:** Policies use `auth.uid()` and direct relationships to determine access.
* **Separation of Concerns:** Separate policies are defined for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` operations.
* **Admin Override:** Administrators have explicit policies allowing them to manage mentor verification.
* **Role-Based Access:** Founder, mentor, and admin capabilities are separated through role-based policies.
* **Data Protection:** Users can only modify records they are authorized to manage.

---

## 📁 Project Structure

```text
venturebridge/
├── public/
│
├── src/
│   ├── app/
│   │   ├── AuthProvider.tsx       # Supabase session & user context
│   │   └── ThemeProvider.tsx      # Dark / light theme switching
│   │
│   ├── assets/                    # Static brand assets & illustrations
│   │
│   ├── components/
│   │   ├── ui/                    # Reusable Radix / Shadcn UI primitives
│   │   └── ModeToggle.tsx
│   │
│   ├── features/
│   │   ├── admin/
│   │   │   ├── AdminDashboard.tsx # Operations panel & mentor approvals
│   │   │   └── AdminLogin.tsx     # Superuser gateway
│   │   │
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx      # User authentication
│   │   │   ├── SignupForm.tsx     # Account registration
│   │   │   └── Onboarding.tsx     # Role assignment & profile creation
│   │   │
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx      # Main router & role-based sidebar
│   │   │   └── DashboardLayout.tsx
│   │   │
│   │   ├── ideas/
│   │   │   ├── IdeaLab.tsx        # Hypothesis builder & pitch creation
│   │   │   └── MyVentures.tsx     # Founder venture management
│   │   │
│   │   ├── matching/
│   │   │   └── NetworkDiscovery.tsx
│   │   │
│   │   └── profiles/
│   │       └── ProfileSettings.tsx
│   │
│   ├── lib/
│   │   ├── client.ts              # Supabase browser client
│   │   └── utils.ts               # Class utility helpers
│   │
│   ├── App.tsx                    # Top-level client routing
│   ├── main.tsx                   # React root mount
│   └── index.css                  # Tailwind styles
│
├── .env.example
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

# 🚀 Getting Started

## Prerequisites

Make sure you have the following installed:

* **Node.js** v18.0.0 or higher
* **npm**, **pnpm**, or **yarn**
* A free **Supabase** account and project

---

## 1. Clone the Repository

```bash
git clone https://github.com/your-username/venturebridge.git
cd venturebridge
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Populate the `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Security:** Never commit your `.env` file or expose your Supabase credentials publicly.

---

## 4. Database Setup

Open the **Supabase SQL Editor** and run the following SQL to initialize the database tables, foreign keys, and RLS policies.

```sql
-- 1. Base Users Table
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('founder', 'mentor', 'admin')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Founders Profile Table
CREATE TABLE public.founders (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  industry TEXT,
  startup_stage TEXT,
  funding_goal TEXT,
  skills TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Mentors Profile Table
CREATE TABLE public.mentors (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  industry TEXT,
  skills TEXT,
  experience_years INT DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Ideas Table
CREATE TABLE public.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.founders(id) ON DELETE CASCADE,
  elevator_pitch TEXT,
  problem TEXT,
  solution TEXT,
  target_market TEXT,
  market TEXT,
  tech_stack TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Connections Table
CREATE TABLE public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID NOT NULL REFERENCES public.founders(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined'))
    DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_connection UNIQUE (founder_id, mentor_id)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Users Policies
CREATE POLICY "Users can read own record"
ON public.users
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
ON public.users
FOR SELECT
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- Founder Policies
CREATE POLICY "Public read for founders"
ON public.founders
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Founders can update own profile"
ON public.founders
FOR UPDATE
USING (auth.uid() = id);

-- Mentor Policies
CREATE POLICY "Public read for verified mentors"
ON public.mentors
FOR SELECT
TO authenticated
USING (is_verified = true OR auth.uid() = id);

CREATE POLICY "Mentors can update own profile"
ON public.mentors
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can update mentors"
ON public.mentors
FOR UPDATE
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- Ideas Policies
CREATE POLICY "Pitches readable by authenticated users"
ON public.ideas
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Founders can manage own pitches"
ON public.ideas
FOR ALL
USING (auth.uid() = owner_id);

-- Connection Policies
CREATE POLICY "Users can view relevant connections"
ON public.connections
FOR SELECT
USING (
  auth.uid() = founder_id OR auth.uid() = mentor_id
);

CREATE POLICY "Founders can create connections"
ON public.connections
FOR INSERT
WITH CHECK (
  auth.uid() = founder_id
);

CREATE POLICY "Users can update relevant connections"
ON public.connections
FOR UPDATE
USING (
  auth.uid() = founder_id OR auth.uid() = mentor_id
);
```

---

## 5. Run Locally

Start the development server:

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:5173
```

Open the URL in your browser to start using VentureBridge.

---

# 👑 Creating an Administrator Account

Follow these steps to create an administrator account:

1. Sign up for a new account through the standard frontend registration.

2. Open **Supabase Studio**.

3. Navigate to:

   **Table Editor → `users`**

4. Locate the row corresponding to your registered account.

5. Change the `role` field from:

   ```text
   founder
   ```

   or

   ```text
   mentor
   ```

   to:

   ```text
   admin
   ```

6. Sign out of the application.

7. Visit:

   ```text
   /admin-login
   ```

You should now have access to the administrator gateway.

---

# 🗺️ Roadmap

* [x] Decoupled RLS PostgreSQL schema with cascading deletes
* [x] Multi-role authentication and dedicated admin onboarding
* [x] Dynamic network discovery and match score computation
* [x] Two-way connection handshake (Send / Accept / Decline)
* [ ] Automated AI Venture Diagnostics for IdeaLab pitch validation
* [ ] Integrated direct messaging between connected founders and mentors
* [ ] Pitch deck attachment storage using Supabase Storage buckets
* [ ] Calendar scheduling integration for approved advisory sessions

---

# 🔮 Future Improvements

Potential future enhancements include:

* AI-powered startup idea analysis
* Advanced founder–mentor recommendation models
* Real-time chat and notifications
* Video conferencing for advisory sessions
* AI-assisted pitch deck generation
* Startup progress analytics
* Investor discovery and fundraising workflows
* Advanced mentor reputation and review systems

---

# 📄 License

Distributed under the **MIT License**. See the `LICENSE` file for more information.
