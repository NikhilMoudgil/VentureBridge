import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, CheckCircle2, ChevronRight, Lock, Printer, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { EVIDENCE_LABEL, type Evidence } from "./workspace/pitch"
import { buildGlance } from "./workspace/pitchGlance"
import { MentorFeedback } from "./workspace/MentorFeedback"
import { getSharedPitch, type SharedPitch } from "./workspace/shareRepo"
import { MissingSchemaError } from "./workspace/ventureRepo"

const supabase = createClient()

const EVIDENCE_STYLE: Record<Evidence, string> = {
  founder: "text-indigo-700 dark:text-indigo-300",
  calculated: "text-sky-700 dark:text-sky-300",
  experiment: "text-emerald-700 dark:text-emerald-300",
  assumption: "text-amber-700 dark:text-amber-300",
  missing: "text-zinc-500",
}

type Teaser = { name: string | null; tagline: string | null; problem: string | null; industry: string | null }
type Load =
  | { kind: "loading" } | { kind: "none"; teaser: Teaser | null } | { kind: "upgrade" } | { kind: "error"; message: string }
  | { kind: "ok"; pitch: SharedPitch; founderName: string | null }

function Shell({ children, role }: { children: React.ReactNode; role: string | null }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-12">
      <Link to={role === "investor" ? "/dashboard/dealflow" : "/dashboard/network"}
        className="inline-flex print:hidden items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      {children}
    </div>
  )
}

/** Read-only pitch for mentors and investors (and the founder's own preview). Access is enforced by the database. */
export function PitchView() {
  const { ideaId } = useParams()
  const { user, role } = useAuth()
  const uid = user?.id
  const [load, setLoad] = useState<Load>({ kind: "loading" })
  const [dealStatus, setDealStatus] = useState<string | null>(null)
  const [dealId, setDealId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [openAll, setOpenAll] = useState(false)

  useEffect(() => {
    if (!ideaId || !uid) return
    let off = false
    setLoad({ kind: "loading" })
    ;(async () => {
      try {
        const pitch = await getSharedPitch(supabase, ideaId)
        if (off) return
        if (!pitch) {
          // Nothing shared (or not shared with this person): show what every member can already see.
          let teaser: Teaser | null = null
          try {
            const t = await supabase.from("ideas").select("name, tagline, problem, industry").eq("id", ideaId).maybeSingle()
            teaser = (t.data as Teaser | null) ?? null
          } catch { /* the teaser is optional */ }
          if (!off) setLoad({ kind: "none", teaser })
          return
        }
        const f = await supabase.from("founders").select("full_name").eq("id", pitch.ownerId).maybeSingle()
        if (off) return
        setLoad({ kind: "ok", pitch, founderName: (f.data as { full_name?: string } | null)?.full_name ?? null })
        if (role === "investor") {
          const d = await supabase.from("deal_flow").select("id, status").eq("investor_id", uid).eq("idea_id", ideaId).maybeSingle()
          if (!off && d.data) {
            const row = d.data as { id: string; status: string }
            setDealId(row.id); setDealStatus(row.status)
          }
        }
      } catch (e) {
        if (off) return
        setLoad(e instanceof MissingSchemaError ? { kind: "upgrade" }
          : { kind: "error", message: e instanceof Error ? e.message : "Could not load this pitch." })
      }
    })()
    return () => { off = true }
  }, [ideaId, uid, role])

  const glance = useMemo(() => (load.kind === "ok" ? buildGlance(load.pitch.snapshot) : []), [load])

  const decide = async (status: "interested" | "passed") => {
    if (!dealId || busy) return
    setBusy(true)
    const { error } = await supabase.from("deal_flow").update({ status }).eq("id", dealId)
    setBusy(false)
    if (error) toast.error(error.message || "Could not update.")
    else { setDealStatus(status); toast.success(`Deal marked as ${status}`) }
  }

  if (load.kind === "loading") return <div className="p-12 text-center text-sm font-medium text-zinc-500 animate-pulse">Opening pitch…</div>

  if (load.kind === "none") {
    const t = load.teaser
    return (
      <Shell role={role}>
        <div className="space-y-4 rounded-xl border border-dashed p-6 dark:border-zinc-800">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">The full pitch is not available to you yet</p>
              <p className="mt-1 text-xs text-zinc-500">The founder has not shared one with you. Here is the short version.</p>
            </div>
          </div>
          {t && (t.name || t.tagline || t.problem) ? (
            <div className="space-y-1 border-t pt-4 dark:border-zinc-800">
              {t.name ? <h1 className="text-xl font-semibold">{t.name}</h1> : null}
              {t.tagline ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.tagline}</p> : null}
              {t.problem ? <p className="line-clamp-3 pt-2 text-sm text-zinc-700 dark:text-zinc-300">{t.problem}</p> : null}
            </div>
          ) : null}
        </div>
      </Shell>
    )
  }

  if (load.kind !== "ok") {
    const msg = load.kind === "upgrade" ? "Pitch sharing is not set up on this project yet." : load.message
    return (
      <Shell role={role}>
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center dark:border-zinc-800">
          <Lock className="h-8 w-8 text-zinc-300" aria-hidden />
          <p className="max-w-md text-sm text-zinc-500">{msg}</p>
        </div>
      </Shell>
    )
  }

  const { pitch, founderName } = load
  const snap = pitch.snapshot
  const title = snap.name || "Untitled venture"
  const mine = pitch.ownerId === uid

  /** Opens every section, switches to the light theme for paper, then prints. The browser's print dialog has "Save as PDF". */
  const savePdf = () => {
    setOpenAll(true)
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    if (wasDark) root.classList.remove("dark")
    window.addEventListener("afterprint", () => { if (wasDark) root.classList.add("dark") }, { once: true })
    window.setTimeout(() => window.print(), 250)
  }
  const canDecide = role === "investor" && dealId && (dealStatus === "submitted" || dealStatus === "reviewing")

  return (
    <Shell role={role}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {snap.stage ? <Badge variant="secondary" className="uppercase text-[10px]">{snap.stage.replace(/_/g, " ")}</Badge> : null}
          {snap.industry ? <Badge variant="outline" className="text-[10px]">{snap.industry}</Badge> : null}
        </div>
        {snap.tagline ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{snap.tagline}</p> : null}
        <p className="text-xs text-zinc-500">
          {founderName ? `By ${founderName}` : "Shared by the founder"}
          {pitch.updatedAt ? ` · updated ${new Date(pitch.updatedAt).toLocaleDateString()}` : ""}
          {mine ? " · this is how readers see your pitch" : ""}
        </p>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs print:hidden" onClick={savePdf}>
          <Printer className="mr-1.5 h-3.5 w-3.5" /> Save as PDF
        </Button>
        <p className="text-[11px] leading-snug text-zinc-500">
          The founder's own account. Items marked as assumptions are not verified, and nothing here means the venture is validated.
        </p>
      </header>

      {glance.length > 0 ? (
        <section aria-label="At a glance" className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">At a glance</h2>
          <dl className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {glance.map(r => (
              <div key={r.id} className="grid gap-0.5 py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
                <dt className="text-xs font-medium text-zinc-500">{r.label}</dt>
                <dd className="text-sm text-zinc-900 dark:text-zinc-100">
                  {r.value}
                  {r.evidence !== "founder" ? (
                    <span className={`ml-2 whitespace-nowrap text-[10px] font-medium ${EVIDENCE_STYLE[r.evidence]}`}>{EVIDENCE_LABEL[r.evidence]}</span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {snap.sections.length === 0 ? (
        <p className="text-sm text-zinc-500">The founder has not shared any sections yet.</p>
      ) : (
        <section aria-label="Full pitch" className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Full pitch <span className="font-normal text-zinc-500">({snap.sections.length} sections)</span></h2>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs print:hidden" onClick={() => setOpenAll(v => !v)}>
              {openAll ? "Collapse all" : "Expand all"}
            </Button>
          </div>
          {snap.sections.map(s => (
            <details key={`${s.id}-${openAll}`} open={openAll}
              className="group break-inside-avoid rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/50">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-90" aria-hidden />
                <span>{s.title}</span>
                <Badge variant="outline" className={`ml-auto text-[10px] ${EVIDENCE_STYLE[s.evidence]}`}>{EVIDENCE_LABEL[s.evidence]}</Badge>
              </summary>
              <div className="space-y-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800/70">
                <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{s.text}</p>
                {s.note ? <p className="text-xs text-amber-700 dark:text-amber-400">{s.note}</p> : null}
              </div>
            </details>
          ))}
        </section>
      )}

      {role === "mentor" && !mine && ideaId ? (
        <div className="print:hidden">
          <MentorFeedback ideaId={ideaId} mode="write" sections={snap.sections.map(s => ({ id: s.id, title: s.title }))} />
        </div>
      ) : null}
      {mine && ideaId ? (
        <div className="print:hidden"><MentorFeedback ideaId={ideaId} mode="read" sections={snap.sections.map(s => ({ id: s.id, title: s.title }))} /></div>
      ) : null}

      {canDecide ? (
        <div className="sticky bottom-4 z-10 print:hidden flex flex-col gap-2 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900/95">
          <span className="text-xs text-zinc-500 sm:mr-auto">Decide when you are ready</span>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => decide("interested")}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Interested
          </Button>
          <Button size="sm" variant="outline" className="text-red-600" disabled={busy} onClick={() => decide("passed")}>
            <X className="mr-2 h-4 w-4" /> Pass
          </Button>
        </div>
      ) : null}
      {role === "investor" && dealStatus === "interested" ? (
        <p className="text-sm font-medium text-emerald-700">Private chat unlocked in Messages.</p>
      ) : null}
    </Shell>
  )
}
