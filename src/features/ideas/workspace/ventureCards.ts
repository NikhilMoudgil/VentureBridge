/**
 * Data for the My Ventures page: one card per venture, with the same progress numbers the workspace shows.
 * Works before the database upgrade too (the extra tables just come back empty).
 */
import { computeScorecard, deriveStatus, nextAction, type Indicator } from "./scorecard"
import type { Blueprint, Competitor, HypothesisLite, MarketAssumption, Milestone, PitchSettings, Risk, VentureSnapshot, WorkspaceStatus } from "./types"
import { mapHypothesis, mapIdea, type Db } from "./ventureRepo"

export type VentureCard = {
  id: string
  idea: VentureSnapshot["idea"]
  createdAt: string | null
  status: WorkspaceStatus
  completion: number
  indicators: Pick<Indicator, "id" | "label" | "score">[]
  next: string
  counts: { hypotheses: number; experiments: number; risks: number; competitors: number; milestones: number }
  shared: boolean
  sharedAt: string | null
}

type Row = Record<string, unknown>
export type CardRows = {
  ideas: Row[]
  workspaces: Row[]
  competitors: Row[]
  market: Row[]
  risks: Row[]
  milestones: Row[]
  hypotheses: Row[]
  shares: Row[]
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const forIdea = (rows: Row[], id: string) => rows.filter(r => String(r.idea_id) === id)

export function buildCards(rows: CardRows): VentureCard[] {
  return rows.ideas.map(r => {
    const id = String(r.id)
    const ws = forIdea(rows.workspaces, id)[0]
    const idea = mapIdea(r, {
      blueprint: (ws && isObj(ws.blueprint) ? ws.blueprint : {}) as Blueprint,
      pitch_settings: (ws && isObj(ws.pitch_settings) ? ws.pitch_settings : {}) as PitchSettings,
    })
    const hyps = forIdea(rows.hypotheses, id)
    const hypLite: HypothesisLite[] = hyps.map(h => mapHypothesis(h as Parameters<typeof mapHypothesis>[0]))
    const experiments = hypLite.reduce((n, h) => n + h.experimentCount, 0)
    const snapshot: VentureSnapshot = {
      idea,
      competitors: forIdea(rows.competitors, id) as unknown as Competitor[],
      market: forIdea(rows.market, id) as unknown as MarketAssumption[],
      risks: forIdea(rows.risks, id) as unknown as Risk[],
      milestones: forIdea(rows.milestones, id) as unknown as Milestone[],
      hypotheses: hypLite,
    }
    const sc = computeScorecard(snapshot)
    const share = forIdea(rows.shares, id)[0]
    return {
      id, idea,
      createdAt: (r.created_at as string | null) ?? null,
      status: deriveStatus(snapshot, sc),
      completion: sc.completion,
      indicators: sc.indicators.map(i => ({ id: i.id, label: i.label, score: i.score })),
      next: nextAction(snapshot, sc).text,
      counts: {
        hypotheses: hypLite.length, experiments, risks: snapshot.risks.length,
        competitors: snapshot.competitors.length, milestones: snapshot.milestones.length,
      },
      shared: !!share,
      sharedAt: share ? ((share.updated_at as string | null) ?? null) : null,
    }
  })
}

/** Child lookups never throw: a missing table (database upgrade not applied) just means "nothing there yet". */
async function soft(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  try {
    const res = await q
    return res.error ? [] : ((res.data ?? []) as unknown as Row[])
  } catch { return [] }
}

export async function loadVentureCards(sb: Db, userId: string): Promise<VentureCard[]> {
  const ideasRes = await sb.from("ideas").select("*").or(`id.eq.${userId},owner_id.eq.${userId}`).order("created_at", { ascending: false })
  if (ideasRes.error) throw new Error(ideasRes.error.message || "Could not load your ventures.")
  const ideas = (ideasRes.data ?? []) as unknown as Row[]
  if (ideas.length === 0) return []
  const ids = ideas.map(i => String(i.id))
  const by = (table: string, cols = "*") => sb.from(table).select(cols).in("idea_id", ids)

  const [workspaces, competitors, market, risks, milestones, shares, hyps] = await Promise.all([
    soft(by("idea_workspace", "idea_id, blueprint, pitch_settings")),
    soft(by("idea_competitors")), soft(by("idea_market_assumptions")), soft(by("idea_risks")), soft(by("idea_milestones")),
    soft(by("idea_pitch_shares", "idea_id, updated_at")),
    (async () => {
      const full = await soft(by("hypotheses", "id, idea_id, title, statement, status, success_metric, success_threshold, experiments(id)"))
      return full.length ? full : soft(by("hypotheses", "id, idea_id, title, statement, status, experiments(id)"))
    })(),
  ])
  return buildCards({ ideas, workspaces, competitors, market, risks, milestones, hypotheses: hyps, shares })
}
