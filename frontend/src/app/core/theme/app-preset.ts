import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

// Toasts are calm neutral cards in every severity; only the icon is coloured (see styles.scss).
const NEUTRAL_TOAST = {
  background: '{content.background}',
  borderColor: '{content.border.color}',
  color: '{text.color}',
  detailColor: '{text.muted.color}',
  shadow: '{overlay.popover.shadow}',
  closeButton: {
    hoverBackground: '{content.hover.background}',
    focusRing: { color: '{focus.ring.color}', shadow: 'none' },
  },
};

/** Aura with an indigo accent; every PrimeNG component picks the colour up from here. */
export const APP_PRESET = definePreset(Aura, {
  semantic: {
    primary: Object.fromEntries(SHADES.map((shade) => [shade, `{indigo.${shade}}`])),
  },
  components: {
    toast: {
      root: { width: '20rem', borderRadius: '0.875rem', blur: '0' },
      summary: { fontWeight: '500', fontSize: '0.875rem' },
      success: NEUTRAL_TOAST,
      info: NEUTRAL_TOAST,
      warn: NEUTRAL_TOAST,
      error: NEUTRAL_TOAST,
    },
  },
});
