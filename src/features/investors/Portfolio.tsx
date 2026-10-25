import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Briefcase, FileText, MessageSquare, Search } from "lucide-react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"

const supabase = createClient()

type Row = {
  id: string
  status: string
  idea_id: string | null
  created_at: string | null
  founders: { full_name: string | null; industry: string | null } | { full_name: string | null; industry: string | null }[] | null
  ideas: { name?: string | null; tagline?: string | null; elevator_pitch?: string | null } | { name?: string | null; tagline?: string | null; elevator_pitch?: string | null }[] | null
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

type Tab = "interested" | "open" | "passed"
const TABS: { key: Tab; label: string }[] = [
  { key: "interested", label: "Shortlist" },
  { key: "open", label: "Under review" },
  { key: "passed", label: "Passed" },
]
const tabOf = (status: string): Tab => (status === "interested" ? "interested" : status === "passed" ? "passed" : "open")

function NoteBox({ dealId, initial, userId, onSaved }: { dealId: string; initial: string; userId: string; onSaved: (v: string) => void }) {
  const [text, setText] = useState(initial)
  const [saving, setSaving] = useState(false)
  const dirty = text !== initial

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from("investor_notes")
      .upsert({ deal_id: dealId, investor_id: userId, note: text, updated_at: new Date().toISOString() }, { onConflict: "deal_id" })
    setSaving(false)
    if (error) toast.error(error.message || "Could not save the note.")
    else {
      toast.success("Note saved.")
      onSaved(text)
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={4000}
        rows={3}
        placeholder="Private note: what stood out, open questions, next step. Only you can see this."
      />
      {dirty && (
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save note"}
        </Button>
      )}
    </div>
  )
}

export function Portfolio() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [notesOk, setNotesOk] = useState(true)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("interested")
  const [q, setQ] = useState("")

  const load = useCallback(async () => {
    if (!user) return
    const deals = await supabase
      .from("deal_flow")
      .select("id, status, idea_id, created_at, founders(full_name, industry), ideas(name, tagline, elevator_pitch)")
      .eq("investor_id", user.id)
      .order("created_at", { ascending: false })
    if (deals.error) toast.error(deals.error.message)
    setRows((deals.data ?? []) as unknown as Row[])

    const n = await supabase.from("investor_notes").select("deal_id, note").eq("investor_id", user.id)
    if (n.error) {
      setNotesOk(false) // table not created yet: the page still works without notes
    } else {
      setNotesOk(true)
      const map: Record<string, string> = {}
      ;((n.data ?? []) as { deal_id: string; note: string }[]).forEach((r) => (map[r.deal_id] = r.note))
      setNotes(map)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { interested: 0, open: 0, passed: 0 }
    rows.forEach((r) => (c[tabOf(r.status)] += 1))
    return c
  }, [rows])

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows
      .filter((r) => tabOf(r.status) === tab)
      .filter((r) => {
        if (!term) return true
        const f = one(r.founders)
        const i = one(r.ideas)
        return [f?.full_name, f?.industry, i?.name, i?.tagline].some((v) => (v ?? "").toLowerCase().includes(term))
      })
  }, [rows, tab, q])

  if (loading) return <div className="p-8 text-center text-sm text-zinc-500">Loading your portfolio...</div>

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Portfolio</h1>
        <p className="mt-1 text-zinc-500">Ventures you marked Interested, with your private notes. Founders never see them.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              tab === t.key
                ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/20"
                : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:bg-zinc-900"
            }`}
          >
            <div className="text-2xl font-semibold tabular-nums">{counts[t.key]}</div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">{t.label}</div>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search founder, venture or industry"
          className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
      </div>

      {!notesOk && (
        <p className="rounded-md border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          Notes are switched off until the investor-notes database update is applied.
        </p>
      )}

      {shown.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Briefcase className="h-8 w-8 text-zinc-400" />
            <p className="text-sm text-zinc-500">
              {rows.length === 0
                ? "No deals yet. Founders who pitch you will appear here."
                : tab === "interested"
                  ? "Nothing shortlisted yet. Mark a pitch Interested in Deal Flow."
                  : "Nothing here."}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/dealflow">Open Deal Flow</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {shown.map((r) => {
            const f = one(r.founders)
            const i = one(r.ideas)
            return (
              <Card key={r.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold">{i?.name || "Untitled venture"}</h3>
                      <p className="text-sm text-zinc-500">
                        {f?.full_name || "Anonymous founder"}
                        {f?.industry ? ` · ${f.industry}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {r.status}
                    </Badge>
                  </div>
                  {(i?.tagline || i?.elevator_pitch) && (
                    <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{i?.tagline || i?.elevator_pitch}</p>
                  )}
                  {notesOk && user && (
                    <NoteBox
                      key={r.id + (notes[r.id] ?? "")}
                      dealId={r.id}
                      initial={notes[r.id] ?? ""}
                      userId={user.id}
                      onSaved={(v) => setNotes((p) => ({ ...p, [r.id]: v }))}
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {r.idea_id && (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/dashboard/pitch/${r.idea_id}`}>
                          <FileText className="mr-2 h-4 w-4" /> View pitch
                        </Link>
                      </Button>
                    )}
                    {r.status === "interested" && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/dashboard/messages">
                          <MessageSquare className="mr-2 h-4 w-4" /> Message
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
