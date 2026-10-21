import type { CookingTipKind, FoodDealMode } from "@/src/lib/data";
import type { Coords } from "@/src/lib/location";

export type FoodComposeDraft = {
  seg: "exchange" | "giveaway" | "signature" | "tips";
  tipKind: CookingTipKind;
  title: string;
  body: string;
  placeDetail: string;
  portions: string;
  allergenKeys: string[];
  dealMode: FoodDealMode | null;
  pendingDealMode: FoodDealMode | null;
  photo: string | null;
  coords: Coords | null;
};

let draft: FoodComposeDraft | null = null;

export function saveFoodComposeDraft(d: FoodComposeDraft) {
  draft = { ...d };
}

export function takeFoodComposeDraft(): FoodComposeDraft | null {
  const d = draft;
  draft = null;
  return d;
}

export function peekFoodComposeDraft(): FoodComposeDraft | null {
  return draft;
}
