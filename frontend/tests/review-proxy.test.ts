import assert from "node:assert/strict";
import test from "node:test";
import { proxyFrameUrl, reviewedProxyUrl } from "../src/presentation/reviewProxy";

test("proxy preserves the reviewed URL, including query and fragment", () => {
  const original = "https://example.com/products?q=a%26b#details";
  const frame = proxyFrameUrl(original, "http://localhost:3002");
  assert.equal(new URL(frame).origin, "http://localhost:3002");
  assert.equal(reviewedProxyUrl(frame, "http://localhost:3002"), original);
  const changedHash = new URL(frame);
  changedHash.hash = "section";
  assert.equal(reviewedProxyUrl(changedHash.href, "http://localhost:3002"), "https://example.com/products?q=a%26b#section");
});

test("direct integration leaves the URL unchanged", () => {
  assert.equal(proxyFrameUrl("https://example.com/", null), "https://example.com/");
  assert.equal(reviewedProxyUrl("https://example.com/", null), "https://example.com/");
});

test("proxy messages cannot substitute another origin, endpoint or URL scheme", () => {
  for (const href of [
    "https://evil.example/?url=https://example.com",
    "http://localhost:3002/other?url=https://example.com",
    "http://localhost:3002/?url=javascript:alert(1)",
    "http://localhost:3002/?url=https://user:secret@example.com",
    "http://localhost:3002/",
  ]) assert.throws(() => reviewedProxyUrl(href, "http://localhost:3002"));
});

test("project frames carry document scope and cannot target another site", () => {
  const frame = new URL(proxyFrameUrl("https://site.test/products", "http://localhost:3002", "https://site.test/"));
  assert.equal(frame.searchParams.get("siteOrigin"), "https://site.test");
  assert.equal(frame.searchParams.get("document"), "1");
  assert.throws(() => proxyFrameUrl("https://external.test/products", "http://localhost:3002", "https://site.test/"));
});

test("same-domain proxy preserves its path and refuses application endpoints", () => {
  const endpoint = "https://juane17.sg-host.com/proxy";
  const original = "https://example.com/products?q=one#details";
  const frame = proxyFrameUrl(original, endpoint, "https://example.com/");
  assert.equal(new URL(frame).pathname, "/proxy/");
  assert.equal(reviewedProxyUrl(frame, endpoint), original);
  assert.throws(() => reviewedProxyUrl("https://juane17.sg-host.com/api/auth/me?url=https://example.com/", endpoint));
});
