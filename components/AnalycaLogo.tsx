'use client';

interface AnalycaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
}

export default function AnalycaLogo({ size = 'md', showText = false, subtitle }: AnalycaLogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14',
  };
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7',
  };
  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  };
  // アプリアイコン風の角丸 (iOS風)
  const borderRadius = {
    sm: 'rounded-[8px]',
    md: 'rounded-[10px]',
    lg: 'rounded-[12px]',
    xl: 'rounded-[14px]',
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`${sizeClasses[size]} ${borderRadius[size]} bg-gradient-to-r from-purple-500 to-emerald-400 flex items-center justify-center shadow-sm`}>
        <svg className={`${iconSizes[size]} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      {showText && (
        <div>
          <h1 className={`${textSizes[size]} font-bold text-gray-800`}>ANALYCA</h1>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
