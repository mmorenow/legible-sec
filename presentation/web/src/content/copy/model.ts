// Copy for /model: plaintext-9b, the archived laptop model.
//
// The page body is composed of PlaintextBanner, LoraDiagram and ModelRunIt.
// The first two read their prose from here; ModelRunIt still carries its own.
//
// The page documents an archived artifact, so nothing below is maintained as a
// claim any more. It is kept exactly as it was written, which is the only
// reason the strings could be moved at all.

export const meta = {
  title: "plaintext-9b · the LEGIBLE model",
  description:
    "plaintext-9b: a 9-billion-parameter model that turns a raw security finding into plain language, in the voice of whoever is in the room. Runs fully offline on a laptop.",
  canonical: "/model/",
};

/* PlaintextBanner: the paragraph under the decoding wordmark. */
export const banner = {
  lede: "A 9-billion-parameter model that turns a raw security finding into plain language, in the voice of whoever is in the room. It runs fully offline on a 16-gigabyte laptop, and the findings you paste never leave your machine.",
};

/* LoraDiagram: the mechanism, taught. Only the lines a reader reads as prose
   are here. The equation's own labels stay in the component, because "Frozen
   base", "Adapter" and "rank 16" name the boxes they sit inside and mean
   nothing away from them. */
export const lora = {
  intro:
    "A LoRA leaves the giant base model untouched and bolts on a tiny trainable adapter. That is the whole idea:",
  baseWeights: "9,000,000,000 weights · never changed",
  runsOn: "4-bit MLX · Apple silicon · client findings never leave the machine",
};
