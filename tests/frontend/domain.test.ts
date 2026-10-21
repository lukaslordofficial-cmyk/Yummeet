// Domain unit tests. Run: node --test /app/tests/frontend/domain.test.ts  (Node >= 22.6 strips TS types)
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildLeafletHtml } from "../../frontend/src/components/map/leafletHtml.ts";
import { CUISINES, cuisineLabel, cuisinePinStyle } from "../../frontend/src/lib/cuisines.ts";
import { cardScore, summarizeDishes } from "../../frontend/src/lib/dishMath.ts";
import { MEETING_CATEGORIES, categoryByKey } from "../../frontend/src/lib/meetingCatalog.ts";
import { FALLBACK_ATTRACTIONS } from "../../frontend/src/lib/attractionsCatalog.ts";
import { clampRouteBuffer, haversineM, withinRouteReach } from "../../frontend/src/lib/geo.ts";
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
  assert.match(html, /weight: 11/);
  assert.match(html, /function focusDriver/);
  assert.match(html, /map\.on\('zoomend'/);
  assert.equal(html.includes("map.on('zoom zoomend'"), false);
  assert.equal(html.includes("drop-shadow"), false);
  assert.match(html, /iconCache/);
});

test("map filters drop Wszystko and retired cuisines", () => {
  const keys = CUISINES.map((c) => c.key);
  assert.equal(keys.includes(null), false);
  for (const retired of ["vegetarian", "street_food", "food_truck", "fine_dining", "bakery"]) {
    assert.equal(keys.includes(retired), false);
  }
  assert.equal(cuisineLabel("vegetarian"), "Wegetariańska");
  assert.equal(cuisineLabel("pizza"), "Pizza");
});

test("route band stays inside 3 km of the line and of the driver", () => {
  const line = [{ lat: 52, lng: 21 }, { lat: 52.1, lng: 21 }];
  const origin = { lat: 52, lng: 21 };
  const remote = { lat: 50, lng: 19 };
  const near = { lat: 52.009, lng: 21.0015 };
  const ahead = { lat: 52.045, lng: 21 };
  const off = { lat: 52.05, lng: 21.06 };
  const side2km = { lat: 52.02, lng: 21.029 };
  assert.equal(withinRouteReach(near, line, origin, 3000), true);
  assert.equal(withinRouteReach(ahead, line, origin, 3000), false);
  assert.equal(withinRouteReach(off, line, origin, 10000), false);
  assert.equal(withinRouteReach(off, line, remote, 3000), false);
  assert.equal(withinRouteReach(near, line, remote, 3000), true);
  assert.equal(withinRouteReach(side2km, line, origin, 1000), false);
  assert.equal(withinRouteReach(side2km, line, origin, 3000), true);
  assert.equal(withinRouteReach(near, [line[0]], origin, 3000), false);
  assert.equal(clampRouteBuffer(10000), 3000);
  assert.equal(clampRouteBuffer(500), 500);
  const kept = [ahead, off, near].filter((p) => withinRouteReach(p, line, origin, 3000));
  kept.sort((a, b) => haversineM(origin, a) - haversineM(origin, b));
  assert.equal(kept.length, 1);
  assert.equal(kept[0], near);
});

test("table presets do not include icebreaker questions", () => {
  assert.equal(FALLBACK_ATTRACTIONS.some((a) => a.category === "questions"), false);
  assert.equal(FALLBACK_ATTRACTIONS.some((a) => /dzieciństwa|restaurację|Podróż smaków|Najdziwniejsze/i.test(a.title)), false);
  assert.equal(FALLBACK_ATTRACTIONS.some((a) => a.title === "Szachy"), true);
});

test("meeting catalog keeps the tasting, game and hobby shelves", () => {
  const oceniaj = categoryByKey("oceniaj");
  const gry = categoryByKey("gry");
  const pasje = categoryByKey("pasje");
  assert.deepEqual(oceniaj?.subs.map((s) => s.label), ["Jedno danie, wiele opinii", "Wiele dań i dzielenie porcji"]);
  assert.deepEqual(gry?.subs.map((s) => s.key), ["planszowe", "karciane", "szachy", "komputerowe", "inne"]);
  assert.deepEqual(pasje?.subs.map((s) => s.label), ["Rozmowa w językach obcych", "Wolontariat", "Wymiana ugotowanych potraw", "Inne"]);
  assert.equal(MEETING_CATEGORIES.length, 5);
  assert.equal(oceniaj?.subs.every((s) => s.format !== "standard"), true);
});

test("dish average skips empty traits and counts cards", () => {
  assert.equal(cardScore({ taste: 8, look: 6, texture: null }), 7);
  assert.equal(cardScore({}), null);
  const board = summarizeDishes([
    { name: "Ramen", description: "Miso", taste: 8, look: 8 },
    { name: " ramen ", description: "", taste: 6 },
    { name: "Gyoza", description: "Na parze", taste: 9 },
  ]);
  assert.equal(board.length, 2);
  assert.equal(board.find((d) => d.name === "Gyoza")?.average, 9);
  assert.equal(board.find((d) => d.name === "Ramen")?.ratingCount, 2);
  assert.equal(board.find((d) => d.name === "Ramen")?.description, "Miso");
});

test("bbox from view is valid and ordered", () => {
  const b = viewToBBox(52.23, 21.01, 13);
  assert.ok(b.south < 52.23 && b.north > 52.23 && b.west < 21.01 && b.east > 21.01);
});
