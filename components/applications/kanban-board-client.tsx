"use client";

import { useRouter } from "next/navigation";

import {
  KanbanBoard,
  type KanbanItem,
} from "@/components/applications/kanban-board";

type Props = {
  applications: KanbanItem[];
};

export function KanbanBoardClient({ applications }: Props) {
  const router = useRouter();

  return (
    <KanbanBoard
      applications={applications}
      onMove={async (id, status) => {
        const response = await fetch(`/api/applications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (response.ok) {
          router.refresh();
        }
      }}
    />
  );
}
