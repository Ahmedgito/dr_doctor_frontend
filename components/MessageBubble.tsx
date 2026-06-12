import React from 'react';
import { useUser } from '@clerk/react';
import { Message, Sender, UrgencyLevel } from '../types';
import { User, AlertTriangle, Phone } from 'lucide-react';
import VerticalDoctorCard from './VerticalDoctorCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageBubbleProps {
  message: Message;
}

const URGENCY_STYLES: Record<UrgencyLevel, string> = {
  low: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/30',
  moderate: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border-teal-200/60 dark:border-teal-500/30',
  high: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200/60 dark:border-orange-500/30',
  emergency: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200/60 dark:border-red-500/30',
};

const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  low: 'Routine',
  moderate: 'See doctor soon',
  high: 'See doctor today',
  emergency: 'Emergency — call 115',
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { user } = useUser();
  const isUser = message.sender === Sender.User;
  const isSystem = message.sender === Sender.System;
  const userImageUrl = user?.imageUrl;

  // Doctors arrive as structured data via the metadata event — the bot's text
  // is a short lead-in and never contains the list itself.
  const doctors = message.doctors ?? [];

  if (isSystem) {
    return (
      <div className="flex justify-center my-6 animate-fade-in-up">
        <span className="text-xs font-medium text-teal-800/60 dark:text-slate-400 bg-[#F2FBFA] dark:bg-white/5 border border-teal-200/60 dark:border-white/5 px-4 py-1.5 rounded-full shadow-sm">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex w-full mb-6 animate-fade-in-up ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[94%] sm:max-w-[90%] md:max-w-[80%] gap-2.5 sm:gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

        {/* Avatar */}
        <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-[12px] overflow-hidden shadow-sm border border-teal-100/80 dark:border-white/10 bg-[#F2FBFA]">
          {isUser ? (
            userImageUrl ? (
              <img src={userImageUrl} alt={user?.fullName ?? 'You'} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white">
                <User size={18} />
              </div>
            )
          ) : (
            <>
              <img src="/assets/logo.png" alt="Dr. Doctor" className="hidden dark:block w-full h-full object-contain bg-slate-900 p-1" />
              <img src="/assets/black_logo.png" alt="Dr. Doctor" className="block dark:hidden w-full h-full object-contain bg-[#F2FBFA] p-1" />
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 min-w-0">

          {/* Message bubble */}
          <div
            className={`
              p-4 md:p-5 rounded-[20px] text-[15px] leading-relaxed transition-all duration-300
              ${isUser
                ? 'bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/10 rounded-tr-[4px] border border-teal-400/20'
                : 'bg-[#F2FBFA] dark:bg-slate-800/60 text-teal-950 dark:text-slate-100 border border-teal-100/80 dark:border-slate-700 rounded-tl-[4px] shadow-sm shadow-teal-900/5'
              }
            `}
          >
            {message.isTyping ? (
              <div>
                <div className="flex space-x-2 py-1.5 px-1">
                  <div className="w-2 h-2 bg-teal-500 dark:bg-teal-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-teal-500 dark:bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-teal-500 dark:bg-teal-400 rounded-full animate-bounce"></div>
                </div>
                {message.agentStatus && (
                  <p className="text-[11px] text-teal-600/50 dark:text-slate-500 italic mt-1 px-1 transition-all duration-300">
                    {message.agentStatus}
                  </p>
                )}
              </div>
            ) : (
              <div className="markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ node, ...props }) => <p className="mb-3 last:mb-0 leading-relaxed" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-3 space-y-1 marker:text-teal-500 dark:marker:text-teal-400" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-3 space-y-1 marker:text-teal-500 dark:marker:text-teal-400" {...props} />,
                    li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                    strong: ({ node, ...props }) => <span className="font-semibold text-teal-800 dark:text-teal-200" {...props} />,
                    a: ({ node, ...props }) => <a className="text-teal-600 dark:text-teal-400 hover:text-emerald-500 hover:underline underline-offset-2 break-all transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="font-semibold text-teal-900 dark:text-slate-200 mt-4 mb-1.5 first:mt-0" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="font-bold text-teal-950 dark:text-slate-200 mt-4 mb-2 first:mt-0" {...props} />,
                    hr: ({ node, ...props }) => <hr className="my-3 border-teal-100 dark:border-white/10" {...props} />,
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-3 rounded-xl border border-teal-200/60 dark:border-white/10">
                        <table className="min-w-full text-sm" {...props} />
                      </div>
                    ),
                    thead: ({ node, ...props }) => <thead className="bg-[#EBF7F6] dark:bg-white/5" {...props} />,
                    th: ({ node, ...props }) => <th className="px-3 py-2 text-left text-xs font-semibold text-teal-800 dark:text-slate-300 border-b border-teal-200/60 dark:border-white/10" {...props} />,
                    td: ({ node, ...props }) => <td className="px-3 py-2 border-b border-teal-100/50 dark:border-white/5 last:border-0 text-teal-900/80 dark:text-slate-300" {...props} />,
                    tr: ({ node, ...props }) => <tr className="even:bg-teal-50/50 dark:even:bg-white/[0.02]" {...props} />,
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Urgency badge — shown on recommendation responses with doctors */}
          {!isUser && !message.emergency && message.urgency && doctors.length > 0 && (
            <span className={`self-start text-[11px] font-semibold px-3 py-1 rounded-full border ${URGENCY_STYLES[message.urgency]}`}>
              {URGENCY_LABELS[message.urgency]}
            </span>
          )}

          {/* Emergency banner */}
          {!isUser && message.emergency && (
            <div className="rounded-[20px] p-4 bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-500/30 flex items-start gap-3 shadow-sm">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700 dark:text-red-400">Emergency — Seek help immediately</p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1 leading-relaxed">
                  Call Pakistan emergency services or go to the nearest hospital now.
                </p>
                <a
                  href="tel:115"
                  className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold text-white bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
                >
                  <Phone size={14} />
                  Call 115
                </a>
              </div>
            </div>
          )}

          {/* Doctor recommendations — stacked cards from structured metadata */}
          {!isUser && !message.emergency && doctors.length > 0 && (
            <div className="flex flex-col gap-3 mt-1 w-full">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600/60 dark:text-slate-500 px-1">
                Recommended specialists
              </span>
              {doctors.map((doctor, idx) => (
                <VerticalDoctorCard key={doctor.doctor_id} doctor={doctor} index={idx} />
              ))}
            </div>
          )}

          {/* Timestamp */}
          <span className={`text-[10px] text-teal-700/50 dark:text-slate-500 font-medium px-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
