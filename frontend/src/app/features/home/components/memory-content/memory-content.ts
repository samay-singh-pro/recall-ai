import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';

import { Attachment } from '../../attachment';
import { Memory } from '../../memory';
import { MEMORY_TYPE_COLORS, MEMORY_TYPE_ICONS } from '../../memory-type-display';
import { AttachmentPreview, describeFile } from '../attachment-preview/attachment-preview';

const TEXT_PART_ID = 'text';

/** One thing to show in the viewer: the typed text (note or link) or one attached file. */
export interface ContentPart {
  id: string;
  label: string;
  icon: string;
  color: string;
  /** Short description under the label, e.g. "PDF · 2 KB" or "24 words". */
  details: string;
  attachment: Attachment | null;
}

/**
 * A memory's original content exactly as saved, in one viewer of fixed size for every format.
 * A memory with several parts (text and files) gets a switcher to pick which one to show.
 */
@Component({
  selector: 'ra-memory-content',
  imports: [
    FormsModule,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    SelectButton,
    AttachmentPreview,
  ],
  templateUrl: './memory-content.html',
  styleUrl: './memory-content.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemoryContent {
  readonly memory = input.required<Memory>();
  readonly copyText = output<string>();

  protected readonly isLink = computed(() => ['link', 'map'].includes(this.memory().type));
  protected readonly linkLabel = computed(() =>
    this.memory().type === 'map' ? 'Open in Maps' : 'Open link',
  );
  protected readonly domain = computed(() => domainOf(this.memory().raw_text ?? ''));
  protected readonly parts = computed(() => partsOf(this.memory()));
  // Starts on the first part again whenever another memory is shown.
  protected readonly selectedPartId = linkedSignal(() => this.parts()[0]?.id ?? '');
  protected readonly selectedPart = computed(
    () => this.parts().find((part) => part.id === this.selectedPartId()) ?? this.parts()[0],
  );
}

/** The text first (if any), then each file, in the order they were added. */
export function partsOf(memory: Memory): ContentPart[] {
  const parts: ContentPart[] = memory.attachments.map((attachment) => ({
    id: attachment.id,
    label: attachment.file_name,
    icon: MEMORY_TYPE_ICONS[attachment.kind],
    color: MEMORY_TYPE_COLORS[attachment.kind],
    details: describeFile(attachment),
    attachment,
  }));
  const text = memory.raw_text;
  if (!text) return parts;

  const isLink = memory.type === 'link' || memory.type === 'map';
  const textPart: ContentPart = {
    id: TEXT_PART_ID,
    label: isLink ? domainOf(text) : 'Note',
    icon: MEMORY_TYPE_ICONS[isLink ? memory.type : 'text'],
    color: MEMORY_TYPE_COLORS[isLink ? memory.type : 'text'],
    details: isLink ? (memory.type === 'map' ? 'Map link' : 'Web page') : countWords(text),
    attachment: null,
  };
  return [textPart, ...parts];
}

/** "recipes.example.com" from a full link, or the link itself if it can't be read. */
export function domainOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

function countWords(text: string): string {
  const words = text.split(/\s+/).filter(Boolean).length;
  return words === 1 ? '1 word' : `${words} words`;
}
