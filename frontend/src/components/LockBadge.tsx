interface Props {
  locked: boolean;
  className?: string;
}

export default function LockBadge({ locked, className = "" }: Props) {
  if (!locked) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 border border-amber-300 ${className}`}
      title="This plan is locked (read-only)"
    >
      🔒 Locked
    </span>
  );
}
