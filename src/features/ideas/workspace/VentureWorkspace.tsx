import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, FlaskConical, Lightbulb } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { NativeSelect, Notice, SaveBadge } from "./fields"
import { computeScorecard, deriveStatus, nextAction } from "./scorecard"
import type { VentureSnapshot } from "./types"
import { useVenture } from "./useVenture"
import { listVentures, type VentureSummary } from "./ventureRepo"
import { BlueprintSection } from "./sections/BlueprintSection"
import { BusinessSection } from "./sections/BusinessSection"
import { ExecutionSection } from "./sections/ExecutionSection"
import { MarketSection } from "./sections/MarketSection"
import { isSectionKey, SECTIONS, type SectionKey } from "./sections/nav"
import { OverviewSection, STATUS_TEXT } from "./sections/OverviewSection"
import { PitchSection } from "./sections/PitchSection"
import { RisksSection } from "./sections/RisksSection"
import { ScorecardSection } from "./sections/ScorecardSection"

const supabase = createClient()

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">{children}</div>
}

export function VentureWorkspace() {
  const { ideaId } = useParams()
  const { user } = useAuth()
  const uid = user?.id
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const v = useVenture(ideaId)
  const [ventures, setVentures] = useState<VentureSummary[]>([])

  const section: SectionKey = isSectionKey(params.get("s")) ? (params.get("s") as SectionKey) : "overview"
  const go = (k: SectionKey) => {
    setParams(prev => { const n = new URLSearchParams(prev); n.set("s", k); return n }, { replace: true })
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    if (!uid) return
    let off = false
    listVentures(supabase, uid).then(r => { if (!off) setVentures(r) }).catch(() => {})
    return () => { off = true }
  }, [uid])

  const { data, saveState } = v
  const snapshot = useMemo<VentureSnapshot | null>(() => data && ({
    idea: data.idea, competitors: data.competitors, market: data.market, risks: data.risks,
    milestones: data.milestones, hypotheses: data.hypotheses,
  }), [data])
  const sc = useMemo(() => (snapshot ? computeScorecard(snapshot) : null), [snapshot])
  const status = useMemo(() => (snapshot && sc ? deriveStatus(snapshot, sc) : "draft"), [snapshot, sc])
  const next = useMemo(() => (snapshot && sc ? nextAction(snapshot, sc) : { text: "", target: "completeness" }), [snapshot, sc])

  // Warn before closing the tab while edits are unsaved.
  useEffect(() => {
    if (saveState === "idle" || saveState === "saved") return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [saveState])

  if (v.status === "loading") {
    return <div className="p-12 text-center text-sm font-medium text-zinc-500 animate-pulse">Opening your venture workspace…</div>
  }
  if (v.status === "upgrade") {
    return (
      <Centered>
        <Lightbulb className="h-10 w-10 text-zinc-300" aria-hidden />
        <h2 className="text-xl font-bold">The IdeaLab database upgrade is needed</h2>
        <p className="text-sm text-zinc-500">
          This workspace stores its data in tables that have not been added to this project yet. Apply the
          <code className="mx-1 rounded bg-zinc-100 px-1 dark:bg-zinc-900">idealab_workspace</code>
          migration in Supabase, then reload this page. Your existing ventures are not changed.
        </p>
        <Link to="/dashboard/ventures"><Button variant="outline" size="sm">Back to My Ventures</Button></Link>
      </Centered>
    )
  }
  if (v.status === "notfound") {
    return (
      <Centered>
        <h2 className="text-xl font-bold">Venture not found</h2>
        <p className="text-sm text-zinc-500">It may have been deleted, or it belongs to someone else.</p>
        <Link to="/dashboard/ventures"><Button variant="outline" size="sm">Back to My Ventures</Button></Link>
      </Centered>
    )
  }
  if (v.status === "error" || !data || !sc) {
    return (
      <Centered>
        <h2 className="text-xl font-bold">Could not open this venture</h2>
        <p className="text-sm text-zinc-500">{v.loadError ?? "Something went wrong."}</p>
        <Button size="sm" onClick={v.reload}>Try again</Button>
      </Centered>
    )
  }

  const title = data.idea.name?.trim() || "Untitled venture"
  const st = STATUS_TEXT[status]

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-16 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1">
          <Link to="/dashboard/ventures" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            <ArrowLeft className="h-3 w-3" /> My Ventures
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <Badge className="bg-indigo-600 text-white hover:bg-indigo-600">{st.label}</Badge>
          </div>
          {data.idea.tagline ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{data.idea.tagline}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {ventures.length > 1 ? (
            <NativeSelect ariaLabel="Switch venture" className="h-9 w-56" value={data.idea.id}
              options={ventures.map(x => ({ value: x.id, label: x.name?.trim() || x.tagline?.trim() || "Untitled venture" }))}
              onChange={id => navigate(`/dashboard/idealab/${id}?s=${section}`)} />
          ) : null}
          <SaveBadge state={saveState} lastSaved={v.lastSaved} error={v.saveError} />
          <Button type="button" size="sm" variant="outline" onClick={() => void v.saveNow()}
            disabled={saveState === "idle" || saveState === "saved" || saveState === "saving"}>Save now</Button>
          <Link to={`/dashboard/validation?idea=${data.idea.id}`}>
            <Button type="button" size="sm" variant="secondary" className="gap-2"><FlaskConical className="h-4 w-4" /> Validation Lab</Button>
          </Link>
        </div>
      </header>

      {saveState === "conflict" ? (
        <Notice tone="error">
          <p className="font-medium">This venture was changed somewhere else (another tab or device), so saving is paused.</p>
          <p className="mt-1">Your edits are still on this screen. Reload to see the latest version and discard them, or overwrite to keep what you have here.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void v.resolveConflict("reload")}>Reload latest</Button>
            <Button size="sm" onClick={() => void v.resolveConflict("overwrite")}>Overwrite with my version</Button>
          </div>
        </Notice>
      ) : null}
      {saveState === "error" ? (
        <Notice tone="error">
          <p className="font-medium">Your latest changes are not saved.</p>
          <p className="mt-1">{v.saveError ?? "Check your connection."} They are kept on this screen and will be retried.</p>
          <Button size="sm" className="mt-2" onClick={() => void v.saveNow()}>Retry now</Button>
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Workspace sections" className="lg:sticky lg:top-4 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {SECTIONS.map(s => {
              const active = s.key === section
              return (
                <li key={s.key} className="shrink-0">
                  <button type="button" onClick={() => go(s.key)} aria-current={active ? "page" : undefined}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      active
                        ? "border-indigo-300 bg-indigo-50 font-semibold text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200"
                        : "border-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"}`}>
                    {s.num ? <span className="mr-2 font-mono text-xs text-indigo-500">{s.num}</span> : null}
                    <span className="whitespace-nowrap lg:whitespace-normal">{s.label}</span>
                    <span className="mt-0.5 hidden text-[11px] font-normal text-zinc-500 lg:block">{s.blurb}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <main className="min-w-0">
          {section === "overview" ? <OverviewSection data={data} api={v} status={status} next={next} indicators={sc.indicators} go={go} /> : null}
          {section === "blueprint" ? <BlueprintSection data={data} api={v} /> : null}
          {section === "market" ? <MarketSection data={data} api={v} /> : null}
          {section === "business" ? <BusinessSection data={data} api={v} /> : null}
          {section === "execution" ? <ExecutionSection data={data} api={v} /> : null}
          {section === "risks" ? <RisksSection data={data} api={v} /> : null}
          {section === "pitch" ? <PitchSection data={data} api={v} /> : null}
          {section === "scorecard" ? (
            <ScorecardSection indicators={sc.indicators} draftStrength={sc.draftStrength} healthScore={data.idea.health_score} go={go} />
          ) : null}
        </main>
      </div>
    </div>
  )
}
