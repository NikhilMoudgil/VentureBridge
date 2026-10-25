/**
 * AI Pitch Review: client side. The LLM call happens in the `pitch-review` Edge Function (the API key never
 * reaches the browser). Everything here is advice shown to the founder; it never feeds the scorecard.
 */
import { throwIf, type Db } from "./ventureRepo"

export type Review = {
  summary: string
  strengths: string[]
  gaps: { section: string; issue: string; why: string }[]
  investorQuestions: string[]
  nextExperiments: { assumption: string; experiment: string; signal: string }[]
}
export type SavedReview = { id: string; createdAt: string; model: string | null; review: Review }
export type PitchSectionInput = { id: string; title: string; text: string; evidence: string }

const s = (v: unknown) => (typeof v === "string" ? v : "")
const a = (v: unknown): any[] => (Array.isArray(v) ? v : [])

/** Normalise whatever is stored so a malformed row can never crash the page. */
export function normalizeReview(raw: unknown): Review {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  return {
    summary: s(o.summary),
    strengths: a(o.strengths).map(s).filter(Boolean),
    gaps: a(o.gaps).map((g) => ({ section: s(g?.section), issue: s(g?.issue), why: s(g?.why) })).filter((g) => g.issue),
    investorQuestions: a(o.investorQuestions).map(s).filter(Boolean),
    nextExperiments: a(o.nextExperiments).map((e) => ({ assumption: s(e?.assumption), experiment: s(e?.experiment), signal: s(e?.signal) })).filter((e) => e.experiment),
  }
}

/** Only sections that have real text and are not flagged as missing are sent. */
export function sectionsForReview(resolved: { id: string; title: string; text: string; evidence: string }[]): PitchSectionInput[] {
  return resolved
    .filter((r) => r.text.trim().length > 0 && r.evidence !== "missing")
    .map((r) => ({ id: r.id, title: r.title, text: r.text.trim(), evidence: r.evidence }))
}

const MESSAGES: Record<string, string> = {
  not_configured: "AI review is not switched on yet. The project owner needs to add the AI key.",
  not_ready: "AI review needs its database upgrade first.",
  limit: "You have reached today's review limit. Try again tomorrow.",
  forbidden: "You can only review your own ventures.",
  unauthorized: "Please sign in again.",
  nothing_to_review: "Fill in at least one pitch section first.",
  bad_model_output: "The AI returned something unreadable. Please try again.",
  provider_failed: "The AI service is not responding. Please try again in a minute.",
}
export const describeAiError = (code: string) => MESSAGES[code] ?? "Could not run the review. Please try again."

const COLS = "id, review, model, created_at"
const toSaved = (r: { id: string; review: unknown; model: string | null; created_at: string }): SavedReview => ({
  id: String(r.id), createdAt: String(r.created_at), model: r.model ?? null, review: normalizeReview(r.review),
})

export async function listReviews(sb: Db, ideaId: string, limit = 5): Promise<SavedReview[]> {
  const res = await sb.from("idea_ai_reviews").select(COLS).eq("idea_id", ideaId).order("created_at", { ascending: false }).limit(limit)
  throwIf(res.error)
  return ((res.data ?? []) as unknown as Parameters<typeof toSaved>[0][]).map(toSaved)
}

/** Returns the saved review, or throws an Error whose message is already user-friendly. */
export async function requestReview(sb: Db, ideaId: string, sections: PitchSectionInput[]): Promise<SavedReview> {
  const { data, error } = await sb.functions.invoke("pitch-review", { body: { ideaId, sections } })
  if (error) {
    let code = "provider_failed"
    try { const body = await (error as { context?: Response }).context?.json(); if (body?.error) code = String(body.error) } catch { /* keep default */ }
    // The function is not deployed at all
    if (/not found|failed to send|404/i.test(String((error as Error).message)) && code === "provider_failed") code = "not_configured"
    throw new Error(describeAiError(code))
  }
  return { id: String(data.id), createdAt: String(data.createdAt), model: data.model ?? null, review: normalizeReview(data.review) }
}
