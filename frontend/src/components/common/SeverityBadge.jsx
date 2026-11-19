import React from 'react';

export const SeverityBadge = ({ severity, size = 'md' }) => {
  const styles = {
    Critical: 'bg-red-950/80 text-red-300 border-red-500/80 shadow-red-900/40 shadow-sm animate-pulse',
    High: 'bg-amber-950/80 text-amber-300 border-amber-500/80 shadow-amber-900/30 shadow-sm',
    Medium: 'bg-yellow-950/80 text-yellow-300 border-yellow-500/80',
    Low: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/80',
  };

  const dotColors = {
    Critical: 'bg-red-500 animate-ping',
    High: 'bg-amber-500',
    Medium: 'bg-yellow-500',
    Low: 'bg-emerald-500',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs font-semibold px-2.5 py-1',
    lg: 'text-sm font-bold px-3 py-1.5',
  };

  const currentStyle = styles[severity] || styles['Medium'];
  const currentDot = dotColors[severity] || dotColors['Medium'];
  const currentSize = sizeClasses[size] || sizeClasses['md'];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border uppercase tracking-wider font-mono ${currentSize} ${currentStyle}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${currentDot}`} />
      {severity}
    </span>
  );
};

export default SeverityBadge;
