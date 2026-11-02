import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Memory } from '../../memory';
import {
  MEMORY_TYPE_COLORS,
  MEMORY_TYPE_ICONS,
  MEMORY_TYPE_LABELS,
} from '../../memory-type-display';

/** A compact, clickable summary of one memory that opens its page: used for search results. */
@Component({
  selector: 'ra-memory-card',
  imports: [DatePipe, RouterLink],
  templateUrl: './memory-card.html',
  styleUrl: './memory-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemoryCard {
  readonly memory = input.required<Memory>();

  protected readonly icon = computed(() => MEMORY_TYPE_ICONS[this.memory().type]);
  protected readonly typeLabel = computed(() => MEMORY_TYPE_LABELS[this.memory().type]);
  protected readonly typeColor = computed(() => MEMORY_TYPE_COLORS[this.memory().type]);
  protected readonly snippet = computed(() => snippetOf(this.memory()));
  protected readonly fileCount = computed(() => this.memory().attachments.length);
  // A photo shows itself; everything else shows its type icon.
  protected readonly thumbnailUrl = computed(
    () => this.memory().attachments.find((file) => file.kind === 'image')?.file_url ?? null,
  );
}

/** One line of what's inside: the text, a page description, or the summary; never the title again. */
export function snippetOf(memory: Memory): string {
  const isLink = memory.type === 'link' || memory.type === 'map';
  const text = isLink
    ? (memory.link_preview?.description ?? memory.raw_text)
    : (memory.raw_text ?? memory.summary);
  const snippet = (text ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' · ');
  return snippet === memory.title ? (memory.summary ?? '') : snippet;
}
