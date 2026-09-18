import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FlaskConical, Target, CheckCircle2, XCircle, TrendingUp, Plus, Activity } from "lucide-react"
import { toast } from "sonner"

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
  status: 'testing' | 'validated' | 'invalidated';
  experiments: Experiment[];
}

export function ValidationLab() {
  const { user } = useAuth()
  const [ideaId, setIdeaId] = useState<string | null>(null)
  const [healthScore, setHealthScore] = useState(0)
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [isHypothesisOpen, setIsHypothesisOpen] = useState(false)
  const [isExperimentOpen, setIsExperimentOpen] = useState<string | null>(null)
  
  // Forms state
  const [hypTitle, setHypTitle] = useState("")
  const [hypStatement, setHypStatement] = useState("")
  const [expMetric, setExpMetric] = useState("")
  const [expResult, setExpResult] = useState("")
  const [expScore, setExpScore] = useState("50")

  useEffect(() => {
    async function loadValidationData() {
      if (!user) return

      // 1. Get Idea and Health Score
      const { data: ideaData } = await supabase
        .from('ideas')
        .select('id, health_score')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (ideaData) {
        setIdeaId(ideaData.id)
        setHealthScore(ideaData.health_score || 0)

        // 2. Get Hypotheses and Nested Experiments
        const { data: hypData } = await supabase
          .from('hypotheses')
          .select(`
            id, title, statement, status,
            experiments ( id, metric, result, evidence_score )
          `)
          .eq('idea_id', ideaData.id)
          .order('created_at', { ascending: false })

        if (hypData) setHypotheses(hypData as any)
      }
      setLoading(false)
    }
    loadValidationData()
  }, [user])

  const recalculateHealthScore = async (currentHypotheses: Hypothesis[]) => {
    if (!ideaId) return
    
    // Simple algorithmic health score synthesis based on validated experiments
    let newScore = 10 // Baseline for starting validation
    currentHypotheses.forEach(h => {
      if (h.status === 'validated') newScore += 15
      h.experiments?.forEach(e => {
        newScore += (e.evidence_score * 0.1) // Add 10% of the experiment's evidence score
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
        .insert({ idea_id: ideaId, title: hypTitle, statement: hypStatement, status: 'testing' })
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
    } catch (err) {
      toast.error("Failed to add hypothesis.")
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

  const updateHypothesisStatus = async (id: string, newStatus: 'validated' | 'invalidated') => {
    try {
      const { error } = await supabase.from('hypotheses').update({ status: newStatus }).eq('id', id)
      if (error) throw error

      const updatedHypotheses = hypotheses.map(h => h.id === id ? { ...h, status: newStatus } : h)
      setHypotheses(updatedHypotheses)
      await recalculateHealthScore(updatedHypotheses)
      
      toast.success(`Hypothesis marked as ${newStatus}.`)
    } catch (err) {
      toast.error("Failed to update status.")
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading Validation Lab...</div>

  if (!ideaId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <FlaskConical className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
        <h2 className="text-2xl font-bold tracking-tight">No Active Venture</h2>
        <p className="mt-2 text-zinc-500 max-w-md">You must define your idea in the IdeaLab before you can start running empirical validation experiments.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-8">
      {/* HEADER & HEALTH SCORE */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Validation Lab</h1>
          <p className="mt-1 text-zinc-500">Define riskiest assumptions, log experiments, and track traction.</p>
        </div>
        <Card className="md:w-72 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-400 dark:text-emerald-600"/> Idea Health Score</span>
              <span className="text-xl font-bold">{healthScore}/100</span>
            </div>
            <Progress value={healthScore} className="h-2 bg-zinc-700 dark:bg-zinc-200" />
          </CardContent>
        </Card>
      </div>

      {/* ACTION BAR */}
      <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <h3 className="font-semibold flex items-center gap-2"><Target className="h-5 w-5 text-indigo-500" /> Business Hypotheses</h3>
        <Dialog open={isHypothesisOpen} onOpenChange={setIsHypothesisOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New Hypothesis</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log New Hypothesis</DialogTitle>
              <DialogDescription>What is the riskiest assumption about your business right now?</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddHypothesis} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Title (e.g., Pricing Tolerance)</Label>
                <Input value={hypTitle} onChange={e => setHypTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Statement</Label>
                <Textarea value={hypStatement} onChange={e => setHypStatement(e.target.value)} placeholder="e.g., Target users will pay $15/mo for this feature." required />
              </div>
              <DialogFooter><Button type="submit">Save Hypothesis</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* HYPOTHESES LIST */}
      <div className="space-y-6">
        {hypotheses.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 border border-dashed rounded-xl dark:border-zinc-800">
            No hypotheses logged yet. Add your first assumption to begin validation.
          </div>
        ) : hypotheses.map((hyp) => (
          <Card key={hyp.id} className="border-zinc-200 shadow-sm dark:border-zinc-800">
            <CardHeader className="pb-3 border-b dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <CardTitle className="text-lg">{hyp.title}</CardTitle>
                    <Badge variant={hyp.status === 'validated' ? 'default' : hyp.status === 'invalidated' ? 'destructive' : 'secondary'} className="uppercase text-[10px]">
                      {hyp.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mt-2">
                    "{hyp.statement}"
                  </CardDescription>
                </div>
                {hyp.status === 'testing' && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => updateHypothesisStatus(hyp.id, 'validated')} className="text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4 mr-1"/> Validate</Button>
                    <Button variant="outline" size="sm" onClick={() => updateHypothesisStatus(hyp.id, 'invalidated')} className="text-red-600 hover:bg-red-50"><XCircle className="h-4 w-4 mr-1"/> Invalidate</Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" /> Experiments & Evidence
                </h4>
                <Dialog open={isExperimentOpen === hyp.id} onOpenChange={(open) => setIsExperimentOpen(open ? hyp.id : null)}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-indigo-600"><Plus className="h-3 w-3" /> Log Evidence</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Log Experiment Evidence</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => handleAddExperiment(e, hyp.id)} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Metric Tracked (e.g., Conversion Rate)</Label>
                        <Input value={expMetric} onChange={e => setExpMetric(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Result / Evidence Details</Label>
                        <Textarea value={expResult} onChange={e => setExpResult(e.target.value)} placeholder="e.g., Ran $50 ad, got 14 signups." required />
                      </div>
                      <div className="space-y-2">
                        <Label>Signal Strength (0-100)</Label>
                        <Input type="number" min="0" max="100" value={expScore} onChange={e => setExpScore(e.target.value)} required />
                        <p className="text-[10px] text-zinc-500">How strong is this proof? (e.g., 100 = Paid Revenue, 20 = Survey answers)</p>
                      </div>
                      <DialogFooter><Button type="submit">Save Evidence</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {hyp.experiments.length === 0 ? (
                <p className="text-sm text-zinc-400">No experiments run yet.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {hyp.experiments.map((exp) => (
                    <div key={exp.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2 bg-white dark:bg-zinc-950">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold uppercase text-zinc-500">{exp.metric}</span>
                        <Badge variant="outline" className="text-[10px]">Signal: {exp.evidence_score}/100</Badge>
                      </div>
                      <p className="text-sm">{exp.result}</p>
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