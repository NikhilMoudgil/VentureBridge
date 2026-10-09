import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Plus, Rocket, Target, Code, Calendar } from "lucide-react"

const supabase = createClient()

type Idea = {
  id: string
  problem?: string
  solution?: string
  elevator_pitch?: string
  market?: string
  target_market?: string
  tech_stack: string
  created_at: string
}

export function MyVentures() {
  const { user } = useAuth()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchIdeas() {
      if (!user) return
      
      const { data } = await supabase
        .from('ideas')
        .select('*')
        .or(`id.eq.${user.id},owner_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (data) setIdeas(data)
      setLoading(false)
    }
    fetchIdeas()
  }, [user])

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">Loading your ventures...</div>
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8 sm:gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">My Ventures</h1>
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
            Manage your saved startup drafts and validated ideas.
          </p>
        </div>
        <div>
          <Link to="/dashboard/idealab">
            <Button size="sm" className="gap-2 sm:size-default">
              <Plus className="h-4 w-4" /> New Venture
            </Button>
          </Link>
        </div>
      </div>

      {ideas.length === 0 && (
        <div className="flex min-h-[35vh] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-950/50">
          <Rocket className="mb-4 h-10 w-10 text-zinc-300 sm:h-12 sm:w-12 dark:text-zinc-700" />
          <h3 className="text-base font-semibold text-zinc-900 sm:text-lg dark:text-zinc-50">No ventures found</h3>
          <p className="mb-4 mt-1 text-xs text-zinc-500 sm:text-sm">You haven't saved any drafts in the IdeaLab yet.</p>
          <Link to="/dashboard/idealab">
            <Button variant="outline" size="sm">Start Building</Button>
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {ideas.map((idea) => {
          const date = new Date(idea.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          const solutionText = idea.solution || idea.elevator_pitch || "No solution drafted yet."
          const marketText = idea.market || idea.target_market || "General"
          const snippet = solutionText.length > 100 ? solutionText.substring(0, 100) + "..." : solutionText
          
          return (
            <Dialog key={idea.id}>
              <DialogTrigger asChild>
                <Card className="group cursor-pointer border-zinc-200 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-950">
                  <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="bg-indigo-50 text-[10px] text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">Draft</Badge>
                      <div className="flex items-center gap-1 text-xs text-zinc-400">
                        <Calendar className="h-3 w-3" /> {date}
                      </div>
                    </div>
                    <CardTitle className="mt-2 text-base line-clamp-1 sm:text-lg">
                      {marketText} Venture
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <p className="text-xs text-zinc-500 sm:text-sm dark:text-zinc-400 line-clamp-3">
                      {snippet}
                    </p>
                  </CardContent>
                </Card>
              </DialogTrigger>
              
              <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">Draft</Badge>
                    <span className="text-xs text-zinc-500">Created: {date}</span>
                  </div>
                  <DialogTitle className="text-xl sm:text-2xl">Venture Details</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Your saved hypothesis and technical parameters.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="mt-4 space-y-4 sm:space-y-6">
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 sm:text-base dark:text-zinc-50">
                      <Target className="h-4 w-4 text-emerald-500" /> The Problem
                    </h4>
                    <p className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 sm:p-4 sm:text-sm dark:bg-zinc-900 dark:text-zinc-300">
                      {idea.problem || "Not provided."}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 sm:text-base dark:text-zinc-50">
                      <Rocket className="h-4 w-4 text-indigo-500" /> Core Solution
                    </h4>
                    <p className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 sm:p-4 sm:text-sm dark:bg-zinc-900 dark:text-zinc-300">
                      {solutionText}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-zinc-900 sm:text-sm dark:text-zinc-50">Target Market</h4>
                      <p className="rounded-md border p-3 text-xs text-zinc-600 sm:text-sm dark:border-zinc-800 dark:text-zinc-400">
                        {marketText}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="flex items-center gap-2 text-xs font-semibold text-zinc-900 sm:text-sm dark:text-zinc-50">
                        <Code className="h-4 w-4 text-zinc-500" /> Tech Stack
                      </h4>
                      <p className="rounded-md border p-3 text-xs text-zinc-600 sm:text-sm dark:border-zinc-800 dark:text-zinc-400">
                        {idea.tech_stack || "Not provided."}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end gap-3 border-t pt-4 dark:border-zinc-800">
                  <Link to="/dashboard/idealab">
                    <Button size="sm" className="sm:size-default">Edit in IdeaLab</Button>
                  </Link>
                </div>
              </DialogContent>
            </Dialog>
          )
        })}
      </div>
    </div>
  )
}