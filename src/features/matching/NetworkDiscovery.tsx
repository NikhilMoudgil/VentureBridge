import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Search, UserPlus, UserMinus, Clock, CheckCircle2, X, TrendingUp, SlidersHorizontal,
  MessageSquare, Briefcase, MapPin, AlertCircle, RefreshCw, Users, Sparkles,
  GraduationCap, Rocket, Landmark, XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Link } from "react-router-dom"

const supabase = createClient()

/* -------------------------------------------------------------------------- */
/* Routes used by this page. IdeaLab + pitch routes are taken from the original */
/* file. MESSAGES and PROFILE are assumptions — verify them against App.tsx.    */
/* -------------------------------------------------------------------------- */
const ROUTES = {
  idealab: "/dashboard/idealab",
  pitch: (ideaId: string) => `/dashboard/pitch/${ideaId}`,
  messages: "/dashboard/messages",
  profile: "/dashboard/profile",
}

type Role = "founder" | "mentor" | "investor"

type NetworkProfile = {
  id: string
  full_name: string
  role: Role
  industry?: string
  startup_stage?: string
  experience_years?: number
  skills?: string
  idea?: any
  investment_stage?: string
  firm_name?: string
  thesis?: string
  // Optional columns — rendered only if they exist on the row. Nothing is invented.
  avatar_url?: string
  location?: string
}

type Match = { score: number; reasons: string[] }
type Entry = { p: NetworkProfile; status: string | null; match: Match | null }
type ConfirmKind = "withdraw" | "disconnect" | "clear"

/* ------------------------------- Pure helpers ------------------------------ */

const norm = (v?: string | null) => (v || "").trim().toLowerCase()

function parseSkills(skills?: string): string[] {
  if (!skills) return []
  const seen = new Set<string>()
  return skills
    .split(",")
    .map((s) => s.trim())
    .filter((s) => {
      const k = s.toLowerCase()
      if (!s || seen.has(k)) return false
      seen.add(k)
      return true
    })
}

const PENDING = ["pending", "submitted", "reviewing"]
const CONNECTED = ["accepted", "interested"]
const CLOSED = ["declined", "passed"]
const isPending = (s: string | null) => !!s && PENDING.includes(s)
const isConnected = (s: string | null) => !!s && CONNECTED.includes(s)
const isClosed = (s: string | null) => !!s && CLOSED.includes(s)

const ROLE_META: Record<Role, { label: string; plural: string; icon: typeof Rocket; badge: string }> = {
  founder: {
    label: "Founder", plural: "Founders", icon: Rocket,
    badge: "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  mentor: {
    label: "Mentor", plural: "Mentors", icon: GraduationCap,
    badge: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  },
  investor: {
    label: "Investor", plural: "Investors", icon: Landmark,
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300",
  },
}

/** Same status resolution as the original getStatus(), made pure. */
function resolveStatus(
  profileId: string, targetRole: string, userId: string | undefined,
  viewerRole: Role | null, connections: any[], dealFlows: any[],
): string | null {
  if (targetRole === "mentor" || viewerRole === "mentor") {
    const conn = connections.find(
      (c) => (c.founder_id === userId && c.mentor_id === profileId) || (c.founder_id === profileId && c.mentor_id === userId),
    )
    return conn ? conn.status : null
  } else if (targetRole === "investor" || viewerRole === "investor") {
    const deal = dealFlows.find(
      (d) => (d.founder_id === userId && d.investor_id === profileId) || (d.founder_id === profileId && d.investor_id === userId),
    )
    return deal ? deal.status : null
  }
  return null
}

/**
 * Same scoring formula as the original calculateMatchScore(). The difference:
 * it also returns the reasons that produced the score, and returns null when no
 * signal matched (so the 40-point baseline is never shown as if it meant something).
 */
function computeMatch(me: NetworkProfile | null, target: NetworkProfile): Match | null {
  if (!me) return null
  const reasons: string[] = []

  if (me.role === "investor" || target.role === "investor") {
    const founder = me.role === "founder" ? me : target
    const investor = me.role === "investor" ? me : target
    let fit = 40
    const stage = norm(founder.startup_stage)
    if (stage && norm(investor.investment_stage).includes(stage)) {
      fit += 30
      reasons.push(`Stage fit: ${founder.startup_stage}`)
    }
    const industry = norm(founder.industry)
    if (industry && norm(investor.thesis).includes(industry)) {
      fit += 30
      reasons.push(`${founder.industry} is in the investment thesis`)
    }
    if (!reasons.length) return null
    return { score: Math.min(100, Math.max(35, fit)), reasons }
  }

  let score = 40
  if (me.industry && target.industry && norm(me.industry) === norm(target.industry)) {
    score += 30
    reasons.push(`Same industry: ${target.industry}`)
  }
  if (me.skills && target.skills) {
    const mine = me.skills.toLowerCase().split(",").map((s) => s.trim())
    const theirs = target.skills.toLowerCase().split(",").map((s) => s.trim())
    const shared = mine.filter((s) => s && theirs.includes(s))
    if (shared.length > 0) {
      score += Math.min(30, shared.length * 15)
      reasons.push(`${shared.length} shared skill${shared.length > 1 ? "s" : ""}: ${shared.slice(0, 3).join(", ")}`)
    }
  }
  if (!reasons.length) return null
  return { score: Math.min(100, Math.max(35, score)), reasons }
}

function statusInfo(status: string | null, viewerRole: Role | null) {
  if (!status) return null
  const map: Record<string, { label: string; tone: string; icon: typeof Clock }> = {
    accepted: { label: "Connected", tone: "success", icon: CheckCircle2 },
    interested: { label: "Interested", tone: "success", icon: CheckCircle2 },
    pending: { label: viewerRole === "mentor" ? "Wants to connect" : "Request pending", tone: "warn", icon: Clock },
    submitted: { label: viewerRole === "founder" ? "Pitch submitted" : "Pitch received", tone: "warn", icon: Clock },
    reviewing: { label: "Under review", tone: "warn", icon: Clock },
    declined: { label: "Declined", tone: "danger", icon: XCircle },
    passed: { label: "Passed", tone: "danger", icon: XCircle },
  }
  return map[status] || null
}

const TONE_CLASS: Record<string, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400",
  warn: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
  danger: "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
}

function cardHeadline(p: NetworkProfile): string {
  const parts: (string | undefined)[] =
    p.role === "investor"
      ? [p.firm_name || "Independent investor"]
      : p.role === "mentor"
        ? [p.industry, p.experience_years ? `${p.experience_years}+ yrs experience` : undefined]
        : [p.industry, p.startup_stage]
  return parts.filter(Boolean).join(" · ")
}

function cardBlurb(p: NetworkProfile): string {
  if (p.role === "founder") return p.idea?.elevator_pitch || p.idea?.solution || ""
  if (p.role === "investor") return p.thesis || ""
  return ""
}

const PROFILE_FIELDS: Record<Role, { key: string; label: string }[]> = {
  founder: [{ key: "industry", label: "industry" }, { key: "startup_stage", label: "startup stage" }, { key: "skills", label: "skills" }],
  mentor: [{ key: "industry", label: "industry" }, { key: "skills", label: "skills" }, { key: "experience_years", label: "years of experience" }],
  investor: [{ key: "investment_stage", label: "investment stage" }, { key: "thesis", label: "thesis" }, { key: "firm_name", label: "firm" }],
}

/* ------------------------------ Small components --------------------------- */

function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role]
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={cn("gap-1 rounded-md px-1.5 py-0 text-[11px] font-medium", meta.badge)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </Badge>
  )
}

function StatusChip({ status, viewerRole }: { status: string | null; viewerRole: Role | null }) {
  const info = statusInfo(status, viewerRole)
  if (!info) return null
  const Icon = info.icon
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium", TONE_CLASS[info.tone])}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {info.label}
    </span>
  )
}

function PersonAvatar({ p, className }: { p: NetworkProfile; className?: string }) {
  const initials = (p.full_name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
  return (
    <Avatar className={cn("shrink-0 border", className)}>
      {p.avatar_url ? <AvatarImage src={p.avatar_url} alt="" /> : null}
      <AvatarFallback className="bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{initials}</AvatarFallback>
    </Avatar>
  )
}

const selectClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"

function FilterSelect(props: {
  id: string; label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; allLabel: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.id} className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{props.label}</Label>
      <select id={props.id} className={selectClass} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        <option value="">{props.allLabel}</option>
        {props.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function ProfileCard({ entry, viewerRole, actions, highlight }: { entry: Entry; viewerRole: Role | null; actions: ReactNode; highlight?: boolean }) {
  const { p, status, match } = entry
  const tags = parseSkills(p.skills)
  const visibleTags = tags.slice(0, 3)
  const extra = tags.length - visibleTags.length
  const headline = cardHeadline(p)
  const blurb = cardBlurb(p)
  const hasDetail = !!(headline || blurb || tags.length || p.location)

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border bg-white shadow-sm transition-colors hover:border-zinc-300 dark:bg-zinc-950 dark:hover:border-zinc-700",
        highlight ? "border-indigo-200 dark:border-indigo-900" : "border-zinc-200 dark:border-zinc-800",
      )}
    >
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <PersonAvatar p={p} className="h-11 w-11" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50" title={p.full_name}>{p.full_name || "Unnamed member"}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <RoleBadge role={p.role} />
              <StatusChip status={status} viewerRole={viewerRole} />
            </div>
          </div>
        </div>

        {headline && <p className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-400" title={headline}>{headline}</p>}
        {blurb && <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{blurb}</p>}

        {(p.location || p.startup_stage || p.investment_stage) && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            {p.role === "investor" && p.investment_stage && (
              <li className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />Invests: {p.investment_stage}</li>
            )}
            {p.role === "founder" && p.startup_stage && (
              <li className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" aria-hidden="true" />{p.startup_stage}</li>
            )}
            {p.location && <li className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{p.location}</li>}
          </ul>
        )}

        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Expertise">
            {visibleTags.map((t) => (
              <li key={t} className="max-w-[10rem] truncate rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400" title={t}>{t}</li>
            ))}
            {extra > 0 && <li className="px-1 py-0.5 text-[11px] text-zinc-400" title={tags.slice(3).join(", ")}>+{extra} more</li>}
          </ul>
        )}

        {!hasDetail && <p className="text-xs italic text-zinc-400">This member hasn’t added profile details yet.</p>}

        {match && (
          <div className="mt-auto rounded-md bg-emerald-50/70 px-2.5 py-2 text-xs dark:bg-emerald-950/20">
            <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {match.score}% match
            </div>
            <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{match.reasons.join(" · ")}</p>
          </div>
        )}
      </div>
      <div className="border-t border-zinc-100 p-3 dark:border-zinc-900">{actions}</div>
    </article>
  )
}

function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
          <div className="h-3 w-1/4 rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
        </div>
      </div>
      <div className="h-3 w-full rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
      <div className="h-3 w-4/5 rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
      <div className="flex gap-2 pt-2">
        <div className="h-8 flex-1 rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
        <div className="h-8 flex-1 rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, body, action }: { icon: typeof Users; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-800">
      <Icon className="h-8 w-8 text-zinc-400" aria-hidden="true" />
      <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <div className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{children}</div>
    </div>
  )
}

/* -------------------------------- Component -------------------------------- */

export function NetworkDiscovery() {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<NetworkProfile | null>(null)
  const [founderIdeaId, setFounderIdeaId] = useState<string | null>(null)

  const [profiles, setProfiles] = useState<NetworkProfile[]>([])
  const [connections, setConnections] = useState<any[]>([])
  const [dealFlows, setDealFlows] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // UI state
  const [tab, setTab] = useState<"discover" | "connections">("discover")
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all")
  const [industryFilter, setIndustryFilter] = useState("")
  const [stageFilter, setStageFilter] = useState("")
  const [skillFilter, setSkillFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "pending" | "connected">("all")
  const [sortBy, setSortBy] = useState<"match" | "name">("match")
  const [showFilters, setShowFilters] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ entry: Entry; kind: ConfirmKind } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  /* ---- Data loading: same queries as the original, plus error handling ---- */
  const fetchNetwork = useCallback(async () => {
    if (!user) return
    try {
      const { data: userData, error: userErr } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
      if (userErr) throw userErr

      if (userData) {
        const role = userData.role as Role
        setCurrentUserRole(role)

        if (role === "founder") {
          const { data: founderData } = await supabase.from("founders").select("*").eq("id", user.id).maybeSingle()
          if (founderData) setCurrentUserProfile({ ...founderData, role: "founder" })

          // Prefer the venture whose pitch the founder has shared; otherwise the newest venture.
          const { data: sharedData } = await supabase.from("idea_pitch_shares").select("idea_id").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle()
          if (sharedData?.idea_id) {
            setFounderIdeaId(sharedData.idea_id)
          } else {
            const { data: ideaData } = await supabase.from("ideas").select("id").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
            if (ideaData) setFounderIdeaId(ideaData.id)
          }
        } else {
          const table = role === "mentor" ? "mentors" : "investors"
          const { data: profileData } = await supabase.from(table).select("*").eq("id", user.id).maybeSingle()
          if (profileData) setCurrentUserProfile({ ...profileData, role })
        }

        const [
          { data: allUsers, error: usersErr },
          { data: foundersData },
          { data: mentorsData },
          { data: investorsData },
          { data: ideasData },
        ] = await Promise.all([
          supabase.from("users").select("id, role").neq("id", user.id), // never show ourselves
          supabase.from("founders").select("*"),
          supabase.from("mentors").select("*"),
          supabase.from("investors").select("*"),
          supabase.from("ideas").select("*"),
        ])
        if (usersErr) throw usersErr

        const matchedProfiles: NetworkProfile[] = []
        if (allUsers) {
          allUsers.forEach((u) => {
            if (u.role === "founder" && foundersData) {
              const f = foundersData.find((x) => x.id === u.id)
              if (f) matchedProfiles.push({ ...f, role: "founder", idea: ideasData?.find((i) => i.owner_id === u.id) })
            } else if (u.role === "mentor" && mentorsData) {
              const m = mentorsData.find((x) => x.id === u.id)
              if (m) matchedProfiles.push({ ...m, role: "mentor" })
            } else if (u.role === "investor" && investorsData) {
              const i = investorsData.find((x) => x.id === u.id)
              if (i) matchedProfiles.push({ ...i, role: "investor" })
            }
          })
        }
        setProfiles(matchedProfiles)

        const { data: connData } = await supabase.from("connections").select("*").or(`founder_id.eq.${user.id},mentor_id.eq.${user.id}`)
        if (connData) setConnections(connData)

        const { data: dealData } = await supabase.from("deal_flow").select("*").or(`founder_id.eq.${user.id},investor_id.eq.${user.id}`)
        if (dealData) setDealFlows(dealData)
      }
      setLoadError(null)
    } catch (err: any) {
      console.error("Network discovery load failed:", err)
      setLoadError(err?.message || "Something went wrong while loading the network.")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    fetchNetwork()
    const channel = supabase
      .channel("network_discovery_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_flow" }, () => fetchNetwork())
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => fetchNetwork())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchNetwork])

  const retry = () => { setLoading(true); setLoadError(null); fetchNetwork() }

  /* ------------- Mutations: identical Supabase calls to the original ------------- */
  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    try { await fn() } finally { setBusyId(null) }
  }

  const handleConnectMentor = (targetId: string, targetName: string) =>
    withBusy(targetId, async () => {
      if (!user || currentUserRole !== "founder") return
      try {
        const { error } = await supabase.from("connections").insert({ founder_id: user.id, mentor_id: targetId, status: "pending" })
        if (error) throw error
        setConnections((prev) => [...prev, { founder_id: user.id, mentor_id: targetId, status: "pending" }])
        toast.success(`Connection request sent to ${targetName}`)
      } catch { toast.error("Failed to send request.") }
    })

  const handlePitchInvestor = (targetId: string, targetName: string) =>
    withBusy(targetId, async () => {
      if (!user || currentUserRole !== "founder") return
      if (!founderIdeaId) {
        toast.error("You need to create a venture in IdeaLab before pitching an investor!")
        return
      }
      try {
        const { error } = await supabase.from("deal_flow").insert({ founder_id: user.id, investor_id: targetId, idea_id: founderIdeaId, status: "submitted" })
        if (error) throw error
        setDealFlows((prev) => [...prev, { founder_id: user.id, investor_id: targetId, idea_id: founderIdeaId, status: "submitted" }])
        toast.success(`Pitch submitted to ${targetName}!`)
      } catch { toast.error("Failed to submit pitch.") }
    })

  const handleUpdateMentorStatus = (founderId: string, newStatus: "accepted" | "declined") =>
    withBusy(founderId, async () => {
      if (!user || currentUserRole !== "mentor") return
      try {
        const { error } = await supabase.from("connections").update({ status: newStatus }).match({ founder_id: founderId, mentor_id: user.id })
        if (error) throw error
        setConnections((prev) => prev.map((c) => (c.founder_id === founderId && c.mentor_id === user.id ? { ...c, status: newStatus } : c)))
        toast.success(`Request ${newStatus}!`)
      } catch { toast.error("Failed to update.") }
    })

  const handleRemoveConnection = (targetId: string, targetRole: string) =>
    withBusy(targetId, async () => {
      if (!user) return
      try {
        if (targetRole === "mentor" || currentUserRole === "mentor") {
          const { error } = await supabase.from("connections").delete().match({
            founder_id: currentUserRole === "founder" ? user.id : targetId,
            mentor_id: currentUserRole === "mentor" ? user.id : targetId,
          })
          if (error) throw error
          setConnections((prev) => prev.filter((c) => !((c.founder_id === user.id && c.mentor_id === targetId) || (c.founder_id === targetId && c.mentor_id === user.id))))
          toast.success("Connection removed.")
        } else if (targetRole === "investor" || currentUserRole === "investor") {
          const { error } = await supabase.from("deal_flow").delete().match({
            founder_id: currentUserRole === "founder" ? user.id : targetId,
            investor_id: currentUserRole === "investor" ? user.id : targetId,
          })
          if (error) throw error
          setDealFlows((prev) => prev.filter((d) => !((d.founder_id === user.id && d.investor_id === targetId) || (d.founder_id === targetId && d.investor_id === user.id))))
          toast.success("Pitch removed.")
        }
      } catch { toast.error("Failed to remove.") }
    })

  /* ------------------------------ Derived data ------------------------------ */
  const entries: Entry[] = useMemo(
    () => profiles.map((p) => ({
      p,
      status: resolveStatus(p.id, p.role, user?.id, currentUserRole, connections, dealFlows),
      match: computeMatch(currentUserProfile, p),
    })),
    [profiles, user?.id, currentUserRole, connections, dealFlows, currentUserProfile],
  )

  const industryOptions = useMemo(() => {
    const m = new Map<string, string>()
    profiles.forEach((p) => { if (p.industry?.trim()) m.set(norm(p.industry), p.industry.trim()) })
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }))
  }, [profiles])

  const stageOptions = useMemo(() => {
    const m = new Map<string, string>()
    profiles.forEach((p) => {
      ;[p.startup_stage, p.investment_stage].forEach((s) => { if (s?.trim()) m.set(norm(s), s.trim()) })
    })
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }))
  }, [profiles])

  const skillOptions = useMemo(() => {
    const counts = new Map<string, { label: string; n: number }>()
    profiles.forEach((p) => parseSkills(p.skills).forEach((s) => {
      const k = s.toLowerCase()
      counts.set(k, { label: counts.get(k)?.label || s, n: (counts.get(k)?.n || 0) + 1 })
    }))
    return [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label)).slice(0, 40).map(([value, v]) => ({ value, label: v.label }))
  }, [profiles])

  const roleCounts = useMemo(() => ({
    all: entries.length,
    mentor: entries.filter((e) => e.p.role === "mentor").length,
    investor: entries.filter((e) => e.p.role === "investor").length,
    founder: entries.filter((e) => e.p.role === "founder").length,
  }), [entries])

  const connectedCount = entries.filter((e) => isConnected(e.status)).length
  const pendingCount = entries.filter((e) => isPending(e.status)).length
  const incomingCount = currentUserRole === "mentor" ? entries.filter((e) => e.status === "pending").length : 0

  const activeFilterCount =
    (roleFilter !== "all" ? 1 : 0) + (industryFilter ? 1 : 0) + (stageFilter ? 1 : 0) + (skillFilter ? 1 : 0) +
    (tab === "discover" && statusFilter !== "all" ? 1 : 0)
  const hasActiveFilters = activeFilterCount > 0 || searchTerm.trim() !== ""

  const clearFilters = () => {
    setSearchTerm(""); setRoleFilter("all"); setIndustryFilter(""); setStageFilter(""); setSkillFilter(""); setStatusFilter("all")
  }

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const list = entries.filter(({ p, status }) => {
      if (tab === "connections" && !isConnected(status)) return false
      if (roleFilter !== "all" && p.role !== roleFilter) return false
      if (industryFilter) {
        const matchesIndustry = norm(p.industry) === industryFilter || (p.role === "investor" && norm(p.thesis).includes(industryFilter))
        if (!matchesIndustry) return false
      }
      if (stageFilter) {
        const matchesStage = norm(p.startup_stage) === stageFilter || (!!p.investment_stage && norm(p.investment_stage).includes(stageFilter))
        if (!matchesStage) return false
      }
      if (skillFilter && !parseSkills(p.skills).some((s) => s.toLowerCase() === skillFilter)) return false
      if (tab === "discover") {
        if (statusFilter === "available" && status) return false
        if (statusFilter === "pending" && !isPending(status)) return false
        if (statusFilter === "connected" && !isConnected(status)) return false
      }
      if (q) {
        const haystack = [p.full_name, p.industry, p.skills, p.firm_name, p.thesis, p.startup_stage, p.investment_stage, p.location, p.role].join(" ").toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    return list.sort((a, b) =>
      sortBy === "match"
        ? (b.match?.score || 0) - (a.match?.score || 0) || (a.p.full_name || "").localeCompare(b.p.full_name || "")
        : (a.p.full_name || "").localeCompare(b.p.full_name || ""),
    )
  }, [entries, tab, roleFilter, industryFilter, stageFilter, skillFilter, statusFilter, searchTerm, sortBy])

  const recommended = useMemo(() => {
    if (tab !== "discover" || hasActiveFilters || !currentUserProfile) return []
    return entries.filter((e) => e.match && !e.status).sort((a, b) => (b.match!.score - a.match!.score)).slice(0, 3)
  }, [entries, tab, hasActiveFilters, currentUserProfile])

  const missingFields = useMemo(() => {
    if (!currentUserProfile) return []
    const me = currentUserProfile as unknown as Record<string, unknown>
    return PROFILE_FIELDS[currentUserProfile.role].filter((f) => !String(me[f.key] ?? "").trim())
  }, [currentUserProfile])

  const selected = entries.find((e) => e.p.id === selectedId) || null

  /* --------------------------------- Actions -------------------------------- */
  const renderActions = (entry: Entry, inDialog = false) => {
    const { p, status } = entry
    const busy = busyId === p.id
    const viewer = currentUserRole
    const nodes: ReactNode[] = []

    if (!inDialog) {
      nodes.push(
        <Button key="view" variant="outline" size="sm" className="flex-1" onClick={() => setSelectedId(p.id)}>
          View profile
        </Button>,
      )
    }

    const messageAndDisconnect = [
        <Button key="msg" asChild size="sm" className="flex-1 gap-1.5">
          <Link to={ROUTES.messages}><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />Message</Link>
        </Button>,
        <Button
          key="disc" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          aria-label={`Disconnect from ${p.full_name}`} title="Disconnect" disabled={busy}
          onClick={() => setConfirm({ entry, kind: "disconnect" })}
        >
          <UserMinus className="h-4 w-4" />
        </Button>,
    ]

    if (viewer === "founder" && p.role === "mentor" && !status) {
      nodes.push(
        <Button key="connect" size="sm" className="flex-1 gap-1.5" disabled={busy} onClick={() => handleConnectMentor(p.id, p.full_name)}>
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />{busy ? "Sending…" : "Connect"}
        </Button>,
      )
    } else if (viewer === "founder" && p.role === "investor" && !status) {
      nodes.push(
        <Button
          key="pitch" size="sm" className="flex-1 gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700" disabled={busy || !founderIdeaId}
          title={!founderIdeaId ? "Create a venture in IdeaLab first" : undefined} onClick={() => handlePitchInvestor(p.id, p.full_name)}
        >
          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />{busy ? "Sending…" : "Pitch"}
        </Button>,
      )
    } else if (viewer === "founder" && isPending(status)) {
      nodes.push(
        <Button key="withdraw" size="sm" variant="secondary" className="flex-1 gap-1.5 hover:bg-red-50 hover:text-red-600" disabled={busy} onClick={() => setConfirm({ entry, kind: "withdraw" })}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />{p.role === "mentor" ? "Cancel request" : "Withdraw pitch"}
        </Button>,
      )
    } else if (isConnected(status) && (viewer === "founder" || (p.role === "founder" && (viewer === "mentor" || viewer === "investor")))) {
      nodes.push(...messageAndDisconnect)
    } else if (viewer === "founder" && isClosed(status)) {
      nodes.push(
        <Button key="clear" size="sm" variant="outline" className="flex-1 gap-1.5 text-red-600" disabled={busy} onClick={() => setConfirm({ entry, kind: "clear" })}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />Clear
        </Button>,
      )
    } else if (viewer === "mentor" && p.role === "founder" && status === "pending") {
      nodes.push(
        <div key="resp" className="flex flex-1 gap-1.5">
          <Button size="sm" className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy} onClick={() => handleUpdateMentorStatus(p.id, "accepted")}>Accept</Button>
          <Button size="sm" variant="outline" className="flex-1 text-red-600" disabled={busy} onClick={() => handleUpdateMentorStatus(p.id, "declined")}>Decline</Button>
        </div>,
      )
    } else if ((viewer === "mentor" || viewer === "investor") && (!status || p.role !== "founder")) {
      nodes.push(<span key="scout" className="flex-1 text-center text-xs text-zinc-400">Scouting mode</span>)
    }

    return <div className="flex w-full items-center gap-2">{nodes}</div>
  }

  const confirmCopy = (c: { entry: Entry; kind: ConfirmKind }) => {
    const name = c.entry.p.full_name || "this member"
    if (c.kind === "withdraw") return { title: "Withdraw request?", body: `Your pending ${c.entry.p.role === "mentor" ? "request" : "pitch"} to ${name} will be removed. You can send a new one later.`, cta: "Withdraw" }
    if (c.kind === "clear") return { title: "Clear this response?", body: `This removes the closed entry with ${name} so you can start fresh.`, cta: "Clear" }
    return { title: `Disconnect from ${name}?`, body: "You will no longer be connected. You’d need to send a new request to reconnect.", cta: "Disconnect" }
  }

  /* ------------------------------ Filter fields ----------------------------- */
  const renderFilterFields = (prefix: string) => (
    <>
      <FilterSelect id={`${prefix}-industry`} label="Industry" value={industryFilter} onChange={setIndustryFilter} options={industryOptions} allLabel="All industries" />
      <FilterSelect id={`${prefix}-stage`} label="Stage" value={stageFilter} onChange={setStageFilter} options={stageOptions} allLabel="All stages" />
      <FilterSelect id={`${prefix}-skill`} label="Expertise" value={skillFilter} onChange={setSkillFilter} options={skillOptions} allLabel="Any expertise" />
      {tab === "discover" && (
        <FilterSelect
          id={`${prefix}-status`} label="Connection status" value={statusFilter === "all" ? "" : statusFilter}
          onChange={(v) => setStatusFilter((v || "all") as typeof statusFilter)} allLabel="Any status"
          options={[{ value: "available", label: "Not connected" }, { value: "pending", label: "Pending" }, { value: "connected", label: "Connected" }]}
        />
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-sort`} className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sort by</Label>
        <select id={`${prefix}-sort`} className={selectClass} value={sortBy} onChange={(e) => setSortBy(e.target.value as "match" | "name")}>
          <option value="match">Best match</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>
    </>
  )

  /* --------------------------------- Render --------------------------------- */
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 pb-8" role="status" aria-label="Loading network">
        <div className="space-y-2">
          <div className="h-8 w-2/3 max-w-md rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
          <div className="h-4 w-1/2 max-w-sm rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      </div>
    )
  }

  if (loadError && profiles.length === 0) {
    return (
      <div className="mx-auto w-full max-w-6xl pb-8">
        <EmptyState
          icon={AlertCircle} title="We couldn’t load the network" body={loadError}
          action={<Button onClick={retry} className="gap-1.5"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</Button>}
        />
      </div>
    )
  }

  const roleTabs: { key: "all" | Role; label: string }[] = [
    { key: "all", label: "All people" },
    { key: "mentor", label: "Mentors" },
    { key: "investor", label: "Investors" },
    { key: "founder", label: "Founders" },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      {/* Intro */}
      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">Find the right people to build with.</h1>
            <p className="mt-2 text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
              Connect with mentors, investors, and founders who can help move your startup forward.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="self-start lg:self-auto">
            <Link to={ROUTES.profile}>{missingFields.length ? "Complete your profile" : "Edit your profile"}</Link>
          </Button>
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {[["People in network", entries.length], ["Connected", connectedCount], ["Pending", pendingCount]].map(([label, n]) => (
            <div key={label as string} className="flex items-baseline gap-2">
              <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
              <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{n}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* Contextual notices (only when backed by real data) */}
      {currentUserRole === "founder" && !founderIdeaId && (
        <div className="flex flex-col gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-indigo-800 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">
          <p className="text-sm font-medium">You need an active venture profile to pitch investors.</p>
          <Button asChild size="sm" variant="secondary" className="self-start bg-white text-indigo-700 hover:bg-zinc-100 sm:self-auto">
            <Link to={ROUTES.idealab}>Create in IdeaLab</Link>
          </Button>
        </div>
      )}
      {missingFields.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
          Match insights use your profile. Add your {missingFields.map((f) => f.label).join(", ")} to get better suggestions.
        </div>
      )}
      {incomingCount > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="text-sm font-medium">{incomingCount} founder{incomingCount > 1 ? "s are" : " is"} waiting for your response.</p>
          <Button size="sm" variant="secondary" className="self-start sm:self-auto" onClick={() => { setTab("discover"); setStatusFilter("pending") }}>Review requests</Button>
        </div>
      )}

      {/* Tabs + search + filters */}
      <section aria-label="Discovery controls" className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div role="tablist" aria-label="Network view" className="inline-flex self-start rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            {([["discover", "Discover people"], ["connections", `My connections (${connectedCount})`]] as const).map(([key, label]) => (
              <button
                key={key} role="tab" type="button" aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  tab === key ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" aria-hidden="true" />
              <Label htmlFor="network-search" className="sr-only">Search people</Label>
              <Input id="network-search" type="search" placeholder="Search name, industry, skills…" className="pl-9 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 md:hidden" onClick={() => setMobileFiltersOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
            </Button>
            <Button variant="outline" size="sm" className="hidden gap-1.5 md:inline-flex" aria-expanded={showFilters} aria-controls="network-filter-panel" onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by role">
          {roleTabs.map((r) => (
            <button
              key={r.key} type="button" aria-pressed={roleFilter === r.key} onClick={() => setRoleFilter(r.key)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                roleFilter === r.key
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900",
              )}
            >
              {r.label} <span className="opacity-60">{roleCounts[r.key]}</span>
            </button>
          ))}
        </div>

        {showFilters && (
          <div id="network-filter-panel" className="hidden gap-4 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 md:grid md:grid-cols-3 lg:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-900/40">
            {renderFilterFields("d")}
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <p aria-live="polite">
            {filtered.length === entries.length || (tab === "connections" && !hasActiveFilters)
              ? `${filtered.length} ${filtered.length === 1 ? "person" : "people"}`
              : `Showing ${filtered.length} of ${tab === "connections" ? connectedCount : entries.length} people`}
          </p>
          {hasActiveFilters && <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={clearFilters}><X className="h-3 w-3" aria-hidden="true" />Clear filters</Button>}
        </div>
      </section>

      {/* Recommended */}
      {recommended.length > 0 && (
        <section aria-labelledby="recommended-heading" className="space-y-3">
          <div>
            <h2 id="recommended-heading" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Recommended for you</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Based on overlap with your profile — industry, stage, and skills.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recommended.map((e) => <ProfileCard key={`rec-${e.p.id}`} entry={e} viewerRole={currentUserRole} actions={renderActions(e)} highlight />)}
          </div>
        </section>
      )}

      {/* Directory */}
      <section aria-label="People directory" className="space-y-3">
        {recommended.length > 0 && <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Everyone</h2>}
        {filtered.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => <ProfileCard key={e.p.id} entry={e} viewerRole={currentUserRole} actions={renderActions(e)} />)}
          </div>
        ) : tab === "connections" && !hasActiveFilters ? (
          <EmptyState
            icon={Users} title="No connections yet"
            body={currentUserRole === "mentor" ? "Accepted founders will show up here." : "When a mentor accepts or an investor shows interest, they’ll show up here."}
            action={<Button size="sm" onClick={() => setTab("discover")}>Discover people</Button>}
          />
        ) : searchTerm.trim() && activeFilterCount === 0 ? (
          <EmptyState icon={Search} title={`No results for “${searchTerm.trim()}”`} body="Try a different name, industry, or skill." action={<Button size="sm" variant="outline" onClick={clearFilters}>Clear search</Button>} />
        ) : hasActiveFilters ? (
          <EmptyState icon={SlidersHorizontal} title="No people match these filters" body="Try removing a filter or widening your search." action={<Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>} />
        ) : (
          <EmptyState icon={Users} title="No other members yet" body="Once more people complete their profiles, they’ll appear here." />
        )}
      </section>

      {/* Mobile filters */}
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow down the people shown.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">{renderFilterFields("m")}</div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={clearFilters}>Clear filters</Button>
            <Button className="flex-1" onClick={() => setMobileFiltersOpen(false)}>Show {filtered.length} {filtered.length === 1 ? "person" : "people"}</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Profile dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelectedId(null) }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <PersonAvatar p={selected.p} className="h-12 w-12" />
                  <div className="min-w-0 text-left">
                    <DialogTitle className="truncate text-lg">{selected.p.full_name || "Unnamed member"}</DialogTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <RoleBadge role={selected.p.role} />
                      <StatusChip status={selected.status} viewerRole={currentUserRole} />
                    </div>
                  </div>
                </div>
                <DialogDescription className="sr-only">Profile details for {selected.p.full_name}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {selected.match && (
                  <div className="rounded-lg bg-emerald-50/70 p-3 text-sm dark:bg-emerald-950/20">
                    <p className="font-medium text-emerald-700 dark:text-emerald-400">{selected.match.score}% match with your profile</p>
                    <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{selected.match.reasons.join(" · ")}</p>
                  </div>
                )}

                {selected.p.role === "founder" && (
                  <>
                    <DetailField label="Elevator pitch">{selected.p.idea?.elevator_pitch || selected.p.idea?.solution || "No pitch details provided yet."}</DetailField>
                    <DetailField label="Problem being solved">{selected.p.idea?.problem || "Not specified."}</DetailField>
                    {(currentUserRole === "investor" || currentUserRole === "mentor") && selected.p.idea?.id && (
                      <Link to={ROUTES.pitch(selected.p.idea.id)} className="inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        View full pitch (if shared with you)
                      </Link>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailField label="Target market">{selected.p.idea?.target_market || selected.p.idea?.market || "General"}</DetailField>
                      <DetailField label="Tech stack">{selected.p.idea?.tech_stack || selected.p.skills || "Unspecified"}</DetailField>
                    </div>
                    {(selected.p.industry || selected.p.startup_stage) && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {selected.p.industry && <DetailField label="Industry">{selected.p.industry}</DetailField>}
                        {selected.p.startup_stage && <DetailField label="Stage">{selected.p.startup_stage}</DetailField>}
                      </div>
                    )}
                  </>
                )}

                {selected.p.role === "mentor" && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailField label="Industry">{selected.p.industry || "General Strategy"}</DetailField>
                      <DetailField label="Experience">{selected.p.experience_years ? `${selected.p.experience_years}+ Years` : "Unlisted"}</DetailField>
                    </div>
                    <DetailField label="Core skills & expertise">{selected.p.skills || "No specific skills highlighted yet."}</DetailField>
                  </>
                )}

                {selected.p.role === "investor" && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailField label="Target stage">{selected.p.investment_stage || "All Stages"}</DetailField>
                      <DetailField label="Firm">{selected.p.firm_name || "Independent"}</DetailField>
                    </div>
                    <DetailField label="Investment thesis">{selected.p.thesis || "No specific investment thesis provided yet."}</DetailField>
                  </>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button variant="outline" size="sm" onClick={() => setSelectedId(null)}>Close</Button>
                <div className="sm:min-w-[14rem]">{renderActions(selected, true)}</div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Destructive-action confirmation */}
      <Dialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null) }}>
        <DialogContent className="max-w-md">
          {confirm && (() => {
            const copy = confirmCopy(confirm)
            const busy = busyId === confirm.entry.p.id
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{copy.title}</DialogTitle>
                  <DialogDescription>{copy.body}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>Keep</Button>
                  <Button
                    className="bg-red-600 text-white hover:bg-red-700" disabled={busy}
                    onClick={async () => {
                      await handleRemoveConnection(confirm.entry.p.id, confirm.entry.p.role)
                      setConfirm(null)
                    }}
                  >
                    {busy ? "Working…" : copy.cta}
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}