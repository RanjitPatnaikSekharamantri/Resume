"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ApplicationStatus } from "@prisma/client";

import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_ORDER,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type KanbanItem = {
  id: string;
  status: ApplicationStatus;
  jobTitle: string;
  company: string;
  matchScore: number | null;
  hasResume: boolean;
  hasNotes: boolean;
};

type Props = {
  applications: KanbanItem[];
  onMove: (id: string, status: ApplicationStatus) => Promise<void> | void;
};

function DraggableCard({ item }: { item: KanbanItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab rounded-lg border border-zinc-200 bg-zinc-50 p-3 transition",
        "hover:border-blue-300 hover:bg-white",
        isDragging && "opacity-70 shadow-lg",
      )}
    >
      <p className="font-medium text-zinc-900">{item.jobTitle}</p>
      <p className="text-sm text-zinc-600">{item.company}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Match {item.matchScore ?? "—"}</Badge>
        {item.hasResume ? <Badge variant="outline">Resume</Badge> : null}
        {item.hasNotes ? <Badge variant="outline">Notes</Badge> : null}
      </div>
    </article>
  );
}

function DropColumn({
  status,
  title,
  count,
  children,
}: {
  status: ApplicationStatus;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "border-zinc-200 bg-white shadow-sm xl:min-h-[500px]",
        isOver && "border-blue-400 ring-2 ring-blue-100",
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-zinc-900">
          {title}
          <span className="ml-2 text-xs font-normal text-zinc-500">{count}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function KanbanBoard({ applications, onMove }: Props) {
  const [optimisticItems, setOptimisticItems] = useState(applications);
  const sensors = useSensors(useSensor(PointerSensor));

  const columns = useMemo(() => {
    return APPLICATION_STATUS_ORDER.map((status) => ({
      status,
      title: APPLICATION_STATUS_LABELS[status],
      items: optimisticItems.filter((item) => item.status === status),
    }));
  }, [optimisticItems]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const itemId = event.active.id as string;
    const overId = event.over?.id as ApplicationStatus | undefined;

    if (!overId) return;

    const existing = optimisticItems.find((i) => i.id === itemId);
    if (!existing || existing.status === overId) return;

    setOptimisticItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status: overId } : item))
    );
    await onMove(itemId, overId);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid gap-4 lg:grid-cols-4 xl:grid-cols-8">
        {columns.map((column) => (
          <DropColumn
            key={column.status}
            status={column.status}
            title={column.title}
            count={column.items.length}
          >
            <SortableContext
              items={column.items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              {column.items.map((item) => (
                <DraggableCard key={item.id} item={item} />
              ))}
            </SortableContext>
          </DropColumn>
        ))}
      </div>
    </DndContext>
  );
}
