#!/usr/bin/env node
"use strict";

/*
 * IndexNow 자동 색인 알림 스크립트
 * 배포 완료 후 dist/sitemap.xml의 모든 URL을 api.indexnow.org(Bing·Naver·Yandex·AI 검색)에 제출합니다.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/rates-2026.json"), "utf8"));
const SITEMAP = path.join(ROOT, "dist/sitemap.xml");

async function main() {
  const key = DATA.verification && DATA.verification.indexNowKey;
  if (!key) {
    console.log("IndexNow: data/rates-2026.json에 indexNowKey가 없어 건너뜁니다.");
    return;
  }
  const baseUrl = String(DATA.siteUrl || "").replace(/\/+$/, "");
  let xml = "";
  if (fs.existsSync(SITEMAP)) {
    xml = fs.readFileSync(SITEMAP, "utf8");
  } else {
    const res = await fetch(`${baseUrl}/sitemap.xml`);
    if (!res.ok) {
      console.log(`IndexNow: ${baseUrl}/sitemap.xml 조회 실패 (HTTP ${res.status})`);
      return;
    }
    xml = await res.text();
  }
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (!urls.length) {
    console.log("IndexNow: 제출할 URL이 없습니다.");
    return;
  }
  const host = new URL(baseUrl).hostname;
  const payload = {
    host,
    key,
    keyLocation: `${baseUrl}/${key}.txt`,
    urlList: urls.slice(0, 10000)
  };

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const text = await res.text().catch(() => "");
    console.log(`IndexNow response: HTTP ${res.status} (${urls.length} URLs submitted) ${text}`.trim());
  } catch (err) {
    console.warn("IndexNow ping warning (non-fatal):", err && err.message ? err.message : err);
  }
}

main();
