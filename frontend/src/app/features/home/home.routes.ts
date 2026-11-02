import { Routes } from '@angular/router';

import { HomePage } from './home-page/home-page';
import { MemoryDetail } from './memory-detail/memory-detail';
import { MemorySearch } from './memory-search/memory-search';
import { NewMemory } from './new-memory/new-memory';

// The home page is the frame (sidebar, header); these pages swap in its middle.
export const HOME_ROUTES: Routes = [
  {
    path: '',
    component: HomePage,
    children: [
      { path: '', component: NewMemory, title: 'Recall AI' },
      { path: 'search', component: MemorySearch, title: 'Search · Recall AI' },
      { path: 'memories/:memoryId', component: MemoryDetail, title: 'Memory · Recall AI' },
    ],
  },
];
