import { useMemo } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { PageThumbnail } from './PageThumbnail';
import type { PageGroup, PageRotation, PageVisualState, VisualGridMode } from '../../lib/visualPageTypes';

export interface VisualPageGridProps {
  pdf: PDFDocumentProxy;
  mode: VisualGridMode;
  pageStates: PageVisualState[];
  pageOrder: number[];
  groups?: PageGroup[];
  activeGroupId?: string | null;
  selectedPages?: Set<number>;
  onPageOrderChange: (order: number[]) => void;
  onPageStatesChange: (states: PageVisualState[]) => void;
  onPageClick?: (pageNum: number, shiftKey: boolean) => void;
}

export default function VisualPageGrid({
  pdf,
  mode,
  pageStates,
  pageOrder,
  groups = [],
  activeGroupId = null,
  selectedPages,
  onPageOrderChange,
  onPageStatesChange,
  onPageClick,
}: VisualPageGridProps) {
  const stateByPage = useMemo(() => {
    const map = new Map<number, PageVisualState>();
    pageStates.forEach((s) => map.set(s.pageNum, s));
    return map;
  }, [pageStates]);

  const groupById = useMemo(() => {
    const map = new Map<string, PageGroup>();
    groups.forEach((g) => map.set(g.id, g));
    return map;
  }, [groups]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const updateState = (pageNum: number, patch: Partial<PageVisualState>) => {
    onPageStatesChange(
      pageStates.map((s) => (s.pageNum === pageNum ? { ...s, ...patch } : s))
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pageOrder.indexOf(Number(active.id));
    const newIndex = pageOrder.indexOf(Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const next = [...pageOrder];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    onPageOrderChange(next);
  };

  const handlePageClick = (pageNum: number, shiftKey: boolean) => {
    if (mode === 'group-select' && activeGroupId) {
      const current = stateByPage.get(pageNum);
      const already = current?.groupId === activeGroupId;
      updateState(pageNum, { groupId: already ? null : activeGroupId });
    }
    onPageClick?.(pageNum, shiftKey);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={mode === 'reorder' || mode === 'organize' ? handleDragEnd : undefined}
    >
      <SortableContext items={pageOrder.map(String)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {pageOrder.map((pageNum) => {
            const state = stateByPage.get(pageNum);
            if (!state) return null;
            const group = state.groupId ? groupById.get(state.groupId) ?? null : null;

            return (
              <PageThumbnail
                key={pageNum}
                pdf={pdf}
                pageNum={pageNum}
                mode={mode}
                rotation={state.rotation}
                removed={state.removed}
                group={group}
                selected={selectedPages?.has(pageNum)}
                sortable={mode === 'reorder' || mode === 'organize'}
                onRotationChange={(num, rotation: PageRotation) => updateState(num, { rotation })}
                onRemovedToggle={(num) => {
                  const current = stateByPage.get(num);
                  updateState(num, { removed: !current?.removed });
                }}
                onPageClick={handlePageClick}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
