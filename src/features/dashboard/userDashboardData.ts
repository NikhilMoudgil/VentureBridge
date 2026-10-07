import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"

const supabase = createClient()

export type Role = "founder" | "mentor" | "investor"
export type Person = { id: string; full_name: string | null; industry: string | null }
export type MentorMatch = { person: Person; score: number }
export type PendingRequest = { founder: Person; requestedAt: string | null }
export type DealItem = {
  id: string
  status: string // submitted | reviewing | interested | passed
  createdAt: string | null
  founder: Person | null
  pitch: string | null
}
export type Activity = { id: string; from: string; content: string; created_at: string }

export type DashboardData = {
  loading: boolean
  role: Role | null
  userId: string
  name: string
  isVerified: boolean
  // profile
  profileStrength: number
  missingFields: string[]
  profileSummary: string
  // founder
  ideasCount: number
  healthScore: number
  hypothesesTotal: number
  hypothesesValidated: number
  suggestions: MentorMatch[]
  // shared between founder / mentor
  acceptedConnections: number
  pendingRequests: number
  // mentor
  pendingList: PendingRequest[]
  // founder + investor
  dealsTotal: number
  dealsInterested: number
  deals: DealItem[]
  // everyone
  activity: Activity[]
  refresh: () => void
}

const EMPTY: DashboardData = {
  loading: true,
  role: null,
  userId: "",
  name: "there",
  isVerified: true,
  profileStrength: 0,
  missingFields: [],
  profileSummary: "",
  ideasCount: 0,
  healthScore: 0,
  hypothesesTotal: 0,
  hypothesesValidated: 0,
  suggestions: [],
  acceptedConnections: 0,
  pendingRequests: 0,
  pendingList: [],
  dealsTotal: 0,
  dealsInterested: 0,
  deals: [],
  activity: [],
  refresh: () => {},
}

/**
 * The fields each role can actually fill in on Profile Settings.
 * (firm_name is optional there, so it isn't scored.)
 */
const PROFILE_FIELDS: Record<Role, { key: string; label: string }[]> = {
  founder: [
    { key: "full_name", label: "name" },
    { key: "industry", label: "industry" },
    { key: "startup_stage", label: "startup stage" },
    { key: "funding_goal", label: "funding goal" },
    { key: "skills", label: "skills" },
  ],
  mentor: [
    { key: "full_name", label: "name" },
    { key: "industry", label: "industry" },
    { key: "experience_years", label: "years of experience" },
    { key: "skills", label: "skills" },
  ],
  investor: [
    { key: "full_name", label: "name" },
    { key: "investment_stage", label: "target stage" },
    { key: "thesis", label: "investment thesis" },
  ],
}

const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === 0 || (typeof v === "string" && v.trim() === "")

function scoreProfile(role: Role, row: Record<string, any> | null) {
  const fields = PROFILE_FIELDS[role]
  const missing = fields.filter((f) => isEmpty(row?.[f.key]))
  const strength = row ? Math.round(((fields.length - missing.length) / fields.length) * 100) : 0
  return { strength, missing: missing.map((f) => f.label) }
}

/** Same formula as calculateMatchScore in NetworkDiscovery, so the numbers agree across pages. */
function matchScore(me: Record<string, any> | null, target: Record<string, any>) {
  if (!me) return 50
  let score = 40
  if (
    me.industry &&
    target.industry &&
    String(me.industry).trim().toLowerCase() === String(target.industry).trim().toLowerCase()
  ) {
    score += 30
  }
  if (me.skills && target.skills) {
    const mine = String(me.skills).toLowerCase().split(",").map((s) => s.trim())
    const theirs = String(target.skills).toLowerCase().split(",").map((s) => s.trim())
    const shared = mine.filter((s) => theirs.includes(s))
    if (shared.length > 0) score += Math.min(30, shared.length * 15)
  }
  return Math.min(100, Math.max(35, score))
}

// Supabase returns a joined row as an object or a one-item array depending on the relation
const one = (v: any) => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export function useDashboardData(): DashboardData {
  const { user } = useAuth()
  const uid = user?.id
  const fallbackName = String(user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there")
  const [data, setData] = useState<DashboardData>(EMPTY)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!uid) return
    let cancelled = false

    async function load(id: string) {
      try {
        const { data: u } = await supabase.from("users").select("role").eq("id", id).maybeSingle()
        const role = u?.role as Role | undefined
        if (!role) {
          if (!cancelled) setData({ ...EMPTY, loading: false })
          return
        }

        const [profileRes, msgRes] = await Promise.all([
          supabase.from(`${role}s`).select("*").eq("id", id).maybeSingle(),
          supabase
            .from("messages")
            .select("id, sender_id, content, created_at")
            .eq("receiver_id", id)
            .order("created_at", { ascending: false })
            .limit(4),
        ])

        const profile = profileRes.data as Record<string, any> | null
        const next: DashboardData = { ...EMPTY, role, loading: false }
        const { strength, missing } = scoreProfile(role, profile)
        next.profileStrength = strength
        next.missingFields = missing
        next.name = String(profile?.full_name || fallbackName).split(" ")[0]

        if (role === "founder") {
          const [ideas, conns, deals, mentors] = await Promise.all([
            supabase
              .from("ideas")
              .select("id, health_score, hypotheses(status)")
              .or(`id.eq.${id},owner_id.eq.${id}`),
            supabase.from("connections").select("status, mentor_id").eq("founder_id", id),
            supabase.from("deal_flow").select("status").eq("founder_id", id),
            supabase.from("mentors").select("id, full_name, industry, skills").eq("is_verified", true),
          ])

          const ideaRows: any[] = ideas.data ?? []
          const hyps = ideaRows.flatMap((i) => i.hypotheses ?? [])
          next.ideasCount = ideaRows.length
          next.healthScore = Math.max(0, ...ideaRows.map((i) => i.health_score ?? 0))
          next.hypothesesTotal = hyps.length
          next.hypothesesValidated = hyps.filter((h: any) => h.status === "validated").length

          const connRows: any[] = conns.data ?? []
          const touched = new Set(connRows.map((r) => r.mentor_id))
          next.acceptedConnections = connRows.filter((r) => r.status === "accepted").length
          next.pendingRequests = connRows.filter((r) => r.status === "pending").length

          const dealRows: any[] = deals.data ?? []
          next.dealsTotal = dealRows.length
          next.dealsInterested = dealRows.filter((r) => r.status === "interested").length

          next.suggestions = ((mentors.data ?? []) as any[])
            .filter((m) => !touched.has(m.id))
            .map((m) => ({
              person: { id: m.id, full_name: m.full_name, industry: m.industry },
              score: matchScore(profile, m),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 4)
        }

        if (role === "mentor") {
          const { data: conns } = await supabase
            .from("connections")
            .select("status, created_at, founders:founder_id(id, full_name, industry)")
            .eq("mentor_id", id)
          const rows: any[] = conns ?? []
          next.isVerified = profile?.is_verified ?? false
          next.acceptedConnections = rows.filter((r) => r.status === "accepted").length
          const pending = rows.filter((r) => r.status === "pending")
          next.pendingRequests = pending.length
          next.pendingList = pending
            .map((r) => ({ founder: one(r.founders) as Person | null, requestedAt: r.created_at as string | null }))
            .filter((r): r is PendingRequest => r.founder !== null)
            .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""))
        }

        if (role === "investor") {
          const { data: deals } = await supabase
            .from("deal_flow")
            .select("id, status, created_at, founders(id, full_name, industry), ideas(elevator_pitch)")
            .eq("investor_id", id)
            .order("created_at", { ascending: false })
          const rows: any[] = deals ?? []
          next.deals = rows.map((r) => ({
            id: r.id,
            status: r.status,
            createdAt: r.created_at,
            founder: one(r.founders),
            pitch: one(r.ideas)?.elevator_pitch ?? null,
          }))
          next.dealsTotal = rows.length
          next.dealsInterested = rows.filter((r) => r.status === "interested").length
          next.profileSummary = [profile?.firm_name, profile?.investment_stage].filter(Boolean).join(", ")
        }

        // Sender names: one lookup against users (messages.sender_id references users.id)
        const msgs: any[] = msgRes.data ?? []
        const senderIds = Array.from(new Set(msgs.map((m) => m.sender_id)))
        const names: Record<string, string> = {}
        if (senderIds.length) {
          const { data: senders } = await supabase.from("users").select("id, full_name").in("id", senderIds)
          ;(senders ?? []).forEach((s: any) => (names[s.id] = s.full_name))
        }
        next.activity = msgs.map((m) => ({
          id: m.id,
          from: names[m.sender_id] || "Member",
          content: m.content ?? "",
          created_at: m.created_at,
        }))

        if (!cancelled) setData(next)
      } catch {
        if (!cancelled) setData({ ...EMPTY, loading: false })
      }
    }

    load(uid)
    return () => {
      cancelled = true
    }
  }, [uid, fallbackName, tick])

  return { ...data, userId: uid ?? "", refresh }
}
