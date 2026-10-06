#!/usr/bin/env node
// Lint for the community sketchbook: checks every entry's metadata file.
// Usage: node sketchbook/lint.mjs [entriesDir]
// Exits 0 when clean; exits 1 with one line per problem, naming file and field.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ENTRIES_DIRNAME = "entries";

// Strip // and /* */ comments and trailing commas so entries can be JSONC.
function parseJsonc(text) {
  let noComments = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inLine) {
      if (c === "\n") { inLine = false; noComments += c; }
      continue;
    }
    if (inBlock) {
      if (c === "*" && n === "/") { inBlock = false; i++; }
      continue;
    }
    if (inString) {
      noComments += c;
      if (c === "\\") { noComments += n ?? ""; i++; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; noComments += c; continue; }
    if (c === "/" && n === "/") { inLine = true; i++; continue; }
    if (c === "/" && n === "*") { inBlock = true; i++; continue; }
    noComments += c;
  }
  // Trailing commas before } or ]
  const noTrailing = noComments.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(noTrailing);
}

const REQUIRED_FIELDS = ["title", "rememberedBy", "place", "motif", "consent", "references", "status"];
const TIERS = new Set(["everyday", "regional", "sacred"]);
const STATUSES = new Set(["sketch", "proposed", "promoted"]);
const REF_KINDS = new Set(["scene", "principle", "photo", "personPhoto"]);

function lintEntry(relFile, entry, errors) {
  const fail = (field, message) =>
    errors.push(`${relFile}: ${field}: ${message}`);

  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    fail("(metadata)", "the metadata file must be a JSON object");
    return;
  }

  for (const field of REQUIRED_FIELDS) {
    const value = entry[field];
    if (!(field in entry) || value === "" || value === undefined) {
      fail(field, "missing required field");
    }
  }

  const motif = entry.motif;
  if (motif !== undefined) {
    if (typeof motif !== "object" || motif === null || Array.isArray(motif)) {
      fail("motif", "must be an object with origin, tier and gloss");
    } else {
      if (!("origin" in motif)) fail("motif.origin", "missing required field");
      if (!("tier" in motif)) fail("motif.tier", "missing required field");
      if (!("gloss" in motif)) fail("motif.gloss", "missing required field (set null when everyday)");
      if ("tier" in motif) {
        if (typeof motif.tier !== "string" || !TIERS.has(motif.tier)) {
          fail("motif.tier", `must be one of everyday, regional, sacred (got ${JSON.stringify(motif.tier)})`);
        } else if (motif.tier === "regional") {
          if (motif.gloss === undefined || motif.gloss === null ||
              (typeof motif.gloss === "string" && motif.gloss.trim() === "")) {
            fail("motif.gloss", "required when tier is regional: name where the motif comes from");
          }
        } else if (motif.tier === "sacred") {
          const lead = entry.communityLead;
          if (lead === undefined || lead === null ||
              (typeof lead === "string" && lead.trim() === "")) {
            fail("communityLead", "required when tier is sacred: name the person from the community leading the work");
          }
        }
      }
    }
  }

  if ("status" in entry && (typeof entry.status !== "string" || !STATUSES.has(entry.status))) {
    fail("status", `must be one of sketch, proposed, promoted (got ${JSON.stringify(entry.status)})`);
  }

  const refs = entry.references;
  if (refs !== undefined) {
    if (!Array.isArray(refs)) {
      fail("references", "must be an array of { kind, note }");
    } else {
      const usesPersonPhoto = refs.some(
        (r) => r && typeof r === "object" && r.kind === "personPhoto",
      );
      for (const [i, r] of refs.entries()) {
        if (!r || typeof r !== "object" || Array.isArray(r)) {
          fail(`references[${i}]`, "must be an object with kind and note");
        } else {
          if (!("kind" in r)) fail(`references[${i}].kind`, "missing required field");
          else if (typeof r.kind !== "string" || !REF_KINDS.has(r.kind)) {
            fail(`references[${i}].kind`, `must be one of scene, principle, photo, personPhoto (got ${JSON.stringify(r.kind)})`);
          }
          if (!("note" in r)) fail(`references[${i}].note`, "missing required field");
        }
      }
      if (usesPersonPhoto) {
        const consent = entry.consent;
        if (consent === undefined || consent === null ||
            (typeof consent === "string" && consent.trim() === "")) {
          fail("consent", "required when a reference is a personPhoto: say who is in the photo and what they agreed to");
        }
      }
    }
  }
}

async function findMetadataFiles(entriesDir) {
  const found = [];
  async function walk(dir) {
    let names;
    try {
      names = await readdir(dir);
    } catch {
      return { missingDir: true };
    }
    for (const name of names) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const full = path.join(dir, name);
      const s = await stat(full).catch(() => null);
      if (!s) continue;
      if (s.isDirectory()) {
        if (name.startsWith("_")) continue; // _template and friends
        const nested = await walk(full);
        if (nested?.missingDir) return { missingDir: true };
      } else if (/\.(json|jsonc)$/.test(name)) {
        found.push(full);
      }
    }
    return { missingDir: false };
  }
  const result = await walk(entriesDir);
  return { found, missingDir: result?.missingDir ?? false };
}

export async function lintEntries(entriesDir) {
  const errors = [];
  const { found, missingDir } = await findMetadataFiles(entriesDir);
  if (missingDir) {
    errors.push(`${entriesDir}: (entries directory): not found`);
    return errors;
  }
  for (const file of found) {
    const relFile = path.relative(path.dirname(entriesDir), file).replaceAll("\\", "/");
    let entry;
    try {
      entry = parseJsonc(await readFile(file, "utf8"));
    } catch (err) {
      errors.push(`${relFile}: (parse): ${err.message}`);
      continue;
    }
    lintEntry(relFile, entry, errors);
  }
  return errors;
}

export async function main(argv = process.argv.slice(2)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const entriesDir = path.resolve(argv[0] ?? path.join(here, ENTRIES_DIRNAME));
  const errors = await lintEntries(entriesDir);
  if (errors.length > 0) {
    for (const line of errors) console.log(line);
    return 1;
  }
  const { found } = await findMetadataFiles(entriesDir);
  console.log(`sketchbook lint: clean (${found.length} entries ok)`);
  return 0;
}

// Run only when invoked directly, not when imported by the tests.
import { fileURLToPath } from "node:url";
const selfPath = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === selfPath) {
  process.exit(await main());
}
