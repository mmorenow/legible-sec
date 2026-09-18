/* The eight dimension marks.
 *
 * Generated from docs/ICON-PROMPTS-rubric.md: each dimension is drawn as a small
 * instrument in the manner of a patent plate, because every mark has to contain
 * something that moves, holds, measures or refuses. D1 is a pin tumbler lock
 * whose key only turns when every question lines up. D5 is a laboratory sieve
 * with one stone too large to pass. The two colours are load bearing: the part
 * that holds the source is rust, the part that serves the reader is cobalt.
 *
 * They are raster, not SVG, and they carry their own colour rather than taking
 * it from the axis. That is a deliberate trade: the engraving detail is what
 * makes them readable as instruments, and it does not survive being reduced to
 * a single stroke weight. They are displayed large for the same reason. The
 * hand drawn line versions they replaced are in git history if a smaller,
 * tintable set is ever wanted.
 */

import type { DimensionId } from "@/content/rubric";

type IconProps = { size?: number; className?: string };

export function DimensionIcon({ id, size = 88, className }: { id: DimensionId } & IconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/rubric/${id.toLowerCase()}.png`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
