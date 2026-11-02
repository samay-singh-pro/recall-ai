import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { MemoriesApi } from './memories-api';
import { Memory } from './memory';
import { MemoryLibrary } from './memory-library';

const NOTE = { id: '1', title: 'Gym at 7' } as Memory;
const PHOTO = { id: '2', title: 'Parking spot' } as Memory;

describe('MemoryLibrary', () => {
  let library: MemoryLibrary;
  let listMemories: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listMemories = vi.fn().mockReturnValue(of([NOTE]));
    TestBed.configureTestingModule({
      providers: [MemoryLibrary, { provide: MemoriesApi, useValue: { listMemories } }],
    });
    library = TestBed.inject(MemoryLibrary);
  });

  it('loads the memories straight away', () => {
    expect(library.memories()).toEqual([NOTE]);
    expect(library.isFirstLoad()).toBe(false);
  });

  it('fetches the list again on reload', () => {
    listMemories.mockReturnValue(of([PHOTO, NOTE]));

    library.reload();

    expect(listMemories).toHaveBeenCalledTimes(2);
    expect(library.memories()).toEqual([PHOTO, NOTE]);
  });

  it('reports a failed load and keeps the list it had', () => {
    listMemories.mockReturnValue(throwError(() => new Error('offline')));

    library.reload();

    expect(library.hasError()).toBe(true);
    expect(library.memories()).toEqual([NOTE]);
  });
});
