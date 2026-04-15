"use client";

import React, { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard, KanbanCardData } from "./kanban-card";
import { APPLICATION_STATUSES } from "@/lib/utils";

interface KanbanBoardProps {
  applications: KanbanCardData[];
  onStatusChange: (applicationId: string, newStatus: string) => void;
}

export function KanbanBoard({ applications, onStatusChange }: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null);
  const [localApps, setLocalApps] = useState(applications);

  React.useEffect(() => {
    setLocalApps(applications);
  }, [applications]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const getColumnCards = useCallback(
    (status: string) => localApps.filter((a) => a.status === status),
    [localApps]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = localApps.find((a) => a.id === active.id);
    if (card) setActiveCard(card);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overData = over.data.current;

    let newStatus: string | undefined;

    if (overData?.type === "column") {
      newStatus = overData.status;
    } else if (overData?.type === "card") {
      const overCard = localApps.find((a) => a.id === over.id);
      if (overCard) newStatus = overCard.status;
    }

    if (newStatus) {
      setLocalApps((prev) =>
        prev.map((app) =>
          app.id === activeId ? { ...app, status: newStatus! } : app
        )
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = active.id as string;
    const card = localApps.find((a) => a.id === activeId);

    if (card) {
      const originalCard = applications.find((a) => a.id === activeId);
      if (originalCard && originalCard.status !== card.status) {
        onStatusChange(activeId, card.status);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {APPLICATION_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            cards={getColumnCards(status)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? <KanbanCard card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
