import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FlaskConical, Target, CheckCircle2, XCircle, Plus, Activity } from "lucide-react"
import { toast } from "sonner"
import { NativeSelect } from "./workspace/fields"
import { listVentures, type VentureSummary } from "./workspace/ventureRepo"

const supabase = createClient()

type Experiment = {
  id: string;
  metric: string;
  result: string;
  evidence_score: number;
}

type Hypothesis = {
  id: string;
  title: string;
  statement: string;
  status: 'testing' | 'validated' | 'invalidated' | 'inconclusive';
  success_metric?: string | null;
  success_threshold?: string | null;
  test_method?: string | null;
  experiments: Experiment[];
}

export function ValidationLab() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [ventures, setVentures] = useState<VentureSummary[]>([])
  const [ideaId, setIdeaId] = useState<string | null>(null)
  const [hypLoading, setHypLoading] = useState(false)
  const [healthScore, setHealthScore] = useState(0)
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [loading, setLoading] = useState(true)

  const [isHypothesisOpen, setIsHypothesisOpen] = useState(false)
  const [isExperimentOpen, setIsExperimentOpen] = useState<string | null>(null)
  
  const [hypTitle, setHypTitle] = useState("")
  const [hypStatement, setHypStatement] = useState("")
  const [hypMetric, setHypMetric] = useState("")
  const [hypThreshold, setHypThreshold] = useState("")
  const [hypMethod, setHypMethod] = useState("")
  const [expMetric, setExpMetric] = useState("")
  const [expResult, setExpResult] = useState("")
  const [expScore, setExpScore] = useState("50")

  // Which venture are we working on? ?idea=<id> picks one; a founder with a single venture needs no choice.
  const wantedIdea = params.get("idea")
  const uid = user?.id
  useEffect(() => {
    let off = false
    async function loadVentures() {
      if (!uid) return
      try {
        const list = await listVentures(supabase, uid)
        if (off) return
        setVentures(list)
        const pick = list.find(v => v.id === wantedIdea) ?? (list.length === 1 ? list[0] : null)
        setIdeaId(pick ? pick.id : null)
        setHealthScore(pick?.health_score ?? 0)
      } catch {
        if (!off) toast.error("Could not load your ventures.")
      }
      if (!off) setLoading(false)
    }
    loadVentures()
    return () => { off = true }
  }, [uid, wantedIdea])

  useEffect(() => {
    if (!ideaId) { setHypotheses([]); return }
    let off = false
    async function loadHypotheses() {
      setHypLoading(true)
      const base = 'id, title, statement, status, experiments ( id, metric, result, evidence_score )'
      let res: { data: any[] | null; error: { code?: string; message?: string } | null } = await supabase
        .from('hypotheses')
        .select(`id, title, statement, status, success_metric, success_threshold, test_method, experiments ( id, metric, result, evidence_score )`)
        .eq('idea_id', ideaId)
        .order('created_at', { ascending: false })
      // Database upgrade not applied yet: fall back to the original columns so this page keeps working.
      if (res.error) {
        res = await supabase.from('hypotheses').select(base).eq('idea_id', ideaId).order('created_at', { ascending: false })
      }
      if (off) return
      if (res.data) setHypotheses(res.data as any)
      setHypLoading(false)
    }
    loadHypotheses()
    return () => { off = true }
  }, [ideaId])

  const recalculateHealthScore = async (currentHypotheses: Hypothesis[]) => {
    if (!ideaId) return
    
    let newScore = 10
    currentHypotheses.forEach(h => {
      if (h.status === 'validated') newScore += 15
      h.experiments?.forEach(e => {
        newScore += (e.evidence_score * 0.1)
      })
    })
    
    const finalScore = Math.min(100, Math.floor(newScore))
    setHealthScore(finalScore)

    await supabase.from('ideas').update({ health_score: finalScore }).eq('id', ideaId)
  }

  const handleAddHypothesis = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ideaId) return

    try {
      const { data, error } = await supabase
        .from('hypotheses')
        .insert({
          idea_id: ideaId, title: hypTitle, statement: hypStatement, status: 'testing',
          ...(hypMetric.trim() ? { success_metric: hypMetric.trim() } : {}),
          ...(hypThreshold.trim() ? { success_threshold: hypThreshold.trim() } : {}),
          ...(hypMethod.trim() ? { test_method: hypMethod.trim() } : {}),
        })
        .select()
        .single()

      if (error) throw error
      
      const newHyp = { ...data, experiments: [] }
      const updatedList = [newHyp, ...hypotheses]
      setHypotheses(updatedList)
      await recalculateHealthScore(updatedList)

      toast.success("Hypothesis logged.")
      setIsHypothesisOpen(false)
      setHypTitle("")
      setHypStatement("")
      setHypMetric("")
      setHypThreshold("")
      setHypMethod("")
    } catch (err: any) {
      toast.error(err?.code === '42703' || err?.code === 'PGRST204'
        ? "Success metric, threshold and test method need the IdeaLab database upgrade. Clear those fields or apply the upgrade."
        : "Failed to add hypothesis.")
    }
  }

  const handleAddExperiment = async (e: React.FormEvent, hypothesisId: string) => {
    e.preventDefault()
    
    try {
      const { data, error } = await supabase
        .from('experiments')
        .insert({ 
          hypothesis_id: hypothesisId, 
          metric: expMetric, 
          result: expResult, 
          evidence_score: parseInt(expScore) 
        })
        .select()
        .single()

      if (error) throw error

      const updatedHypotheses = hypotheses.map(h => {
        if (h.id === hypothesisId) {
          return { ...h, experiments: [...h.experiments, data] }
        }
        return h
      })

      setHypotheses(updatedHypotheses)
      await recalculateHealthScore(updatedHypotheses)

      toast.success("Experiment evidence logged.")
      setIsExperimentOpen(null)
      setExpMetric("")
      setExpResult("")
      setExpScore("50")
    } catch (err) {
      toast.error("Failed to add experiment.")
    }
  }

  const updateHypothesisStatus = async (id: string, newStatus: 'validated' | 'invalidated' | 'inconclusive') => {
    try {
      const { error } = await supabase.from('hypotheses').update({ status: newStatus }).eq('id', id)
      if (error) throw error

      const updatedHypotheses = hypotheses.map(h => h.id === id ? { ...h, status: newStatus } : h)
      setHypotheses(updatedHypotheses)
      await recalculateHealthScore(updatedHypotheses)
      
      toast.success(`Hypothesis marked as ${newStatus}.`)
    } catch (err: any) {
      toast.error(err?.code === '23514'
        ? "Marking a hypothesis inconclusive needs the IdeaLab database upgrade."
        : "Failed to update status.")
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading Validation Lab...</div>

  if (!ideaId && ventures.length > 1) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Which venture are you validating?</h2>
        <p className="text-xs text-zinc-500 sm:text-sm">Each venture has its own hypotheses and experiments.</p>
        <div className="grid gap-3">
          {ventures.map(v => (
            <button key={v.id} type="button" onClick={() => setParams({ idea: v.id })}
              className="rounded-xl border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600">
              <div className="font-semibold">{v.name?.trim() || v.tagline?.trim() || v.market?.trim() || "Untitled venture"}</div>
              {v.problem ? <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{v.problem}</div> : null}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (!ideaId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <FlaskConical className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">No Active Venture</h2>
        <p className="mt-2 text-xs text-zinc-500 sm:text-sm max-w-md">You must define your idea in the IdeaLab before you can start running empirical validation experiments.</p>
        <Link to="/dashboard/idealab/new" className="mt-4"><Button size="sm">Start a venture</Button></Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-8 sm:gap-8">
      {/* HEADER & HEALTH SCORE */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">Validation Lab</h1>
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">Define riskiest assumptions, log experiments, and track traction.</p>
          {ventures.length > 1 ? (
            <div className="mt-2 w-full max-w-xs">
              <NativeSelect ariaLabel="Venture" className="h-9" value={ideaId}
                options={ventures.map(v => ({ value: v.id, label: v.name?.trim() || v.tagline?.trim() || v.market?.trim() || "Untitled venture" }))}
                onChange={id => setParams({ idea: id })} />
            </div>
          ) : null}
          <Link to={`/dashboard/idealab/${ideaId}?s=risks`} className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Open this venture's workspace
          </Link>
        </div>
        <Card className="w-full md:w-72 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-400 dark:text-emerald-600"/> Idea Health Score</span>
              <span className="text-lg font-bold sm:text-xl">{healthScore}/100</span>
            </div>
            <Progress value={healthScore} className="h-2 bg-zinc-700 dark:bg-zinc-200" />
            <p className="mt-2 text-[10px] leading-snug opacity-70">Built from the signal strengths you rate and hypotheses you mark validated. A progress indicator, not a measure of demand.</p>
          </CardContent>
        </Card>
      </div>

      {/* ACTION BAR */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <h3 className="font-semibold text-sm sm:text-base flex items-center gap-2"><Target className="h-5 w-5 text-indigo-500" /> Business Hypotheses</h3>
        <Dialog open={isHypothesisOpen} onOpenChange={setIsHypothesisOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 self-start sm:self-auto"><Plus className="h-4 w-4" /> New Hypothesis</Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle>Log New Hypothesis</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">What is the riskiest assumption about your business right now?</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddHypothesis} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Title (e.g., Pricing Tolerance)</Label>
                <Input value={hypTitle} onChange={e => setHypTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Statement</Label>
                <Textarea value={hypStatement} onChange={e => setHypStatement(e.target.value)} placeholder="e.g., Target users will pay $15/mo for this feature." required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Success metric (optional)</Label>
                  <Input value={hypMetric} onChange={e => setHypMetric(e.target.value)} placeholder="e.g., paid trial rate" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Success threshold (optional)</Label>
                  <Input value={hypThreshold} onChange={e => setHypThreshold(e.target.value)} placeholder="e.g., 10 of 50 people" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">How you will test it (optional)</Label>
                <Input value={hypMethod} onChange={e => setHypMethod(e.target.value)} placeholder="e.g., landing page and 50 messages" />
              </div>
              <DialogFooter><Button type="submit" size="sm">Save Hypothesis</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* HYPOTHESES LIST */}
      <div className="space-y-4 sm:space-y-6">
        {hypLoading ? (
          <div className="text-center py-12 text-xs sm:text-sm text-zinc-500">Loading hypotheses...</div>
        ) : hypotheses.length === 0 ? (
          <div className="text-center py-12 text-xs sm:text-sm text-zinc-500 border border-dashed rounded-xl dark:border-zinc-800">
            No hypotheses logged yet. Add your first assumption to begin validation.
          </div>
        ) : hypotheses.map((hyp) => (
          <Card key={hyp.id} className="border-zinc-200 shadow-sm dark:border-zinc-800">
            <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3 border-b dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 sm:gap-3 mb-1">
                    <CardTitle className="text-base sm:text-lg">{hyp.title}</CardTitle>
                    <Badge variant={hyp.status === 'validated' ? 'default' : hyp.status === 'invalidated' ? 'destructive' : hyp.status === 'inconclusive' ? 'outline' : 'secondary'} className="uppercase text-[10px]">
                      {hyp.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mt-1">
                    "{hyp.statement}"
                  </CardDescription>
                  {(hyp.success_metric || hyp.success_threshold || hyp.test_method) ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      {hyp.success_metric ? <>Metric: {hyp.success_metric}. </> : null}
                      {hyp.success_threshold ? <>Success if: {hyp.success_threshold}. </> : null}
                      {hyp.test_method ? <>Test: {hyp.test_method}.</> : null}
                    </p>
                  ) : null}
                  {hyp.status === 'validated' && hyp.experiments.length === 0 ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Marked validated, but no experiment is recorded to back it. Log the evidence below.</p>
                  ) : null}
                </div>
                {hyp.status === 'testing' && (
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => updateHypothesisStatus(hyp.id, 'validated')} className="text-emerald-600 hover:bg-emerald-50 text-xs px-2.5 h-8"><CheckCircle2 className="h-3.5 w-3.5 mr-1"/> Validate</Button>
                    <Button variant="outline" size="sm" onClick={() => updateHypothesisStatus(hyp.id, 'invalidated')} className="text-red-600 hover:bg-red-50 text-xs px-2.5 h-8"><XCircle className="h-3.5 w-3.5 mr-1"/> Invalidate</Button>
                    <Button variant="outline" size="sm" onClick={() => updateHypothesisStatus(hyp.id, 'inconclusive')} className="text-xs px-2.5 h-8">Inconclusive</Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-4 sm:p-6 sm:pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" /> Experiments & Evidence
                </h4>
                <Dialog open={isExperimentOpen === hyp.id} onOpenChange={(open) => setIsExperimentOpen(open ? hyp.id : null)}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-indigo-600 text-xs"><Plus className="h-3 w-3" /> Log Evidence</Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-md">
                    <DialogHeader><DialogTitle>Log Experiment Evidence</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => handleAddExperiment(e, hyp.id)} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Metric Tracked (e.g., Conversion Rate)</Label>
                        <Input value={expMetric} onChange={e => setExpMetric(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Result / Evidence Details</Label>
                        <Textarea value={expResult} onChange={e => setExpResult(e.target.value)} placeholder="e.g., Ran $50 ad, got 14 signups." required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Signal Strength (0-100)</Label>
                        <Input type="number" min="0" max="100" value={expScore} onChange={e => setExpScore(e.target.value)} required />
                      </div>
                      <DialogFooter><Button type="submit" size="sm">Save Evidence</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {hyp.experiments.length === 0 ? (
                <p className="text-xs sm:text-sm text-zinc-400">No experiments run yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {hyp.experiments.map((exp) => (
                    <div key={exp.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 space-y-2 bg-white dark:bg-zinc-950">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-semibold uppercase text-zinc-500">{exp.metric}</span>
                        <Badge variant="outline" className="text-[10px]">Signal: {exp.evidence_score}/100</Badge>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">{exp.result}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}