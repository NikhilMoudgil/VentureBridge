import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Plus, Rocket, Trash2, Share2, FlaskConical, Target, Activity } from "lucide-react"
import { toast } from "sonner"
import { loadVentureCards, type VentureCard } from "./workspace/ventureCards"
import { STATUS_TEXT } from "./workspace/sections/OverviewSection"

const supabase = createClient()

const STAGE_LABEL: Record<string, string> = {
  idea: "Idea", research: "Researching", prototype: "Prototype", mvp: "MVP built",
  early_traction: "Early traction", growth: "Growth",
}
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  exploring: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  validating: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  pitch_ready: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
}

type SortKey = "recent" | "progress" | "name"

const titleOf = (c: VentureCard) =>
  c.idea.name?.trim() || `${c.idea.market || c.idea.target_market || "General"} Venture`
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""
const segColor = (s: number) => (s >= 70 ? "bg-emerald-500" : s >= 35 ? "bg-indigo-500" : s > 0 ? "bg-amber-500" : "bg-zinc-200 dark:bg-zinc-800")

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  )
}

function Count({ icon, n, label }: { icon: ReactNode; n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${n} ${label}`}>
      {icon}<span className="tabular-nums">{n}</span><span className="hidden sm:inline">{label}</span>
    </span>
  )
}

export function MyVentures() {
  const { user } = useAuth()
  const [cards, setCards] = useState<VentureCard[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortKey>("recent")
  const [toDelete, setToDelete] = useState<VentureCard | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let alive = true
    async function run() {
      if (!user) return
      try {
        const rows = await loadVentureCards(supabase as never, user.id)
        if (alive) setCards(rows)
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : "Could not load your ventures.")
      }
      if (alive) setLoading(false)
    }
    run()
    return () => { alive = false }
  }, [user])

  const confirmDelete = async () => {
    if (!user || !toDelete || deleting) return
    setDeleting(true)
    const target = toDelete
    // select() makes the database report which rows were really deleted, so a blocked delete is not mistaken for success
    const { data, error } = await supabase
      .from("ideas")
      .delete()
      .eq("id", target.id)
      .or(`id.eq.${user.id},owner_id.eq.${user.id}`)
      .select("id")
    setDeleting(false)

    if (error) {
      toast.error(error.code === "23503"
        ? "This venture is still linked to other records, so it could not be deleted. Apply the latest database upgrade and try again."
        : error.message || "Could not delete the venture.")
      return
    }
    if (!data || data.length === 0) {
      toast.error("The venture was not deleted. Your database does not allow deleting yet: apply the latest database upgrade, then try again.")
      return
    }
    setCards(prev => prev.filter(c => c.id !== target.id))
    setToDelete(null)
    toast.success(`"${titleOf(target)}" deleted.`)
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? cards.filter(c => [titleOf(c), c.idea.tagline, c.idea.industry, c.idea.problem].some(t => (t ?? "").toLowerCase().includes(q)))
      : cards.slice()
    if (sort === "progress") list.sort((a, b) => b.completion - a.completion)
    else if (sort === "name") list.sort((a, b) => titleOf(a).localeCompare(titleOf(b)))
    return list // "recent" keeps the database order (newest first)
  }, [cards, query, sort])

  const summary = useMemo(() => ({
    total: cards.length,
    avg: cards.length ? Math.round(cards.reduce((s, c) => s + c.completion, 0) / cards.length) : 0,
    tested: cards.filter(c => c.counts.experiments > 0).length,
    shared: cards.filter(c => c.shared).length,
  }), [cards])

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading your ventures...</div>

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">My Ventures</h1>
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
            Every venture with its progress, evidence and next step.
          </p>
        </div>
        <Link to="/dashboard/idealab/new">
          <Button size="sm" className="gap-2 sm:size-default"><Plus className="h-4 w-4" /> New Venture</Button>
        </Link>
      </div>

      {loadError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {loadError}
        </div>
      )}

      {cards.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Ventures" value={summary.total} />
            <Stat label="Avg. completion" value={`${summary.avg}%`} />
            <Stat label="With experiments" value={summary.tested} />
            <Stat label="Pitches shared" value={summary.shared} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, industry or problem"
              aria-label="Search ventures" className="sm:max-w-xs" />
            <div className="flex gap-1" role="group" aria-label="Sort ventures">
              {([["recent", "Newest"], ["progress", "Most complete"], ["name", "A to Z"]] as [SortKey, string][]).map(([k, l]) => (
                <Button key={k} type="button" size="sm" variant={sort === k ? "default" : "outline"} onClick={() => setSort(k)}>{l}</Button>
              ))}
            </div>
          </div>
        </>
      )}

      {!loadError && cards.length === 0 && (
        <div className="flex min-h-[35vh] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-950/50">
          <Rocket className="mb-4 h-10 w-10 text-zinc-300 sm:h-12 sm:w-12 dark:text-zinc-700" />
          <h3 className="text-base font-semibold text-zinc-900 sm:text-lg dark:text-zinc-50">No ventures found</h3>
          <p className="mb-4 mt-1 text-xs text-zinc-500 sm:text-sm">You haven't saved any drafts in the IdeaLab yet.</p>
          <Link to="/dashboard/idealab/new"><Button variant="outline" size="sm">Start Building</Button></Link>
        </div>
      )}

      {cards.length > 0 && shown.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-500">No ventures match "{query}".</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {shown.map(c => {
          const title = titleOf(c)
          const st = STATUS_TEXT[c.status]
          const stage = c.idea.startup_stage ? STAGE_LABEL[c.idea.startup_stage] : null
          const about = c.idea.problem || c.idea.solution || c.idea.elevator_pitch
          return (
            <Card key={c.id} className="flex flex-col border-zinc-200 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700">
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600/10 text-base font-semibold text-indigo-600 dark:text-indigo-400">
                    {title.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/dashboard/idealab/${c.id}`} className="block truncate text-base font-semibold text-zinc-900 hover:underline sm:text-lg dark:text-zinc-50">{title}</Link>
                    <p className="truncate text-xs text-zinc-500">{c.idea.tagline || (c.idea.industry ? c.idea.industry : "No tagline yet")}</p>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-zinc-400">{shortDate(c.createdAt)}</div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className={`text-[10px] ${STATUS_STYLE[c.status] ?? ""}`}>{st.label}</Badge>
                  {stage ? <Badge variant="outline" className="text-[10px]">{stage}</Badge> : null}
                  {c.idea.industry ? <Badge variant="outline" className="text-[10px]">{c.idea.industry}</Badge> : null}
                  {c.shared ? (
                    <Badge variant="outline" className="gap-1 text-[10px]" title={c.sharedAt ? `Shared pitch updated ${shortDate(c.sharedAt)}` : "Pitch shared"}>
                      <Share2 className="h-3 w-3" /> Shared
                    </Badge>
                  ) : null}
                </div>

                {about ? <p className="line-clamp-2 text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">{about}</p> : null}

                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Checklist completion</span><span className="tabular-nums">{c.completion}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                    role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.completion} aria-label={`${title} completion`}>
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${c.completion}%` }} />
                  </div>
                  <div className="mt-2 flex gap-1" aria-label="Scorecard indicators">
                    {c.indicators.map(i => (
                      <div key={i.id} title={`${i.label}: ${i.score}%`} className={`h-1.5 flex-1 rounded-sm ${segColor(i.score)}`} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                  <Count icon={<Target className="h-3.5 w-3.5" />} n={c.counts.hypotheses} label="hypotheses" />
                  <Count icon={<FlaskConical className="h-3.5 w-3.5" />} n={c.counts.experiments} label="experiments" />
                  <Count icon={<Activity className="h-3.5 w-3.5" />} n={c.counts.risks} label="risks" />
                  <span title={`${c.counts.competitors} competitors, ${c.counts.milestones} milestones`} className="tabular-nums">
                    {c.counts.competitors} comp. · {c.counts.milestones} milestones
                  </span>
                </div>

                <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">Next: </span>{c.next}
                </div>
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-4 py-3 sm:px-5 dark:border-zinc-800/60">
                <div className="flex gap-2">
                  <Link to={`/dashboard/idealab/${c.id}`}><Button size="sm">Open workspace</Button></Link>
                  <Link to={`/dashboard/validation?idea=${c.id}`}><Button size="sm" variant="outline">Validation Lab</Button></Link>
                </div>
                <Button type="button" variant="ghost" size="sm" aria-label={`Delete ${title}`}
                  className="h-8 gap-1 px-2 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                  onClick={() => setToDelete(c)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!toDelete} onOpenChange={(open) => { if (!open && !deleting) setToDelete(null) }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this venture?</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              <span className="font-medium">{toDelete ? titleOf(toDelete) : ""}</span> and everything inside it will be permanently deleted:
              its workspace, competitors, market estimates, risks, milestones, notes, hypotheses and experiments, any shared pitch,
              and pitches already sent to investors. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" disabled={deleting} onClick={() => setToDelete(null)}>Cancel</Button>
            <Button type="button" size="sm" disabled={deleting} onClick={confirmDelete} className="bg-red-600 text-white hover:bg-red-700">
              {deleting ? "Deleting..." : "Delete venture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}