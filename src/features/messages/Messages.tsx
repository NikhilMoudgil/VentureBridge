import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Send, MessageSquare, Sparkles, Calendar, HelpCircle, TrendingUp, Compass, Clock, Trash2, Video } from "lucide-react"
import { toast } from "sonner"
import { VideoCall } from "@/components/VideoCall"

const supabase = createClient()

type Contact = {
  id: string
  full_name: string
  role: 'Founder' | 'Mentor' | 'Investor'
  industry?: string
}

type Message = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string }
type PromptTemplate = { id: string, label: string, icon: React.ReactNode, text: string }

const FOUNDER_PROMPTS: PromptTemplate[] = [
  { id: "intro_call", label: "Request Intro Call", icon: <Calendar className="h-3 w-3" />, text: "Thanks for connecting! Do you have 15 minutes this week for a brief introductory call to discuss our venture roadmap?" },
  { id: "pitch_feedback", label: "Pitch Feedback", icon: <Sparkles className="h-3 w-3" />, text: "I recently refined our problem and solution statement. Would you be open to providing critical feedback on our assumptions?" }
]

const MENTOR_PROMPTS: PromptTemplate[] = [
  { id: "roadblock_check", label: "Identify Top Roadblock", icon: <HelpCircle className="h-3 w-3" />, text: "Glad to connect! What is the single biggest operational or technical bottleneck holding you back this week?" },
  { id: "office_hours", label: "Offer Office Hours", icon: <Clock className="h-3 w-3" />, text: "I hold open advisory office hours for founders. Send over your available time slots for later this week." }
]

const INVESTOR_PROMPTS: PromptTemplate[] = [
  { id: "traction_check", label: "Request Metrics", icon: <TrendingUp className="h-3 w-3" />, text: "Thanks for the connection. Before we set up a call, can you share your top 3 current traction metrics (e.g., MRR, Active Users)?" },
  { id: "deck_request", label: "Request Pitch Deck", icon: <Compass className="h-3 w-3" />, text: "Your IdeaLab summary looks interesting. Do you have a formal pitch deck or data room link you can share here?" }
]

export function Messages() {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<'founder' | 'mentor' | 'investor' | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeContact, setActiveContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [inCall, setInCall] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchContacts() {
      if (!user) return
      try {
        const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
        const role = userData?.role as 'founder' | 'mentor' | 'investor'
        setCurrentUserRole(role)

        let parsedContacts: Contact[] = []

        // 1. Fetch Mentor Connections (Where status = 'accepted')
        if (role === 'founder' || role === 'mentor') {
          const { data: connections } = await supabase
            .from('connections')
            .select(`founder_id, mentor_id, founders:founder_id(id, full_name, industry), mentors:mentor_id(id, full_name, industry)`)
            .or(`founder_id.eq.${user.id},mentor_id.eq.${user.id}`)
            .eq('status', 'accepted')

          if (connections) {
            connections.forEach((conn: any) => {
              const contactData = role === 'founder' ? conn.mentors : conn.founders
              if (contactData) {
                parsedContacts.push({
                  id: contactData.id,
                  full_name: contactData.full_name || "Anonymous Member",
                  role: role === 'founder' ? 'Mentor' : 'Founder',
                  industry: contactData.industry
                })
              }
            })
          }
        }

        // 2. Fetch Investor Deal Flow (Where status = 'interested')
        if (role === 'founder' || role === 'investor') {
          const { data: dealFlows } = await supabase
            .from('deal_flow')
            .select(`founder_id, investor_id, founders:founder_id(id, full_name, industry), investors:investor_id(id, full_name, investment_stage)`)
            .or(`founder_id.eq.${user.id},investor_id.eq.${user.id}`)
            .eq('status', 'interested')

          if (dealFlows) {
            dealFlows.forEach((deal: any) => {
              const contactData = role === 'founder' ? deal.investors : deal.founders
              if (contactData) {
                parsedContacts.push({
                  id: contactData.id,
                  full_name: contactData.full_name || "Anonymous Member",
                  role: role === 'founder' ? 'Investor' : 'Founder',
                  industry: contactData.industry || contactData.investment_stage
                })
              }
            })
          }
        }

        setContacts(parsedContacts)
        if (parsedContacts.length > 0 && !activeContact) setActiveContact(parsedContacts[0])
      } catch (err) {
        toast.error("Could not load advisory contacts.")
      } finally {
        setLoading(false)
      }
    }
    fetchContacts()
  }, [user])

  useEffect(() => {
    if (!user || !activeContact) return
    const fetchMessages = async () => {
      const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${user.id})`).order('created_at', { ascending: true })
      if (data) setMessages(data)
    }
    fetchMessages()

    const channel = supabase.channel(`chat_${user.id}_${activeContact.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as Message
        if ((newMsg.sender_id === user.id && newMsg.receiver_id === activeContact.id) || (newMsg.sender_id === activeContact.id && newMsg.receiver_id === user.id)) {
          setMessages((prev) => [...prev, newMsg])
        }
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, activeContact])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user || !activeContact) return
    const textToSend = newMessage.trim()
    setNewMessage("")
    const { error } = await supabase.from('messages').insert({ sender_id: user.id, receiver_id: activeContact.id, content: textToSend })
    if (error) { toast.error("Message failed to send."); setNewMessage(textToSend) }
  }

  const handleClearChat = async () => {
    if (!user || !activeContact) return;
    if (!window.confirm("Are you sure you want to clear your chat history?")) return;
    try {
      await supabase.from('messages').delete().or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${user.id})`);
      setMessages([]);
      toast.success("Chat history cleared.");
    } catch (err) { toast.error("Could not clear chat history."); }
  }

  // Deterministically sort user IDs to ensure both caller and receiver join the exact same room
  const getCallRoomId = () => {
    if (!user || !activeContact) return ""
    return [user.id, activeContact.id].sort().join("_")
  }

  const activePrompts = currentUserRole === 'founder' ? FOUNDER_PROMPTS : (currentUserRole === 'mentor' ? MENTOR_PROMPTS : INVESTOR_PROMPTS)

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading conversations...</div>

  return (
    <div className="flex h-[78vh] w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 relative">
      
      {/* WebRTC Video Call Overlay */}
      {inCall && activeContact && (
        <VideoCall 
          roomId={getCallRoomId()} 
          onEndCall={() => setInCall(false)} 
        />
      )}

      {/* Sidebar Contacts List */}
      <div className="w-80 border-r border-zinc-200 bg-zinc-50/50 flex flex-col dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-semibold tracking-tight text-sm">Active Communications</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {contacts.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">No active conversations. Connect with Mentors or get interest from Investors to unlock chat.</div>
          ) : contacts.map((contact) => (
            <button key={contact.id} onClick={() => { setActiveContact(contact); setInCall(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${activeContact?.id === contact.id ? "bg-zinc-200/80 dark:bg-zinc-800 font-medium" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
              <Avatar className="h-9 w-9 border">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${contact.full_name}`} />
                <AvatarFallback>{contact.full_name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="overflow-hidden flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm truncate">{contact.full_name}</p>
                  <Badge variant={contact.role === 'Investor' ? 'default' : 'outline'} className="text-[10px] uppercase">{contact.role}</Badge>
                </div>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{contact.industry || "General"}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 relative">
        {activeContact && (
          <>
            {/* Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border">
                  <AvatarFallback>{activeContact.full_name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-sm">{activeContact.full_name}</h3>
                  <span className="text-xs text-zinc-500">{activeContact.role}</span>
                </div>
              </div>
              
              {/* Header Action Buttons */}
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setInCall(true)} 
                  className="gap-1.5 h-8 text-xs font-medium border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-400 dark:hover:bg-indigo-950"
                >
                  <Video className="h-3.5 w-3.5 text-indigo-500" /> Video Call
                </Button>
                <Button variant="ghost" size="icon" onClick={handleClearChat} className="text-zinc-400 hover:text-red-600 h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Messages Feed */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-zinc-900 text-white rounded-br-none dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 rounded-bl-none dark:bg-zinc-900 border'}`}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Prompt Templates */}
            <div className="px-4 py-2 border-t border-zinc-100 bg-zinc-50/70 dark:border-zinc-900">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {activePrompts.map((prompt) => (
                  <Button key={prompt.id} variant="outline" size="sm" onClick={() => setNewMessage(prompt.text)} className="h-7 rounded-full text-xs">
                    <span className="mr-1 text-zinc-500">{prompt.icon}</span>{prompt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Message Input Form */}
            <div className="p-4 bg-white border-t border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={`Message ${activeContact.full_name}...`} className="rounded-full" />
                <Button type="submit" size="icon" disabled={!newMessage.trim()} className="rounded-full"><Send className="h-4 w-4" /></Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}