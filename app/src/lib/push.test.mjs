// Run: node --test src/lib/push.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { alertCopy, shouldNotify } from "./push-copy.ts";

test("one push per band entered, never on improvement", () => {
  assert.equal(shouldNotify("warning", null), true);
  assert.equal(shouldNotify("warning", "warning"), false, "same band twice");
  assert.equal(shouldNotify("urgent", "warning"), true, "worse band");
  assert.equal(shouldNotify("warning", "urgent"), false, "improved");
  assert.equal(shouldNotify("liquidatable", "urgent"), true);
  assert.equal(shouldNotify("healthy", "urgent"), false, "healthy never pushes");
  assert.equal(shouldNotify("watch", null), false, "watch is in-app only");
});

test("copy matches parameters.md §4", () => {
  const v = { symbol: "NVDAx", ltvPct: "57%", liqPct: "62%", add: "1.20", repay: "$86.40" };
  assert.equal(alertCopy("warning", v).title, "NVDAx dropped");
  assert.match(alertCopy("warning", v).body, /at 57%\. Add 1\.20 NVDAx or repay \$86\.40/);
  assert.equal(alertCopy("urgent", v).title, "Close to liquidation");
  assert.match(alertCopy("urgent", v).body, /At 62% your NVDAx can be sold/);
  assert.equal(alertCopy("liquidatable", v).title, "Your position can be liquidated");
  assert.match(alertCopy("liquidatable", v).body, /Repay \$86\.40 or add 1\.20 NVDAx/);
});
