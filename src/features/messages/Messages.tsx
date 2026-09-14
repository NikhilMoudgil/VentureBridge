import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Send, 
  MessageSquare, 
  Sparkles, 
  Calendar, 
  HelpCircle, 
  TrendingUp, 
  Compass,
  Clock,
  Trash2
} from "lucide-react"
import { toast } from "sonner"

const supabase = createClient()

type Contact = {
  id: string
  full_name: string
  role: 'Founder' | 'Mentor'
  industry?: string
}

type Message = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
}

type PromptTemplate = {
  id: string
  label: string
  icon: React.ReactNode
  text: string
}

// Pre-configured role-specific advisory prompts
const FOUNDER_PROMPTS: PromptTemplate[] = [
  {
    id: "intro_call",
    label: "Request Intro Call",
    icon: <Calendar className="h-3 w-3" />,
    text: "Thanks for connecting! Do you have 15 minutes this week for a brief introductory call to discuss our venture roadmap?"
  },
  {
    id: "pitch_feedback",
    label: "Review IdeaLab Hypothesis",
    icon: <Sparkles className="h-3 w-3" />,
    text: "I recently refined our problem and solution statement in IdeaLab. Would you be open to providing critical feedback on our target market assumptions?"
  },
  {
    id: "tech_blocker",
    label: "Architecture Question",
    icon: <HelpCircle className="h-3 w-3" />,
    text: "Hi! I noticed your background in this domain. We are evaluating architectural trade-offs for our MVP and would love your insight on best practices."
  },
  {
    id: "milestone_update",
    label: "Milestone Progress",
    icon: <TrendingUp className="h-3 w-3" />,
    text: "Quick progress update: we just deployed our core prototype and validated initial user intent. Would love to share our preliminary metrics with you."
  }
]

const MENTOR_PROMPTS: PromptTemplate[] = [
  {
    id: "roadblock_check",
    label: "Identify Top Roadblock",
    icon: <HelpCircle className="h-3 w-3" />,
    text: "Glad to connect! To keep our conversations high-signal: what is the single biggest operational or technical bottleneck holding you back this week?"
  },
  {
    id: "gtm_clarification",
    label: "Inquire Customer Acquisition",
    icon: <Compass className="h-3 w-3" />,
    text: "I reviewed your pitch outline. The problem space is compelling—how are you approaching your first 100 organic user acquisitions?"
  },
  {
    id: "office_hours",
    label: "Offer Office Hours",
    icon: <Clock className="h-3 w-3" />,
    text: "I hold open advisory office hours for founders. Send over your available time slots for later this week and let's set up a 20-minute strategy session."
  },
  {
    id: "async_boundary",
    label: "Async Review Mode",
    icon: <Sparkles className="h-3 w-3" />,
    text: "Happy to support asynchronously here in chat. Feel free to lay out your questions or pitch deck sections and I will review them in detail."
  }
]

export function Messages() {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<'founder' | 'mentor' | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeContact, setActiveContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 1. Fetch User Role and Accepted Connections
  useEffect(() => {
    async function fetchContacts() {
      if (!user) return

      try {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        const role = userData?.role as 'founder' | 'mentor'
        setCurrentUserRole(role)

        const { data: connections, error } = await supabase
          .from('connections')
          .select(`
            founder_id,
            mentor_id,
            founders:founder_id(id, full_name, industry),
            mentors:mentor_id(id, full_name, industry)
          `)
          .or(`founder_id.eq.${user.id},mentor_id.eq.${user.id}`)
          .eq('status', 'accepted')

        if (error) throw error

        if (connections) {
          const parsedContacts: Contact[] = connections.map((conn: any) => {
            const isFounder = role === 'founder'
            const contactData = isFounder ? conn.mentors : conn.founders
            return {
              id: contactData.id,
              full_name: contactData.full_name || "Anonymous Member",
              role: isFounder ? 'Mentor' : 'Founder',
              industry: contactData.industry
            }
          })
          setContacts(parsedContacts)
          if (parsedContacts.length > 0 && !activeContact) {
            setActiveContact(parsedContacts[0])
          }
        }
      } catch (err: any) {
        console.error("Error fetching network contacts:", err.message)
        toast.error("Could not load advisory contacts.")
      } finally {
        setLoading(false)
      }
    }

    fetchContacts()
  }, [user])

  // 2. Fetch Chat History & Subscribe to Realtime Messages
  useEffect(() => {
    if (!user || !activeContact) return

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })

      if (error) {
        console.error("Error fetching messages:", error.message)
      } else if (data) {
        setMessages(data)
      }
    }

    fetchMessages()

    const channel = supabase
      .channel(`chat_${user.id}_${activeContact.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message
          if (
            (newMsg.sender_id === user.id && newMsg.receiver_id === activeContact.id) ||
            (newMsg.sender_id === activeContact.id && newMsg.receiver_id === user.id)
          ) {
            setMessages((prev) => [...prev, newMsg])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, activeContact])

  // Auto-scroll when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSelectPrompt = (templateText: string) => {
    setNewMessage(templateText)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user || !activeContact) return

    const textToSend = newMessage.trim()
    setNewMessage("")

    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: activeContact.id,
      content: textToSend
    })

    if (error) {
      console.error("Failed to send message:", error.message)
      toast.error("Message failed to send. Please retry.")
      setNewMessage(textToSend)
    }
  }
  const handleClearChat = async () => {
    if (!user || !activeContact) return;

    // Optional: Add a browser confirmation dialog so users don't accidentally delete
    if (!window.confirm(`Are you sure you want to clear your chat history with ${activeContact.full_name}? This cannot be undone.`)) {
      return;
    }

    try {
      // Delete all messages where the current user and active contact are the sender/receiver
      const { error } = await supabase
        .from('messages')
        .delete()
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${user.id})`);

      if (error) throw error;

      // Clear the local state immediately for a snappy UI
      setMessages([]);
      toast.success("Chat history cleared.");
    } catch (err: any) {
      console.error("Failed to clear chat:", err.message);
      toast.error("Could not clear chat history.");
    }
  }

  const activePrompts = currentUserRole === 'founder' ? FOUNDER_PROMPTS : MENTOR_PROMPTS

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">Loading advisory conversations...</div>
  }

  return (
    <div className="flex h-[78vh] w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      
      {/* LEFT: Connections Sidebar */}
      <div className="w-80 border-r border-zinc-200 bg-zinc-50/50 flex flex-col dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-semibold tracking-tight text-sm text-zinc-900 dark:text-zinc-100">
            Advisory Network
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Approved Matchmaking Connections</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {contacts.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              No accepted advisory connections yet. Connect with members in Network Discovery to unlock private messaging.
            </div>
          ) : (
            contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setActiveContact(contact)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                  activeContact?.id === contact.id
                    ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Avatar className="h-9 w-9 border">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${contact.full_name}`} />
                  <AvatarFallback>{contact.full_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm truncate">{contact.full_name}</p>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                      {contact.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {contact.industry || "General Strategy"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Active Chat View */}
      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 relative">
        {activeContact ? (
          <>
            {/* Contact Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950 z-10">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${activeContact.full_name}`} />
                  <AvatarFallback>{activeContact.full_name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                    {activeContact.full_name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">{activeContact.role}</span>
                    {activeContact.industry && (
                      <>
                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                        <span className="text-xs text-zinc-500">{activeContact.industry}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleClearChat}
                title="Clear chat history"
                className="text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Conversation Log */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-2">
                  <MessageSquare className="h-8 w-8 opacity-20" />
                  <p className="text-sm">No messages yet. Use a prompt below to initiate discussion.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === user?.id
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          isMe
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-br-none'
                            : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 rounded-bl-none border border-zinc-200/50 dark:border-zinc-800'
                        }`}
                      >
                        {msg.content}
                        <span className={`block text-[10px] mt-1 ${isMe ? 'text-zinc-400 dark:text-zinc-600 text-right' : 'text-zinc-400 text-left'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* QUICK-SELECT PROMPT CAROUSEL */}
            <div className="px-4 py-2 border-t border-zinc-100 bg-zinc-50/70 dark:border-zinc-900 dark:bg-zinc-900/40">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  Advisory Quick Starters ({currentUserRole === 'founder' ? 'Founder' : 'Mentor'})
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {activePrompts.map((prompt) => (
                  <Button
                    key={prompt.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectPrompt(prompt.text)}
                    className="h-7 whitespace-nowrap rounded-full bg-white px-3 text-xs font-normal text-zinc-700 shadow-none hover:border-zinc-400 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:border-zinc-700"
                  >
                    <span className="mr-1 text-zinc-500">{prompt.icon}</span>
                    {prompt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-white border-t border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Write your message to ${activeContact.full_name}...`}
                  className="flex-1 rounded-full bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 px-4"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newMessage.trim()}
                  className="h-10 w-10 shrink-0 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-6 text-center">
            <MessageSquare className="h-12 w-12 mb-3 opacity-20" />
            <h4 className="font-semibold text-zinc-700 dark:text-zinc-300">Select an Advisory Conversation</h4>
            <p className="text-xs text-zinc-500 max-w-sm mt-1">
              Choose an accepted founder or mentor from the left panel to review past correspondence or ask questions.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}