"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard, KanbanCardData } from "./kanban-card";
import { APPLICATION_STATUSES } from "@/lib/utils";

interface KanbanBoardProps {
  applications: KanbanCardData[];
  onStatusChange: (applicationId: string, newStatus: string) => void;
}

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

export function KanbanBoard({
  applications,
  onStatusChange,
}: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null);
  const [localApps, setLocalApps] = useState<KanbanCardData[]>(applications);

  // Track the original status before drag started so we can revert on cancel
  const dragStartStatusRef = useRef<string | null>(null);

  React.useEffect(() => {
    setLocalApps(applications);
  }, [applications]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getColumnCards = useCallback(
    (status: string) => localApps.filter((a) => a.status === status),
    [localApps]
  );

  // Resolve the target status from a droppable element
  function resolveStatus(
    overId: string | number,
    overData: Record<string, unknown> | undefined
  ): string | undefined {
    // Dropped on a column
    if (overData?.type === "column") {
      return overData.status as string;
    }
    // Dropped on a card — inherit that card's column
    if (overData?.type === "card") {
      const overCard = localApps.find((a) => a.id === overId);
      return overCard?.status;
    }
    // Droppable id is "column-{status}"
    if (typeof overId === "string" && overId.startsWith("column-")) {
      return overId.replace("column-", "");
    }
    return undefined;
  }

  const handleDragStart = (event: DragStartEvent) => {
    const card = localApps.find((a) => a.id === event.active.id);
    if (card) {
      setActiveCard(card);
      dragStartStatusRef.current = card.status;
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const newStatus = resolveStatus(over.id, over.data.current);

    if (!newStatus) return;

    // Optimistically move the card to the new column in local state
    setLocalApps((prev) => {
      const current = prev.find((a) => a.id === activeId);
      if (!current || current.status === newStatus) return prev;
      return prev.map((app) =>
        app.id === activeId ? { ...app, status: newStatus } : app
      );
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    const activeId = active.id as string;

    if (!over) {
      // Dropped outside any droppable — revert to original status
      if (dragStartStatusRef.current) {
        setLocalApps((prev) =>
          prev.map((app) =>
            app.id === activeId
              ? { ...app, status: dragStartStatusRef.current! }
              : app
          )
        );
      }
      dragStartStatusRef.current = null;
      return;
    }

    const card = localApps.find((a) => a.id === activeId);
    const originalStatus = dragStartStatusRef.current;
    dragStartStatusRef.current = null;

    if (card && originalStatus && card.status !== originalStatus) {
      onStatusChange(activeId, card.status);
    }
  };

  const handleDragCancel = () => {
    // Revert to server state
    setLocalApps(applications);
    setActiveCard(null);
    dragStartStatusRef.current = null;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      measuring={measuring}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-thin">
        {APPLICATION_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            cards={getColumnCards(status)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard ? <KanbanCard card={activeCard} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
