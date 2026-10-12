import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Lock, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { EVIDENCE_LABEL, type Evidence } from "./workspace/pitch"
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

type Load =
  | { kind: "loading" } | { kind: "none" } | { kind: "upgrade" } | { kind: "error"; message: string }
  | { kind: "ok"; pitch: SharedPitch; founderName: string | null }

function Shell({ children, role }: { children: React.ReactNode; role: string | null }) {
  return (
  <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-12">
    <Link to={role === "investor" ? "/dashboard/dealflow" : "/dashboard/network"}
      className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
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

  useEffect(() => {
    if (!ideaId || !uid) return
    let off = false
    setLoad({ kind: "loading" })
    ;(async () => {
      try {
        const pitch = await getSharedPitch(supabase, ideaId)
        if (off) return
        if (!pitch) { setLoad({ kind: "none" }); return }
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

  const decide = async (status: "interested" | "passed") => {
    if (!dealId || busy) return
    setBusy(true)
    const { error } = await supabase.from("deal_flow").update({ status }).eq("id", dealId)
    setBusy(false)
    if (error) toast.error(error.message || "Could not update.")
    else { setDealStatus(status); toast.success(`Deal marked as ${status}`) }
  }

  if (load.kind === "loading") return <div className="p-12 text-center text-sm font-medium text-zinc-500 animate-pulse">Opening pitch…</div>
  if (load.kind !== "ok") {
    const msg =
      load.kind === "upgrade" ? "Pitch sharing is not set up on this project yet."
      : load.kind === "error" ? load.message
      : "No pitch is available to you for this venture. The founder may not have shared one with you yet."
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

  return (
    <Shell role={role}>
      <header className="space-y-2 border-b border-zinc-200 pb-5 dark:border-zinc-800">
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
      </header>

      <p className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 text-xs leading-relaxed text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-200">
        This is the founder's own account, labelled by where each part comes from. Figures marked as assumptions are not verified.
        Nothing here means the venture has been validated.
      </p>

      {snap.sections.length === 0 ? (
        <p className="text-sm text-zinc-500">The founder has not shared any sections yet.</p>
      ) : snap.sections.map(s => (
        <Card key={s.id} className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
          <CardHeader className="p-5 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              {s.title}
              <Badge variant="outline" className={`text-[10px] ${EVIDENCE_STYLE[s.evidence]}`}>{EVIDENCE_LABEL[s.evidence]}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-5 pt-0 sm:p-6 sm:pt-0">
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{s.text}</p>
            {s.note ? <p className="text-xs text-amber-700 dark:text-amber-400">{s.note}</p> : null}
          </CardContent>
        </Card>
      ))}

      {role === "investor" && dealId && (dealStatus === "submitted" || dealStatus === "reviewing") ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 sm:flex-row">
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
