import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MapPin, ShieldCheck, Mic, DollarSign, Star, Sparkles, Menu, X, Plus, Trash2, MessageSquare } from 'lucide-react';
import { useTheme } from './context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import { useAuth } from '@clerk/react';
import { Message, Sender, Coordinates, ConversationSummary } from './types';
import { streamChat, ChatFilters, agentStatusHint } from './services/chatApi';
import { listConversations, getConversation, deleteConversation } from './services/conversationsApi';
import MessageBubble from './components/MessageBubble';
import UserMenu from './components/UserMenu';

function createInitialMessage(): Message {
  return {
    id: 'init-' + Date.now(),
    text: "Hello! I'm **Dr. Doctor**. \n\nI can help you analyze your symptoms and find the best nearby specialists or hospitals. \n\nHow are you feeling today?",
    sender: Sender.Bot,
    timestamp: new Date(),
  };
}

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
  // Clerk — userId is the stable Clerk user ID (format: user_xxxx)
  const { getToken, isSignedIn, userId } = useAuth();

  const [messages, setMessages] = useState<Message[]>(() => [createInitialMessage()]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [activeFilters, setActiveFilters] = useState<FilterType[]>([]);
  const { isDarkMode } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // AbortController for the currently in-flight SSE stream.
  // Aborting it cancels the fetch cleanly; onDone still fires (via AbortError path)
  // so isProcessing always resets to false.
  const streamAbortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      setTimeout(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, [messages, isProcessing]);

  // ── Geolocation ────────────────────────────────────────────────────────────

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('denied'); return; }
    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationStatus('granted');
      },
      () => { setLocationStatus('denied'); },
    );
  };

  useEffect(() => { requestLocation(); }, []);

  // ── Conversation history ───────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    if (!isSignedIn || !userId) return;
    setConvLoading(true);
    try {
      const data = await listConversations(userId);
      console.log('[app] conversations loaded:', data.length);
      setConversations(data);
    } catch {
      // Silently fail — never break the chat experience over a sidebar error
    } finally {
      setConvLoading(false);
    }
  }, [isSignedIn, userId]);

  useEffect(() => {
    if (isSignedIn && userId) {
      loadConversations();
    } else {
      setConversations([]);
      setConversationId(null);
      setMessages([createInitialMessage()]);
    }
  }, [isSignedIn, userId, loadConversations]);

  const startNewConversation = () => {
    streamAbortRef.current?.abort();
    setMessages([createInitialMessage()]);
    setConversationId(null);
    setRateLimitMsg(null);
    setIsSidebarOpen(false);
  };

  const selectConversation = async (id: string) => {
    // Kill any in-flight stream first — otherwise its onMetadata fires asynchronously
    // and overwrites the new conversationId, locking the input in the wrong chat.
    streamAbortRef.current?.abort();
    try {
      const conv = await getConversation(id);
      if (!conv) return;
      const restored: Message[] = conv.messages.map(m => ({
        id: m.id,
        text: m.content,
        sender: m.role === 'user' ? Sender.User : Sender.Bot,
        timestamp: new Date(m.created_at),
      }));
      setMessages(restored.length > 0 ? restored : [createInitialMessage()]);
      setConversationId(id);
      setRateLimitMsg(null);
      setIsSidebarOpen(false);
    } catch {
      // Ignore — keep current chat intact
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) startNewConversation();
    } catch {
      // Ignore
    }
  };

  // ── Filters ────────────────────────────────────────────────────────────────

  const toggleFilter = (filter: FilterType) => {
    setActiveFilters(prev =>
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  // ── Send message ───────────────────────────────────────────────────────────

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const isFirstTurn = !messages.some(m => m.sender === Sender.User);
    const userText = inputValue.trim();
    setInputValue('');
    setIsProcessing(true);
    setRateLimitMsg(null);

    console.log('[app] handleSendMessage', {
      conversationId,
      userId,
      isFirstTurn,
      messagePreview: userText.slice(0, 60),
    });

    const abortController = new AbortController();
    streamAbortRef.current = abortController;

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
      onAgentStatus: (name, status) => {
        const hint = agentStatusHint(name, status);
        setMessages(prev => prev.map(msg =>
          msg.id === botMsgId
            ? { ...msg, agentStatus: hint || undefined }
            : msg
        ));
      },

      onText: (chunk) => {
        accText += chunk;
        setMessages(prev => prev.map(msg =>
          msg.id === botMsgId
            ? { ...msg, text: accText, isTyping: false, agentStatus: undefined }
            : msg
        ));
      },

      onMetadata: (meta) => {
        console.log('[app] onMetadata', {
          conversation_id: meta.conversation_id,
          active_agent: meta.active_agent,
          urgency: meta.urgency,
          emergency: meta.emergency,
          doctors_count: meta.doctors_shown?.length ?? 0,
        });
        setConversationId(meta.conversation_id);
        setMessages(prev => prev.map(msg =>
          msg.id === botMsgId
            ? {
                ...msg,
                emergency: meta.emergency,
                urgency: meta.urgency,
                // Attach doctor cards only when the recommendation agent has results
                doctors: meta.doctors_shown.length > 0 ? meta.doctors_shown : undefined,
              }
            : msg
        ));
      },

      onError: (err) => {
        if (err.code === 429) {
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
        console.log('[app] onDone — stream complete, conversationId=', conversationId);
        setIsProcessing(false);
        // Refresh sidebar after every completed turn
        loadConversations();
        // Backend generates the LLM title ~1-2 s after the first turn — poll once more
        if (isFirstTurn) setTimeout(() => loadConversations(), 2500);
      },
    }, {
      getToken,
      userId,
      signal: abortController.signal,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── Conversation sidebar list (shared between desktop + mobile) ───────────

  const ConversationList = () => (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={startNewConversation}
        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-400 text-sm font-semibold transition-colors border border-teal-500/20 dark:border-teal-500/10"
      >
        <Plus size={15} strokeWidth={2.5} />
        New Chat
      </button>

      <div className="space-y-0.5 mt-1">
        {/* Unsaved "new conversation" placeholder */}
        {conversationId === null && (
          <div className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20">
            <MessageSquare size={13} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-teal-800 dark:text-teal-300 truncate leading-snug">
                New conversation
              </p>
              <p className="text-[10px] text-teal-600/70 dark:text-teal-400/70 mt-0.5">
                Just now
              </p>
            </div>
          </div>
        )}

        {convLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : conversations.length > 0 ? (
          conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                conversationId === conv.id
                  ? 'bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20'
                  : 'hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent'
              }`}
            >
              <MessageSquare size={13} className={conversationId === conv.id ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'} flex-shrink-0 />
              <div className="flex-1 min-w-0">
                <p className={`text-xs truncate leading-snug ${conversationId === conv.id ? 'font-semibold text-teal-800 dark:text-teal-300' : 'text-slate-700 dark:text-slate-300'}`}>
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
          ))
        ) : conversationId !== null ? (
          <p className="px-3 py-6 text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
            No conversations yet. Start chatting to build your history.
          </p>
        ) : null}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full relative overflow-hidden transition-colors duration-500 bg-[#E8F5F3] dark:bg-slate-900">

      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-400/20 dark:bg-teal-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>

      {/* Mobile Drawer */}
      <div className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${isSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-teal-950/40 dark:bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsSidebarOpen(false)}
        />
        <aside className={`absolute left-0 top-0 bottom-0 w-[85%] max-w-[320px] bg-[#F2FBFA] dark:bg-slate-900 border-r border-teal-100 dark:border-slate-800 flex flex-col shadow-2xl transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-5 flex-shrink-0 flex items-center justify-between border-b border-teal-100/60 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg">
                <img
                  src={isDarkMode ? '/assets/logo.png' : '/assets/black_logo.png'}
                  alt="dr.doctor logo"
                  className="w-5 h-5 object-contain"
                />
              </div>
              <span className="font-bold text-lg text-teal-950 dark:text-white truncate">dr.doctor</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 flex-shrink-0 text-teal-700/50 dark:text-slate-400 hover:text-teal-950 dark:hover:text-white rounded-lg hover:bg-teal-100/50 dark:hover:bg-slate-800 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="p-4 rounded-2xl bg-[#EBF7F6] dark:bg-slate-800/50 border border-teal-100/80 dark:border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F2FBFA] dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-100 dark:border-teal-500/10">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-teal-900 dark:text-slate-200">Secure & Private</p>
                  <p className="text-[10px] text-teal-700/60 dark:text-slate-400">HIPAA Compliant AI</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-teal-700/50 dark:text-slate-500 uppercase tracking-wider mb-3 px-1">Chat History</h4>
              <ConversationList />
            </div>
          </div>

          <div className="p-4 border-t border-teal-100/60 dark:border-slate-800 flex-shrink-0 space-y-3">
            <UserMenu variant="sidebar" />
            <p className="text-[10px] text-slate-400 text-center">
              © 2024 Dr. Doctor AI
            </p>
          </div>
        </aside>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-80 h-[95vh] my-auto ml-4 rounded-[24px] bg-[#F2FBFA] dark:bg-slate-900 shadow-sm border border-teal-100/60 dark:border-slate-800 z-20 transition-all duration-300">
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative group">
                <div className="absolute inset-0 bg-teal-500 blur-lg opacity-20 group-hover:opacity-60 transition-opacity rounded-xl"></div>
                <div>
                  <img
                    src={isDarkMode ? '/assets/logo.png' : '/assets/black_logo.png'}
                    alt="dr.doctor logo"
                    className="w-16 h-16"
                  />
                </div>
              </div>
              <h1 className="font-bold text-[22px] text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-blue-600 dark:from-teal-400 dark:to-blue-500 tracking-tight">
                dr.doctor
              </h1>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 px-5 gap-5">
          <div className="p-4 rounded-[16px] bg-gradient-to-br from-[#EBF7F6] to-transparent dark:from-slate-800/50 dark:to-transparent border border-teal-100/80 dark:border-slate-700/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-teal-500/5 group-hover:bg-teal-500/10 transition-colors"></div>
            <div className="relative flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#F2FBFA] dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-sm border border-teal-100/80 dark:border-teal-500/10">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-teal-950 dark:text-slate-200">Secure & Private</p>
                <p className="text-[11px] font-medium text-teal-700/60 dark:text-slate-400">HIPAA Compliant AI</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-1 -mx-1">
            <h4 className="text-[11px] font-bold text-teal-700/50 dark:text-slate-500 uppercase tracking-wider mb-3 px-2">Chat History</h4>
            <ConversationList />
          </div>
        </div>

        <div className="p-5 border-t border-teal-100/60 dark:border-slate-800/50">
          <p className="text-[10px] text-slate-400 text-center leading-relaxed font-medium">
            AI can make mistakes. Consider checking important information.
          </p>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative h-full z-10 md:p-4 min-w-0">

        {/* Soft sea-green background provides cohesive tint throughout the app */}
        <div className="flex-1 flex flex-col bg-[#EBF7F6] dark:bg-[#0B1120] md:rounded-[24px] shadow-sm border-teal-100/80 dark:border-slate-800 md:border relative overflow-hidden transition-colors">

          {/* Desktop header */}
          <div className="hidden md:flex flex-shrink-0 items-center justify-end px-6 py-3 border-b border-teal-100/80 dark:border-slate-800 bg-[#EBF7F6]/95 dark:bg-[#0B1120]/95 z-20">
            <UserMenu />
          </div>

          {/* Mobile Header */}
          <div className="md:hidden flex-shrink-0 flex items-center justify-between px-3 py-3 border-b border-teal-100/80 dark:border-slate-800 bg-[#EBF7F6]/95 dark:bg-[#0B1120]/95 z-20">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-1 flex-shrink-0 text-teal-800/60 dark:text-slate-300 hover:text-teal-950 dark:hover:text-white hover:bg-teal-100/50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-sm">
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
              <button
                onClick={startNewConversation}
                className="p-2 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-400/10 rounded-full transition-colors"
                aria-label="New chat"
                title="New chat"
              >
                <Plus size={20} />
              </button>
              <ThemeToggle size="sm" className="rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800" />
              <button
                onClick={requestLocation}
                className={`p-2 rounded-full transition-all ${locationStatus === 'granted' ? 'text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-400/10' : 'text-teal-700/50 dark:text-slate-400 bg-teal-100/50 dark:bg-slate-800'}`}
              >
                <MapPin size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 scroll-smooth min-h-0 overscroll-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
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
          <div className="p-4 z-20 flex-shrink-0 bg-gradient-to-t from-[#EBF7F6] via-[#EBF7F6] to-[#EBF7F6]/0 dark:from-[#0B1120] dark:via-[#0B1120] dark:to-[#0B1120]/0 pt-6">
            <div className="max-w-3xl mx-auto w-full">

              <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide px-1">
                {[
                  { id: 'price', icon: DollarSign, label: 'Best Price' },
                  { id: 'nearest', icon: MapPin, label: 'Nearest' },
                  { id: 'experienced', icon: Star, label: 'Top Rated' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => toggleFilter(filter.id as FilterType)}
                    className={`
                      flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold transition-all duration-300
                      ${activeFilters.includes(filter.id as FilterType)
                        ? 'bg-teal-200/50 dark:bg-teal-500/20 border border-teal-300/50 dark:border-teal-500/50 text-teal-800 dark:text-teal-300 shadow-sm'
                        : 'bg-[#F2FBFA] dark:bg-slate-800 border border-teal-100/80 dark:border-slate-700 text-teal-800/70 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-teal-950 dark:hover:text-slate-200 shadow-sm shadow-teal-900/5'
                      }
                    `}
                  >
                    <filter.icon size={14} className={activeFilters.includes(filter.id as FilterType) ? 'text-teal-600' : 'text-teal-600/50'} />
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500/30 to-blue-500/30 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-500 blur-md"></div>
                <div className="relative flex items-end bg-[#F2FBFA] dark:bg-slate-800 border border-teal-100/80 dark:border-slate-700 rounded-2xl shadow-sm shadow-teal-900/5 transition-all">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Describe your symptoms..."
                    className="w-full bg-transparent border-none focus:ring-0 text-teal-950 dark:text-slate-100 placeholder-teal-700/40 dark:placeholder-slate-500 pl-4 md:pl-5 pr-20 md:pr-24 py-4 resize-none max-h-32 text-[15px] font-medium leading-relaxed"
                    rows={1}
                    style={{ minHeight: '60px' }}
                  />

                  <div className="absolute right-2 bottom-2.5 flex items-center gap-1">
                    <button
                      className="p-2.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group/mic relative hidden md:block"
                      title="Record voice"
                    >
                      <Mic size={20} />
                      <span className="absolute inset-0 rounded-xl bg-teal-50/80 scale-0 group-hover/mic:scale-100 transition-transform duration-300"></span>
                    </button>
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isProcessing}
                      className={`
                        p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center
                        ${inputValue.trim() && !isProcessing
                          ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md hover:shadow-lg hover:shadow-teal-500/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
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
