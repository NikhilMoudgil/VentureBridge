import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import {
  MissingSchemaError, createHypothesisFromRisk as repoCreateHypothesis, deleteChild,
  fetchVersions, insertChild, loadVenture, saveMarketTier, saveNotes as repoSaveNotes,
  updateChild, type ChildTable, type IdeaPatch, type NewHypothesis, type VentureData,
} from "./ventureRepo"
import { legacyElevatorPitch } from "./pitch"
import { AUTOSAVE_MS, flushSession, makeSession, schedule, type SaveState, type Session, type Ui } from "./autosave"
import type { Blueprint, Competitor, MarketAssumption, Milestone, PitchSettings, Risk } from "./types"

const supabase = createClient()

export type { SaveState }
export type LoadStatus = "loading" | "ready" | "notfound" | "error" | "upgrade"

const has = (s?: string | null) => (s ?? "").trim().length > 0

export function friendlyError(label: string, e: unknown): string {
  if (e instanceof MissingSchemaError) return "This needs the IdeaLab database upgrade, which has not been applied to this project yet."
  return `${label}: ${e instanceof Error ? e.message : "unknown error"}`
}

type ListKey = "competitors" | "risks" | "milestones"
const TABLE: Record<ListKey, ChildTable> = { competitors: "idea_competitors", risks: "idea_risks", milestones: "idea_milestones" }
type WithId = { id: string }

export function useVenture(ideaId: string | undefined) {
  const { user } = useAuth()
  const uid = user?.id
  const sess = useRef<Session | null>(null)

  const [status, setStatus] = useState<LoadStatus>("loading")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [data, setData] = useState<VentureData | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const ui = useMemo<Ui>(() => ({
    state: (s, st) => { s.state = st; if (!s.dead) setSaveState(st) },
    error: (s, m) => { if (!s.dead) setSaveError(m) },
    saved: s => { if (!s.dead) setLastSaved(new Date()) },
    data: s => { if (!s.dead) setData(s.data) },
  }), [])

  // ---- load / unload -------------------------------------------------------------------------
  useEffect(() => {
    if (!uid || !ideaId) return
    let cancelled = false
    setStatus("loading")
    setLoadError(null)
    setSaveState("idle")
    setSaveError(null)

    loadVenture(supabase, ideaId, uid)
      .then(d => {
        if (cancelled) return
        if (!d) { setStatus("notfound"); return }
        sess.current = makeSession(ideaId, d)
        setData(d)
        setStatus("ready")
      })
      .catch(e => {
        if (cancelled) return
        if (e instanceof MissingSchemaError) setStatus("upgrade")
        else { setStatus("error"); setLoadError(e instanceof Error ? e.message : "Could not load this venture.") }
      })

    const onHide = () => {
      if (document.visibilityState === "hidden" && sess.current) void flushSession(sess.current, ui, supabase)
    }
    document.addEventListener("visibilitychange", onHide)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onHide)
      const s = sess.current
      if (s) {
        const p = flushSession(s, ui, supabase) // best effort: writes pending edits before the screen goes away
        s.dead = true
        sess.current = null
        void p
      }
    }
  }, [uid, ideaId, reloadTick, ui])

  // ---- founder-authored edits (debounced autosave) ---------------------------------------------
  const markDirty = useCallback((s: Session) => {
    if (s.state === "conflict") return
    ui.state(s, "dirty")
    schedule(s, ui, supabase, AUTOSAVE_MS)
  }, [ui])

  const setIdea = useCallback((patch: IdeaPatch) => {
    const s = sess.current
    if (!s) return
    const cur = s.data.idea
    const full: IdeaPatch = { ...patch }
    if ("problem" in patch || "solution" in patch || "market" in patch) {
      // Keep ideas.elevator_pitch in step only while the founder has not customised it, so other pages that
      // show it keep working and an edited pitch is never overwritten.
      const next = { ...cur, ...patch }
      const wasAuto = !has(cur.elevator_pitch) || cur.elevator_pitch === legacyElevatorPitch(cur)
      const anyText = has(next.problem) || has(next.solution) || has(next.market)
      if (wasAuto && anyText && !("elevator_pitch" in patch)) full.elevator_pitch = legacyElevatorPitch(next)
    }
    const idea = { ...cur, ...full }
    if ("market" in full) idea.target_market = full.market ?? null
    s.data = { ...s.data, idea }
    s.pendingIdea = { ...s.pendingIdea, ...full }
    ui.data(s)
    markDirty(s)
  }, [ui, markDirty])

  const setBlueprint = useCallback((fn: (b: Blueprint) => Blueprint) => {
    const s = sess.current
    if (!s) return
    s.data = { ...s.data, idea: { ...s.data.idea, blueprint: fn(s.data.idea.blueprint) } }
    s.wsDirty = true
    ui.data(s)
    markDirty(s)
  }, [ui, markDirty])

  const setPitchSettings = useCallback((fn: (p: PitchSettings) => PitchSettings) => {
    const s = sess.current
    if (!s) return
    s.data = { ...s.data, idea: { ...s.data.idea, pitch_settings: fn(s.data.idea.pitch_settings) } }
    s.wsDirty = true
    ui.data(s)
    markDirty(s)
  }, [ui, markDirty])

  const saveNow = useCallback(async () => {
    const s = sess.current
    if (s) await flushSession(s, ui, supabase)
  }, [ui])

  const resolveConflict = useCallback(async (mode: "reload" | "overwrite") => {
    const s = sess.current
    if (!s) return
    if (mode === "reload") {
      s.pendingIdea = {}; s.wsDirty = false
      if (s.timer) clearTimeout(s.timer)
      setReloadTick(t => t + 1) // effect cleanup retires this session, then the venture is loaded again
      return
    }
    try {
      s.versions = await fetchVersions(supabase, s.id)
      ui.state(s, "dirty")
      await flushSession(s, ui, supabase)
    } catch (e) {
      toast.error(friendlyError("Could not overwrite", e))
    }
  }, [ui])

  // ---- rows in the child tables: saved immediately ---------------------------------------------
  const apply = useCallback((s: Session, fn: (d: VentureData) => VentureData) => { s.data = fn(s.data); ui.data(s) }, [ui])

  const run = useCallback(async <T,>(label: string, fn: (s: Session) => Promise<T>): Promise<T | undefined> => {
    const s = sess.current
    if (!s) return undefined
    try { return await fn(s) } catch (e) { toast.error(friendlyError(label, e)); return undefined }
  }, [])

  const updateRow = useCallback(async (key: ListKey, id: string, patch: Record<string, unknown>) => {
    const s = sess.current
    if (!s) return
    const prev = (s.data[key] as unknown as WithId[]).find(r => r.id === id)
    if (!prev) return
    const mapRows = (d: VentureData, f: (r: WithId) => WithId) =>
      ({ ...d, [key]: (d[key] as unknown as WithId[]).map(f) }) as VentureData
    apply(s, d => mapRows(d, r => (r.id === id ? { ...r, ...patch } : r)))
    try {
      await updateChild(supabase, TABLE[key], id, patch)
    } catch (e) {
      apply(s, d => mapRows(d, r => (r.id === id ? prev : r)))
      toast.error(friendlyError("Could not save the change", e))
    }
  }, [apply])

  const removeRow = useCallback((key: ListKey, id: string) =>
    run("Could not remove it", async s => {
      await deleteChild(supabase, TABLE[key], id)
      apply(s, d => ({ ...d, [key]: (d[key] as unknown as WithId[]).filter(r => r.id !== id) }) as VentureData)
    }), [run, apply])

  const addCompetitor = useCallback((name: string, kind: Competitor["kind"]) =>
    run("Could not add the alternative", async s => {
      const row = await insertChild<Competitor>(supabase, "idea_competitors", { idea_id: s.id, name: name.trim(), kind })
      apply(s, d => ({ ...d, competitors: [...d.competitors, row] }))
    }), [run, apply])

  const addRisk = useCallback((r: Pick<Risk, "title" | "kind" | "category" | "likelihood" | "impact">) =>
    run("Could not add the risk", async s => {
      const row = await insertChild<Risk>(supabase, "idea_risks", { idea_id: s.id, ...r, title: r.title.trim() })
      apply(s, d => ({ ...d, risks: [...d.risks, row] }))
    }), [run, apply])

  const addMilestone = useCallback((m: Pick<Milestone, "title" | "kind" | "priority"> & { target_date?: string }) =>
    run("Could not add the item", async s => {
      const sortOrder = s.data.milestones.length
      const row = await insertChild<Milestone>(supabase, "idea_milestones",
        { idea_id: s.id, ...m, title: m.title.trim(), sort_order: sortOrder })
      apply(s, d => ({ ...d, milestones: [...d.milestones, row] }))
    }), [run, apply])

  const saveMarket = useCallback(async (tier: MarketAssumption["tier"], patch: Partial<MarketAssumption>) => {
    const s = sess.current
    if (!s) return
    const prev = s.data.market.find(m => m.tier === tier)
    const merged: MarketAssumption = {
      tier, customer_count: null, annual_spend_per_customer: null, basis: null, source_url: null,
      source_date: null, evidence_status: "assumption", ...(prev ?? {}), ...patch,
    }
    const put = (d: VentureData, m: MarketAssumption | undefined) =>
      ({ ...d, market: [...d.market.filter(x => x.tier !== tier), ...(m ? [m] : [])] })
    apply(s, d => put(d, merged))
    try {
      const saved = await saveMarketTier(supabase, s.id, merged)
      apply(s, d => put(d, saved))
    } catch (e) {
      apply(s, d => put(d, prev))
      toast.error(friendlyError("Could not save the market estimate", e))
    }
  }, [apply])

  const saveNotes = useCallback((notes: string) =>
    run("Could not save notes", async s => {
      if (notes === s.data.notes) return
      await repoSaveNotes(supabase, s.id, notes)
      apply(s, d => ({ ...d, notes }))
    }), [run, apply])

  const createHypothesisFromRisk = useCallback(async (riskId: string, h: NewHypothesis): Promise<boolean> => {
    const res = await run("Could not create the hypothesis", async s => {
      const out = await repoCreateHypothesis(supabase, s.id, riskId, h)
      apply(s, d => ({
        ...d,
        hypotheses: [out.hypothesis, ...d.hypotheses],
        risks: d.risks.map(r => (r.id === riskId ? out.risk : r)),
      }))
      return true
    })
    return res === true
  }, [run, apply])

  return {
    status, loadError, data,
    saveState, saveError, lastSaved,
    setIdea, setBlueprint, setPitchSettings, saveNow, resolveConflict,
    reload: () => setReloadTick(t => t + 1),
    addCompetitor, updateCompetitor: (id: string, p: Partial<Competitor>) => updateRow("competitors", id, p),
    removeCompetitor: (id: string) => removeRow("competitors", id),
    addRisk, updateRisk: (id: string, p: Partial<Risk>) => updateRow("risks", id, p),
    removeRisk: (id: string) => removeRow("risks", id),
    addMilestone, updateMilestone: (id: string, p: Partial<Milestone>) => updateRow("milestones", id, p),
    removeMilestone: (id: string) => removeRow("milestones", id),
    saveMarket, saveNotes, createHypothesisFromRisk,
  }
}

export type VentureApi = ReturnType<typeof useVenture>
