/**
 * Data layer for the IdeaLab workspace. No React. Every function takes the Supabase client as its
 * first argument so it can be tested with an in-memory fake (see ventureRepo.test.ts).
 *
 * Conventions:
 *  - Errors are thrown as MissingSchemaError (migration not applied), ConflictError (someone else
 *    changed the row) or a plain Error with the database message.
 *  - Optimistic concurrency: `ideas.row_version` and `idea_workspace.row_version`. A write that
 *    matches zero rows is reported as a ConflictError. (A row hidden by RLS also matches zero rows;
 *    the message says "changed elsewhere or no longer yours" for that reason.)
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  Blueprint, Competitor, HypothesisLite, Idea, MarketAssumption, Milestone,
  PitchSettings, Risk, StartupStage,
} from "./types"

export type Db = SupabaseClient

export class MissingSchemaError extends Error {
  constructor() {
    super("The IdeaLab database upgrade has not been applied to this project yet.")
    this.name = "MissingSchemaError"
  }
}
export class ConflictError extends Error {
  constructor(message = "This venture was changed elsewhere (or is no longer yours).") {
    super(message)
    this.name = "ConflictError"
  }
}

type PgErr = { code?: string; message?: string } | null | undefined

/** 42703 undefined column, 42P01 undefined table; PGRST200/204/205 = PostgREST schema-cache misses. */
const MISSING_CODES = new Set(["42703", "42P01", "PGRST200", "PGRST204", "PGRST205"])

export function isMissingSchema(err: PgErr): boolean {
  if (!err) return false
  if (err.code && MISSING_CODES.has(err.code)) return true
  return /column .* does not exist|relation .* does not exist|schema cache/i.test(err.message ?? "")
}

export function throwIf(err: PgErr): void {
  if (!err) return
  if (isMissingSchema(err)) throw new MissingSchemaError()
  throw new Error(err.message || "Database error")
}

export const STARTUP_STAGES: StartupStage[] =
  ["idea", "research", "prototype", "mvp", "early_traction", "growth"]

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------
export type HypothesisDetail = HypothesisLite & {
  title: string
  statement: string
  target_audience: string | null
  expected_outcome: string | null
  test_method: string | null
  time_window: string | null
  conclusion: string | null
}

export type VentureData = {
  /** `blueprint` and `pitch_settings` are merged in from the owner-only idea_workspace table. */
  idea: Idea
  /** null = no idea_workspace row exists yet (first save inserts it). */
  workspaceVersion: number | null
  competitors: Competitor[]
  market: MarketAssumption[]
  risks: Risk[]
  milestones: Milestone[]
  hypotheses: HypothesisDetail[]
  notes: string
}

export type VentureSummary = {
  id: string
  name: string | null
  tagline: string | null
  problem: string | null
  solution: string | null
  market: string | null
  target_market: string | null
  startup_stage: StartupStage | null
  health_score: number | null
  updated_at: string | null
  created_at: string | null
}

const IDEA_COLS =
  "id, owner_id, name, tagline, problem, solution, market, target_market, tech_stack, " +
  "elevator_pitch, industry, startup_stage, business_model, geographic_focus, " +
  "pitch_ready_confirmed, health_score, row_version, updated_at"

const SUMMARY_COLS =
  "id, name, tagline, problem, solution, market, target_market, startup_stage, health_score, updated_at, created_at"
const LEGACY_SUMMARY_COLS =
  "id, problem, solution, market, target_market, health_score, updated_at, created_at"

const HYP_COLS =
  "id, title, statement, status, target_audience, expected_outcome, success_metric, " +
  "success_threshold, test_method, time_window, conclusion, created_at, experiments(id)"

// ---------------------------------------------------------------------------------------------
// Normalisation helpers (pure, exported for tests)
// ---------------------------------------------------------------------------------------------
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const IDEA_EDITABLE = [
  "name", "tagline", "problem", "solution", "market", "tech_stack", "elevator_pitch",
  "industry", "startup_stage", "business_model", "geographic_focus",
  "pitch_ready_confirmed",
] as const
export type IdeaPatch = Partial<Pick<Idea, (typeof IDEA_EDITABLE)[number]>>

const NULLABLE_TEXT = new Set(["name", "tagline", "industry", "business_model", "geographic_focus"])

/** Whitelists editable columns, mirrors market -> target_market, and turns blanks into NULL where the DB needs it. */
export function toIdeaRow(patch: IdeaPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const key of IDEA_EDITABLE) {
    if (!(key in patch)) continue
    const v = (patch as Record<string, unknown>)[key]
    if (key === "startup_stage") {
      row[key] = typeof v === "string" && (STARTUP_STAGES as string[]).includes(v) ? v : null
    } else if (key === "pitch_ready_confirmed") {
      row[key] = Boolean(v)
    } else if (NULLABLE_TEXT.has(key)) {
      row[key] = typeof v === "string" && v.trim() === "" ? null : v
    } else {
      row[key] = v ?? ""
    }
  }
  if ("market" in row) row.target_market = row.market // IdeaLab has always kept both in sync
  return row
}

/** Postgres rejects '' for date columns; turn blank dates into NULL. */
export function cleanDates<T extends Record<string, unknown>>(patch: T): T {
  const out: Record<string, unknown> = { ...patch }
  for (const k of Object.keys(out)) if (k.endsWith("_date") && out[k] === "") out[k] = null
  return out as T
}

type RawHyp = Record<string, unknown> & { experiments?: unknown[] | null }
export function mapHypothesis(r: RawHyp): HypothesisDetail {
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    statement: String(r.statement ?? ""),
    status: (r.status as HypothesisDetail["status"]) ?? "testing",
    success_metric: (r.success_metric as string | null) ?? null,
    success_threshold: (r.success_threshold as string | null) ?? null,
    experimentCount: Array.isArray(r.experiments) ? r.experiments.length : 0,
    target_audience: (r.target_audience as string | null) ?? null,
    expected_outcome: (r.expected_outcome as string | null) ?? null,
    test_method: (r.test_method as string | null) ?? null,
    time_window: (r.time_window as string | null) ?? null,
    conclusion: (r.conclusion as string | null) ?? null,
  }
}

export function mapIdea(r: Record<string, unknown>, ws: { blueprint: Blueprint; pitch_settings: PitchSettings }): Idea {
  return {
    id: String(r.id),
    name: (r.name as string | null) ?? null,
    tagline: (r.tagline as string | null) ?? null,
    problem: (r.problem as string | null) ?? null,
    solution: (r.solution as string | null) ?? null,
    market: (r.market as string | null) ?? (r.target_market as string | null) ?? null,
    target_market: (r.target_market as string | null) ?? null,
    tech_stack: (r.tech_stack as string | null) ?? null,
    elevator_pitch: (r.elevator_pitch as string | null) ?? null,
    industry: (r.industry as string | null) ?? null,
    startup_stage: (r.startup_stage as StartupStage | null) ?? null,
    business_model: (r.business_model as string | null) ?? null,
    geographic_focus: (r.geographic_focus as string | null) ?? null,
    // Funding ask comes from the owner-only workspace document, never from the readable `ideas` row.
    funding_goal: (() => { const n = numOrNull(ws.blueprint.funding?.goal); return n !== null && n >= 0 ? n : null })(),
    use_of_funds: ws.blueprint.funding?.useOfFunds?.trim() ? ws.blueprint.funding.useOfFunds : null,
    pitch_ready_confirmed: Boolean(r.pitch_ready_confirmed),
    blueprint: ws.blueprint,
    pitch_settings: ws.pitch_settings,
    health_score: numOrNull(r.health_score),
    row_version: Number(r.row_version ?? 1),
    updated_at: (r.updated_at as string | null) ?? null,
  }
}

// ---------------------------------------------------------------------------------------------
// Ventures
// ---------------------------------------------------------------------------------------------
export async function listVentures(sb: Db, ownerId: string): Promise<VentureSummary[]> {
  let res: { data: unknown; error: PgErr } = await sb.from("ideas").select(SUMMARY_COLS).eq("owner_id", ownerId).order("updated_at", { ascending: false })
  if (res.error && isMissingSchema(res.error)) {
    // Database upgrade not applied yet: keep pages that only list ventures working.
    res = await sb.from("ideas").select(LEGACY_SUMMARY_COLS).eq("owner_id", ownerId).order("updated_at", { ascending: false })
  }
  throwIf(res.error)
  return ((res.data ?? []) as unknown as Record<string, unknown>[]).map(r => ({
    id: String(r.id),
    name: (r.name as string | null) ?? null,
    tagline: (r.tagline as string | null) ?? null,
    problem: (r.problem as string | null) ?? null,
    solution: (r.solution as string | null) ?? null,
    market: (r.market as string | null) ?? null,
    target_market: (r.target_market as string | null) ?? null,
    startup_stage: (r.startup_stage as StartupStage | null) ?? null,
    health_score: numOrNull(r.health_score),
    updated_at: (r.updated_at as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
  }))
}

/**
 * Idempotent create. `clientKey` must be generated once per "new venture" form: a double click or a
 * network retry sends the same key, hits the unique index (owner_id, created_by_client_key) and returns
 * the venture that already exists instead of creating a second one.
 */
export async function createVenture(
  sb: Db, ownerId: string, clientKey: string, init: { name?: string; tagline?: string },
): Promise<string> {
  const row = {
    owner_id: ownerId,
    created_by_client_key: clientKey,
    name: init.name?.trim() || null,
    tagline: init.tagline?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  const ins = await sb.from("ideas").insert(row).select("id").single()
  if (!ins.error && ins.data) return String((ins.data as unknown as { id: string }).id)
  if (ins.error?.code === "23505") {
    const existing = await sb.from("ideas").select("id")
      .eq("owner_id", ownerId).eq("created_by_client_key", clientKey).maybeSingle()
    if (existing.data) return String((existing.data as unknown as { id: string }).id)
  }
  throwIf(ins.error)
  throw new Error("Could not create the venture.")
}

/** Returns null when the idea does not exist OR is not owned by `ownerId` (other members can read it via RLS). */
export async function loadVenture(sb: Db, ideaId: string, ownerId: string): Promise<VentureData | null> {
  const ideaQ = await sb.from("ideas").select(IDEA_COLS).eq("id", ideaId).eq("owner_id", ownerId).maybeSingle()
  throwIf(ideaQ.error)
  if (!ideaQ.data) return null

  const [ws, comps, mkt, risks, ms, hyps, notes] = await Promise.all([
    sb.from("idea_workspace").select("blueprint, pitch_settings, row_version").eq("idea_id", ideaId).maybeSingle(),
    sb.from("idea_competitors").select("*").eq("idea_id", ideaId).order("created_at", { ascending: true }),
    sb.from("idea_market_assumptions").select("*").eq("idea_id", ideaId),
    sb.from("idea_risks").select("*").eq("idea_id", ideaId).order("created_at", { ascending: true }),
    sb.from("idea_milestones").select("*").eq("idea_id", ideaId).order("sort_order", { ascending: true }),
    sb.from("hypotheses").select(HYP_COLS).eq("idea_id", ideaId).order("created_at", { ascending: false }),
    sb.from("idea_private_notes").select("notes").eq("idea_id", ideaId).maybeSingle(),
  ])
  for (const r of [ws, comps, mkt, risks, ms, hyps, notes]) throwIf(r.error)

  const wsRow = ws.data as unknown as { blueprint?: unknown; pitch_settings?: unknown; row_version?: number } | null
  const blueprint = (wsRow && isObj(wsRow.blueprint) ? wsRow.blueprint : {}) as Blueprint
  const pitch_settings = (wsRow && isObj(wsRow.pitch_settings) ? wsRow.pitch_settings : {}) as PitchSettings

  return {
    idea: mapIdea(ideaQ.data as unknown as Record<string, unknown>, { blueprint, pitch_settings }),
    workspaceVersion: wsRow ? Number(wsRow.row_version ?? 1) : null,
    competitors: (comps.data ?? []) as unknown as Competitor[],
    market: ((mkt.data ?? []) as unknown as Record<string, unknown>[]).map(m => ({
      tier: m.tier as MarketAssumption["tier"],
      customer_count: numOrNull(m.customer_count),
      annual_spend_per_customer: numOrNull(m.annual_spend_per_customer),
      basis: (m.basis as string | null) ?? null,
      source_url: (m.source_url as string | null) ?? null,
      source_date: (m.source_date as string | null) ?? null,
      evidence_status: m.evidence_status as MarketAssumption["evidence_status"],
    })),
    risks: (risks.data ?? []) as unknown as Risk[],
    milestones: (ms.data ?? []) as unknown as Milestone[],
    hypotheses: ((hyps.data ?? []) as unknown as RawHyp[]).map(mapHypothesis),
    notes: ((notes.data as unknown as { notes?: string } | null)?.notes) ?? "",
  }
}

/** Current versions only; used to resolve a conflict by "overwrite". */
export async function fetchVersions(sb: Db, ideaId: string): Promise<{ idea: number; ws: number | null }> {
  const [i, w] = await Promise.all([
    sb.from("ideas").select("row_version").eq("id", ideaId).maybeSingle(),
    sb.from("idea_workspace").select("row_version").eq("idea_id", ideaId).maybeSingle(),
  ])
  throwIf(i.error); throwIf(w.error)
  if (!i.data) throw new ConflictError("This venture no longer exists.")
  return {
    idea: Number((i.data as unknown as { row_version: number }).row_version),
    ws: w.data ? Number((w.data as unknown as { row_version: number }).row_version) : null,
  }
}

// ---------------------------------------------------------------------------------------------
// Versioned saves
// ---------------------------------------------------------------------------------------------
export async function saveIdea(sb: Db, ideaId: string, expectedVersion: number, patch: IdeaPatch): Promise<number> {
  const row = toIdeaRow(patch)
  if (Object.keys(row).length === 0) return expectedVersion
  const res = await sb.from("ideas").update(row).eq("id", ideaId).eq("row_version", expectedVersion).select("row_version")
  throwIf(res.error)
  const rows = (res.data ?? []) as unknown as { row_version: number }[]
  if (rows.length === 0) throw new ConflictError()
  return Number(rows[0].row_version)
}

export async function saveWorkspace(
  sb: Db, ideaId: string, expectedVersion: number | null, blueprint: Blueprint, pitchSettings: PitchSettings,
): Promise<number> {
  if (expectedVersion === null) {
    const ins = await sb.from("idea_workspace")
      .insert({ idea_id: ideaId, blueprint, pitch_settings: pitchSettings }).select("row_version").single()
    if (ins.error?.code === "23505") throw new ConflictError() // another tab created it first
    throwIf(ins.error)
    return Number((ins.data as unknown as { row_version: number }).row_version)
  }
  const res = await sb.from("idea_workspace")
    .update({ blueprint, pitch_settings: pitchSettings })
    .eq("idea_id", ideaId).eq("row_version", expectedVersion).select("row_version")
  throwIf(res.error)
  const rows = (res.data ?? []) as unknown as { row_version: number }[]
  if (rows.length === 0) throw new ConflictError()
  return Number(rows[0].row_version)
}

// ---------------------------------------------------------------------------------------------
// Child tables (owner-only via RLS)
// ---------------------------------------------------------------------------------------------
export type ChildTable = "idea_competitors" | "idea_risks" | "idea_milestones"

export async function insertChild<T>(sb: Db, table: ChildTable, row: Record<string, unknown>): Promise<T> {
  const res = await sb.from(table).insert(cleanDates(row)).select("*").single()
  throwIf(res.error)
  return res.data as unknown as T
}

export async function updateChild<T>(sb: Db, table: ChildTable, id: string, patch: Record<string, unknown>): Promise<T> {
  const res = await sb.from(table).update(cleanDates(patch)).eq("id", id).select("*").single()
  throwIf(res.error)
  return res.data as unknown as T
}

export async function deleteChild(sb: Db, table: ChildTable, id: string): Promise<void> {
  const res = await sb.from(table).delete().eq("id", id)
  throwIf(res.error)
}

export async function saveMarketTier(sb: Db, ideaId: string, m: MarketAssumption): Promise<MarketAssumption> {
  const row = cleanDates({
    idea_id: ideaId, tier: m.tier,
    customer_count: m.customer_count, annual_spend_per_customer: m.annual_spend_per_customer,
    basis: m.basis ?? null, source_url: m.source_url ?? null, source_date: m.source_date ?? null,
    evidence_status: m.evidence_status,
  })
  const res = await sb.from("idea_market_assumptions").upsert(row, { onConflict: "idea_id,tier" }).select("*").single()
  throwIf(res.error)
  const r = res.data as unknown as Record<string, unknown>
  return {
    tier: r.tier as MarketAssumption["tier"],
    customer_count: numOrNull(r.customer_count),
    annual_spend_per_customer: numOrNull(r.annual_spend_per_customer),
    basis: (r.basis as string | null) ?? null,
    source_url: (r.source_url as string | null) ?? null,
    source_date: (r.source_date as string | null) ?? null,
    evidence_status: r.evidence_status as MarketAssumption["evidence_status"],
  }
}

export async function saveNotes(sb: Db, ideaId: string, notes: string): Promise<void> {
  const res = await sb.from("idea_private_notes").upsert({ idea_id: ideaId, notes }, { onConflict: "idea_id" })
  throwIf(res.error)
}

export type NewHypothesis = {
  title: string; statement: string
  success_metric?: string; success_threshold?: string; test_method?: string
  target_audience?: string; time_window?: string
}

/** Creates a hypothesis and links the risk to it. If linking fails the new hypothesis is removed again. */
export async function createHypothesisFromRisk(
  sb: Db, ideaId: string, riskId: string, h: NewHypothesis,
): Promise<{ hypothesis: HypothesisDetail; risk: Risk }> {
  const clean = (s?: string) => (s && s.trim() ? s.trim() : null)
  const ins = await sb.from("hypotheses").insert({
    idea_id: ideaId, title: h.title.trim(), statement: h.statement.trim(), status: "testing",
    success_metric: clean(h.success_metric), success_threshold: clean(h.success_threshold),
    test_method: clean(h.test_method), target_audience: clean(h.target_audience), time_window: clean(h.time_window),
  }).select(HYP_COLS).single()
  throwIf(ins.error)
  const hypothesis = mapHypothesis(ins.data as unknown as RawHyp)

  const link = await sb.from("idea_risks").update({ hypothesis_id: hypothesis.id }).eq("id", riskId).select("*").single()
  if (link.error) {
    await sb.from("hypotheses").delete().eq("id", hypothesis.id) // do not leave an orphan behind
    throwIf(link.error)
  }
  return { hypothesis, risk: link.data as unknown as Risk }
}
