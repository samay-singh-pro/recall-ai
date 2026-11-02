import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';

/** Header search for memories: Enter searches, × clears, Cmd/Ctrl+K jumps to it from anywhere. */
@Component({
  selector: 'ra-search-bar',
  imports: [FormsModule, IconField, InputIcon, InputText],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'focusOnShortcut($event)' },
})
export class SearchBar {
  /** The search currently shown, so the bar always says what the results are for. */
  readonly query = input('');
  readonly search = output<string>();
  readonly clear = output<void>();

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  protected readonly draft = linkedSignal(() => this.query());
  protected readonly shortcutHint = computed(() =>
    navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K',
  );

  /** Search for what's typed. */
  protected submit(): void {
    const query = this.draft().trim();
    if (query) this.search.emit(query);
  }

  /** Empty the bar and keep the cursor in it for a new search. */
  protected clearSearch(): void {
    this.draft.set('');
    this.clear.emit();
    this.field().nativeElement.focus();
  }

  protected focusOnShortcut(event: KeyboardEvent): void {
    const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (!isShortcut) return;
    event.preventDefault();
    this.field().nativeElement.focus();
  }
}
