import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Save, User, Briefcase, Link as LinkIcon, Award } from "lucide-react"

const supabase = createClient()

export function ProfileSettings() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState<'founder' | 'mentor' | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    full_name: "",
    industry: "",
    experience_years: "",
    skills: "",
    linkedin_url: ""
  })

  useEffect(() => {
    async function loadProfile() {
      if (!user) return
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (data) {
        setRole(data.role)
        setFormData({
          full_name: data.full_name || "",
          industry: data.industry || "",
          experience_years: data.experience_years ? data.experience_years.toString() : "",
          skills: data.skills || "",
          linkedin_url: data.linkedin_url || ""
        })
      }
      setLoading(false)
    }
    loadProfile()
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    try {
      const payload = {
        full_name: formData.full_name,
        // Only save mentor fields if they are a mentor
        ...(role === 'mentor' && {
          industry: formData.industry,
          experience_years: parseInt(formData.experience_years) || 0,
          skills: formData.skills,
          linkedin_url: formData.linkedin_url
        })
      }

      const { error } = await supabase.from('users').update(payload).eq('id', user.id)
      
      if (error) throw error
      toast.success("Profile updated successfully!")
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading profile data...</div>

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Profile Settings</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Manage your account details and platform preferences.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SHARED SECTION: Basic Info */}
        <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Personal Information
              </CardTitle>
              <Badge variant="outline" className="uppercase">{role}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input 
                id="full_name" name="full_name" 
                value={formData.full_name} onChange={handleChange} 
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address (Read Only)</Label>
              <Input value={user?.email || ""} disabled className="bg-zinc-50 dark:bg-zinc-900" />
            </div>
          </CardContent>
        </Card>

        {/* MENTOR ONLY SECTION: Matching Criteria */}
        {role === 'mentor' && (
          <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" /> Mentor Qualifications
              </CardTitle>
              <CardDescription>
                This data powers the matching algorithm. Ensure it is accurate to attract the right founders.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="industry" className="flex items-center gap-2"><Briefcase className="h-3 w-3"/> Primary Industry</Label>
                  <Input 
                    id="industry" name="industry" 
                    placeholder="e.g. FinTech, EdTech, SaaS"
                    value={formData.industry} onChange={handleChange} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience_years">Years of Experience</Label>
                  <Input 
                    id="experience_years" name="experience_years" type="number" min="0"
                    placeholder="e.g. 5, 10, 15"
                    value={formData.experience_years} onChange={handleChange} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills">Core Competencies (Comma separated)</Label>
                <Textarea 
                  id="skills" name="skills" 
                  placeholder="e.g. React Architecture, B2B Sales, Fundraising"
                  value={formData.skills} onChange={handleChange} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin_url" className="flex items-center gap-2"><LinkIcon className="h-3 w-3"/> LinkedIn URL</Label>
                <Input 
                  id="linkedin_url" name="linkedin_url" type="url"
                  placeholder="https://linkedin.com/in/yourprofile"
                  value={formData.linkedin_url} onChange={handleChange} 
                />
              </div>

            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}