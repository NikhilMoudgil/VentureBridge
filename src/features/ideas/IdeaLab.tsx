import { useEffect, useRef, useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { createVenture, listVentures, MissingSchemaError, type VentureSummary } from "./workspace/ventureRepo"

const supabase = createClient()

/** One key per "new venture" form. A double click or a retry sends the same key, so it can only ever create one venture. */
function newClientKey(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === "function") return c.randomUUID()
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function UpgradeNotice() {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
      <Lightbulb className="h-10 w-10 text-zinc-300" aria-hidden />
      <h2 className="text-xl font-bold">The IdeaLab database upgrade is needed</h2>
      <p className="text-sm text-zinc-500">
        Apply the <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">idealab_workspace</code> migration in Supabase, then reload.
        Your existing ventures are not changed.
      </p>
      <Link to="/dashboard/ventures"><Button variant="outline" size="sm">Back to My Ventures</Button></Link>
    </div>
  )
}

/** Start a new venture. Creates one row, then opens its workspace. */
export function NewVenture() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const key = useRef(newClientKey())
  const busy = useRef(false)
  const [name, setName] = useState("")
  const [tagline, setTagline] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [upgrade, setUpgrade] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || busy.current || !name.trim()) return
    busy.current = true
    setCreating(true)
    setError(null)
    try {
      const id = await createVenture(supabase, user.id, key.current, { name, tagline })
      navigate(`/dashboard/idealab/${id}`, { replace: true })
    } catch (err) {
      if (err instanceof MissingSchemaError) setUpgrade(true)
      else setError(err instanceof Error ? err.message : "Could not create the venture.")
      busy.current = false
      setCreating(false)
    }
  }

  if (upgrade) return <UpgradeNotice />

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 py-8">
      <div className="space-y-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-gradient-to-br from-zinc-800 to-zinc-950 shadow-md dark:from-zinc-100 dark:to-zinc-300">
          <Lightbulb className="h-5 w-5 text-zinc-100 dark:text-zinc-900" aria-hidden />
        </div>
        <h1 className="pt-2 text-2xl font-bold tracking-tight sm:text-3xl">Start a new venture</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Name it now; everything else can be filled in as you learn. You can run several ventures side by side.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nv-name" className="font-semibold">Venture name</Label>
          <Input id="nv-name" autoFocus required value={name} onChange={e => setName(e.target.value)} maxLength={120}
            placeholder="e.g. PathFinder" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nv-tag" className="font-semibold">One-line description <span className="font-normal text-zinc-400">(optional)</span></Label>
          <Input id="nv-tag" value={tagline} onChange={e => setTagline(e.target.value)} maxLength={200}
            placeholder="What it is, for whom" />
        </div>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={creating || !name.trim()}>{creating ? "Creating…" : "Create venture"}</Button>
          <Link to="/dashboard/ventures"><Button type="button" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </div>
  )
}

/**
 * /dashboard/idealab: opens your most recently edited venture, or starts the first one.
 * (The earlier single-form editor has been replaced by the workspace at /dashboard/idealab/:ideaId.)
 */
export function IdeaLab() {
  const { user } = useAuth()
  const [ventures, setVentures] = useState<VentureSummary[] | null>(null)
  const [upgrade, setUpgrade] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const uid = user?.id
  useEffect(() => {
    if (!uid) return
    let off = false
    listVentures(supabase, uid)
      .then(r => { if (!off) setVentures(r) })
      .catch(e => {
        if (off) return
        if (e instanceof MissingSchemaError) setUpgrade(true)
        else setError(e instanceof Error ? e.message : "Could not load your ventures.")
      })
    return () => { off = true }
  }, [uid, tick])

  if (upgrade) return <UpgradeNotice />
  if (error) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-zinc-500">{error}</p>
        <Button size="sm" onClick={() => { setError(null); setTick(t => t + 1) }}>Try again</Button>
      </div>
    )
  }
  if (!ventures) return <div className="p-12 text-center text-sm font-medium text-zinc-500 animate-pulse">Loading IdeaLab…</div>
  if (ventures.length > 0) return <Navigate to={`/dashboard/idealab/${ventures[0].id}`} replace />
  return <NewVenture />
}
