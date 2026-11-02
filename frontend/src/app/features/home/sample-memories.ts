import { Memory } from './memory';

// The sample files live in `public/samples/`.
const SAMPLES_URL = '/samples';

/**
 * Realistic memories of every format the stand-in API starts with, so each screen has
 * something to show. Removed together with the stand-in once the backend exists.
 */
export function createSampleMemories(now = new Date()): Memory[] {
  return [
    {
      id: 'sample-wifi',
      type: 'text',
      title: "Mom's wifi password",
      raw_text:
        "Mom's wifi\nNetwork: Sharma-Home-5G\nPassword: sunflower42\nRouter is behind the TV.",
      attachments: [],
      summary: null,
      link_preview: null,
      source_memory: null,
      created_at: hoursAgo(now, 2),
    },
    {
      id: 'sample-parking',
      type: 'image',
      title: 'Airport parking spot',
      raw_text: null,
      attachments: [
        {
          id: 'sample-parking-photo',
          kind: 'image',
          file_name: 'airport-parking-spot.svg',
          file_url: `${SAMPLES_URL}/airport-parking-spot.svg`,
          file_size: 1544,
          preview_rows: null,
        },
      ],
      summary: 'Parked at the Terminal 2 garage, level P2, spot C-47.',
      link_preview: null,
      source_memory: null,
      created_at: hoursAgo(now, 26),
    },
    {
      id: 'sample-restaurant',
      type: 'text',
      title: 'Olive & Thyme, recommended by Priya',
      raw_text:
        'Priya recommended Olive & Thyme on 5th Street. Get the mushroom risotto and the ' +
        'tiramisu. Book ahead on weekends, it fills up by 8.',
      attachments: [],
      summary: null,
      link_preview: null,
      source_memory: null,
      created_at: hoursAgo(now, 30),
    },
    {
      id: 'sample-lease',
      type: 'pdf',
      title: 'Apartment lease agreement',
      raw_text: null,
      attachments: [
        {
          id: 'sample-lease-pdf',
          kind: 'pdf',
          file_name: 'lease-agreement.pdf',
          file_url: `${SAMPLES_URL}/lease-agreement.pdf`,
          file_size: 2054,
          preview_rows: null,
        },
      ],
      summary:
        '12-month lease for Flat 4B from 1 Dec 2026. Rent 28,000 is due by the 5th; ' +
        "the deposit is two months' rent. Two months' notice to leave after the first 6 months.",
      link_preview: null,
      source_memory: null,
      created_at: hoursAgo(now, 72),
    },
    {
      id: 'sample-recipe',
      type: 'link',
      title: 'One-bowl banana bread recipe',
      raw_text: 'https://recipes.example.com/one-bowl-banana-bread',
      attachments: [],
      summary: 'A one-bowl banana bread that takes about an hour, using 3 very ripe bananas.',
      link_preview: {
        title: 'One-Bowl Banana Bread (Ready in 1 Hour)',
        description:
          'Moist, simple banana bread made in a single bowl with 3 ripe bananas, butter and ' +
          'brown sugar. No mixer needed.',
      },
      source_memory: null,
      created_at: hoursAgo(now, 100),
    },
    {
      id: 'sample-budget',
      type: 'excel',
      title: 'Japan trip budget',
      raw_text: null,
      attachments: [
        {
          id: 'sample-budget-xlsx',
          kind: 'excel',
          file_name: 'japan-trip-budget.xlsx',
          file_url: `${SAMPLES_URL}/japan-trip-budget.xlsx`,
          file_size: 1811,
          preview_rows: [
            ['Item', 'Category', 'Cost (USD)', 'Booked'],
            ['Flights Delhi-Tokyo (2)', 'Travel', '1480', 'Yes'],
            ['Hotel Shinjuku, 5 nights', 'Stay', '960', 'Yes'],
            ['Ryokan Hakone, 2 nights', 'Stay', '620', 'No'],
            ['JR Pass, 7 days (2)', 'Travel', '420', 'No'],
            ['Food & cafes', 'Daily', '450', '-'],
            ['Activities & tickets', 'Daily', '190', '-'],
            ['Total', '', '4120', ''],
          ],
        },
      ],
      summary: 'Estimated 4,120 USD for two people; flights are the biggest cost.',
      link_preview: null,
      source_memory: null,
      created_at: hoursAgo(now, 150),
    },
  ];
}

function hoursAgo(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}
