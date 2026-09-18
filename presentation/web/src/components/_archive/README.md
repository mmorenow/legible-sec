# Retired components

Nothing here is dead code and nothing here gets deleted. These components were
built for the project's earlier framing, where LEGIBLE was a translator with a
judge attached. The project is now organized around the rubric and the
instruments that apply it, so these no longer describe what the site is.

They are kept because they work, because the animation work in them is
expensive to rebuild, and because a framing that changed once can change again.

Nothing in this folder is imported by a route. Removing an import is how a
component arrives here; deleting a file is not something this project does.

## What is here, and why it was retired

- **HeroMerge.tsx** · the hero animation in which a finding's words arc into a
  smudge and bloom back out as an executive translation. Retired 2026-08-31:
  LEGIBLE does not translate anything for now, so the first thing the home page
  showed a reader was the one claim the project no longer makes.
- **Workflow.tsx** · the workflow rail, "one finding in, one faithful sentence
  out". Retired 2026-08-31: it describes a translation machine end to end, and
  there is no such machine to describe.
- **RagFlow.tsx** · the retrieval pipeline, showing how a precedent is fetched
  in order to translate with it. Retired 2026-08-31: retrieval is still real,
  but everything it is drawn as feeding is not.
- **AudiencePlan.tsx** · the five audience personas as flip cards. Retired
  2026-08-31 by owner decision: audiences are not shown on the site at all.
  The persona videos it played remain in `public/media/`.
