import React from 'react';
import { Doctor } from '../types';
import { MapPin, Star, ExternalLink, Navigation, BadgeCheck, Wallet, Sparkles } from 'lucide-react';

/** Google Maps link for the clinic: lat/lng directions when coordinates are
 *  known, otherwise a place search by hospital name + city. */
const googleMapsUrl = (doctor: Doctor): string | null => {
  if (doctor.hospital_lat != null && doctor.hospital_lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${doctor.hospital_lat},${doctor.hospital_lng}`;
  }
  const place = [doctor.hospital_name, doctor.city].filter(Boolean).join(', ');
  if (!place) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
};

interface VerticalDoctorCardProps {
  doctor: Doctor;
  index: number;
}

/** Gradient pairs cycled by rank so avatars feel distinct but on-palette. */
const AVATAR_GRADIENTS = [
  'from-teal-400 to-emerald-500',
  'from-indigo-400 to-cyan-500',
  'from-rose-400 to-orange-500',
  'from-purple-400 to-indigo-500',
  'from-sky-400 to-blue-500',
];

const initialsOf = (name: string): string =>
  name
    .replace(/^(assist\.?\s*prof\.?|prof\.?|dr\.?)+\s*/gi, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || 'Dr';

const VerticalDoctorCard: React.FC<VerticalDoctorCardProps> = ({ doctor, index }) => {
  const fee = doctor.fee_walk_in ?? doctor.fee_online;
  const isOnlineFee = doctor.fee_walk_in == null && doctor.fee_online != null;
  const feeLabel = fee != null ? `Rs. ${fee.toLocaleString()}` : 'Not listed';
  const distanceLabel = doctor.distance_km != null ? `${doctor.distance_km.toFixed(1)} km` : null;
  const isBestMatch = index === 0;
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const mapsUrl = googleMapsUrl(doctor);

  return (
    <div
      className={`
        group relative w-full overflow-hidden will-change-transform
        bg-[#F2FBFA] dark:bg-slate-900
        border rounded-[16px] sm:rounded-[20px] shadow-sm shadow-teal-900/5
        hover:shadow-md hover:shadow-teal-900/10 hover:-translate-y-0.5
        transition-all duration-300 ease-out
        animate-fade-in-up
        ${isBestMatch
          ? 'border-teal-400/50 dark:border-teal-500/50 ring-1 ring-teal-400/20 dark:ring-teal-500/30'
          : 'border-teal-100/80 dark:border-slate-800 hover:border-teal-400/40 dark:hover:border-teal-500/30'}
      `}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      {/* Background glow stripped for performance, using subtle static gradient instead */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-transparent dark:from-teal-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Best match ribbon */}
      {isBestMatch && (
        <div className="absolute top-0 right-0 z-20">
          <div className="relative">
            {/* Replaced heavy blur with solid color shadow for performance */}
            <span className="relative flex items-center gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-teal-500 to-emerald-500 pl-3 pr-3 py-1 rounded-bl-[16px] shadow-sm">
              <Sparkles size={10} className="animate-pulse" />
              Best match
            </span>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3.5 sm:p-5">
        
        {/* Avatar + Content Container */}
        <div className="flex flex-row gap-3 sm:gap-4 flex-1 min-w-0">
          {/* Avatar Area */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-[14px] sm:rounded-[16px] bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-sm ring-2 ring-[#F2FBFA]/50 dark:ring-white/10 group-hover:scale-[1.03] transition-transform duration-300`}>
              {initialsOf(doctor.name)}
            </div>
            <span className="text-[10px] font-bold text-teal-600/60 dark:text-slate-500 tracking-wider">
              #{index + 1}
            </span>
          </div>

          {/* Details Area */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-1.5 pt-0.5">
            <div>
              <h3 className="font-bold text-[14px] sm:text-[16px] text-teal-950 dark:text-white leading-tight flex items-center gap-1.5 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                <span className="truncate">{doctor.name}</span>
                <BadgeCheck size={16} className="text-emerald-500 flex-shrink-0" />
              </h3>
              {doctor.specialty && (
                <div className="mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/50 dark:bg-teal-500/10 text-emerald-800 dark:text-teal-300 border border-emerald-200/50 dark:border-teal-500/20">
                    {doctor.specialty}
                  </span>
                </div>
              )}
            </div>

            {(doctor.hospital_name || doctor.city) && (
              <div className="flex items-start gap-1.5 text-[12px] sm:text-[13px] text-teal-800/70 dark:text-slate-300 mt-0.5">
                <MapPin size={14} className="text-teal-600/50 mt-0.5 flex-shrink-0" />
                <span className="leading-snug font-medium">
                  {doctor.hospital_name ?? 'Clinic not listed'}
                  {doctor.city && <span className="text-teal-600/60 dark:text-slate-500">, {doctor.city}</span>}
                </span>
              </div>
            )}

            {/* Meta tags: fee, distance, reviews */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/60 dark:bg-slate-800/80 border border-teal-100/50 dark:border-slate-700/50">
                <Wallet size={12} className="text-emerald-500" />
                <span className="text-[11px] sm:text-[12px] font-bold text-teal-900 dark:text-slate-200">
                  {feeLabel}
                  {fee != null && (
                    <span className="ml-1 text-[9px] sm:text-[10px] font-medium text-teal-700/60 dark:text-slate-500 uppercase tracking-wide">
                      {isOnlineFee ? 'online' : 'walk-in'}
                    </span>
                  )}
                </span>
              </div>

              {distanceLabel && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/60 dark:bg-slate-800/80 border border-teal-100/50 dark:border-slate-700/50">
                  <Navigation size={11} className="text-teal-600" />
                  <span className="text-[11px] sm:text-[12px] font-bold text-teal-900 dark:text-slate-300">
                    {distanceLabel}
                  </span>
                </div>
              )}

              {doctor.satisfaction_pct != null && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-orange-500/10 border border-emerald-100 dark:border-orange-500/20">
                  <Star size={11} className="text-emerald-500 fill-emerald-500" />
                  <span className="text-[11px] sm:text-[12px] font-bold text-emerald-900 dark:text-orange-200">
                    {doctor.satisfaction_pct}%
                  </span>
                  {doctor.reviews_count != null && doctor.reviews_count > 0 && (
                    <span className="text-[10px] font-medium text-emerald-700/60 dark:text-orange-200/60">
                      ({doctor.reviews_count})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Button - stretches on mobile, fixed width on desktop */}
        <div className="flex w-full sm:w-auto mt-2 sm:mt-0 flex-shrink-0">
          <a
            href={doctor.profile_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`
              relative overflow-hidden group/btn w-full sm:w-[130px] flex items-center justify-center gap-1.5
              text-[13px] font-bold rounded-xl py-2.5 sm:py-2.5 px-4
              transition-all duration-300 active:scale-95
              ${isBestMatch
                ? 'text-white bg-gradient-to-r from-teal-500 to-emerald-500 shadow-sm hover:shadow-teal-500/20'
                : 'text-teal-800 dark:text-white bg-white/80 dark:bg-slate-800 border border-teal-200/80 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:border-teal-400 dark:hover:border-teal-500/50 shadow-sm shadow-teal-900/5'}
            `}
          >
            {isBestMatch && (
              <div className="absolute inset-0 bg-white/0 group-hover/btn:bg-white/10 transition-colors duration-300" />
            )}
            View Profile
            <ExternalLink size={13} className={`${isBestMatch ? 'text-teal-50' : 'text-teal-600/50 dark:text-slate-400 group-hover/btn:text-teal-600'}`} />
          </a>
        </div>
      </div>

      {/* Map layer — elegantly integrated without heavy filters */}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open directions to ${doctor.hospital_name ?? 'clinic'} in Google Maps`}
          className="
            relative z-10 flex items-stretch mx-3.5 sm:mx-5 mb-3.5 sm:mb-5 h-12 sm:h-14 rounded-[14px] sm:rounded-2xl overflow-hidden
            bg-[#EBF7F6] dark:bg-slate-800
            border border-teal-100/80 dark:border-slate-700
            hover:border-teal-400/50 dark:hover:border-teal-500/50 hover:shadow-sm hover:shadow-teal-900/5
            transition-all duration-300 group/map
          "
        >
          {/* Label panel - Replaced backdrop-blur with solid color for performance */}
          <div className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 flex-shrink-0 w-3/5 sm:w-1/2 md:w-2/5 bg-[#F2FBFA] dark:bg-slate-900 z-10">
            <span className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-teal-100/50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 group-hover/map:bg-teal-500 group-hover/map:text-white transition-all duration-300 shadow-sm">
              <Navigation size={15} />
            </span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="text-[12px] sm:text-[13px] font-bold text-teal-950 dark:text-white group-hover/map:text-teal-700 dark:group-hover/map:text-teal-400 transition-colors truncate">
                Get Directions
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium text-teal-700/60 dark:text-slate-400 truncate">
                Open in Maps
              </span>
            </span>
          </div>

          {/* Map preview */}
          <div className="relative flex-1 min-w-0 bg-[#e8eaed] dark:bg-[#1a202c] overflow-hidden">
            {/* Simple CSS gradient instead of backdrop blur */}
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#F2FBFA] dark:from-slate-900 to-transparent z-10 pointer-events-none" />
            
            {/* Highly performant dark mode map approach: simple opacity instead of invert/hue-rotate/contrast */}
            <div className="absolute inset-0 bg-slate-900/60 hidden dark:block z-[5] pointer-events-none" />
            
            {/* In light mode, a subtle mint tint over the map image removes the bright white mapping elements */}
            <div className="absolute inset-0 bg-teal-500/5 z-[5] pointer-events-none dark:hidden" />
            
            <img
              src="/assets/map-placeholder.png"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover group-hover/map:scale-105 transition-transform duration-500 ease-out mix-blend-multiply opacity-80 dark:opacity-100 dark:mix-blend-normal"
            />

            {/* Destination pin with pulse ring */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[60%] flex flex-col items-center z-10 group-hover/map:-translate-y-[65%] transition-transform duration-300">
              <span className="absolute w-8 h-8 rounded-full bg-red-500/20 animate-ping" />
              <MapPin size={22} className="relative text-red-500 fill-red-500/20" strokeWidth={2.5} />
              <div className="w-2.5 h-1 bg-teal-900/10 rounded-full mt-1 group-hover/map:w-2 transition-all duration-300" />
            </div>

            {/* Open affordance */}
            <span className="absolute right-2 top-2 flex items-center justify-center w-6 h-6 rounded-lg bg-[#F2FBFA] shadow-sm border border-teal-100/80 z-10">
              <ExternalLink size={12} className="text-teal-600/60 group-hover/map:text-teal-700 transition-colors" />
            </span>
          </div>
        </a>
      )}
    </div>
  );
};

export default VerticalDoctorCard;
