import type { CategoryId } from "./types.ts";

/**
 * The fixed report skeleton.
 *
 * Every scan renders every check in this catalog, in this order, whatever was uploaded.
 * A check is either CLEAR or has findings — it is never absent. That is what makes two
 * scans comparable, and what makes a report the user can learn to read once.
 *
 * The engine is deterministic: pattern analysis over the text, no model in the loop, so
 * the same folder always produces the same report. Adding a check here without emitting
 * it (or emitting a checkId not listed here) fails the catalog test.
 */
export interface CheckMeta {
  id: string;
  categoryId: CategoryId;
  name: string;
  blurb: string;
}

export const CHECK_CATALOG: CheckMeta[] = [
  // Prompt injection & instruction hijack — AST01
  { id: "injection-override", categoryId: "injection", name: "Instruction override", blurb: "Text telling the agent to ignore the rules it already has." },
  { id: "injection-role-rewrite", categoryId: "injection", name: "Role rewrite", blurb: "Reassigns who the agent is, for every turn after it loads." },
  { id: "injection-system-claim", categoryId: "injection", name: "System-prompt impersonation", blurb: "Claims the authority of a higher-privilege message." },
  { id: "injection-deception", categoryId: "injection", name: "Concealment instruction", blurb: "Tells the agent to act without telling you." },
  { id: "injection-trusts-remote-text", categoryId: "injection", name: "Remote text as instructions", blurb: "Treats fetched content as directives rather than data." },
  { id: "injection-invisible-characters", categoryId: "injection", name: "Invisible characters", blurb: "Zero-width and bidi controls that read differently to a human." },
  { id: "injection-html-comment", categoryId: "injection", name: "Hidden HTML comment", blurb: "Imperative text invisible when rendered, visible to the model." },

  // Untrusted external instructions — AST05
  { id: "external-fetch-and-execute", categoryId: "external-instructions", name: "Fetch and execute", blurb: "Downloads and runs code in a single unreviewed step." },
  { id: "external-eval-fetch", categoryId: "external-instructions", name: "Evaluated remote content", blurb: "Hands remotely fetched text to an interpreter." },
  { id: "external-remote-instruction-file", categoryId: "external-instructions", name: "Remote instruction file", blurb: "Loads its own instructions from a URL you do not control." },
  { id: "external-unpinned-source", categoryId: "external-instructions", name: "Mutable raw source", blurb: "Branch or tag URLs that can change after you reviewed them." },
  { id: "external-opaque-host", categoryId: "external-instructions", name: "Opaque host", blurb: "Paste sites and shortened links that hide what they serve." },

  // Supply chain & drift — AST02, AST07
  { id: "supply-off-registry-install", categoryId: "supply-chain", name: "Off-registry install", blurb: "Installs from a git URL or tarball rather than a registry." },
  { id: "supply-unpinned-install", categoryId: "supply-chain", name: "Unpinned dependency", blurb: "No version, so you get whatever is newest when it runs." },
  { id: "supply-typosquat-shape", categoryId: "supply-chain", name: "Typosquat shape", blurb: "A package name one edit away from a popular one." },
  { id: "supply-binary-artifact", categoryId: "supply-chain", name: "Shipped binary", blurb: "A compiled artifact nobody reviews in a pull request." },
  { id: "supply-make-executable", categoryId: "supply-chain", name: "Marked executable", blurb: "The last step before downloaded code can run." },
  { id: "supply-global-install", categoryId: "supply-chain", name: "Global install", blurb: "Changes the machine, not just the project." },

  // Over-privilege — AST03
  { id: "privilege-wildcard-tools", categoryId: "over-privilege", name: "Wildcard tool grant", blurb: "Every tool the agent has, with no prompt before use." },
  { id: "privilege-unconstrained-shell", categoryId: "over-privilege", name: "Unconstrained shell", blurb: "Bash with no command filter is arbitrary execution." },
  { id: "privilege-permission-bypass", categoryId: "over-privilege", name: "Permission bypass", blurb: "Asks you to disable the last place a human can intervene." },
  { id: "privilege-combo", categoryId: "over-privilege", name: "Shell + network + write", blurb: "Individually fine; together a complete path in and out." },
  { id: "privilege-sudo", categoryId: "over-privilege", name: "Root requested", blurb: "Turns a mistake in a skill into a mistake on the machine." },
  { id: "privilege-writes-outside-workspace", categoryId: "over-privilege", name: "Writes outside the workspace", blurb: "Changes that outlive the project and the skill." },

  // Data-exfiltration paths — AST05
  { id: "exfil-pair", categoryId: "exfiltration", name: "Credential read + route out", blurb: "Reads secrets and has somewhere to send them. The pairing is the finding." },
  { id: "exfil-codebase-upload", categoryId: "exfiltration", name: "Codebase upload", blurb: "Archives the project, then sends the archive." },
  { id: "exfil-hardcoded-secret", categoryId: "exfiltration", name: "Committed credential", blurb: "A live key in a published file is a key in everyone's hands." },
  { id: "exfil-collector-endpoint", categoryId: "exfiltration", name: "Collector endpoint", blurb: "Hosts that exist to receive arbitrary data from anywhere." },
  { id: "exfil-credential-read", categoryId: "exfiltration", name: "Credential access", blurb: "Touches secrets. Listed so a later outbound call is a change you notice." },

  // Hidden & unreadable content — AST08
  { id: "opacity-encoded-blob", categoryId: "opacity", name: "Encoded blob", blurb: "Content no reviewer could have read, inside an instruction file." },
  { id: "opacity-runtime-decode", categoryId: "opacity", name: "Runtime decoding", blurb: "Produces content that never existed in reviewable form." },
  { id: "opacity-skipped-directory", categoryId: "opacity", name: "Skipped directory", blurb: "Runnable code parked where review and scanners do not look." },
  { id: "opacity-unreadable-file", categoryId: "opacity", name: "Unreadable file", blurb: "Reported, never passed over. What we cannot read, we cannot clear." },
  { id: "opacity-bulk-reference", categoryId: "opacity", name: "Bulk reference", blurb: "A file too large for anyone to have read end to end." },

  // Metadata hygiene — AST04
  { id: "metadata-no-frontmatter", categoryId: "metadata", name: "Missing frontmatter", blurb: "No name or trigger, so it fires on everything or nothing." },
  { id: "metadata-missing-name", categoryId: "metadata", name: "Missing name", blurb: "Nothing to reference, pin or report against." },
  { id: "metadata-missing-description", categoryId: "metadata", name: "Missing description", blurb: "The only thing the agent sees when deciding to load it." },
  { id: "metadata-unsafe-yaml", categoryId: "metadata", name: "Unsafe YAML", blurb: "Tags, anchors and merge keys, parsed before anyone trusts the skill." },
  { id: "metadata-over-budget", categoryId: "metadata", name: "Description over budget", blurb: "Past 1,536 characters the trigger wording is silently cut." },
  { id: "metadata-keyword-stuffed", categoryId: "metadata", name: "Keyword-stuffed description", blurb: "Fires on prompts it has no business in, on every turn." },
  { id: "metadata-body-over-limit", categoryId: "metadata", name: "Body over the line limit", blurb: "Expensive to load and unlikely to have been read in full." },
  { id: "metadata-no-version", categoryId: "metadata", name: "No version", blurb: "Nothing says whether this is the skill you reviewed last month." },
  { id: "metadata-no-owner", categoryId: "metadata", name: "No owner", blurb: "Nobody named to answer for it when it misfires." },
  { id: "metadata-no-license", categoryId: "metadata", name: "No license", blurb: "The terms you are installing under are unstated." },
  { id: "metadata-tools-undeclared", categoryId: "metadata", name: "No declared tool list", blurb: "Inherits whatever the agent has — shell, network, writes." },
  { id: "metadata-broad-trigger", categoryId: "metadata", name: "Broad trigger", blurb: "Fires on many prompts, and wins ones that belonged elsewhere." },

  // Library-level — AST09
  { id: "library-trigger-collision", categoryId: "library", name: "Trigger collision", blurb: "Two skills competing for the same prompts; which fires is arbitrary." },
  { id: "library-duplicate-body", categoryId: "library", name: "Duplicate skill", blurb: "Two copies drift apart and only one of them gets fixed." },
  { id: "library-listing-cost", categoryId: "library", name: "Listing cost", blurb: "What you pay on every turn for skills that never fire." },
  { id: "library-orphan-reference", categoryId: "library", name: "Orphan reference", blurb: "Points at a file that is not there; the agent fails quietly." },
];

export const CHECK_IDS = new Set(CHECK_CATALOG.map((c) => c.id));

/** How many named checks the fixed skeleton runs. Copy reads this, never a literal. */
export const CHECK_COUNT = CHECK_CATALOG.length;
