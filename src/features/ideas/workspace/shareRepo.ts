/**
 * Pitch sharing. A founder publishes a frozen "snapshot" of the pitch sections they chose; mentors and
 * investors read it on a separate page. Pure helpers (build/parse) plus thin database calls.
 * Who may read a snapshot is decided by the database (see 20261011000000_idealab_pitch_shares.sql).
 */
import type { Evidence, ResolvedSection } from "./pitch"
import { throwIf, type Db } from "./ventureRepo"

export type SharedSection = { id: string; title: string; text: string; evidence: Evidence; note?: string; overridden: boolean }

export type PitchSnapshot = {
  version: 1
  name: string | null
  tagline: string | null
  industry: string | null
  stage: string | null
  sections: SharedSection[]
}

export type SharedPitch = { ideaId: string; ownerId: string; snapshot: PitchSnapshot; publishedAt: string | null; updatedAt: string | null }

const EVIDENCE: Evidence[] = ["founder", "calculated", "experiment", "assumption", "missing"]
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null)

/** Only sections the founder ticked AND that have text are shared. Gaps are not published. */
export function buildSnapshot(
  meta: { name?: string | null; tagline?: string | null; industry?: string | null; stage?: string | null },
  resolved: ResolvedSection[],
): PitchSnapshot {
  return {
    version: 1,
    name: str(meta.name)?.trim() ?? null,
    tagline: str(meta.tagline)?.trim() ?? null,
    industry: str(meta.industry)?.trim() ?? null,
    stage: str(meta.stage),
    sections: resolved.filter(s => s.included && s.text.trim()).map(s => ({
      id: s.id, title: s.title, text: s.text.trim(), evidence: s.evidence,
      ...(s.note && s.evidence !== "missing" ? { note: s.note } : {}), overridden: s.overridden,
    })),
  }
}

/** The database column is free-form JSON, so never trust its shape. */
export function parseSnapshot(raw: unknown): PitchSnapshot {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>
  const list = Array.isArray(o.sections) ? o.sections : []
  const sections: SharedSection[] = []
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue
    const s = item as Record<string, unknown>
    const text = str(s.text), title = str(s.title), id = str(s.id)
    if (!text || !title || !id) continue
    sections.push({
      id, title, text,
      evidence: EVIDENCE.includes(s.evidence as Evidence) ? (s.evidence as Evidence) : "founder",
      ...(str(s.note) ? { note: str(s.note) as string } : {}),
      overridden: s.overridden === true,
    })
  }
  return { version: 1, name: str(o.name), tagline: str(o.tagline), industry: str(o.industry), stage: str(o.stage), sections }
}

/** True when the founder's current choices differ from what is published. */
export const snapshotsDiffer = (a: PitchSnapshot, b: PitchSnapshot) => JSON.stringify(a) !== JSON.stringify(b)

type Row = { idea_id: string; owner_id: string; snapshot: unknown; published_at: string | null; updated_at: string | null }
const toShared = (r: Row): SharedPitch => ({
  ideaId: String(r.idea_id), ownerId: String(r.owner_id), snapshot: parseSnapshot(r.snapshot),
  publishedAt: r.published_at ?? null, updatedAt: r.updated_at ?? null,
})

/** Null when nothing is published OR the caller is not allowed to see it (the database does not say which). */
export async function getSharedPitch(sb: Db, ideaId: string): Promise<SharedPitch | null> {
  const res = await sb.from("idea_pitch_shares")
    .select("idea_id, owner_id, snapshot, published_at, updated_at").eq("idea_id", ideaId).maybeSingle()
  throwIf(res.error)
  return res.data ? toShared(res.data as unknown as Row) : null
}

export async function publishPitch(sb: Db, ownerId: string, ideaId: string, snapshot: PitchSnapshot): Promise<SharedPitch> {
  const res = await sb.from("idea_pitch_shares")
    .upsert({ idea_id: ideaId, owner_id: ownerId, snapshot }, { onConflict: "idea_id" })
    .select("idea_id, owner_id, snapshot, published_at, updated_at").single()
  throwIf(res.error)
  return toShared(res.data as unknown as Row)
}

export async function unpublishPitch(sb: Db, ideaId: string): Promise<void> {
  const res = await sb.from("idea_pitch_shares").delete().eq("idea_id", ideaId)
  throwIf(res.error)
}
