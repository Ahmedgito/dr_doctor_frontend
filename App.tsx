import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MapPin, ShieldCheck, Mic, DollarSign, Star, Sun, Moon, Sparkles, Menu, X, Plus, Trash2, MessageSquare } from 'lucide-react';
import { useAuth } from '@clerk/react';
import { Message, Sender, Coordinates, ConversationSummary } from './types';
import { streamChat, ChatFilters } from './services/chatApi';
import { listConversations, getConversation, deleteConversation } from './services/conversationsApi';
import MessageBubble from './components/MessageBubble';
import UserMenu from './components/UserMenu';

const INITIAL_MESSAGE: Message = {
  id: 'init-1',
  text: "Hello! I'm **Dr. Doctor**. \n\nI can help you analyze your symptoms and find the best nearby specialists or hospitals. \n\nHow are you feeling today?",
  sender: Sender.Bot,
  timestamp: new Date(),
};

type FilterType = 'price' | 'nearest' | 'experienced';

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function App() {
  const { getToken, isSignedIn } = useAuth();

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [activeFilters, setActiveFilters] = useState<FilterType[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      setTimeout(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, [messages, isProcessing]);

  // Handle Dark Mode
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || !savedTheme) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return newMode;
    });
  };

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('denied'); return; }
    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationStatus('granted');
      },
      (error) => { console.error('Geolocation error:', error); setLocationStatus('denied'); }
    );
  };

  useEffect(() => { requestLocation(); }, []);

  // ── Conversation history ────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    if (!isSignedIn) return;
    setConvLoading(true);
    try {
      const data = await listConversations(getToken);
      setConversations(data.conversations);
    } catch {
      // silently fail — don't break the chat experience
    } finally {
      setConvLoading(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (isSignedIn) {
      loadConversations();
    } else {
      // Anonymous → authenticated upgrade: clear local conversation state
      setConversations([]);
      setConversationId(null);
    }
  }, [isSignedIn, loadConversations]);

  const startNewConversation = () => {
    setMessages([INITIAL_MESSAGE]);
    setConversationId(null);
    setRateLimitMsg(null);
    setIsSidebarOpen(false);
  };

  const selectConversation = async (id: string) => {
    try {
      const conv = await getConversation(getToken, id);
      if (!conv) return;
      const restored: Message[] = conv.messages.map(m => ({
        id: m.id,
        text: m.content,
        sender: m.role === 'user' ? Sender.User : Sender.Bot,
        timestamp: new Date(m.created_at),
      }));
      setMessages(restored.length > 0 ? restored : [INITIAL_MESSAGE]);
      setConversationId(id);
      setRateLimitMsg(null);
      setIsSidebarOpen(false);
    } catch {
      // ignore — keep current chat intact
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await deleteConversation(getToken, id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) startNewConversation();
    } catch {
      // ignore
    }
  };

  // ── Filters ─────────────────────────────────────────────────────────────

  const toggleFilter = (filter: FilterType) => {
    setActiveFilters(prev =>
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  // ── Send message ─────────────────────────────────────────────────────────

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userText = inputValue.trim();
    setInputValue('');
    setIsProcessing(true);
    setRateLimitMsg(null);

    const userMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: Sender.User,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    const botMsgId = 'bot-' + Date.now();
    setMessages(prev => [...prev, {
      id: botMsgId,
      text: '',
      sender: Sender.Bot,
      timestamp: new Date(),
      isTyping: true,
    }]);

    const filters: ChatFilters = {};
    if (location && activeFilters.includes('nearest')) {
      filters.user_lat = location.latitude;
      filters.user_lng = location.longitude;
    }
    if (activeFilters.includes('price')) filters.max_fee = 1500;
    if (activeFilters.includes('experienced')) filters.min_satisfaction = 80;

    let accText = '';

    await streamChat(userText, conversationId, filters, {
      onText: (chunk) => {
        accText += chunk;
        setMessages(prev => prev.map(msg =>
          msg.id === botMsgId ? { ...msg, text: accText, isTyping: false } : msg
        ));
      },
      onMetadata: (meta) => {
        setConversationId(meta.conversation_id);
        setMessages(prev => prev.map(msg =>
          msg.id === botMsgId
            ? {
                ...msg,
                phase: meta.phase,
                emergency: meta.emergency,
                doctors: meta.phase === 'recommendation' ? meta.doctors_shown : undefined,
                urgency: meta.phase === 'recommendation' ? meta.urgency : undefined,
              }
            : msg
        ));
      },
      onError: (err) => {
        if (err.code === 403) {
          // Conversation ownership mismatch — start fresh
          setConversationId(null);
          setMessages(prev => prev.map(msg =>
            msg.id === botMsgId
              ? { ...msg, text: 'Session expired. Please resend your message to start a new conversation.', isTyping: false }
              : msg
          ));
        } else if (err.code === 429) {
          setRateLimitMsg(err.message || 'Too many requests. Please wait a moment and try again.');
          setMessages(prev => prev.map(msg =>
            msg.id === botMsgId
              ? { ...msg, text: err.message || 'Rate limit reached. Please wait.', isTyping: false }
              : msg
          ));
        } else {
          setMessages(prev => prev.map(msg =>
            msg.id === botMsgId
              ? { ...msg, text: err.message, isTyping: false }
              : msg
          ));
        }
      },
      onDone: () => {
        setIsProcessing(false);
        loadConversations(); // refresh sidebar after each completed turn
      },
    }, getToken);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── Conversation sidebar list (shared between desktop + mobile) ──────────

  const ConversationList = () => (
    <div className="flex flex-col gap-2">
      <button
        onClick={startNewConversation}
        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 text-sm font-medium transition-colors border border-teal-500/20 dark:border-teal-500/10"
      >
        <Plus size={15} />
        New Chat
      </button>

      {convLoading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : conversations.length > 0 ? (
        <div className="space-y-0.5 mt-1">
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                conversationId === conv.id
                  ? 'bg-teal-500/10 dark:bg-teal-500/10 border border-teal-500/20'
                  : 'hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent'
              }`}
            >
              <MessageSquare size={13} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 dark:text-slate-300 truncate leading-snug">
                  {conv.title ?? 'New conversation'}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {formatRelativeTime(conv.last_active_at)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-all flex-shrink-0"
                title="Delete conversation"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-3 py-6 text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
          No conversations yet. Start chatting to build your history.
        </p>
      )}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full relative overflow-hidden transition-colors duration-500 bg-slate-50 dark:bg-slate-900">

      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-400/30 dark:bg-teal-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>

      {/* Mobile Drawer */}
      <div className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${isSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsSidebarOpen(false)}
        />
        <aside className={`absolute left-0 top-0 bottom-0 w-[85%] max-w-[320px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-r border-slate-200 dark:border-white/10 flex flex-col shadow-2xl transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-5 flex-shrink-0 flex items-center justify-between border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg">
                <img
                  src={isDarkMode ? '/assets/logo.png' : '/assets/black_logo.png'}
                  alt="dr.doctor logo"
                  className="w-5 h-5 object-contain"
                />
              </div>
              <span className="font-bold text-lg text-slate-800 dark:text-white truncate">dr.doctor</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 flex-shrink-0 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Secure & Private</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">HIPAA Compliant AI</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Chat History</h4>
              <ConversationList />
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-white/10 flex-shrink-0 space-y-3">
            <UserMenu variant="sidebar" />
            <p className="text-[10px] text-slate-500 text-center">
              © 2024 Dr. Doctor AI
            </p>
          </div>
        </aside>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-80 h-[95vh] my-auto ml-4 rounded-3xl glass-panel shadow-2xl z-20 transition-all duration-300">
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative group">
                <div className="absolute inset-0 bg-teal-500 blur-lg opacity-20 group-hover:opacity-60 transition-opacity rounded-xl"></div>
                <div>
                  <img
                    src={isDarkMode ? '/assets/logo.png' : '/assets/black_logo.png'}
                    alt="dr.doctor logo"
                    className="w-20 h-20"
                  />
                </div>
              </div>
              <h1 className="font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-blue-600 dark:from-teal-400 dark:to-blue-500 tracking-tight">
                dr.doctor
              </h1>
            </div>

            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all active:scale-95"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 px-4 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50/50 to-transparent dark:from-white/5 dark:to-white/0 border border-slate-100 dark:border-white/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-teal-500/5 group-hover:bg-teal-500/10 transition-colors"></div>
            <div className="relative flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <ShieldCheck size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Secure & Private</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">HIPAA Compliant AI</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-1 -mx-1">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-2">Chat History</h4>
            <ConversationList />
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-white/5">
          <p className="text-[10px] text-slate-500 text-center leading-relaxed">
            AI can make mistakes. Consider checking important information.
          </p>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative h-full z-10 md:p-4 min-w-0">

        {/* Chat Container */}
        <div className="flex-1 flex flex-col bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl md:rounded-3xl shadow-2xl border-slate-100 dark:border-white/10 md:border relative overflow-hidden transition-colors">

          {/* Desktop header — user top-right */}
          <div className="hidden md:flex flex-shrink-0 items-center justify-end px-6 py-3 border-b border-slate-100 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-20">
            <UserMenu />
          </div>

          {/* Mobile Header */}
          <div className="md:hidden flex-shrink-0 flex items-center justify-between px-3 py-3 border-b border-slate-100 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-20">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-1 flex-shrink-0 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg">
                  <img
                    src={isDarkMode ? '/assets/logo.png' : '/assets/black_logo.png'}
                    alt="dr.doctor logo"
                    className="w-4 h-4 object-contain"
                  />
                </div>
                <span className="font-bold text-base text-slate-800 dark:text-white truncate">dr.doctor</span>
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={toggleTheme} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-white/5">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={requestLocation}
                className={`p-2 rounded-full transition-all ${locationStatus === 'granted' ? 'text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-400/10' : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5'}`}
              >
                <MapPin size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 scroll-smooth min-h-0 overscroll-contain"
          >
            <div className="max-w-3xl mx-auto w-full pb-4 min-h-full flex flex-col justify-end">
              {messages.length === 1 && <div className="flex-1"></div>}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          </div>

          {/* Rate limit banner */}
          {rateLimitMsg && (
            <div className="mx-4 mb-2 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-500/30 text-xs text-orange-700 dark:text-orange-300">
              <span>{rateLimitMsg}</span>
              <button onClick={() => setRateLimitMsg(null)} className="flex-shrink-0 hover:text-orange-900 dark:hover:text-orange-100">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input & Filters */}
          <div className="p-4 z-20 flex-shrink-0">
            <div className="max-w-3xl mx-auto w-full">

              {/* Animated Filters */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide px-1">
                {[
                  { id: 'price', icon: DollarSign, label: 'Best Price' },
                  { id: 'nearest', icon: MapPin, label: 'Nearest' },
                  { id: 'experienced', icon: Star, label: 'Top Rated' }
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => toggleFilter(filter.id as FilterType)}
                    className={`
                      flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 border backdrop-blur-md
                      ${activeFilters.includes(filter.id as FilterType)
                        ? 'bg-teal-100 dark:bg-teal-500/20 border-teal-200 dark:border-teal-500/50 text-teal-700 dark:text-teal-300 shadow-md'
                        : 'bg-white/60 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-slate-200'
                      }
                    `}
                  >
                    <filter.icon size={14} />
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Glass Input Field */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-blue-600 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
                <div className="relative flex items-end bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl transition-all">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Describe your symptoms..."
                    className="w-full bg-transparent border-none focus:ring-0 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 pl-4 md:pl-5 pr-20 md:pr-24 py-4 resize-none max-h-32 text-sm md:text-[15px] leading-relaxed"
                    rows={1}
                    style={{ minHeight: '60px' }}
                  />

                  <div className="absolute right-2 bottom-2.5 flex items-center gap-1">
                    <button
                      className="p-2.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group/mic relative hidden md:block"
                      title="Record voice"
                    >
                      <Mic size={20} />
                      <span className="absolute inset-0 rounded-xl bg-teal-400/20 scale-0 group-hover/mic:scale-100 transition-transform duration-300"></span>
                    </button>
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isProcessing}
                      className={`
                        p-2.5 rounded-xl transition-all duration-300 shadow-lg flex items-center justify-center
                        ${inputValue.trim() && !isProcessing
                          ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white hover:shadow-[0_0_20px_rgba(20,184,166,0.4)] hover:scale-105 active:scale-95'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                        }
                      `}
                    >
                      {isProcessing ? (
                        <Sparkles size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} className={inputValue.trim() ? 'translate-x-0.5' : ''} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
