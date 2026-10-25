import { useCallback, useEffect, useState } from "react"
import { MessageSquareText, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { addFeedback, cleanNote, deleteFeedback, isNotAllowed, listFeedback, MAX_NOTE, type Feedback } from "./feedbackRepo"
import { MissingSchemaError } from "./ventureRepo"

const supabase = createClient()

type Props = {
  ideaId: string
  /** "write": a mentor reviewing a mentee's pitch. "read": the founder reading what mentors said. */
  mode: "write" | "read"
  sections?: { id: string; title: string }[]
}

/** Mentor notes on a shared pitch. The database decides who may write and who may read. */
export function MentorFeedback({ ideaId, mode, sections = [] }: Props) {
  const { user } = useAuth()
  const uid = user?.id
  const [items, setItems] = useState<Feedback[]>([])
  const [state, setState] = useState<"loading" | "ready" | "upgrade" | "error">("loading")
  const [text, setText] = useState("")
  const [section, setSection] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await listFeedback(supabase, ideaId))
      setState("ready")
    } catch (e) {
      setState(e instanceof MissingSchemaError ? "upgrade" : "error")
    }
  }, [ideaId])
  useEffect(() => { setState("loading"); void load() }, [load])

  const titleOf = (id: string | null) => (id ? sections.find((s) => s.id === id)?.title ?? null : null)

  const send = async () => {
    const body = cleanNote(text)
    if (!body) { toast.error(text.trim() ? `Keep the note under ${MAX_NOTE} characters.` : "Write a note first."); return }
    setBusy(true)
    try {
      const saved = await addFeedback(supabase, ideaId, section || null, body)
      setItems((p) => [{ ...saved, mentorName: "You" }, ...p])
      setText("")
      toast.success("Feedback sent to the founder.")
    } catch (e) {
      const m = e instanceof Error ? e.message : ""
      toast.error(isNotAllowed(m) ? "You can leave feedback once the founder has accepted your request." : m || "Could not send feedback.")
    } finally { setBusy(false) }
  }

  const remove = async (id: string) => {
    if (!window.confirm("Delete this note? The founder will no longer see it.")) return
    try { await deleteFeedback(supabase, id); setItems((p) => p.filter((x) => x.id !== id)) }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete.") }
  }

  if (state === "loading") return null
  if (state === "upgrade") {
    return mode === "write"
      ? <p className="text-xs text-amber-700 dark:text-amber-400">Mentor feedback needs the pitch-feedback database upgrade.</p>
      : null
  }
  if (state === "error") return null

  return (
    <section aria-label="Mentor feedback" className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquareText className="h-4 w-4" />
        {mode === "write" ? "Your feedback for the founder" : "Mentor feedback"}
        {items.length > 0 ? <span className="font-normal text-zinc-500">({items.length})</span> : null}
      </h2>

      {mode === "write" ? (
        <div className="space-y-2">
          {sections.length > 0 ? (
            <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Which part of the pitch"
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <option value="">General feedback</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          ) : null}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={MAX_NOTE}
            placeholder="What is strong, what is unclear, what should they test next? The founder sees this with your name." />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{text.length}/{MAX_NOTE}</span>
            <Button type="button" size="sm" onClick={send} disabled={busy || text.trim().length === 0}>
              {busy ? "Sending..." : "Send feedback"}
            </Button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {mode === "read" ? "No feedback yet. Once a mentor you are connected with reviews your shared pitch, their notes appear here." : "You have not left any feedback on this pitch yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((f) => (
            <li key={f.id} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800/70">
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{f.mentorId === uid ? "You" : f.mentorName || "Mentor"}</span>
                {titleOf(f.sectionId) ? <span>on {titleOf(f.sectionId)}</span> : null}
                <span>· {new Date(f.createdAt).toLocaleDateString()}</span>
                {f.mentorId === uid ? (
                  <button type="button" onClick={() => remove(f.id)} aria-label="Delete note" className="ml-auto text-zinc-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-zinc-800 dark:text-zinc-200">{f.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
