import React from 'react';
import { Lock, Zap, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ColumnModeIndicatorProps {
  mode: 'manual' | 'automatic';
  rulesCount?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ColumnModeIndicator({
  mode,
  rulesCount = 0,
  className,
  size = 'sm',
}: ColumnModeIndicatorProps) {
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  if (mode === 'manual') {
    return null; // Don't show indicator for manual columns
  }

  const tooltipContent = (
    <div className="text-xs">
      <div className="font-medium mb-1">Automatic Column</div>
      <div>Values are calculated automatically</div>
      {rulesCount > 0 && <div>Rules: {rulesCount}</div>}
      <div className="text-muted-foreground mt-1">Read-only</div>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-700 border border-amber-200',
              'hover:bg-amber-200 transition-colors cursor-help',
              iconSizes[size],
              className
            )}
          >
            <Lock className={cn(iconSizes[size], 'scale-75')} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Alternative indicator for different contexts
export function ColumnModeIndicatorWithText({
  mode,
  rulesCount = 0,
  className,
}: ColumnModeIndicatorProps) {
  if (mode === 'manual') {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs',
              'bg-amber-100 text-amber-800 border border-amber-200',
              'hover:bg-amber-200 transition-colors cursor-help',
              className
            )}
          >
            <Lock className="h-3 w-3" />
            <span>Auto</span>
            {rulesCount > 0 && (
              <span className="bg-amber-200 text-amber-900 px-1 rounded-full text-[10px]">
                {rulesCount}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <div className="font-medium mb-1">Automatic Column</div>
            <div>Values are calculated based on {rulesCount} rule{rulesCount !== 1 ? 's' : ''}</div>
            <div className="text-muted-foreground mt-1">Read-only</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Icon-only indicator for grid headers (most compact)
export function ColumnModeIconIndicator({
  mode,
  className,
}: Pick<ColumnModeIndicatorProps, 'mode' | 'className'>) {
  if (mode === 'manual') {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Lock
            className={cn(
              'h-3 w-3 text-amber-600 ml-1 flex-shrink-0',
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">Automatic (Read-only)</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
