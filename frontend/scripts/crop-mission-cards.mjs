/**
 * Wycina pojedyncze karty z plansz kolekcji misji.
 * Usage: node scripts/crop-mission-cards.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../assets/cards/cropped");
fs.mkdirSync(outDir, { recursive: true });

/** Detective sheet: 6×3, karty 1–17, komórka 18 = logo */
const DET = {
  file: path.join(__dirname, "../assets/cards/sheet_smaczne_odkrycia.png"),
  cols: 6,
  rows: 3,
  // delikatne marginesy zewnętrzne + szczeliny (dostosowane empirycznie)
  marginX: 0.012,
  marginY: 0.018,
  gapX: 0.008,
  gapY: 0.012,
  map: [
    "book_det_ghost_venue",
    "book_det_unknown_cuisine",
    "book_det_two_tens",
    "book_det_off_radar",
    "book_det_blank_spot",
    "book_det_tgtg",
    "book_det_happy_hour",
    "book_det_full_belly",
    "book_det_green_trail",
    "book_det_no_traps",
    "book_det_after_hours",
    "book_det_group_table",
    "book_det_breakfast",
    "book_det_receipt",
    "book_det_field_report",
    "book_det_best_dessert",
    "book_det_baker",
  ],
};

/**
 * Host sheet: nieregularny układ z opisów arkusza.
 * Przybliżamy jako siatkę 6×3 i mapujemy tylko zajęte komórki.
 * R1: 18–22 (+ pusta), R2: 24,25,26,27,28,30, R3: 31–34 (+ logo/pergamin)
 */
const HOST = {
  file: path.join(__dirname, "../assets/cards/sheet_gospodarz_stolu.png"),
  cols: 6,
  rows: 3,
  marginX: 0.012,
  marginY: 0.018,
  gapX: 0.008,
  gapY: 0.012,
  // index komórki 0..17 → kod karty (null = pomiń)
  // R1: intro + 18–22 | R2: 24–28 + 30 | R3: 31–34 + logo
  cells: [
    null, // intro „Klasa II”
    "book_host_empty_table", // 18
    "book_host_singles", // 19
    "book_host_picnic", // 20
    "book_host_skills_share", // 21
    "book_host_problem_idea", // 22
    "book_host_babel", // 24
    "book_host_other_view", // 25
    "book_host_one_book", // 26
    "book_host_other_side", // 27
    "book_host_small_change", // 28
    "book_host_from_scratch", // 30
    "book_host_chess", // 31
    "book_host_boardgames", // 32
    "book_host_quiz", // 33
    "book_host_curious", // 34
    null, // logo
    null,
  ],
};

async function cropGrid(spec, codesOrCells) {
  const meta = await sharp(spec.file).metadata();
  const W = meta.width;
  const H = meta.height;
  const mx = Math.round(W * spec.marginX);
  const my = Math.round(H * spec.marginY);
  const gx = Math.round(W * spec.gapX);
  const gy = Math.round(H * spec.gapY);
  const innerW = W - 2 * mx - (spec.cols - 1) * gx;
  const innerH = H - 2 * my - (spec.rows - 1) * gy;
  const cw = Math.floor(innerW / spec.cols);
  const ch = Math.floor(innerH / spec.rows);

  const list = Array.isArray(codesOrCells) ? codesOrCells : codesOrCells;
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const code = list[i];
    if (!code) continue;
    const col = i % spec.cols;
    const row = Math.floor(i / spec.cols);
    const left = mx + col * (cw + gx);
    const top = my + row * (ch + gy);
    const dest = path.join(outDir, `${code}.png`);
    await sharp(spec.file)
      .extract({ left, top, width: cw, height: ch })
      .png()
      .toFile(dest);
    out.push({ code, dest, left, top, cw, ch });
    console.log("cropped", code, "→", path.basename(dest));
  }
  return out;
}

const det = await cropGrid(DET, DET.map);
const host = await cropGrid(HOST, HOST.cells);
console.log(JSON.stringify({ det: det.length, host: host.length, outDir }, null, 2));
