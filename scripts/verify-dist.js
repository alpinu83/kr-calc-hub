#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "rates-2026.json"), "utf8"));
const BASE_URL = DATA.siteUrl.replace(/\/+$/, "");
const BASE_PATH = (() => {
  try {
    return new URL(BASE_URL).pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
})();

function walkHtml(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtml(full, results);
    } else if (entry.name.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

function resolveDistTarget(urlPath) {
  let clean = urlPath.split("#")[0].split("?")[0];
  if (BASE_PATH) {
    assert(
      clean === BASE_PATH || clean.startsWith(`${BASE_PATH}/`),
      `Unprefixed internal path "${urlPath}" (expected prefix "${BASE_PATH}/")`
    );
    clean = clean.slice(BASE_PATH.length) || "/";
  }
  const rel = clean.replace(/^\/+/, "");
  if (!rel) return path.join(DIST, "index.html");
  const exact = path.join(DIST, rel);
  if (fs.existsSync(exact) && fs.statSync(exact).isFile()) return exact;
  const asIndex = path.join(DIST, rel, "index.html");
  if (fs.existsSync(asIndex) && fs.statSync(asIndex).isFile()) return asIndex;
  return null;
}

function verify() {
  const requiredFiles = [
    "index.html",
    "404.html",
    "sitemap.xml",
    "rss.xml",
    "robots.txt",
    "ads.txt",
    ".nojekyll",
    "about/index.html",
    "privacy/index.html",
    "tips/index.html",
    "year-end-tax/index.html",
    "couple-tax/index.html",
    "business-tax/index.html",
    "inheritance-tax/index.html",
    "transfer-tax/index.html",
    "vat/index.html",
    "financial-tax/index.html",
    "car-tax/index.html",
    "other-income/index.html",
    "holding-tax/index.html",
    "eitc/index.html",
    "weekly-holiday/2027-minimum-wage/index.html",
    "assets/styles.css",
    "assets/wage-tax-table-2026.js",
    "assets/calculators.js",
    "assets/calculators-ext.js",
    "assets/app.js",
    "assets/app-ext.js",
    "assets/favicon.svg",
    "assets/og-image.svg"
  ];
  for (const rel of requiredFiles) {
    assert(fs.existsSync(path.join(DIST, rel)), `Missing required dist file: ${rel}`);
  }

  const htmlFiles = walkHtml(DIST);
  assert(htmlFiles.length >= 210, `Expected at least 210 HTML files, found ${htmlFiles.length}`);

  let checkedLinks = 0;
  for (const file of htmlFiles) {
    const relFile = path.relative(DIST, file);
    const html = fs.readFileSync(file, "utf8");

    assert(/<title>[^<]+<\/title>/.test(html), `Missing <title> in ${relFile}`);
    assert(/<meta name="description" content="[^"]+"/.test(html), `Missing description in ${relFile}`);
    assert(/<link rel="canonical" href="https?:\/\/[^"]+"/.test(html), `Missing canonical in ${relFile}`);
    assert(/<h1[\s>]/.test(html), `Missing <h1> in ${relFile}`);
    assert(!html.includes("#affiliate-"), `Dummy #affiliate-* link found in ${relFile}`);

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert(jsonLdMatch, `Missing JSON-LD in ${relFile}`);
    const parsedLd = JSON.parse(jsonLdMatch[1]);
    assert(Array.isArray(parsedLd) && parsedLd.length > 0, `Invalid JSON-LD array in ${relFile}`);

    const attrRegex = /\b(?:href|src)="([^"]+)"/g;
    let m;
    while ((m = attrRegex.exec(html)) !== null) {
      const target = m[1];
      if (/^(https?:|mailto:|tel:|#|data:)/i.test(target)) continue;
      checkedLinks++;
      const resolved = resolveDistTarget(target);
      assert(resolved, `Broken internal link "${target}" in ${relFile}`);
    }
  }

  const sitemap = fs.readFileSync(path.join(DIST, "sitemap.xml"), "utf8");
  assert(sitemap.includes(`<loc>${BASE_URL}/</loc>`), "Sitemap missing home URL");
  assert(sitemap.includes(`<loc>${BASE_URL}/tips/</loc>`), "Sitemap missing /tips/");
  assert(sitemap.includes(`<loc>${BASE_URL}/about/</loc>`), "Sitemap missing /about/");
  assert(sitemap.includes(`<loc>${BASE_URL}/privacy/</loc>`), "Sitemap missing /privacy/");
  assert(
    sitemap.includes(`<loc>${BASE_URL}/weekly-holiday/2027-minimum-wage/</loc>`),
    "Sitemap missing /weekly-holiday/2027-minimum-wage/"
  );
  assert(!sitemap.includes("404.html"), "Sitemap must not include 404.html");

  const rss = fs.readFileSync(path.join(DIST, "rss.xml"), "utf8");
  assert(rss.includes("<rss version=\"2.0\""), "Invalid rss.xml header");
  assert(rss.includes(`<link>${BASE_URL}/</link>`), "rss.xml missing channel link");

  const robots = fs.readFileSync(path.join(DIST, "robots.txt"), "utf8");
  assert(robots.includes(`Sitemap: ${BASE_URL}/sitemap.xml`), "robots.txt sitemap mismatch");

  console.log(
    `Verified ${htmlFiles.length} HTML pages, ${checkedLinks} internal links, JSON-LD, sitemap.xml, rss.xml, and robots.txt — 0 issues!`
  );
}

verify();
