"use client";

import React from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FileText,
  StickyNote,
  GripVertical,
  Mail,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoreBadge } from "@/components/applications/match-score-card";

export interface KanbanCardData {
  id: string;
  jobTitle: string;
  company: string;
  location?: string | null;
  matchScore?: number | null;
  status: string;
  resumeVersions?: { id: string }[];
  coverLetters?: { id: string }[];
  notes?: string | null;
}

interface KanbanCardProps {
  card: KanbanCardData;
  overlay?: boolean;
}

export function KanbanCard({ card, overlay }: KanbanCardProps) {
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasResume = card.resumeVersions && card.resumeVersions.length > 0;
  const hasCoverLetter = card.coverLetters && card.coverLetters.length > 0;
  const hasNotes = card.notes && card.notes.trim().length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white border p-3 transition-all group select-none",
        isDragging
          ? "opacity-40 border-blue-300 shadow-none"
          : "border-gray-200 shadow-sm hover:shadow-md",
        overlay &&
          "shadow-xl border-blue-400 rotate-[2deg] scale-105 cursor-grabbing",
        "rounded-xl"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          className={cn(
            "mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing transition-opacity shrink-0",
            overlay ? "opacity-100 text-gray-500" : "sm:opacity-0 sm:group-hover:opacity-100 opacity-100"
          )}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          tabIndex={-1}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <Link
            href={`/applications/${card.id}`}
            className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-1"
            onClick={(e) => {
              if (isDragging) e.preventDefault();
            }}
          >
            {card.jobTitle}
          </Link>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {card.company}
          </p>
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {card.location && (
          <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
            <MapPin className="w-3 h-3" />
            <span className="truncate max-w-[80px]">{card.location}</span>
          </span>
        )}
        {card.matchScore != null && card.matchScore > 0 && (
          <ScoreBadge score={card.matchScore} />
        )}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {hasResume && (
            <span title="Has resume">
              <FileText className="w-3 h-3 text-blue-400" />
            </span>
          )}
          {hasCoverLetter && (
            <span title="Has cover letter">
              <Mail className="w-3 h-3 text-purple-400" />
            </span>
          )}
          {hasNotes && (
            <span title="Has notes">
              <StickyNote className="w-3 h-3 text-amber-400" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
