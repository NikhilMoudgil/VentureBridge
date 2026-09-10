import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { createClient } from "@/lib/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldAlert, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

const supabase = createClient()

export function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // 1. Authenticate credentials
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      // 2. Verify Superuser Role in the database
      const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (roleError || userData?.role !== 'admin') {
        await supabase.auth.signOut()
        throw new Error("Access denied. Administrative privileges required.")
      }

      toast.success("Superuser access granted.")
      navigate("/admin/operations")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-md border-red-900/50 bg-zinc-900 shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <ShieldAlert className="h-6 w-6 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-50">System Gateway</CardTitle>
          <CardDescription className="text-zinc-400">Authorized personnel only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Admin Email</Label>
              <Input 
                id="email" 
                type="email" 
                className="border-zinc-800 bg-zinc-950 text-zinc-100" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <Input 
                id="password" 
                type="password" 
                className="border-zinc-800 bg-zinc-950 text-zinc-100" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            <Button type="submit" variant="destructive" className="w-full font-semibold" disabled={loading}>
              {loading ? "Authenticating..." : "Authorize Access"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button asChild variant="link" className="text-zinc-500 hover:text-zinc-300">
              <Link to="/login"><ArrowLeft className="mr-2 h-4 w-4" /> Return to standard login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}