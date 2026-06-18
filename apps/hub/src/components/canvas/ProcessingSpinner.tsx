interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClass = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-10 w-10 border-[3px]',
} as const;

/** Zero-dependency CSS spinner for local tool processing feedback. */
export default function ProcessingSpinner({ size = 'md', className = '' }: Props) {
  return (
    <div
      className={`animate-spin rounded-full border-canvas-border border-t-canvas-accent ${sizeClass[size]} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
