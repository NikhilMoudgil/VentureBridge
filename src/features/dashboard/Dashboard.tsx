import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { motion, MotionConfig } from "framer-motion"
import { toast } from "sonner"
import {
  Activity as HealthIcon,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Lightbulb,
  Rocket,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useDashboardData, type Activity, type DashboardData, type DealItem, type Person, type Role } from "./userDashboardData"
import { CountUp, Initials, ProgressRing, Reveal, Stagger, timeAgo } from "./ui"

const supabase = createClient()

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SUBTITLE: Record<Role, string> = {
  founder: "Build your venture, pitch to experts, and scale your startup.",
  mentor: "Review incoming founder pitches and guide early-stage teams.",
  investor: "Scout high-signal startups and manage your deal flow pipeline.",
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return "Working late"
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

/** Runs a Supabase write, toasts the outcome, then refreshes dashboard data. */
function useAction(refresh: () => void) {
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (
    id: string,
    task: () => PromiseLike<{ error: { message: string } | null }>,
    success: string
  ) => {
    setBusy(id)
    const { error } = await task()
    setBusy(null)
    if (error) {
      toast.error(error.message || "Something went wrong.")
    } else {
      toast.success(success)
      refresh()
    }
  }
  return { busy, run }
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function Backdrop() {
  const mask = "radial-gradient(ellipse at top, black 25%, transparent 75%)"
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 h-[420px]">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0.10)_1px,transparent_1px)] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)]"
        style={{ backgroundSize: "22px 22px", maskImage: mask, WebkitMaskImage: mask }}
      />
    </div>
  )
}

function Header({ d, role }: { d: DashboardData; role: Role }) {
  const hint =
    d.profileStrength >= 100
      ? "Your profile is complete"
      : d.missingFields[0]
        ? `Add your ${d.missingFields[0]}`
        : "Keep your profile current"
  return (
    <Reveal className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          {greeting()}, {d.name}
        </h1>
        <p className="mt-2 max-w-xl text-zinc-500 dark:text-zinc-400">{SUBTITLE[role]}</p>
      </div>
      <Link
        to="/dashboard/profile"
        className="flex items-center gap-3 self-start rounded-xl border border-zinc-200 bg-white/70 py-2 pl-2 pr-4 transition-colors hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:bg-zinc-900 sm:self-auto"
      >
        <ProgressRing value={d.profileStrength} size={44} stroke={4} textClass="text-[11px]" />
        <span className="text-sm leading-tight">
          <span className="block font-medium">Profile strength</span>
          <span className="text-xs text-zinc-500">{hint}</span>
        </span>
      </Link>
    </Reveal>
  )
}

/** The one loud element on the page. Each role passes its own visual. */
function HeroPanel({
  label,
  title,
  body,
  cta,
  to,
  children,
}: {
  label: string
  title: string
  body: string
  cta: string
  to: string
  children: ReactNode
}) {
  return (
    <Reveal>
      <section className="relative overflow-hidden rounded-2xl bg-zinc-950 p-6 text-zinc-50 md:p-8 dark:bg-zinc-900 dark:ring-1 dark:ring-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(99,102,241,0.35), transparent)" }}
        />
        <div className="relative grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center">
          <div>
            <p className="text-sm text-zinc-400">{label}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">{body}</p>
            <Link
              to={to}
              className="group mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div>{children}</div>
        </div>
      </section>
    </Reveal>
  )
}

type Figure = {
  label: string
  icon: ReactNode
  iconClass: string
  value?: number
  unit?: string
  text?: string
  caption: string
  to: string
  cta: string
}

/** Three headline numbers in a single ruled strip instead of three separate cards. */
function Figures({ items }: { items: Figure[] }) {
  return (
    <Reveal>
      <div className="grid divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white/70 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((f) => (
          <div key={f.label} className="flex flex-col p-6">
            <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
              <span>{f.label}</span>
              <span className={f.iconClass}>{f.icon}</span>
            </div>
            <p
              className={cn(
                "mt-3 font-semibold tracking-tight tabular-nums",
                f.value !== undefined ? "text-4xl" : "text-2xl leading-[2.5rem]"
              )}
            >
              {f.value !== undefined ? (
                <>
                  <CountUp value={f.value} />
                  <span className="ml-2 text-base font-medium text-zinc-500">{f.unit}</span>
                </>
              ) : (
                f.text
              )}
            </p>
            <p className="mt-1 text-sm text-zinc-500">{f.caption}</p>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2.5 mt-4 self-start text-zinc-700 dark:text-zinc-300"
            >
              <Link to={f.to}>{f.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </Reveal>
  )
}

function Panel({
  title,
  action,
  className,
  children,
}: {
  title: string
  action?: { label: string; to: string }
  className?: string
  children: ReactNode
}) {
  return (
    <Reveal className={className}>
      <section className="h-full rounded-xl border border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/40">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h3 className="text-sm font-medium">{title}</h3>
          {action && (
            <Link
              to={action.to}
              className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
            >
              {action.label}
            </Link>
          )}
        </header>
        {children}
      </section>
    </Reveal>
  )
}

function List({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">{children}</ul>
}

/** A row that links somewhere. */
function Row({ name, sub, trailing, to }: { name: string; sub?: string; trailing?: string; to: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <Initials name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          {sub && <p className="truncate text-xs text-zinc-500">{sub}</p>}
        </div>
        {trailing && <span className="shrink-0 text-xs text-zinc-500">{trailing}</span>}
      </Link>
    </li>
  )
}

/** A row with buttons on the right (can't be a link, since buttons can't live inside one). */
function ActionRow({
  name,
  sub,
  meta,
  children,
}: {
  name: string
  sub?: string
  meta?: string
  children: ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
      <Initials name={name} />
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm font-medium">{name}</p>
        {sub && <p className="truncate text-xs text-zinc-500">{sub}</p>}
      </div>
      {meta && <span className="hidden text-xs text-zinc-500 sm:block">{meta}</span>}
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </li>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-sm leading-relaxed text-zinc-500">{children}</p>
}

function MessagesPanel({ items }: { items: Activity[] }) {
  return (
    <Panel title="Recent messages" action={{ label: "Open inbox", to: "/dashboard/messages" }} className="lg:col-span-2">
      {items.length === 0 ? (
        <Empty>No messages yet. Once you connect with someone, your conversations show up here.</Empty>
      ) : (
        <List>
          {items.map((m) => (
            <Row key={m.id} name={m.from} sub={m.content} trailing={timeAgo(m.created_at)} to="/dashboard/messages" />
          ))}
        </List>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Founder                                                             */
/* ------------------------------------------------------------------ */

type Milestone = { label: string; hint: string; done: boolean }

/** A line that draws itself up to the last milestone you've reached. */
function PathVisual({ items }: { items: Milestone[] }) {
  const n = items.length
  const last = items.reduce((acc, m, i) => (m.done ? i : acc), -1)
  const next = items.findIndex((m) => !m.done)
  // Column i starts at i/n of the width plus its share of the 0.5rem gaps; the node centre is 12px in.
  const at = (i: number) => `calc(${(i / n) * 100}% + ${(i / n) * 0.5}rem)`
  return (
    <div className="relative">
      <div className="absolute left-3 top-3 h-px bg-white/15" style={{ width: at(n - 1) }} />
      <motion.div
        className="absolute left-3 top-3 h-px origin-left bg-indigo-400"
        style={{ width: at(n - 1) }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: last <= 0 ? 0 : last / (n - 1) }}
        transition={{ duration: 1.1, ease: "easeOut", delay: 0.7 }}
      />
      <ol className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {items.map((m, i) => (
          <li key={m.label}>
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.5 + i * 0.1 }}
              className={cn(
                "relative grid h-6 w-6 place-items-center rounded-full",
                m.done
                  ? "bg-indigo-400 text-zinc-950"
                  : i === next
                    ? "bg-zinc-950 ring-2 ring-white dark:bg-zinc-900"
                    : "bg-zinc-950 ring-1 ring-white/25 dark:bg-zinc-900"
              )}
            >
              {m.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              {i === next && (
                <span className="absolute -inset-1.5 animate-ping rounded-full ring-1 ring-white/50 [animation-duration:2.4s] motion-reduce:animate-none" />
              )}
            </motion.span>
            <p
              className={cn(
                "mt-3 text-[11px] font-medium sm:text-xs",
                m.done || i === next ? "text-zinc-50" : "text-zinc-500"
              )}
            >
              {m.label}
            </p>
            <p className="mt-0.5 hidden text-xs leading-snug text-zinc-500 sm:block">{m.hint}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function FounderView({ d }: { d: DashboardData }) {
  const steps = [
    {
      label: "Profile",
      hint: "80% or more complete",
      done: d.profileStrength >= 80,
      title: "Complete your profile",
      body: `Mentors and investors look at profiles first. Yours is ${d.profileStrength}% complete.`,
      cta: "Edit profile",
      to: "/dashboard/profile",
    },
    {
      label: "Idea",
      hint: "Saved in IdeaLab",
      done: d.ideasCount > 0,
      title: "Save your first venture",
      body: "Describe your idea in IdeaLab: the problem, your solution and your market.",
      cta: "Open IdeaLab",
      to: "/dashboard/idealab",
    },
    {
      label: "Validated",
      hint: "One assumption proven",
      done: d.hypothesesValidated > 0,
      title: "Validate your riskiest assumption",
      body:
        d.hypothesesTotal > 0
          ? `${d.hypothesesTotal} ${plural(d.hypothesesTotal, "hypothesis", "hypotheses")} logged. Run experiments and mark one as validated.`
          : "Log a hypothesis and the experiments behind it in the Validation Lab.",
      cta: "Open Validation Lab",
      to: "/dashboard/validation",
    },
    {
      label: "Mentor",
      hint: "Request accepted",
      done: d.acceptedConnections > 0,
      title: "Connect with a mentor",
      body:
        d.pendingRequests > 0
          ? `${d.pendingRequests} ${plural(d.pendingRequests, "request", "requests")} pending. You can send more from the Network page.`
          : "Ask a verified mentor for feedback on your pitch.",
      cta: "Find mentors",
      to: "/dashboard/network",
    },
    {
      label: "Investor",
      hint: "Interest received",
      done: d.dealsInterested > 0,
      title: d.dealsTotal > 0 ? "Waiting on investors" : "Pitch an investor",
      body:
        d.dealsTotal > 0
          ? `${d.dealsTotal} ${plural(d.dealsTotal, "pitch", "pitches")} sent. Interest unlocks a private chat in Messages.`
          : "Send your venture to an investor from the Network page.",
      cta: "Open network",
      to: "/dashboard/network",
    },
  ]
  const next = steps.find((s) => !s.done)

  const healthFigure: Figure =
    d.ideasCount > 0
      ? {
          label: "Idea health",
          icon: <HealthIcon className="h-4 w-4" />,
          iconClass: "text-emerald-500",
          value: d.healthScore,
          unit: "/ 100",
          caption:
            d.hypothesesTotal > 0
              ? `${d.hypothesesValidated} of ${d.hypothesesTotal} ${plural(d.hypothesesTotal, "hypothesis", "hypotheses")} validated`
              : "Log experiments to raise your score",
          to: "/dashboard/validation",
          cta: "Open Validation Lab",
        }
      : {
          label: "IdeaLab pitch studio",
          icon: <Lightbulb className="h-4 w-4" />,
          iconClass: "text-amber-500",
          text: "Idea Check",
          caption: "Check your draft for gaps before you share it",
          to: "/dashboard/idealab",
          cta: "Open IdeaLab",
        }

  return (
    <>
      <HeroPanel
        label={next ? "Your next step" : "Launch path complete"}
        title={next ? next.title : "You've reached every milestone"}
        body={next ? next.body : "Keep your connections warm and reply to new messages."}
        cta={next ? next.cta : "Open messages"}
        to={next ? next.to : "/dashboard/messages"}
      >
        <PathVisual items={steps} />
      </HeroPanel>

      <Figures
        items={[
          {
            label: "Saved ventures",
            icon: <Rocket className="h-4 w-4" />,
            iconClass: "text-indigo-500",
            value: d.ideasCount,
            unit: plural(d.ideasCount, "draft", "drafts"),
            caption: "Ideas saved in your workspace",
            to: "/dashboard/ventures",
            cta: "View ventures",
          },
          {
            label: "Network connections",
            icon: <Users className="h-4 w-4" />,
            iconClass: "text-blue-500",
            value: d.acceptedConnections,
            unit: "active",
            caption: d.pendingRequests > 0 ? `${d.pendingRequests} request pending` : "Mentors you're connected with",
            to: "/dashboard/network",
            cta: "Find mentors",
          },
          healthFigure,
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          title="Mentors worth meeting"
          action={{ label: "Browse network", to: "/dashboard/network" }}
          className="lg:col-span-3"
        >
          {d.suggestions.length === 0 ? (
            <Empty>No new verified mentors right now. Check the network page for the full list.</Empty>
          ) : (
            <List>
              {d.suggestions.map(({ person, score }) => (
                <Row
                  key={person.id}
                  name={person.full_name || "Anonymous member"}
                  sub={person.industry || "General"}
                  trailing={`${score}% match`}
                  to="/dashboard/network"
                />
              ))}
            </List>
          )}
        </Panel>
        <MessagesPanel items={d.activity} />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Mentor                                                              */
/* ------------------------------------------------------------------ */

function QueueVisual({ people, total }: { people: Person[]; total: number }) {
  if (!total) return <p className="text-sm text-zinc-500">Nothing in your queue right now.</p>
  return (
    <div className="flex items-center gap-5">
      <p className="text-6xl font-semibold tabular-nums tracking-tight">
        <CountUp value={total} />
      </p>
      <div className="flex -space-x-3">
        {people.slice(0, 4).map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
          >
            <Initials
              name={p.full_name || "?"}
              className="h-11 w-11 bg-white text-zinc-950 ring-2 ring-zinc-950 dark:bg-white dark:text-zinc-950 dark:ring-zinc-900"
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function MentorView({ d }: { d: DashboardData }) {
  const waiting = d.pendingRequests
  const { busy, run } = useAction(d.refresh)

  // Same write the Network page makes when a mentor responds
  const respond = (founderId: string, status: "accepted" | "declined") =>
    run(
      founderId,
      () => supabase.from("connections").update({ status }).match({ founder_id: founderId, mentor_id: d.userId }),
      `Request ${status}!`
    )

  return (
    <>
      {!d.isVerified && (
        <Reveal>
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50 p-4 dark:bg-amber-950/20">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Verification pending</p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Your profile is under review by an administrator.
              </p>
            </div>
          </div>
        </Reveal>
      )}

      <HeroPanel
        label="Pitch queue"
        title={
          waiting > 0
            ? `${waiting} ${plural(waiting, "founder is", "founders are")} waiting for your review`
            : "No pitches waiting"
        }
        body={
          waiting > 0
            ? "Accept or decline below, or open the network to read each founder's profile first."
            : "New requests appear here. A complete profile helps the right founders find you."
        }
        cta={waiting > 0 ? "Open network" : "Edit profile"}
        to={waiting > 0 ? "/dashboard/network" : "/dashboard/profile"}
      >
        <QueueVisual people={d.pendingList.map((r) => r.founder)} total={waiting} />
      </HeroPanel>

      <Figures
        items={[
          {
            label: "Incoming requests",
            icon: <Clock className="h-4 w-4" />,
            iconClass: "text-amber-500",
            value: waiting,
            unit: "pending",
            caption: "Founders waiting on a response",
            to: "/dashboard/network",
            cta: "Review founder pitches",
          },
          {
            label: "Active mentees",
            icon: <Users className="h-4 w-4" />,
            iconClass: "text-blue-500",
            value: d.acceptedConnections,
            unit: "active",
            caption: "Founders you're advising",
            to: "/dashboard/messages",
            cta: "Open messages",
          },
          {
            label: "Professional profile",
            icon: <CheckCircle2 className="h-4 w-4" />,
            iconClass: "text-emerald-500",
            text: "Expertise & skills",
            caption: `${d.profileStrength}% complete`,
            to: "/dashboard/profile",
            cta: "Edit profile",
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Pitch queue" action={{ label: "Open network", to: "/dashboard/network" }} className="lg:col-span-3">
          {d.pendingList.length === 0 ? (
            <Empty>No pending pitches. Requests from founders will appear here as they come in.</Empty>
          ) : (
            <List>
              {d.pendingList.slice(0, 5).map(({ founder, requestedAt }) => (
                <ActionRow
                  key={founder.id}
                  name={founder.full_name || "Anonymous founder"}
                  sub={founder.industry || "General"}
                  meta={requestedAt ? timeAgo(requestedAt) : undefined}
                >
                  <Button size="sm" disabled={busy === founder.id} onClick={() => respond(founder.id, "accepted")}>
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === founder.id}
                    onClick={() => respond(founder.id, "declined")}
                  >
                    Decline
                  </Button>
                </ActionRow>
              ))}
            </List>
          )}
        </Panel>
        <MessagesPanel items={d.activity} />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Investor                                                            */
/* ------------------------------------------------------------------ */

const DEAL_STATUSES = [
  { key: "submitted", label: "Submitted", color: "bg-indigo-400" },
  { key: "reviewing", label: "Reviewing", color: "bg-sky-400" },
  { key: "interested", label: "Interested", color: "bg-emerald-400" },
  { key: "passed", label: "Passed", color: "bg-zinc-500" },
]

const needsDecision = (deal: DealItem) => deal.status === "submitted" || deal.status === "reviewing"

function PipelineVisual({ counts }: { counts: Record<string, number> }) {
  const total = DEAL_STATUSES.reduce((s, st) => s + (counts[st.key] ?? 0), 0)
  if (total === 0) return <p className="text-sm text-zinc-500">Your pipeline is empty.</p>
  return (
    <div>
      <div className="flex h-3 gap-1 overflow-hidden rounded-full">
        {DEAL_STATUSES.filter((st) => (counts[st.key] ?? 0) > 0).map((st, i) => (
          <motion.div
            key={st.key}
            className={cn("h-full rounded-full", st.color)}
            style={{ flexBasis: 0 }}
            initial={{ flexGrow: 0 }}
            animate={{ flexGrow: counts[st.key] }}
            transition={{ duration: 0.9, ease: "easeOut", delay: 0.5 + i * 0.1 }}
          />
        ))}
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {DEAL_STATUSES.map((st) => (
          <li key={st.key} className="flex items-center gap-2 text-zinc-400">
            <span className={cn("h-2 w-2 rounded-full", st.color)} />
            <span>{st.label}</span>
            <span className="ml-auto tabular-nums text-zinc-50">{counts[st.key] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function InvestorView({ d }: { d: DashboardData }) {
  const { busy, run } = useAction(d.refresh)
  const counts = d.deals.reduce<Record<string, number>>((acc, deal) => {
    acc[deal.status] = (acc[deal.status] ?? 0) + 1
    return acc
  }, {})
  const open = d.deals.filter(needsDecision).length
  const passed = counts.passed ?? 0

  // Same write the Deal Flow page makes
  const decide = (dealId: string, status: "interested" | "passed") =>
    run(dealId, () => supabase.from("deal_flow").update({ status }).eq("id", dealId), `Deal marked as ${status}`)

  const hero =
    open > 0
      ? {
          title: `${open} ${plural(open, "pitch needs", "pitches need")} your decision`,
          body: "Respond below, or open deal flow to read each pitch in full.",
          cta: "Open deal flow",
          to: "/dashboard/dealflow",
        }
      : d.dealsTotal > 0
        ? {
            title: "You're all caught up",
            body: `${d.dealsInterested} interested, ${passed} passed. New pitches appear here as founders submit them.`,
            cta: "Open deal flow",
            to: "/dashboard/dealflow",
          }
        : {
            title: "No pitches yet",
            body: "Founders pitch you from the Network page. A clear thesis helps them decide whether to.",
            cta: "Edit profile",
            to: "/dashboard/profile",
          }

  // Pitches that need a decision first, newest first within each group
  const ordered = [...d.deals].sort((a, b) => Number(needsDecision(b)) - Number(needsDecision(a))).slice(0, 5)

  return (
    <>
      <HeroPanel label="Deal flow" {...hero}>
        <PipelineVisual counts={counts} />
      </HeroPanel>

      <Figures
        items={[
          {
            label: "Deal flow pipeline",
            icon: <TrendingUp className="h-4 w-4" />,
            iconClass: "text-emerald-500",
            value: d.dealsTotal,
            unit: plural(d.dealsTotal, "pitch", "pitches"),
            caption: "Vetted founder hypotheses to evaluate",
            to: "/dashboard/dealflow",
            cta: "View deal flow",
          },
          {
            label: "Interested",
            icon: <Users className="h-4 w-4" />,
            iconClass: "text-indigo-500",
            value: d.dealsInterested,
            unit: plural(d.dealsInterested, "founder", "founders"),
            caption: "Private chats unlocked in Messages",
            to: "/dashboard/messages",
            cta: "Open messages",
          },
          {
            label: "Investment profile",
            icon: <CheckCircle2 className="h-4 w-4" />,
            iconClass: "text-blue-500",
            text: "Thesis & criteria",
            caption: d.profileSummary || "Add your target stage and thesis",
            to: "/dashboard/profile",
            cta: "Edit profile",
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          title={open > 0 ? "Needs your decision" : "Recent pitches"}
          action={{ label: "See all", to: "/dashboard/dealflow" }}
          className="lg:col-span-3"
        >
          {ordered.length === 0 ? (
            <Empty>No pitches yet. Founders who pitch you will appear here.</Empty>
          ) : (
            <List>
              {ordered.map((deal) => (
                <ActionRow
                  key={deal.id}
                  name={deal.founder?.full_name || "Anonymous founder"}
                  sub={deal.pitch || deal.founder?.industry || "No pitch provided"}
                  meta={deal.createdAt ? timeAgo(deal.createdAt) : undefined}
                >
                  {needsDecision(deal) ? (
                    <>
                      <Button size="sm" disabled={busy === deal.id} onClick={() => decide(deal.id, "interested")}>
                        Interested
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === deal.id}
                        onClick={() => decide(deal.id, "passed")}
                      >
                        Pass
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs capitalize text-zinc-500">{deal.status}</span>
                  )}
                </ActionRow>
              ))}
            </List>
          )}
        </Panel>
        <MessagesPanel items={d.activity} />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function Skeleton() {
  const block = "rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70"
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse space-y-6 motion-reduce:animate-none" aria-busy="true">
      <div className={cn(block, "h-12 w-96 max-w-full")} />
      <div className={cn(block, "h-56 rounded-2xl")} />
      <div className={cn(block, "h-40")} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className={cn(block, "h-64 lg:col-span-3")} />
        <div className={cn(block, "h-64 lg:col-span-2")} />
      </div>
    </div>
  )
}

export function Dashboard() {
  const d = useDashboardData()

  if (d.loading) return <Skeleton />
  if (!d.role) {
    return (
      <div className="p-8 text-center text-zinc-500">
        We couldn't load your account role. Try signing out and back in.
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative mx-auto w-full max-w-6xl pb-10">
        <Backdrop />
        <Stagger className="relative flex flex-col gap-6">
          <Header d={d} role={d.role} />
          {d.role === "founder" && <FounderView d={d} />}
          {d.role === "mentor" && <MentorView d={d} />}
          {d.role === "investor" && <InvestorView d={d} />}
        </Stagger>
      </div>
    </MotionConfig>
  )
}
