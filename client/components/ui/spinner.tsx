export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={`h-8 w-8 animate-spin rounded-full border-4 border-t-transparent border-primary ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
