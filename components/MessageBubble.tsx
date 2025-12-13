import React from 'react';
import { Message, Sender } from '../types';
import { User, Sparkles } from 'lucide-react';
import HospitalCard from './HospitalCard';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.sender === Sender.User;
  const isSystem = message.sender === Sender.System;

  if (isSystem) {
    return (
      <div className="flex justify-center my-6 animate-fade-in-up">
        <span className="text-xs font-medium text-slate-400 bg-white/5 border border-white/5 px-4 py-1.5 rounded-full backdrop-blur-md">
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
                : 'bg-gradient-to-br from-teal-500/20 to-teal-500/10 text-teal-400 backdrop-blur-md'
            }
        `}>
          {isUser ? <User size={18} /> : <Sparkles size={18} />}
        </div>

        <div className="flex flex-col gap-2 min-w-0">
            {/* Message Content */}
            <div 
                className={`
                    p-4 md:p-5 rounded-2xl text-[15px] leading-relaxed shadow-lg backdrop-blur-md border transition-all duration-300 hover:shadow-xl
                    ${isUser 
                        ? 'bg-gradient-to-br from-indigo-600/90 to-purple-700/90 text-white border-white/10 rounded-tr-sm' 
                        : 'bg-slate-800/60 dark:bg-slate-800/60 text-slate-100 border-white/5 rounded-tl-sm'
                    }
                `}
            >
                {message.isTyping ? (
                    <div className="flex space-x-2 py-1.5 px-1">
                        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"></div>
                    </div>
                ) : (
                   <div className="markdown-content">
                     <ReactMarkdown 
                      components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2 marker:text-teal-400" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2 marker:text-teal-400" {...props} />,
                        li: ({node, ...props}) => <li className="mb-1" {...props} />,
                        strong: ({node, ...props}) => <span className="font-bold text-teal-200" {...props} />,
                        a: ({node, ...props}) => <a className="text-teal-400 hover:underline underline-offset-2" {...props} />,
                      }}
                     >
                       {message.text}
                     </ReactMarkdown>
                   </div>
                )}
            </div>

            {/* Grounding Results (Maps) */}
            {!isUser && message.groundingMaps && message.groundingMaps.length > 0 && (
                <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-1 scrollbar-hide -ml-1 mask-linear-fade">
                    {message.groundingMaps.map((mapData, idx) => (
                        <HospitalCard key={idx} mapData={mapData} index={idx} />
                    ))}
                </div>
            )}
            
            {/* Timestamp */}
            <span className={`text-[10px] text-slate-500 font-medium px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;