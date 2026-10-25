/**
 * Mentor feedback on a founder's shared pitch. Pure helpers plus thin database calls.
 * Who may write or read is decided by the database (see 20261015000000_pitch_feedback.sql):
 * an accepted mentor writes, only that mentor and the founder who owns the venture read.
 */
import { throwIf, type Db } from "./ventureRepo"

export const MAX_NOTE = 2000

export type Feedback = {
  id: string
  ideaId: string
  mentorId: string
  mentorName: string | null
  sectionId: string | null
  body: string
  createdAt: string
}

/** Trimmed note, or null when it is empty or too long to save. */
export function cleanNote(raw: string): string | null {
  const t = raw.trim()
  return t.length === 0 || t.length > MAX_NOTE ? null : t
}

/** True when the database refused the write because the mentor is not (yet) accepted by this founder. */
export const isNotAllowed = (message: string) => /row-level security|permission denied/i.test(message)

type Row = { id: string; idea_id: string; mentor_id: string; section_id: string | null; body: string; created_at: string }
const toFeedback = (r: Row, names: Record<string, string>): Feedback => ({
  id: String(r.id), ideaId: String(r.idea_id), mentorId: String(r.mentor_id), mentorName: names[r.mentor_id] ?? null,
  sectionId: r.section_id ?? null, body: String(r.body ?? ""), createdAt: String(r.created_at),
})
const COLS = "id, idea_id, mentor_id, section_id, body, created_at"

/** Newest first. Mentor names come from a second lookup; if that fails the notes still show. */
export async function listFeedback(sb: Db, ideaId: string): Promise<Feedback[]> {
  const res = await sb.from("pitch_feedback").select(COLS).eq("idea_id", ideaId).order("created_at", { ascending: false })
  throwIf(res.error)
  const rows = (res.data ?? []) as unknown as Row[]
  const ids = Array.from(new Set(rows.map((r) => r.mentor_id)))
  const names: Record<string, string> = {}
  if (ids.length) {
    const u = await sb.from("users").select("id, full_name").in("id", ids)
    if (!u.error) ((u.data ?? []) as unknown as { id: string; full_name: string | null }[]).forEach((x) => { if (x.full_name) names[x.id] = x.full_name })
  }
  return rows.map((r) => toFeedback(r, names))
}

export async function addFeedback(sb: Db, ideaId: string, sectionId: string | null, body: string): Promise<Feedback> {
  const res = await sb.from("pitch_feedback").insert({ idea_id: ideaId, section_id: sectionId, body }).select(COLS).single()
  throwIf(res.error)
  return toFeedback(res.data as unknown as Row, {})
}

export async function deleteFeedback(sb: Db, id: string): Promise<void> {
  const res = await sb.from("pitch_feedback").delete().eq("id", id).select("id")
  throwIf(res.error)
  if (!res.data || (res.data as unknown[]).length === 0) throw new Error("That note could not be deleted.")
}
