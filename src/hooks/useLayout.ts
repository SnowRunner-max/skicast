import { useMediaQuery } from './useMediaQuery'

/**
 * The three ways the screen is arranged. Phones come first; the others are
 * layered on top of the phone styles in index.css.
 *
 *  - sheet: the map fills the screen and the forecast is a bottom sheet over
 *    it. Every phone held upright, and tablets.
 *  - split: map on the left, forecast card on the right, with tight spacing.
 *    A phone turned on its side, where a bottom sheet would leave no map.
 *  - wide: the same two columns with desktop spacing, framing every lift.
 */
export type Layout = 'sheet' | 'split' | 'wide'

const WIDE = '(min-width: 1100px)'
/**
 * "Short and landscape" rather than a width, because a phone on its side is
 * wider than many tablets are upright; what it lacks is height. The width
 * floor keeps a very small window from being split into two unusable columns.
 */
const SPLIT = '(orientation: landscape) and (max-height: 520px) and (min-width: 540px)'

/**
 * The layout is decided here, in one place, and App writes it to
 * `data-layout` on the root for the stylesheet to read. A CSS media query
 * would be the usual tool, but the layout also changes which components are
 * rendered (BottomSheet or a card) and how the map frames itself, so script
 * has to know it anyway. Keeping a second copy of the breakpoints in CSS
 * would let the two disagree.
 */
export function useLayout(): Layout {
  const wide = useMediaQuery(WIDE)
  const split = useMediaQuery(SPLIT)
  return wide ? 'wide' : split ? 'split' : 'sheet'
}
