import { useEffect, useState, type ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { SaveState } from "./autosave"
import type { Blueprint } from "./types"
import type { VentureApi } from "./useVenture"
import type { VentureData } from "./ventureRepo"

export const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length

const control =
  "w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
  "dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"

export type Option = { value: string; label: string }

// ------------------------------------------------------------------------------------------------
// Layout helpers
// ------------------------------------------------------------------------------------------------
export function Panel({ title, description, children, className }: {
  title: ReactNode; description?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <Card className={cn("border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50", className)}>
      <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? <CardDescription className="text-sm">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">{children}</CardContent>
    </Card>
  )
}

export function SectionTitle({ num, title, children }: { num?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-1 flex flex-col gap-1">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
        {num ? <span className="mr-2 font-mono text-sm font-medium text-indigo-500">{num}</span> : null}
        {title}
      </h2>
      {children ? <p className="max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">{children}</p> : null}
    </div>
  )
}

const tones = {
  info: "border-indigo-200 bg-indigo-50/60 text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-200",
  warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200",
  error: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200",
} as const

export function Notice({ tone = "info", children, className }: {
  tone?: keyof typeof tones; children: ReactNode; className?: string
}) {
  return (
    <div role={tone === "error" ? "alert" : undefined}
      className={cn("rounded-lg border px-3 py-2.5 text-xs leading-relaxed sm:text-sm", tones[tone], className)}>
      {children}
    </div>
  )
}

export function SaveBadge({ state, lastSaved, error }: { state: SaveState; lastSaved: Date | null; error: string | null }) {
  const time = lastSaved ? lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null
  const text =
    state === "saving" ? "Saving…"
    : state === "dirty" ? "Unsaved changes"
    : state === "error" ? "Not saved"
    : state === "conflict" ? "Save paused: conflict"
    : time ? `Saved ${time}` : "No changes yet"
  const color =
    state === "error" || state === "conflict" ? "text-red-600 dark:text-red-400"
    : state === "dirty" || state === "saving" ? "text-amber-600 dark:text-amber-400"
    : "text-zinc-500 dark:text-zinc-400"
  return (
    <span role="status" aria-live="polite" title={error ?? undefined} className={cn("text-xs font-medium", color)}>
      {text}
    </span>
  )
}

// ------------------------------------------------------------------------------------------------
// Controlled fields (autosaved by the hook)
// ------------------------------------------------------------------------------------------------
export function Field({ label, hint, htmlFor, aside, children }: {
  label: ReactNode; hint?: ReactNode; htmlFor?: string; aside?: ReactNode; children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-3">
        <Label htmlFor={htmlFor} className="text-sm font-semibold">{label}</Label>
        {aside ? <span className="font-mono text-[10px] text-zinc-400">{aside}</span> : null}
      </div>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  )
}

type Common = { id: string; label: ReactNode; hint?: ReactNode; placeholder?: string }

export function TextField({ id, label, hint, placeholder, value, onChange, maxLength }: Common & {
  value: string; onChange: (v: string) => void; maxLength?: number
}) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <Input id={id} value={value} maxLength={maxLength} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} className="h-10 text-sm focus-visible:ring-indigo-500" />
    </Field>
  )
}

export function AreaField({ id, label, hint, placeholder, value, onChange, rows = 4, showWords }: Common & {
  value: string; onChange: (v: string) => void; rows?: number; showWords?: boolean
}) {
  return (
    <Field label={label} hint={hint} htmlFor={id} aside={showWords ? `${words(value)} words` : undefined}>
      <Textarea id={id} value={value} rows={rows} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} className="resize-y text-sm leading-relaxed focus-visible:ring-indigo-500" />
    </Field>
  )
}

const parseNum = (t: string): number | null | "invalid" => {
  const s = t.trim()
  if (s === "") return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : "invalid"
}

export function NumberField({ id, label, hint, placeholder, value, onChange }: Common & {
  value: number | null | undefined; onChange: (n: number | null) => void
}) {
  const [text, setText] = useState(value == null ? "" : String(value))
  useEffect(() => {
    const cur = parseNum(text)
    if (cur !== "invalid" && cur !== (value ?? null)) setText(value == null ? "" : String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const invalid = parseNum(text) === "invalid"
  return (
    <Field label={label} hint={invalid ? "Enter a number that is zero or more." : hint} htmlFor={id}>
      <Input id={id} type="number" inputMode="decimal" min={0} step="any" value={text} placeholder={placeholder}
        aria-invalid={invalid} className="h-10 text-sm focus-visible:ring-indigo-500"
        onChange={e => {
          setText(e.target.value)
          const n = parseNum(e.target.value)
          if (n !== "invalid") onChange(n)
        }} />
    </Field>
  )
}

export function NativeSelect({ id, value, onChange, options, ariaLabel, className, placeholder }: {
  id?: string; value: string; onChange: (v: string) => void; options: Option[]; ariaLabel?: string
  className?: string; placeholder?: string
}) {
  return (
    <select id={id} aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)}
      className={cn(control, "h-10", className)}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function SelectField({ id, label, hint, value, onChange, options, placeholder }: Common & {
  value: string; onChange: (v: string) => void; options: Option[]
}) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <NativeSelect id={id} value={value} onChange={onChange} options={options} placeholder={placeholder ?? "Choose…"} />
    </Field>
  )
}

export function CheckField({ id, label, hint, checked, onChange }: {
  id: string; label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-zinc-300 accent-indigo-600 dark:border-zinc-700" />
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium leading-snug">{label}</Label>
        {hint ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// Commit-on-blur fields for rows in the child tables (each commit is one database write)
// ------------------------------------------------------------------------------------------------
export function CommitText({ value, onCommit, ariaLabel, placeholder, type = "text", className }: {
  value: string; onCommit: (v: string) => void; ariaLabel: string; placeholder?: string; type?: string; className?: string
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <Input aria-label={ariaLabel} type={type} value={text} placeholder={placeholder}
      className={cn("h-9 text-sm focus-visible:ring-indigo-500", className)}
      onChange={e => setText(e.target.value)}
      onBlur={() => { if (text !== value) onCommit(text) }}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }} />
  )
}

export function CommitArea({ value, onCommit, ariaLabel, placeholder, rows = 2, className }: {
  value: string; onCommit: (v: string) => void; ariaLabel: string; placeholder?: string; rows?: number; className?: string
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <Textarea aria-label={ariaLabel} value={text} rows={rows} placeholder={placeholder}
      className={cn("resize-y text-sm leading-relaxed focus-visible:ring-indigo-500", className)}
      onChange={e => setText(e.target.value)}
      onBlur={() => { if (text !== value) onCommit(text) }} />
  )
}

export function CommitNumber({ value, onCommit, ariaLabel, placeholder, className }: {
  value: number | null | undefined; onCommit: (n: number | null) => void; ariaLabel: string; placeholder?: string; className?: string
}) {
  const [text, setText] = useState(value == null ? "" : String(value))
  useEffect(() => setText(value == null ? "" : String(value)), [value])
  const invalid = parseNum(text) === "invalid"
  return (
    <Input aria-label={ariaLabel} type="number" inputMode="decimal" min={0} step="any" value={text}
      placeholder={placeholder} aria-invalid={invalid}
      className={cn("h-9 text-sm focus-visible:ring-indigo-500", className)}
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        const n = parseNum(text)
        if (n === "invalid") { setText(value == null ? "" : String(value)); return }
        if (n !== (value ?? null)) onCommit(n)
      }} />
  )
}

// ------------------------------------------------------------------------------------------------
// Blueprint-bound fields: read and write ideas' private JSON via the hook
// ------------------------------------------------------------------------------------------------
type BpKey = keyof Blueprint
type BpBase = { data: VentureData; api: VentureApi; s: BpKey; k: string }

const readBp = (data: VentureData, s: BpKey, k: string): unknown =>
  (data.idea.blueprint[s] as Record<string, unknown> | undefined)?.[k]

const writeBp = (api: VentureApi, s: BpKey, k: string, v: unknown) =>
  api.setBlueprint(b => ({ ...b, [s]: { ...(b[s] as object | undefined), [k]: v } }) as Blueprint)

export function BpText({ data, api, s, k, ...rest }: BpBase & Omit<Common, "id"> & { id?: string }) {
  return <TextField id={rest.id ?? `${String(s)}-${k}`} label={rest.label} hint={rest.hint} placeholder={rest.placeholder}
    value={String(readBp(data, s, k) ?? "")} onChange={v => writeBp(api, s, k, v)} />
}

export function BpArea({ data, api, s, k, rows, ...rest }: BpBase & Omit<Common, "id"> & { id?: string; rows?: number }) {
  return <AreaField id={rest.id ?? `${String(s)}-${k}`} label={rest.label} hint={rest.hint} placeholder={rest.placeholder} rows={rows}
    value={String(readBp(data, s, k) ?? "")} onChange={v => writeBp(api, s, k, v)} />
}

export function BpNumber({ data, api, s, k, ...rest }: BpBase & Omit<Common, "id"> & { id?: string }) {
  const raw = readBp(data, s, k)
  return <NumberField id={rest.id ?? `${String(s)}-${k}`} label={rest.label} hint={rest.hint} placeholder={rest.placeholder}
    value={typeof raw === "number" ? raw : null} onChange={n => writeBp(api, s, k, n)} />
}

export function BpSelect({ data, api, s, k, options, ...rest }: BpBase & Omit<Common, "id"> & { id?: string; options: Option[] }) {
  return <SelectField id={rest.id ?? `${String(s)}-${k}`} label={rest.label} hint={rest.hint} options={options}
    value={String(readBp(data, s, k) ?? "")} onChange={v => writeBp(api, s, k, v === "" ? undefined : v)} />
}
