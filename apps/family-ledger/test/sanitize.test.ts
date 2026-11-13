import assert from "node:assert/strict";
import { test } from "node:test";
import {
  safeSourceFileLabel,
  sanitizeLedgerJson,
} from "../src/lib/domain/sanitize";

test("ledger DTO sanitization removes source keys and paths recursively", () => {
  const sanitized = sanitizeLedgerJson({
    notes: ["see /private/example/input.json"],
    coverage: {
      source: "/private/example/source.json",
      detail: "from C:\\private\\input.json",
    },
    pending: [{ basis: "依据 /Users/example/private.pdf" }],
  });
  assert.deepEqual(sanitized, {
    notes: ["see [路径已隐藏]"],
    coverage: { detail: "from [路径已隐藏]" },
    pending: [{ basis: "依据 [路径已隐藏]" }],
  });
});

test("safe source labels use recorded string or structured provenance without paths", () => {
  assert.equal(
    safeSourceFileLabel("/private/input/ledger.json"),
    "ledger.json",
  );
  assert.equal(
    safeSourceFileLabel({
      path: "C:\\private\\structured.csv",
      sha256: "a".repeat(64),
    }),
    "structured.csv",
  );
  assert.equal(safeSourceFileLabel({ sha256: "a".repeat(64) }), undefined);
});
