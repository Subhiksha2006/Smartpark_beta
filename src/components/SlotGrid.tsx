export type Slot = {
  id: string;
  code: string;
  status: "available" | "occupied" | "reserved";
};

const COLORS: Record<Slot["status"], string> = {
  available: "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-400",
  occupied: "bg-red-500/15 border-red-500 text-red-700 dark:text-red-400",
  reserved: "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-500",
};

export function SlotGrid({
  slots,
  onSelect,
  selectable,
  selectedId,
  allowAny,
}: {
  slots: Slot[];
  onSelect?: (s: Slot) => void;
  selectable?: boolean;
  selectedId?: string | null;
  allowAny?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {slots.map((s) => {
        const selected = selectedId === s.id;
        const clickable = selectable && (allowAny || s.status === "available");
        return (
          <button
            key={s.id}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onSelect?.(s)}
            className={`aspect-square rounded-xl border-2 p-3 text-center transition ${COLORS[s.status]} ${
              clickable ? "cursor-pointer hover:scale-105" : "cursor-default"
            } ${selected ? "ring-4 ring-primary ring-offset-2 ring-offset-background" : ""}`}
          >
            <div className="text-lg font-bold">{s.code}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wide">{s.status}</div>
          </button>
        );
      })}
    </div>
  );
}

export function SlotLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs">
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-emerald-500" /> Available
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-red-500" /> Occupied
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-amber-500" /> Reserved
      </span>
    </div>
  );
}
