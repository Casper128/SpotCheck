import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveReviewPage } from "../src/presentation/resolveReviewPage";

describe("review navigation", () => {
  const current = "https://reviewed.example/products/current?old=1";

  it("uses the resolved URL for relative route pin queries", () => {
    assert.deepEqual(resolveReviewPage("details", current), {
      url: "https://reviewed.example/products/details", pageRoute: "/products/details",
    });
    assert.deepEqual(resolveReviewPage("../about", current), {
      url: "https://reviewed.example/about", pageRoute: "/about",
    });
  });

  it("keeps the current page route when changing query or fragment", () => {
    assert.deepEqual(resolveReviewPage("?tab=details#section", current), {
      url: "https://reviewed.example/products/current?tab=details#section", pageRoute: "/products/current",
    });
    assert.equal(resolveReviewPage("#section", current).pageRoute, "/products/current");
    assert.equal(resolveReviewPage(" /about ", current).pageRoute, "/about");
  });

  it("rejects empty and non-HTTP destinations", () => {
    for (const value of [" ", "javascript:alert(1)", "data:text/html,test", "file:///tmp/test"]) {
      assert.throws(() => resolveReviewPage(value, current));
    }
  });
});
