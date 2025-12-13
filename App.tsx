import React, { useState, useEffect, useRef } from 'react';
import { Send, MapPin, ShieldCheck, Mic, DollarSign, Star, Sun, Moon, MessageSquare, Clock, Sparkles, Menu, X } from 'lucide-react';
import { Message, Sender, Coordinates } from './types';
import { sendMessageToGemini } from './services/geminiService';
import MessageBubble from './components/MessageBubble';
import ReactMarkdown from 'react-markdown';

const INITIAL_MESSAGE: Message = {
  id: 'init-1',
  text: "Hello! I'm **Dr. Doctor**. \n\nI can help you analyze your symptoms and find the best nearby specialists or hospitals. \n\nHow are you feeling today?",
  sender: Sender.Bot,
  timestamp: new Date(),
};

type FilterType = 'price' | 'nearest' | 'experienced';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [activeFilters, setActiveFilters] = useState<FilterType[]>(['nearest']);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Use a ref for the scrollable container
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Mock Recent Chats
  const recentChats = [
    { id: 1, title: 'Severe Migraine Symptoms', date: 'Today' },
    { id: 2, title: 'Pediatrician nearby', date: 'Yesterday' },
    { id: 3, title: 'Skin Rash Consultation', date: '3 days ago' },
  ];

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
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
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus('granted');
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationStatus('denied');
      }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const toggleFilter = (filter: FilterType) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter) 
        : [...prev, filter]
    );
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userText = inputValue.trim();
    setInputValue('');
    
    // Add User Message
    const newUserMessage: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: Sender.User,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setIsProcessing(true);

    // Add Typing Indicator
    const typingMessageId = 'typing-' + Date.now();
    setMessages(prev => [...prev, {
        id: typingMessageId,
        text: '',
        sender: Sender.Bot,
        timestamp: new Date(),
        isTyping: true
    }]);

    try {
      // Call Gemini (Mock service)
      const response = await sendMessageToGemini(userText, location);

      // Remove Typing Indicator and Add Response
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== typingMessageId);
        return [...filtered, {
          id: Date.now().toString(),
          text: response.text,
          sender: Sender.Bot,
          timestamp: new Date(),
          groundingMaps: response.groundingMaps
        }];
      });

    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.id !== typingMessageId));
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: "I'm having trouble connecting right now. Please try again.",
        sender: Sender.Bot,
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-full w-full relative overflow-hidden transition-colors duration-500 bg-slate-50 dark:bg-slate-900">
      
      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-400/30 dark:bg-teal-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" style={{animationDelay: '1.5s'}}></div>

      {/* Mobile Drawer */}
      <div className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${isSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div 
            className={`absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`} 
            onClick={() => setIsSidebarOpen(false)} 
        />
        <aside className={`absolute left-0 top-0 bottom-0 w-[85%] max-w-[320px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-r border-slate-200 dark:border-white/10 flex flex-col shadow-2xl transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-5 flex-shrink-0 flex items-center justify-between border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-700 rounded-lg flex items-center justify-center text-white shadow-lg">
                        <img src="/assets/logo.png" alt="dr.doctor logo" className="w-24 h-24" />
                    </div>
                    <span className="font-bold text-lg text-slate-800 dark:text-white">dr.doctor</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                    <X size={20} />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Recent History</h4>
                    <div className="space-y-1">
                        {recentChats.map((chat) => (
                            <button 
                                key={chat.id}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-left"
                            >
                                <MessageSquare size={16} className="text-slate-400 dark:text-slate-500" />
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                        {chat.title}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-slate-400 dark:text-slate-500">
                                        <Clock size={10} />
                                        <span className="text-[10px]">{chat.date}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 dark:border-white/10 flex-shrink-0">
                <p className="text-[10px] text-slate-500 text-center">
                    © 2024 Dr. Doctor AI
                </p>
            </div>
        </aside>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-80 h-[95vh] my-auto ml-4 rounded-3xl glass-panel shadow-2xl z-20 transition-all duration-300">
        <div className="p-6 pb-2">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-teal-500 blur-lg opacity-20 group-hover:opacity-60 transition-opacity rounded-xl"></div>
                        <div className="">
                            <img src="/assets/logo.png" alt="dr.doctor logo" className="w-20 h-20" />
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
                 <div className="relative flex items-center justify-between">
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
            </div>

            <div className="flex-1 overflow-y-auto px-2 -mx-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Recent History</h4>
                
                <div className="space-y-1">
                    {recentChats.map((chat) => (
                        <button 
                            key={chat.id}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100/50 dark:hover:bg-white/5 transition-all group text-left border border-transparent hover:border-slate-200/50 dark:hover:border-white/5 hover:translate-x-1"
                        >
                            <MessageSquare size={16} className="text-slate-400 dark:text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white truncate transition-colors">
                                    {chat.title}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5 text-slate-400 dark:text-slate-500">
                                    <Clock size={10} />
                                    <span className="text-[10px]">{chat.date}</span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-white/5">
            <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                AI can make mistakes. Consider checking important information.
            </p>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative h-full z-10 md:p-4 min-w-0">
        
        {/* Chat Container */}
        <div className="flex-1 flex flex-col bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl md:rounded-3xl shadow-2xl border-slate-100 dark:border-white/10 md:border relative overflow-hidden transition-colors">
            
            {/* Mobile Header - Fixed positioning within flex column */}
            <div className="md:hidden flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-20">
                 <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        aria-label="Open menu"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-teal-500 to-teal-700 rounded-lg flex items-center justify-center text-white shadow-lg">
                            <img src="/assets/logo.png" alt="dr.doctor logo" className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-lg text-slate-800 dark:text-white">dr.doctor</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
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
                    {/* Welcome spacer */}
                    {messages.length === 1 && <div className="flex-1"></div>}
                    
                    {messages.map((msg) => (
                        <MessageBubble key={msg.id} message={msg} />
                    ))}
                </div>
            </div>

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
                                        <Send size={18} className={inputValue.trim() ? "translate-x-0.5" : ""} />
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