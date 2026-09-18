// Copy for /try: the instrument page.

export const meta = {
  title: "LEGIBLE \u00b7 try it",
  description:
    "Paste a technical finding and the summary somebody wrote from it, and the checks read the summary against the finding. Everything on this page runs in your browser and sends nothing.",
  canonical: "/try/",
};

export const page = {
  /* Visually hidden: the mode selector inside the instrument is what a sighted
     reader sees as the heading. */
  srHeading: "Try LEGIBLE: review a draft, or see how a concept was explained",
};

/* The quiet footer under the instrument. It exists to answer the question a
   checker invites: what happens to the text I paste. The answer is short and
   the page has to be able to prove it, which is why both modes run locally. */
export const runsHere = {
  heading: "Where this runs.",
  /* Page level, so it has to be true of BOTH modes. Review reads two texts and
     can call a model if you give it a key; Explain retrieves from a library
     that ships inside the page and never calls anything. Saying "the draft you
     paste" here was true of one tab and false of the other. */
  body: "Everything on this page is JavaScript in this tab. What you paste, and what comes back, stays in the browser. Review can go further if you give it a key: the layers above the deterministic one need a model, and that key is stored in this browser and used only to call the provider you chose, directly. Explain never calls anything, because the analogy library ships inside the page.",
  points: [
    { label: "Sent to a server", value: "Nothing, unless you add a key" },
    { label: "With a key", value: "Only the two texts you pasted into Review, to the provider you chose" },
    { label: "Stored", value: "The key, in this browser · clearable from the panel above" },
  ],
};

// ---------------------------------------------------------------------------
// Explain mode
//
// The other half of /try. It retrieves an analogy a professional published and
// it never writes one, so every line below is about where the words came from
// rather than about what they say. The miss state is the important one: a
// retriever that fills its own gaps would be the failure this project exists
// to name, so the gap is reported and the reader is offered concepts the
// library actually holds.
// ---------------------------------------------------------------------------

export const explain = {
  /* The count is the size of the baked library, passed in, because the library
     is data and its length is read off the JSON at render time. */
  retrievesNote: (onFile: number) =>
    `retrieves the closest real analogy from the baked library · ${onFile} on file · nothing is generated`,
  idle: "A real analogy from the corpus, with its author on the record.",
  verbatimNote:
    "retrieved verbatim from the library, never generated · it is not rewritten for your finding",
  missHeading: "No analogy in the library covers that yet.",
  missBody:
    "Every analogy here is a real, attributed explanation a professional published, and this mode only retrieves from that library: it will not write one to fill the gap. Try a concept the library knows:",
};

// ---------------------------------------------------------------------------
// The key gate
//
// The control that supplies the key the model layers need. It is a control and
// not an onboarding flow, so these strings state what is running, what is not,
// and where the key goes. Nothing here persuades anybody to add one.
// ---------------------------------------------------------------------------

export const keyGate = {
  /* The provider's own display name is passed in, from `@/lib/keyStore`, which
     is where the list of providers is defined. */
  storedNote: (providerLabel: string) =>
    `the key is stored in this browser and sent only to ${providerLabel} ·`,
  consoleLinkLabel: "get one",
  /* Appended to the line above, for one provider only. Browsers are refused by
     OpenAI often enough that a reader who hits it should have been told first. */
  openaiNote: " · OpenAI often refuses calls made straight from a page",
  runningNote:
    "deterministic checks are running · entailment and judgement need a key from Anthropic, OpenAI or Google",
};

// ---------------------------------------------------------------------------
// The precedents band
//
// Real pairs from the corpus, nearest the finding on screen. It asks a local
// motor, so both of the states below are failures to retrieve rather than
// findings about the text, and both say which one they are.
// ---------------------------------------------------------------------------

export const precedents = {
  offlineNote: "start the local motor to see precedents ·",
  retryLabel: "try again",
  emptyNote: "no close precedents in the index for this text",
};
