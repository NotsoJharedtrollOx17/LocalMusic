import { expect, it } from "vitest";
import fixture from "../../tests/fixtures/scoped-search.json";
import { matchesSearch } from "./match";
it("shares literal normalized AND-of-substrings semantics with Rust", () => {
  for (const c of fixture.cases)
    expect(matchesSearch(c.value, c.query)).toBe(c.expected);
});
