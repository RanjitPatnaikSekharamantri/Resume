"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanCard, KanbanCardData } from "./kanban-card";
import { getStatusLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_DOT_COLORS: Record<string, string> = {
  not_applied: "bg-gray-400",
  saved: "bg-blue-400",
  applied: "bg-indigo-400",
  screening: "bg-purple-400",
  interview: "bg-amber-400",
  offer: "bg-emerald-400",
  rejected: "bg-red-400",
  archived: "bg-gray-300",
};

interface KanbanColumnProps {
  status: string;
  cards: KanbanCardData[];
}

export function KanbanColumn({ status, cards }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: "column", status },
  });

  const dotColor = STATUS_DOT_COLORS[status] || "bg-gray-400";

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl min-w-[280px] w-[280px] shrink-0 border transition-all duration-200",
        isOver
          ? "border-blue-300 bg-blue-50/40 ring-2 ring-blue-200/50"
          : "border-gray-200/60 bg-gray-50/50"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200/60">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            {getStatusLabel(status)}
          </h3>
        </div>
        <span
          className={cn(
            "text-xs font-medium rounded-full px-1.5 py-0.5 tabular-nums transition-colors",
            cards.length > 0
              ? "bg-gray-200/80 text-gray-600"
              : "bg-gray-100 text-gray-400"
          )}
        >
          {cards.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-240px)] min-h-[120px] scrollbar-thin"
      >
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </SortableContext>

        {/* Empty drop target */}
        {cards.length === 0 && (
          <div
            className={cn(
              "flex items-center justify-center rounded-lg border-2 border-dashed h-20 transition-colors",
              isOver
                ? "border-blue-300 bg-blue-50/50 text-blue-500"
                : "border-gray-200 text-gray-400"
            )}
          >
            <p className="text-xs">
              {isOver ? "Drop here" : "No applications"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
