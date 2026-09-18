// Canonical verbatim verifier for web-harvested pairs.
// Renders each source_url in headless Chrome (what a human sees), saves an exact
// text snapshot for provenance, and confirms technical_text + executive_text are
// literal substrings of that snapshot (unicode- and whitespace-normalized).
//
//   node scripts/verify_canonical.mjs data/pairs/candidates_writeups_v1.jsonl
//
// Writes: data/snapshots/<sha1(url)>.txt (the archived rendered text)
//         <input>.verified.jsonl  (only pairs where both halves verify, with snapshot ref)
// Prints a per-pair report and totals.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import puppeteer from "/Users/marcelomoreno/Downloads/legible-sec/presentation/web/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = "/Users/marcelomoreno/Downloads/legible-sec";
const SNAP_DIR = path.join(ROOT, "data/snapshots");
fs.mkdirSync(SNAP_DIR, { recursive: true });

const inFile = process.argv[2] || "data/pairs/candidates_writeups_v1.jsonl";
const rows = fs.readFileSync(path.join(ROOT, inFile), "utf8")
  .split("\n").filter(Boolean).map((l) => JSON.parse(l));

function canon(s) {
  return (s || "")
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/ /g, " ")
    .replace(/[​﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
});

let techOK = 0, execOK = 0, bothOK = 0;
const verified = [];
const report = [];

for (const r of rows) {
  const page = await browser.newPage();
  await page.setUserAgent("legible-research/0.1 (academic dataset; marcelomorenoscholar@gmail.com)");
  let snapshot = "";
  try {
    await page.goto(r.source_url, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise((res) => setTimeout(res, 800));
    snapshot = await page.evaluate(() => document.body.innerText || "");
  } catch (e) {
    report.push(`  ERR  ${r.source_org?.slice(0, 22)}  ${e.name}  ${r.source_url}`);
    await page.close();
    continue;
  }
  await page.close();

  const hay = canon(snapshot);
  const t = hay.includes(canon(r.technical_text));
  const e = hay.includes(canon(r.executive_text));
  techOK += t; execOK += e;

  const sha = crypto.createHash("sha1").update(r.source_url).digest("hex").slice(0, 16);
  const snapPath = path.join("data/snapshots", `${sha}.txt`);
  fs.writeFileSync(path.join(ROOT, snapPath), snapshot, "utf8");

  report.push(`  ${t && e ? "OK  " : "FAIL"}  tech:${t ? "1" : "0"} exec:${e ? "1" : "0"}  ${(r.source_org || "").slice(0, 26).padEnd(26)}  ${r.source_url.slice(0, 46)}`);
  if (t && e) {
    bothOK++;
    verified.push({ ...r, verbatim_ok: true, snapshot_path: snapPath,
      snapshot_sha1: crypto.createHash("sha1").update(snapshot).digest("hex") });
  }
}
await browser.close();

const outFile = path.join(ROOT, inFile.replace(/\.jsonl$/, ".verified.jsonl"));
fs.writeFileSync(outFile, verified.map((v) => JSON.stringify(v)).join("\n") + "\n", "utf8");

console.log(report.join("\n"));
console.log(`\nboth-verbatim: ${bothOK}/${rows.length}   (tech ${techOK}/${rows.length}, exec ${execOK}/${rows.length})`);
console.log(`verified pairs -> ${path.relative(ROOT, outFile)}`);
console.log(`snapshots archived -> data/snapshots/`);
