"use client";

import React from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { FileText, StickyNote, GripVertical } from "lucide-react";

export interface KanbanCardData {
  id: string;
  jobTitle: string;
  company: string;
  matchScore?: number | null;
  status: string;
  resumeVersions?: { id: string }[];
  coverLetters?: { id: string }[];
  notes?: string | null;
}

interface KanbanCardProps {
  card: KanbanCardData;
}

export function KanbanCard({ card }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasResume = card.resumeVersions && card.resumeVersions.length > 0;
  const hasNotes = card.notes && card.notes.trim().length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow group cursor-default"
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <Link
            href={`/applications/${card.id}`}
            className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-1"
          >
            {card.jobTitle}
          </Link>
          <p className="text-xs text-gray-500 mt-0.5">{card.company}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        {card.matchScore && (
          <Badge variant="info" className="text-[10px] px-1.5 py-0">
            {card.matchScore}% match
          </Badge>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          {hasResume && <FileText className="w-3 h-3 text-gray-400" />}
          {hasNotes && <StickyNote className="w-3 h-3 text-gray-400" />}
        </div>
      </div>
    </div>
  );
}
