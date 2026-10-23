// Domain unit tests. Run: node --test /app/tests/frontend/domain.test.ts  (Node >= 22.6 strips TS types)
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildLeafletHtml } from "../../frontend/src/components/map/leafletHtml.ts";
import { CUISINES, cuisineLabel, cuisinePinStyle } from "../../frontend/src/lib/cuisines.ts";
import { cardScore, summarizeDishes } from "../../frontend/src/lib/dishMath.ts";
import { MEETING_CATEGORIES, categoryByKey } from "../../frontend/src/lib/meetingCatalog.ts";
import { ACTIVITY_LINE, BUILTIN_QUESTIONS, FALLBACK_ATTRACTIONS, FIND_PACKS, FIND_SOMEONE_INSTRUCTION, FIND_SOMEONE_PLAY_INSTRUCTION, RUNAWAY_STORY_INSTRUCTION, SOCIAL_GAMES, STORY_STARTERS, TWO_TRUTHS_INSTRUCTION, addCustomBody, addCustomHeading, addCustomQuestion, drawStoryStarter, gameActivityLine, gameInstruction, plannedGameKeys, questionInstruction, questionPoolWarning, setPlanLimit, setStoryMode, splitPlan, storyPickMode, storyTurnIndex, syncPlanNote, toggleGame, togglePrompt, toggleQuestion, toggleStoryStarter } from "../../frontend/src/lib/meetingPlan.ts";
import { placeQueryVariants, placeSuggestionTitle } from "../../frontend/src/lib/routing.ts";
import { subcategoryByKey } from "../../frontend/src/lib/meetingCatalog.ts";
import { clampRouteBuffer, filterPinsByPrice, haversineM, withinRadiusM, withinRouteReach } from "../../frontend/src/lib/geo.ts";
import { eventQrValue, parseEntryCode, parseEventQr } from "../../frontend/src/lib/eventQr.ts";
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

test("meeting plan has the question pool and social games", () => {
  assert.equal(BUILTIN_QUESTIONS.length, 20);
  assert.equal(BUILTIN_QUESTIONS[0], "Jaką najgłupszą rzecz zrobiłeś/aś, próbując komuś zaimponować?");
  assert.match(BUILTIN_QUESTIONS[19], /święto narodowe/);
  assert.deepEqual(SOCIAL_GAMES.map((g) => g.id), ["two-truths", "find-someone", "runaway-story"]);
  assert.equal(SOCIAL_GAMES.some((g) => g.title === "Zgadnij, co wybrałem"), false);
  const picked = syncPlanNote(setPlanLimit(toggleGame(toggleQuestion([], BUILTIN_QUESTIONS[0]), SOCIAL_GAMES[0]), 3));
  const note = splitPlan(picked).note?.body ?? "";
  assert.equal(ACTIVITY_LINE, "Organizator przeprowadzi dla uczestników Zabawę w pytania.");
  assert.match(note, new RegExp(ACTIVITY_LINE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(note.includes(BUILTIN_QUESTIONS[0]), true);
  assert.match(note, /Dwie prawdy/);
  assert.equal(note.includes(TWO_TRUTHS_INSTRUCTION), true);
  assert.ok(note.includes(`${ACTIVITY_LINE}\n\n${questionInstruction(3)}`));
  assert.ok(note.includes(`${gameActivityLine("Dwie prawdy i jedno kłamstwo")}\n\n${gameInstruction("Dwie prawdy i jedno kłamstwo")}`));
  assert.match(note, new RegExp(gameActivityLine("Dwie prawdy i jedno kłamstwo").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(gameActivityLine("Znajdź kogoś, kto…"), "Organizator przeprowadzi dla uczestników zabawę w: Znajdź kogoś, kto….");
  assert.equal(note.includes("Organizator przeprowadzi"), true);
  assert.ok(note.includes("\n\n"));
  const local = syncPlanNote(addCustomQuestion([], "Czy lubisz deszcz?"));
  assert.equal(splitPlan(local).questions.some((q) => q.title === "Czy lubisz deszcz?"), true);
  assert.equal((splitPlan(local).note?.body ?? "").includes("Czy lubisz deszcz"), true);
  const findNote = splitPlan(syncPlanNote(toggleGame([], SOCIAL_GAMES[1]))).note?.body ?? "";
  assert.match(findNote, /Organizator przeprowadzi dla uczestników zabawę w: Znajdź kogoś, kto…\./);
  const story = STORY_STARTERS[0];
  const withStory = splitPlan(syncPlanNote(toggleStoryStarter([], story)));
  assert.equal(withStory.questions.some((q) => q.title === story.title), false);
  assert.equal(withStory.starters.length, 1);
  assert.equal(withStory.games.some((g) => g.title === "Historia, która wymknęła się spod kontroli"), true);
  assert.match(withStory.note?.body ?? "", /Historia, która wymknęła się spod kontroli/);
  assert.match(withStory.note?.body ?? "", /Sąsiad i nielegalny biznes/);
  assert.equal((withStory.note?.body ?? "").includes(BUILTIN_QUESTIONS[0]), false);
  assert.deepEqual(placeQueryVariants("ul Komandorska"), ["ul Komandorska", "ulica Komandorska", "Komandorska"]);
  assert.deepEqual(placeQueryVariants("os. Słoneczne"), ["os. Słoneczne", "osiedle Słoneczne", "Słoneczne"]);
  assert.deepEqual(placeQueryVariants("al. Jana"), ["al. Jana", "aleja Jana", "Jana"]);
  assert.deepEqual(placeQueryVariants("ulica Floriańska"), ["ulica Floriańska", "Floriańska"]);
  assert.equal(placeSuggestionTitle({ city: "Kraków", street: "Rynek", house: "16" }), "Kraków Rynek 16");
  assert.deepEqual(filterPinsByPrice([
    { price_min: 90, price_max: 120 },
    { price_min: 20, price_max: 30 },
    { price_min: null, price_max: null },
  ], { min: null, max: 40 }).map((pin) => pin.price_min), [20, null]);
  assert.equal(STORY_STARTERS.length, 16);
  assert.equal(FIND_PACKS.length, 6);
  assert.equal(FALLBACK_ATTRACTIONS.some((a) => a.category === "challenges" || a.title === "Szachy"), false);
  assert.equal(FALLBACK_ATTRACTIONS.some((a) => a.title === "Dwie prawdy i jedno kłamstwo"), true);
  const plan = splitPlan([
    { category: "questions", title: "Notatka organizatora", body: "Kawa na koszt autora rundy." },
    { category: "questions", title: "Pytania na osobę", body: "3" },
    { category: "questions", title: BUILTIN_QUESTIONS[0], body: "" },
    { category: "games", title: "Znajdź kogoś: …pamięta wszystkie zamówienia.", body: "…pamięta wszystkie zamówienia." },
    { category: "challenges", title: "20 pompek", body: "stare" },
  ]);
  assert.equal(plan.limit, 3);
  assert.equal(plan.questions.length, 1);
  assert.equal(plan.prompts.length, 1);
  assert.equal(plan.games.length, 0);
  assert.equal(plan.legacy.length, 1);
  assert.equal(storyTurnIndex(0, 4), 0);
  assert.equal(storyTurnIndex(4, 4), 0);
  assert.equal(storyTurnIndex(5, 4), 1);
  assert.equal(FIND_SOMEONE_INSTRUCTION.includes("drinka"), false);
  assert.match(FIND_SOMEONE_INSTRUCTION, /ogłasza zwycięzcę/);
  assert.match(gameInstruction("Dwie prawdy i jedno kłamstwo"), /rozszyfrować pozostałych/);
  assert.match(gameInstruction("Znajdź kogoś, kto…"), /wstrzymać się od odpowiedzi/);
  assert.match(FIND_SOMEONE_PLAY_INSTRUCTION, /1 pkt/);
  const homemade = splitPlan(syncPlanNote(addCustomBody(addCustomHeading([], "Przywitanie"), "Siadamy przy jednym stole.")));
  assert.equal(homemade.custom.length, 2);
  assert.equal(homemade.questions.length, 0);
  assert.match(homemade.note?.body ?? "", /Przywitanie/);
  assert.match(homemade.note?.body ?? "", /Siadamy przy jednym stole/);
  assert.match(RUNAWAY_STORY_INSTRUCTION, /podpowiedzi na żądanie/);
  assert.match(gameInstruction("Historia, która wymknęła się spod kontroli"), /notuje kto jakie zdanie dopisał/);
  const prompted = splitPlan(togglePrompt([], FIND_PACKS[0].prompts[0]));
  assert.equal(prompted.prompts.length, 1);
  assert.equal(prompted.games.some((game) => game.title === "Znajdź kogoś, kto…"), true);
  const customStory = splitPlan(toggleStoryStarter([], { title: "Mój początek", text: "Zaczęło się zwyczajnie, ale wtedy…" }));
  assert.equal(customStory.questions.length, 0);
  assert.equal(customStory.starters.length, 1);
  assert.match(questionPoolWarning(8, 3, 2) ?? "", /minimum 24 pytania/);
  assert.equal(questionPoolWarning(8, 3, 24), null);
  assert.equal(questionPoolWarning(4, 1, 4), null);
  const addedOrder = toggleQuestion(toggleGame(toggleGame([], SOCIAL_GAMES[1]), SOCIAL_GAMES[0]), BUILTIN_QUESTIONS[0]);
  assert.deepEqual(plannedGameKeys(addedOrder), ["find-someone", "two-truths", "questions"]);
  const randomMode = setStoryMode([], "losowo");
  assert.equal(storyPickMode(randomMode), "losowo");
  assert.equal(splitPlan(randomMode).games.some((game) => game.title === "Historia, która wymknęła się spod kontroli"), true);
  assert.equal(drawStoryStarter(["used"], [{ title: "A", text: "used" }, { title: "B", text: "next" }], () => 0)?.text, "next");
  assert.equal(drawStoryStarter([STORY_STARTERS[0].text], [STORY_STARTERS[0]], () => 0)?.title, STORY_STARTERS[1].title);
});

test("meeting catalog keeps the tasting, game and hobby shelves", () => {
  const oceniaj = categoryByKey("oceniaj");
  const gry = categoryByKey("gry");
  const pasje = categoryByKey("pasje");
  assert.deepEqual(oceniaj?.subs.map((s) => s.label), ["Jedno danie, wiele opinii", "Wiele dań i dzielenie porcji"]);
  assert.deepEqual(gry?.subs.map((s) => s.key), ["planszowe", "karciane", "szachy", "komputerowe", "inne"]);
  assert.deepEqual(pasje?.subs.map((s) => s.label), ["Rozmowa w językach obcych", "Wolontariat", "Wymiana ugotowanych potraw", "Inne"]);
  assert.equal(MEETING_CATEGORIES.length, 5);
  assert.equal(categoryByKey("poznaj")?.label, "Speed Friending");
  assert.equal(categoryByKey("poznaj")?.blurb, "Poznawanie nowych ludzi, poprzez rozmowy lub gry i zabawy towarzyskie");
  assert.equal(withinRadiusM({ lat: 52.23, lng: 21.01 }, { lat: 52.24, lng: 21.02 }, 50_000), true);
  assert.equal(withinRadiusM({ lat: 52.23, lng: 21.01 }, { lat: 51.1, lng: 17.0 }, 50_000), false);
  assert.equal(withinRadiusM({ lat: 52.23, lng: 21.01 }, { lat: null, lng: null }, 50_000), false);
  const eventId = "11111111-1111-1111-1111-111111111111";
  assert.deepEqual(parseEventQr(eventQrValue(eventId, "AB12CD")), { eventId, code: "AB12CD" });
  assert.equal(parseEventQr("nie-kod"), null);
  assert.deepEqual(parseEntryCode("ab12cd"), { code: "AB12CD" });
  assert.deepEqual(categoryByKey("poznaj")?.subs.map((s) => s.key), ["otwarty_stol", "nowi_w_miescie", "kolacja_nieznajomych"]);
  assert.equal(subcategoryByKey("poznaj", "otwarty_stol")?.templates.length, 0);
  assert.equal(subcategoryByKey("poznaj", "nowi_w_miescie")?.templates.length, 0);
  assert.equal(subcategoryByKey("poznaj", "kolacja_nieznajomych")?.templates.length, 0);
  assert.equal(categoryByKey("randki")?.blurb, "Spotkania tylko we dwoje lub speed dating.");
  assert.match(oceniaj?.blurb ?? "", /degustatorów/);
  assert.match(categoryByKey("pasje")?.blurb ?? "", /wolontariat lokalny/);
  assert.match(gry?.blurb ?? "", /pretekstem/);
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
