/**
 * Autosave state machine for one open venture. No React and no direct Supabase import, so it can be
 * tested with the in-memory fake. useVenture owns one Session per open venture.
 */
import {
  ConflictError, MissingSchemaError, saveIdea, saveWorkspace, type Db, type IdeaPatch, type VentureData,
} from "./ventureRepo"

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict"

export const AUTOSAVE_MS = 1200

/** All mutable state for one open venture. A new Session is created per (venture, load); an old one can finish its last save in the background. */
export type Session = {
  id: string
  data: VentureData
  versions: { idea: number; ws: number | null }
  pendingIdea: IdeaPatch
  wsDirty: boolean
  saving: boolean
  again: boolean
  timer: ReturnType<typeof setTimeout> | undefined
  state: SaveState
  /** true once this session no longer owns the screen: it may still finish saving but must not touch UI state */
  dead: boolean
}

export type Ui = {
  state: (s: Session, st: SaveState) => void
  error: (s: Session, m: string | null) => void
  saved: (s: Session) => void
  data: (s: Session) => void
}

export function makeSession(id: string, data: VentureData): Session {
  return {
    id, data, versions: { idea: data.idea.row_version, ws: data.workspaceVersion },
    pendingIdea: {}, wsDirty: false, saving: false, again: false, timer: undefined, state: "idle", dead: false,
  }
}

export function schedule(s: Session, ui: Ui, db: Db, ms: number) {
  if (s.timer) clearTimeout(s.timer)
  s.timer = setTimeout(() => { void flushSession(s, ui, db) }, ms)
}

/**
 * Writes pending edits. Edits that arrive while a save is in flight are kept and sent afterwards.
 * If a part fails, only that part's pending edits are restored, so a retry never resends what already saved.
 */
export async function flushSession(s: Session, ui: Ui, db: Db): Promise<void> {
  if (s.timer) { clearTimeout(s.timer); s.timer = undefined }
  if (s.state === "conflict") return
  if (s.saving) { s.again = true; return }

  const patch = s.pendingIdea
  const doWs = s.wsDirty
  const hasIdea = Object.keys(patch).length > 0
  if (!hasIdea && !doWs) return

  s.saving = true
  s.pendingIdea = {}
  s.wsDirty = false
  ui.state(s, "saving")
  ui.error(s, null)

  const { blueprint, pitch_settings } = s.data.idea
  let ideaDone = !hasIdea
  let wsDone = !doWs
  try {
    if (!ideaDone) { s.versions.idea = await saveIdea(db, s.id, s.versions.idea, patch); ideaDone = true }
    if (!wsDone) { s.versions.ws = await saveWorkspace(db, s.id, s.versions.ws, blueprint, pitch_settings); wsDone = true }
    ui.saved(s)
  } catch (e) {
    if (!ideaDone) s.pendingIdea = { ...patch, ...s.pendingIdea } // newer edits win
    if (!wsDone) s.wsDirty = true
    s.saving = false
    if (e instanceof ConflictError) { ui.state(s, "conflict"); ui.error(s, e.message) }
    else if (e instanceof MissingSchemaError) { ui.state(s, "error"); ui.error(s, e.message) }
    else { ui.state(s, "error"); ui.error(s, e instanceof Error ? e.message : "Could not save.") }
    return
  }

  s.saving = false
  const more = s.again || Object.keys(s.pendingIdea).length > 0 || s.wsDirty
  s.again = false
  if (more) { ui.state(s, "dirty"); schedule(s, ui, db, 300) } else ui.state(s, "saved")
}
