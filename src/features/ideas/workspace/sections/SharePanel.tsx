import { useCallback, useEffect, useMemo, useState } from "react"
import { Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Notice, Panel } from "../fields"
import type { ResolvedSection } from "../pitch"
import {
  buildSnapshot, getSharedPitch, publishPitch, snapshotsDiffer, unpublishPitch, type SharedPitch,
} from "../shareRepo"
import { MissingSchemaError } from "../ventureRepo"
import type { Idea } from "../types"

const supabase = createClient()

type State = { kind: "loading" } | { kind: "ready"; shared: SharedPitch | null } | { kind: "upgrade" } | { kind: "error"; message: string }

/** Founder-side control: publish, update or withdraw the frozen pitch that mentors and investors can read. */
export function SharePanel({ idea, resolved }: { idea: Idea; resolved: ResolvedSection[] }) {
  const { user } = useAuth()
  const uid = user?.id
  const [state, setState] = useState<State>({ kind: "loading" })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setState({ kind: "ready", shared: await getSharedPitch(supabase, idea.id) }) }
    catch (e) {
      setState(e instanceof MissingSchemaError ? { kind: "upgrade" }
        : { kind: "error", message: e instanceof Error ? e.message : "Could not check sharing." })
    }
  }, [idea.id])
  useEffect(() => { setState({ kind: "loading" }); void load() }, [load])

  const current = useMemo(
    () => buildSnapshot({ name: idea.name, tagline: idea.tagline, industry: idea.industry, stage: idea.startup_stage }, resolved),
    [idea.name, idea.tagline, idea.industry, idea.startup_stage, resolved])
  const count = current.sections.length

  const publish = async () => {
    if (!uid || busy) return
    if (count === 0) { toast.error("Tick at least one section that has content first."); return }
    if (!window.confirm(`Investors you have pitched and mentors you have sent a request to will be able to read these ${count} section${count === 1 ? "" : "s"}. Continue?`)) return
    setBusy(true)
    try {
      const shared = await publishPitch(supabase, uid, idea.id, current)
      setState({ kind: "ready", shared })
      toast.success("Pitch shared.")
    } catch (e) {
      toast.error(e instanceof MissingSchemaError ? "Sharing needs the database upgrade." : e instanceof Error ? e.message : "Could not share.")
    } finally { setBusy(false) }
  }

  const withdraw = async () => {
    if (busy) return
    if (!window.confirm("Mentors and investors will no longer be able to read your pitch. Continue?")) return
    setBusy(true)
    try { await unpublishPitch(supabase, idea.id); setState({ kind: "ready", shared: null }); toast.success("Pitch withdrawn.") }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not withdraw.") }
    finally { setBusy(false) }
  }

  const shared = state.kind === "ready" ? state.shared : null
  const stale = shared ? snapshotsDiffer(shared.snapshot, current) : false

  return (
    <Panel title={<span className="flex items-center gap-2"><Share2 className="h-4 w-4" /> Share with investors and mentors</span>}
      description="Shares a frozen copy of the sections you ticked above. Only investors you have pitched and mentors you have sent a request to can read it.">
      {state.kind === "loading" ? <p className="text-sm text-zinc-500">Checking sharing status…</p> : null}
      {state.kind === "upgrade" ? <Notice tone="warn">Sharing needs the pitch-sharing database upgrade. Apply the idealab_pitch_shares migration, then reload.</Notice> : null}
      {state.kind === "error" ? <Notice tone="error">{state.message}</Notice> : null}
      {state.kind === "ready" ? (
        <div className="space-y-3">
          <p className="text-sm">
            {shared
              ? <>Shared{shared.updatedAt ? <> · last updated {new Date(shared.updatedAt).toLocaleString()}</> : null} · {shared.snapshot.sections.length} section{shared.snapshot.sections.length === 1 ? "" : "s"}.</>
              : "Not shared yet. Nobody can read your pitch."}
          </p>
          {stale ? <Notice tone="warn">Your pitch has changed since you last shared it. Update it so readers see the latest version.</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={publish} disabled={busy || count === 0 || (!!shared && !stale)}>
              {shared ? "Update shared pitch" : `Share ${count} section${count === 1 ? "" : "s"}`}
            </Button>
            {shared ? <Button type="button" size="sm" variant="outline" onClick={withdraw} disabled={busy}>Withdraw</Button> : null}
          </div>
          <p className="text-xs text-zinc-500">Your private notes, risk list, blueprint and unticked sections are never included.</p>
        </div>
      ) : null}
    </Panel>
  )
}
