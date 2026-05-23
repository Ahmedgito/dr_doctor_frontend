import React from 'react';
import { Message, Sender, UrgencyLevel } from '../types';
import { User, Sparkles, AlertTriangle, Phone } from 'lucide-react';
import HospitalCard from './HospitalCard';
import DoctorCard from './DoctorCard';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  message: Message;
}

const URGENCY_STYLES: Record<UrgencyLevel, string> = {
  low: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30',
  moderate: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30',
  high: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/30',
  emergency: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30',
};

const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  low: 'Routine',
  moderate: 'See doctor soon',
  high: 'See doctor today',
  emergency: 'Emergency — call 115',
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.sender === Sender.User;
  const isSystem = message.sender === Sender.System;

  if (isSystem) {
    return (
      <div className="flex justify-center my-6 animate-fade-in-up">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 px-4 py-1.5 rounded-full backdrop-blur-md">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex w-full mb-6 animate-fade-in-up ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

        {/* Avatar */}
        <div className={`
            flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-lg border border-white/10
            ${isUser
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                : 'bg-gradient-to-br from-teal-500/20 to-teal-500/10 text-teal-600 dark:text-teal-400 backdrop-blur-md bg-white dark:bg-transparent'
            }
        `}>
          {isUser ? <User size={18} /> : <Sparkles size={18} />}
        </div>

        <div className="flex flex-col gap-2 min-w-0">

          {/* Message bubble */}
          <div
            className={`
              p-4 md:p-5 rounded-2xl text-[15px] leading-relaxed shadow-lg backdrop-blur-md border transition-all duration-300 hover:shadow-xl
              ${isUser
                ? 'bg-gradient-to-br from-indigo-600/90 to-purple-700/90 text-white border-white/10 rounded-tr-sm'
                : 'bg-white dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-white/5 rounded-tl-sm'
              }
            `}
          >
            {message.isTyping ? (
              <div className="flex space-x-2 py-1.5 px-1">
                <div className="w-2 h-2 bg-teal-500 dark:bg-teal-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-teal-500 dark:bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-teal-500 dark:bg-teal-400 rounded-full animate-bounce"></div>
              </div>
            ) : (
              <div className="markdown-content">
                <ReactMarkdown
                  components={{
                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2 marker:text-teal-500 dark:marker:text-teal-400" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2 marker:text-teal-500 dark:marker:text-teal-400" {...props} />,
                    li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                    strong: ({ node, ...props }) => <span className="font-bold text-teal-700 dark:text-teal-200" {...props} />,
                    a: ({ node, ...props }) => <a className="text-teal-600 dark:text-teal-400 hover:underline underline-offset-2" {...props} />,
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Urgency badge — shown for non-emergency bot messages on recommendation phase */}
          {!isUser && message.urgency && !message.emergency && message.phase === 'recommendation' && (
            <span className={`self-start text-[11px] font-semibold px-3 py-1 rounded-full border ${URGENCY_STYLES[message.urgency]}`}>
              {URGENCY_LABELS[message.urgency]}
            </span>
          )}

          {/* Emergency banner */}
          {!isUser && message.emergency && (
            <div className="rounded-2xl p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700 dark:text-red-400">Emergency — Seek help immediately</p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1 leading-relaxed">
                  Call Pakistan emergency services or go to the nearest hospital now.
                </p>
                <a
                  href="tel:115"
                  className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl transition-colors shadow-md"
                >
                  <Phone size={14} />
                  Call 115
                </a>
              </div>
            </div>
          )}

          {/* Doctor cards from backend */}
          {!isUser && !message.emergency && message.phase === 'recommendation' && message.doctors && message.doctors.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-3 pt-1 px-1 scrollbar-hide -ml-1">
              {message.doctors.map((doctor, idx) => (
                <DoctorCard key={doctor.doctor_id} doctor={doctor} index={idx} />
              ))}
            </div>
          )}

          {/* Legacy grounding maps (kept for backward compat) */}
          {!isUser && message.groundingMaps && message.groundingMaps.length > 0 && !message.doctors && (
            <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-1 scrollbar-hide -ml-1 mask-linear-fade">
              {message.groundingMaps.map((mapData, idx) => (
                <HospitalCard key={idx} mapData={mapData} index={idx} />
              ))}
            </div>
          )}

          {/* Timestamp */}
          <span className={`text-[10px] text-slate-400 dark:text-slate-500 font-medium px-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
