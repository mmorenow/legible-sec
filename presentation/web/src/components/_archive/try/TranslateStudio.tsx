"use client";

import { TryPanel } from "../TryPanel";

/* Translate: one surface, no forks. TryPanel's live view owns every state —
   motor offline (quickstart + recorded session), warming, loading, result —
   and its Audience options are the dataset's real registers
   (audience_observed). The old aspirational entry form (legacy audience keys,
   a Goal selector that drove nothing) is gone: the instrument never shows a
   control the motor does not honor. */

export function TranslateStudio() {
  return <TryPanel mode="live" />;
}
