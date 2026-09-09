import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { Sparkles, Save, AlertTriangle, Target, HelpCircle } from "lucide-react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"

const supabase = createClient()

export function IdeaLab() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("problem")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ideaId, setIdeaId] = useState<string | null>(null)

  // AI State
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiResults, setAiResults] = useState<{ risks: string[], audience: string, questions: string[] } | null>(null)

  const [formData, setFormData] = useState({
    problem: "",
    solution: "",
    market: "",
    techStack: ""
  })

  useEffect(() => {
    async function loadDraft() {
      if (!user) return
      const { data } = await supabase.from('ideas').select('*').eq('owner_id', user.id).maybeSingle()
      if (data) {
        setIdeaId(data.id)
        setFormData({
          problem: data.problem || "",
          solution: data.solution || "",
          market: data.market || "",
          techStack: data.tech_stack || ""
        })
      }
      setLoading(false)
    }
    loadDraft()
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    const payload = {
      owner_id: user.id,
      problem: formData.problem,
      solution: formData.solution,
      market: formData.market,
      tech_stack: formData.techStack,
      updated_at: new Date().toISOString()
    }

    try {
      if (ideaId) {
        const { error } = await supabase.from('ideas').update(payload).eq('id', ideaId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('ideas').insert([payload]).select('id').single()
        if (error) throw error
        if (data) setIdeaId(data.id)
      }
      toast.success("Venture details saved successfully!")
    } catch (error: any) {
      toast.error(error.message || "Failed to save draft.")
    } finally {
      setSaving(false)
    }
  }

  // Simulate calling the LLM API backend
  const runAIAnalysis = () => {
    if (!formData.problem || !formData.solution) {
      toast.error("Please fill out the Problem and Solution fields first.")
      return
    }
    
    setAiAnalyzing(true)
    
    // Simulate a 2-second network request to your future AI endpoint
    setTimeout(() => {
      setAiResults({
        risks: [
          "Customer acquisition cost (CAC) might exceed lifetime value in this specific niche.",
          "High dependency on third-party APIs limits your technical moat."
        ],
        audience: "The current pitch targets too broad an audience. Narrow it down to early-stage B2B SaaS founders first.",
        questions: [
          "How will you acquire your first 100 paying users without paid ads?",
          "What happens if a major competitor replicates this feature?"
        ]
      })
      setAiAnalyzing(false)
      toast.success("AI Diagnostic Complete")
    }, 2000)
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading IdeaLab workspace...</div>

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">IdeaLab</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Structure your venture hypothesis and run AI validation.
          </p>
        </div>
        <div className="mt-4 flex gap-3 md:mt-0">
          
          {/* AI Diagnostics Sheet Trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button onClick={runAIAnalysis} variant="secondary" className="gap-2">
                <Sparkles className="h-4 w-4" /> {aiAnalyzing ? "Analyzing..." : "AI Diagnostics"}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500" /> 
                  AI Diagnostic Report
                </SheetTitle>
                <SheetDescription>
                  Automated risk analysis and market feedback based on your current IdeaLab draft.
                </SheetDescription>
              </SheetHeader>
              
              <ScrollArea className="mt-6 h-[calc(100vh-8rem)] pr-4">
                {aiAnalyzing ? (
                  <div className="flex flex-col items-center justify-center space-y-4 py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-indigo-500" />
                    <p className="text-sm text-zinc-500">Evaluating assumptions...</p>
                  </div>
                ) : aiResults ? (
                  <div className="space-y-6 pb-8">
                    
                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> Core Risks
                      </h4>
                      <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {aiResults.risks.map((risk, i) => (
                          <li key={i} className="rounded-md border p-3 dark:border-zinc-800">{risk}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
                        <Target className="h-4 w-4 text-emerald-500" /> Market Positioning
                      </h4>
                      <div className="rounded-md border p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                        {aiResults.audience}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
                        <HelpCircle className="h-4 w-4 text-blue-500" /> Validation Questions
                      </h4>
                      <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {aiResults.questions.map((q, i) => (
                          <li key={i} className="rounded-md border p-3 dark:border-zinc-800">{q}</li>
                        ))}
                      </ul>
                    </div>

                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-zinc-500">
                    No data to display. Please run the analysis.
                  </div>
                )}
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Draft"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8 grid w-full grid-cols-3">
            <TabsTrigger value="problem">1. The Problem</TabsTrigger>
            <TabsTrigger value="solution">2. The Solution</TabsTrigger>
            <TabsTrigger value="market">3. Market & Stage</TabsTrigger>
          </TabsList>

          <TabsContent value="problem">
            <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <CardHeader>
                <CardTitle>Define the Problem</CardTitle>
                <CardDescription>What is the core pain point you are solving?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="problem">Problem Statement</Label>
                  <Textarea 
                    id="problem" 
                    name="problem"
                    value={formData.problem} 
                    onChange={handleChange}
                    placeholder="Describe the problem your target audience faces..." 
                    className="min-h-[150px]" 
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t border-zinc-100 p-4 dark:border-zinc-800">
                <Button type="button" onClick={() => setActiveTab("solution")}>Next: The Solution →</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="solution">
            <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <CardHeader>
                <CardTitle>Outline your Solution</CardTitle>
                <CardDescription>How does your product eliminate the pain point?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="solution">Core Value Proposition</Label>
                  <Textarea 
                    id="solution" 
                    name="solution"
                    value={formData.solution}
                    onChange={handleChange}
                    placeholder="Describe your product or service..." 
                    className="min-h-[150px]" 
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-zinc-100 p-4 dark:border-zinc-800">
                <Button type="button" variant="outline" onClick={() => setActiveTab("problem")}>← Back</Button>
                <Button type="button" onClick={() => setActiveTab("market")}>Next: Market & Stage →</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="market">
            <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <CardHeader>
                <CardTitle>Market & Execution</CardTitle>
                <CardDescription>Who is paying for this and where are you right now?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="market">Target Audience</Label>
                  <Input 
                    id="market" 
                    name="market"
                    value={formData.market}
                    onChange={handleChange}
                    placeholder="e.g. B2B SaaS companies, College students" 
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="techStack">Tech Stack / Required Skills</Label>
                  <Input 
                    id="techStack" 
                    name="techStack"
                    value={formData.techStack}
                    onChange={handleChange}
                    placeholder="e.g. React, Python, Marketing" 
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-zinc-100 p-4 dark:border-zinc-800">
                <Button type="button" variant="outline" onClick={() => setActiveTab("solution")}>← Back</Button>
                <Button type="submit" disabled={saving}>Save Venture Details</Button>
              </CardFooter>
            </Card>
          </TabsContent>

        </Tabs>
      </form>
    </div>
  )
}