// Domain unit tests. Run: node --test /app/tests/frontend/domain.test.ts  (Node >= 22.6 strips TS types)
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildLeafletHtml } from "../../frontend/src/components/map/leafletHtml.ts";
import { cuisinePinStyle } from "../../frontend/src/lib/cuisines.ts";
import { levelProgress, missionActions, rpsWinner, viewToBBox } from "../../frontend/src/domain/rules.ts";

test("rock-paper-scissors resolution matches server _rps_winner", () => {
  assert.equal(rpsWinner("rock", "rock"), 0);
  assert.equal(rpsWinner("rock", "scissors"), 1);
  assert.equal(rpsWinner("scissors", "paper"), 1);
  assert.equal(rpsWinner("paper", "rock"), 1);
  assert.equal(rpsWinner("rock", "paper"), 2);
  assert.equal(rpsWinner("scissors", "rock"), 2);
});

test("mission actions per status", () => {
  assert.deepEqual(missionActions("available", 0, false), ["accept"]);
  assert.deepEqual(missionActions("accepted", 0, false), ["start", "cancel"]);
  assert.deepEqual(missionActions("in_progress", 0, false), ["submit", "cancel"]);
  assert.deepEqual(missionActions("completed", 1, false), []);
  assert.deepEqual(missionActions("completed", 1, true), ["accept"]);
});

test("level progress is configurable via level table", () => {
  const levels = [{ level: 1, name: "Nowicjusz", min_xp: 0 }, { level: 2, name: "Smakosz", min_xp: 100 }, { level: 3, name: "Odkrywca", min_xp: 300 }];
  assert.equal(levelProgress(0, levels).current.level, 1);
  assert.equal(levelProgress(150, levels).current.name, "Smakosz");
  assert.equal(levelProgress(200, levels).progress, 0.5);
  assert.equal(levelProgress(999, levels).next, null);
});

test("cuisine teardrop pins differ by culinary style", () => {
  const pizza = cuisinePinStyle("pizza");
  const sushi = cuisinePinStyle("sushi");
  const polish = cuisinePinStyle("polish");
  assert.notEqual(pizza.color, sushi.color);
  assert.notEqual(pizza.glyph, sushi.glyph);
  assert.equal(polish.glyph, "🥟");
  assert.equal(cuisinePinStyle(null).glyph, "🍽️");
  assert.ok(cuisinePinStyle("custom_xyz").color.startsWith("#"));
});

test("map teardrops stay small and are not rebuilt during pinch zoom", () => {
  const html = buildLeafletHtml({
    center: { lat: 52.23, lng: 21.01 },
    zoom: 13,
    markers: [{ id: "a", lat: 52.23, lng: 21.01, title: "A", color: "#E05F36", glyph: "🍕" }],
    fitBounds: false,
  });
  assert.match(html, /11 \+ t \* 17/);
  assert.match(html, /map\.on\('zoomend'/);
  assert.equal(html.includes("map.on('zoom zoomend'"), false);
  assert.equal(html.includes("drop-shadow"), false);
  assert.match(html, /iconCache/);
});

test("bbox from view is valid and ordered", () => {
  const b = viewToBBox(52.23, 21.01, 13);
  assert.ok(b.south < 52.23 && b.north > 52.23 && b.west < 21.01 && b.east > 21.01);
});
