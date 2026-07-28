/**
 * Logo iad.
 *
 * « iad » toujours en minuscules ; « I@D » est réservé aux documents
 * contractuels. Le mot IMMOBILIER ne se sépare jamais du monogramme, d'où le
 * bloc unique et non deux éléments positionnables séparément.
 */
export function IadLogo({
  variant = 'cyan',
  size = 'md',
  className = '',
}: {
  variant?: 'cyan' | 'white' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const wordmarkColor =
    variant === 'white' ? 'text-white' : variant === 'dark' ? 'text-[#006390]' : 'text-[#00b4ec]'

  const subtitleColor =
    variant === 'white' ? 'text-white/80' : variant === 'dark' ? 'text-[#006390]/80' : 'text-[#006390]'

  const scale = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-2xl'

  return (
    <div
      className={`inline-flex flex-col items-start leading-none tracking-tight select-none ${className}`}
    >
      <span className={`font-black tracking-tighter lowercase ${scale} ${wordmarkColor}`}>iad</span>
      <span className={`-mt-0.5 text-[6px] font-bold uppercase tracking-[0.28em] ${subtitleColor}`}>
        IMMOBILIER
      </span>
    </div>
  )
}
