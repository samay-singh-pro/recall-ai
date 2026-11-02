import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmPopup } from 'primeng/confirmpopup';
import { Menu } from 'primeng/menu';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';

import { Memory } from '../../memory';
import { MEMORY_TYPE_ICONS } from '../../memory-type-display';

/** Memories that share a day heading, e.g. "Today". */
export interface MemoryGroup {
  label: string;
  memories: Memory[];
}

const SKELETON_ROWS = [1, 2, 3, 4, 5];
// The menu sits on the sidebar's own background, so its box styling is switched off.
const MENU_TOKENS = {
  root: { background: 'transparent', borderColor: 'transparent' },
  list: { padding: '0' },
  submenuLabel: { padding: '1rem 0.75rem 0.375rem', fontWeight: '600' },
};

/**
 * Sidebar list of saved memories, newest first, grouped into Today, Yesterday and Earlier.
 * Clicking a row asks to open it; the bin button asks to delete it after the user confirms.
 */
@Component({
  selector: 'ra-memory-panel',
  imports: [Button, ConfirmPopup, Menu, Message, Skeleton],
  providers: [ConfirmationService],
  templateUrl: './memory-panel.html',
  styleUrl: './memory-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemoryPanel {
  private readonly locale = inject(LOCALE_ID);
  private readonly confirmationService = inject(ConfirmationService);

  readonly memories = input.required<Memory[]>();
  readonly isLoading = input(false);
  readonly hasError = input(false);
  readonly openMemory = output<Memory>();
  readonly deleteMemory = output<Memory>();

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly menuTokens = MENU_TOKENS;
  protected readonly menuGroups = computed<MenuItem[]>(() =>
    groupByDay(this.memories(), new Date()).map((group) => ({
      label: group.label,
      items: group.memories.map((memory) => ({
        id: memory.id,
        label: memory.title,
        icon: MEMORY_TYPE_ICONS[memory.type],
        command: () => this.openMemory.emit(memory),
        // Today and Yesterday already name the day, so only the time is shown.
        state: {
          memory,
          fileCount: memory.attachments.length,
          time: formatDate(
            memory.created_at,
            group.label === 'Earlier' ? 'MMM d' : 'h:mm a',
            this.locale,
          ),
        },
      })),
    })),
  );

  /** Ask "Delete this memory?" next to the bin button and emit only if the user agrees. */
  protected confirmDelete(event: Event, memory: Memory): void {
    // The row itself opens the memory, so the click must not reach it.
    event.stopPropagation();
    this.confirmationService.confirm({
      // Anchor the popup to the bin button itself, wherever inside it the click landed.
      target: (event.target as HTMLElement).closest('button') ?? undefined,
      message: 'Delete this memory? This cannot be undone.',
      icon: 'pi pi-trash',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger', size: 'small' },
      rejectButtonProps: { severity: 'secondary', size: 'small', text: true },
      accept: () => this.deleteMemory.emit(memory),
    });
  }
}

/** Sort memories newest first and split them into Today, Yesterday and Earlier. */
export function groupByDay(memories: Memory[], now: Date): MemoryGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const groups: MemoryGroup[] = [
    { label: 'Today', memories: [] },
    { label: 'Yesterday', memories: [] },
    { label: 'Earlier', memories: [] },
  ];

  const newestFirst = [...memories].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const memory of newestFirst) {
    const addedAt = new Date(memory.created_at).getTime();
    const groupIndex = addedAt >= startOfToday ? 0 : addedAt >= startOfYesterday ? 1 : 2;
    groups[groupIndex].memories.push(memory);
  }
  return groups.filter((group) => group.memories.length > 0);
}
