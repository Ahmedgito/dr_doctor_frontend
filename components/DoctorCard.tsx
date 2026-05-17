import React from 'react';
import { Doctor } from '../types';
import { MapPin, Star, ExternalLink, DollarSign, Navigation } from 'lucide-react';

interface DoctorCardProps {
  doctor: Doctor;
  index: number;
}

const DoctorCard: React.FC<DoctorCardProps> = ({ doctor, index }) => {
  const fee = doctor.fee_online ?? doctor.fee_walk_in;
  const feeLabel = fee != null ? `Rs. ${fee.toLocaleString()}` : 'Fee not listed';
  const distanceLabel = doctor.distance_km != null ? `${doctor.distance_km.toFixed(1)} km` : null;

  return (
    <div
      className="
        group relative flex-shrink-0 w-60
        bg-white/90 dark:bg-slate-800/60 backdrop-blur-xl
        border border-slate-200 dark:border-white/10
        rounded-2xl p-4 shadow-lg
        hover:shadow-teal-500/10 hover:-translate-y-1
        transition-all duration-300 flex flex-col gap-3
        animate-fade-in-up
      "
      style={{ animationDelay: `${index * 120}ms`, animationFillMode: 'both' }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-teal-50/40 to-transparent dark:from-white/5 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />

      {/* Name + specialty */}
      <div>
        <p className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-tight line-clamp-1 group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors">
          {doctor.name}
        </p>
        {doctor.specialty && (
          <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium mt-0.5">{doctor.specialty}</p>
        )}
      </div>

      {/* Hospital */}
      <div className="flex items-start gap-1.5">
        <MapPin size={11} className="text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
          {doctor.hospital_name}
        </p>
      </div>

      {/* Fee + rating row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
          <DollarSign size={10} className="text-teal-500" />
          {feeLabel}
        </span>

        {doctor.satisfaction_pct != null && (
          <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
            <Star size={10} className="text-yellow-500 fill-yellow-500" />
            {doctor.satisfaction_pct}%
            {doctor.reviews_count != null && (
              <span className="text-slate-400">({doctor.reviews_count})</span>
            )}
          </span>
        )}

        {distanceLabel && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Navigation size={10} />
            {distanceLabel}
          </span>
        )}
      </div>

      {/* Profile link */}
      <a
        href={doctor.profile_url}
        target="_blank"
        rel="noopener noreferrer"
        className="
          mt-auto flex items-center justify-center gap-1.5
          text-[11px] font-semibold
          text-slate-700 dark:text-slate-200
          border border-slate-200 dark:border-white/10
          hover:bg-teal-500 hover:text-white hover:border-teal-500
          rounded-xl py-2.5 transition-all duration-300
        "
      >
        View Profile
        <ExternalLink size={10} />
      </a>
    </div>
  );
};

export default DoctorCard;
