"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard, KanbanCardData } from "./kanban-card";
import { getStatusLabel } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KanbanColumnProps {
  status: string;
  cards: KanbanCardData[];
}

export function KanbanColumn({ status, cards }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: "column", status },
  });

  return (
    <div
      className={`flex flex-col bg-gray-50/80 rounded-xl min-w-[280px] w-[280px] border transition-colors ${
        isOver ? "border-blue-300 bg-blue-50/30" : "border-gray-200/60"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200/60">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            {getStatusLabel(status)}
          </h3>
          <span className="text-xs text-gray-400 bg-gray-200/60 rounded-full px-1.5 py-0.5 font-medium">
            {cards.length}
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1 max-h-[calc(100vh-220px)]">
        <div ref={setNodeRef} className="p-2 space-y-2 min-h-[60px]">
          <SortableContext
            items={cards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {cards.map((card) => (
              <KanbanCard key={card.id} card={card} />
            ))}
          </SortableContext>
        </div>
      </ScrollArea>
    </div>
  );
}
