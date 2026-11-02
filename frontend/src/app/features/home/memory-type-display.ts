import { MemoryType } from './memory';

/** PrimeIcons class shown for each kind of memory. */
export const MEMORY_TYPE_ICONS: Record<MemoryType, string> = {
  text: 'pi pi-align-left',
  image: 'pi pi-image',
  pdf: 'pi pi-file-pdf',
  excel: 'pi pi-file-excel',
  link: 'pi pi-link',
  map: 'pi pi-map-marker',
};

/** Short name shown for each kind of memory. */
export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  text: 'Text',
  image: 'Image',
  pdf: 'PDF',
  excel: 'Excel',
  link: 'Link',
  map: 'Map',
};

/** PrimeNG palette colour for each kind of memory, so kinds are easy to tell apart at a glance. */
export const MEMORY_TYPE_COLORS: Record<MemoryType, string> = {
  text: 'var(--p-indigo-500)',
  image: 'var(--p-pink-500)',
  pdf: 'var(--p-red-500)',
  excel: 'var(--p-emerald-500)',
  link: 'var(--p-sky-500)',
  map: 'var(--p-amber-500)',
};
