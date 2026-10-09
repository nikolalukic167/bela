/** Karte's mark (public/favicon.svg, built by scripts/cards/build-brand.mjs) with the wordmark. */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className={`shrink-0 ${className}`} draggable={false} />;
}

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <span className={`inline-flex items-center ${lg ? 'gap-3' : 'gap-2'}`}>
      <LogoMark className={lg ? 'size-12 sm:size-16' : 'size-8'} />
      <span className={`font-display font-extrabold tracking-tight ${lg ? 'text-4xl sm:text-6xl' : 'text-xl'}`}>Karte</span>
    </span>
  );
}
