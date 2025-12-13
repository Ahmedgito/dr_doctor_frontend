import React from 'react';
import { GroundingMap } from '../types';
import { MapPin, Navigation, Star } from 'lucide-react';

interface HospitalCardProps {
  mapData: GroundingMap;
  index: number;
}

const HospitalCard: React.FC<HospitalCardProps> = ({ mapData, index }) => {
  return (
    <div 
      className="
        group relative
        bg-white/90 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 
        rounded-2xl p-4 
        shadow-lg hover:shadow-teal-500/10 
        transition-all duration-300 hover:-translate-y-1 
        min-w-[240px] max-w-[280px] flex-shrink-0 flex flex-col justify-between
        animate-fade-in-up
      "
      style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'both' }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-teal-50/50 to-transparent dark:from-white/5 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"></div>
      
      <div>
        <div className="flex items-start justify-between mb-3">
            <div className="p-2 bg-teal-50 dark:bg-teal-500/10 rounded-xl text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/20 group-hover:bg-teal-100 dark:group-hover:bg-teal-500/20 transition-colors">
                <MapPin size={20} />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 px-2 py-1 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300">
                <Star size={10} className="text-yellow-500 dark:text-yellow-400 fill-yellow-500 dark:fill-yellow-400" />
                <span>4.8</span>
            </div>
        </div>
        
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight mb-1 line-clamp-2 group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors">
            {mapData.title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-1">
             {mapData.address || "Medical Facility • Open Now"}
        </p>
      </div>

      <a 
        href={mapData.uri} 
        target="_blank" 
        rel="noopener noreferrer"
        className="
            mt-2 flex items-center justify-center gap-2 w-full py-2.5 
            bg-slate-100 dark:bg-white/5 hover:bg-teal-500 dark:hover:bg-teal-500 hover:text-white
            border border-slate-200 dark:border-white/5 hover:border-teal-500
            text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl 
            transition-all duration-300 group-hover:shadow-lg
        "
      >
        <Navigation size={14} />
        Navigate
      </a>
    </div>
  );
};

export default HospitalCard;