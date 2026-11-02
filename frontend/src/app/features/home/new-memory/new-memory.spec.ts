import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { MemoryInput } from '../components/memory-input/memory-input';
import { MemoriesApi } from '../memories-api';
import { Memory } from '../memory';
import { MemoryLibrary } from '../memory-library';
import { NewMemory } from './new-memory';

describe('NewMemory', () => {
  let fixture: ComponentFixture<NewMemory>;
  let compiled: HTMLElement;
  let createMemory: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;
  let addToast: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createMemory = vi.fn().mockReturnValue(of({ id: '1' } as Memory));
    reload = vi.fn();
    addToast = vi.fn();
    await TestBed.configureTestingModule({
      imports: [NewMemory],
      providers: [
        { provide: MemoriesApi, useValue: { createMemory } },
        { provide: MemoryLibrary, useValue: { reload } },
        { provide: MessageService, useValue: { add: addToast } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewMemory);
    await fixture.whenStable();
    compiled = fixture.nativeElement as HTMLElement;
  });

  function remember(text: string): Promise<void> {
    const draft = { text, files: [new File(['x'], 'photo.png', { type: 'image/png' })] };
    fixture.debugElement.query(By.directive(MemoryInput)).triggerEventHandler('remember', draft);
    return fixture.whenStable();
  }

  it('greets the user', () => {
    expect(compiled.querySelector('h1')?.textContent).toMatch(
      /Good (morning|afternoon|evening), Guest/,
    );
  });

  it('saves the add box as one memory, then confirms and refreshes the list', async () => {
    await remember('Gym at 7');

    expect(createMemory).toHaveBeenCalledExactlyOnceWith({
      text: 'Gym at 7',
      files: [expect.objectContaining({ name: 'photo.png' })],
    });
    expect(reload).toHaveBeenCalledOnce();
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('says so when saving fails and leaves the list alone', async () => {
    createMemory.mockReturnValue(throwError(() => new Error('offline')));

    await remember('Gym at 7');

    expect(reload).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });
});
