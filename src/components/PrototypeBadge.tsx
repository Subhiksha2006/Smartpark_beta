import { usePrototypeMode } from "@/lib/prototype-mode";
import { CircleDot } from "lucide-react";

export function PrototypeBadge({ className = "" }: { className?: string }) {
  const [on] = usePrototypeMode();
  if (!on) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300 ${className}`}
    >
      <CircleDot className="h-3 w-3 animate-pulse" />
      Prototype Mode Active
    </span>
  );
}
