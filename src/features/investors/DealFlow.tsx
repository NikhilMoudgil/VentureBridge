import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, CheckCircle2, X } from "lucide-react"
import { toast } from "sonner"

const supabase = createClient()

type Deal = {
  id: string
  status: string
  founders: { full_name: string; industry: string }
  ideas: { elevator_pitch: string; problem: string; target_market: string; tech_stack: string }
}

export function DealFlow() {
  const { user } = useAuth()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDeals() {
      if (!user) return
      
      const { data, error } = await supabase
        .from('deal_flow')
        .select(`
          id, status, 
          founders(full_name, industry), 
          ideas(elevator_pitch, problem, target_market, tech_stack)
        `)
        .eq('investor_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error("Deal Flow Fetch Error:", error)
        toast.error(`Database Error: ${error.message}`)
      } else if (data) {
        setDeals(data as any[])
      }
      setLoading(false)
    }

    fetchDeals()

    // NEW: Real-time listener. Instantly updates the list if a founder submits a new pitch.
    if (!user) return
    const channel = supabase.channel(`investor_deal_flow_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_flow', filter: `investor_id=eq.${user.id}` }, () => {
        fetchDeals()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const updateDealStatus = async (dealId: string, newStatus: 'interested' | 'passed') => {
    try {
      const { error } = await supabase.from('deal_flow').update({ status: newStatus }).eq('id', dealId)
      if (error) throw error
      toast.success(`Deal marked as ${newStatus}`)
    } catch (err: any) { 
      toast.error(err.message || "Failed to update status") 
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading deal flow pipeline...</div>

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deal Flow Pipeline</h1>
          <p className="mt-1 text-zinc-500">Discover and evaluate vetted startup pitches.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-4">
        {deals.length === 0 ? (
          <Card className="col-span-2 flex flex-col items-center justify-center border-dashed bg-zinc-50 py-24 text-zinc-500 dark:bg-zinc-900/20">
            <TrendingUp className="mb-4 h-8 w-8 opacity-20" />
            <p className="text-sm">No pitches received yet. Ensure your profile is updated.</p>
          </Card>
        ) : deals.map(deal => (
          <Card key={deal.id} className="flex flex-col justify-between transition-all hover:border-zinc-400">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <Badge className={deal.status === 'interested' ? "bg-emerald-100 text-emerald-700" : deal.status === 'passed' ? "bg-zinc-100 text-zinc-500" : "bg-indigo-100 text-indigo-700"}>
                  {deal.status.toUpperCase()}
                </Badge>
                <span className="text-xs font-mono text-zinc-500">{deal.founders?.industry || "Tech"}</span>
              </div>
              <CardTitle className="text-lg">Pitch by {deal.founders?.full_name}</CardTitle>
              <CardDescription className="mt-2 text-zinc-800 dark:text-zinc-200 font-medium">
                {deal.ideas?.elevator_pitch || "No pitch provided."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Problem</span>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">{deal.ideas?.problem}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                <div><span className="font-semibold text-zinc-700 dark:text-zinc-300">Market:</span> {deal.ideas?.target_market}</div>
                <div><span className="font-semibold text-zinc-700 dark:text-zinc-300">Stack:</span> {deal.ideas?.tech_stack}</div>
              </div>
            </CardContent>
            
            {/* Action Bar */}
            {(deal.status === 'submitted' || deal.status === 'reviewing') && (
              <CardFooter className="border-t bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 flex gap-2">
                <Button className="w-1/2 bg-emerald-600 hover:bg-emerald-700" onClick={() => updateDealStatus(deal.id, 'interested')}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Interested
                </Button>
                <Button variant="outline" className="w-1/2 text-red-600" onClick={() => updateDealStatus(deal.id, 'passed')}>
                  <X className="h-4 w-4 mr-2" /> Pass
                </Button>
              </CardFooter>
            )}
            {deal.status === 'interested' && (
              <CardFooter className="border-t bg-emerald-50 p-4 text-sm text-emerald-700 font-medium">
                <CheckCircle2 className="h-4 w-4 mr-2" /> Private Chat Unlocked in Messages
              </CardFooter>
            )}
            {deal.status === 'passed' && (
              <CardFooter className="border-t bg-zinc-100 p-4 text-sm text-zinc-500 font-medium">
                <X className="h-4 w-4 mr-2" /> You passed on this deal.
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}