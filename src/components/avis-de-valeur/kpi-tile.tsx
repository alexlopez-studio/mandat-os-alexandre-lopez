import type { LucideIcon } from 'lucide-react'

/**
 * Tuile d'indicateur.
 *
 * Le corail iad (#ea584a) n'apparaît que sur une variation négative ou une
 * alerte. Un chiffre de prix ne passe jamais en corail.
 */
export function KpiTile({
  label,
  value,
  unit,
  context,
  variance,
  icon: Icon,
  isDark = false,
  className = '',
}: {
  label: string
  value: string | number
  unit?: string
  context?: string
  variance?: { value: string; isNegative?: boolean }
  icon?: LucideIcon
  isDark?: boolean
  className?: string
}) {
  return (
    <div
      className={`relative rounded-[3mm] border-t-2 border-[#00b4ec] p-3 ${
        isDark
          ? 'border-x border-b border-white/10 bg-[#004f73] text-white'
          : 'border-x border-b border-[#CDF7FF] bg-[#E9FCFF]/80 text-slate-900'
      } ${className}`}
    >
      {Icon && (
        <div className="absolute right-2.5 top-2.5 text-[#00b4ec] opacity-40">
          <Icon className="h-4 w-4" />
        </div>
      )}

      <div
        className={`mb-1 text-[9px] font-bold uppercase tracking-[0.14em] ${
          isDark ? 'text-slate-300' : 'text-slate-600'
        }`}
      >
        {label}
      </div>

      <div className="avv-figure flex items-baseline gap-1 text-2xl font-extrabold leading-tight">
        <span className={isDark ? 'text-white' : 'text-[#006390]'}>{value}</span>
        {unit && (
          <span
            className={`text-xs font-semibold tracking-normal ${isDark ? 'text-cyan-200' : 'text-[#008EC3]'}`}
          >
            {unit}
          </span>
        )}
      </div>

      {(context || variance) && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] leading-snug">
          {context && (
            <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{context}</span>
          )}
          {variance && (
            <span
              className={`ml-auto shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[9.5px] font-bold ${
                variance.isNegative ? 'bg-[#ea584a]/15 text-[#ea584a]' : 'bg-[#00b4ec]/15 text-[#008EC3]'
              }`}
            >
              {variance.value}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
