import { Priority } from "@/lib/types";

const STYLES: Record<Priority, string> = {
  P1: "bg-red-100 text-red-700",
  P2: "bg-orange-100 text-orange-700",
  P3: "bg-yellow-100 text-yellow-700",
  P4: "bg-gray-100 text-gray-600",
};

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return null;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STYLES[priority]}`}>
      {priority}
    </span>
  );
}
