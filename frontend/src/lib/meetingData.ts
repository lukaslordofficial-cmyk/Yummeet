import { rpc } from "@/src/lib/api";
import type { DishAxis } from "@/src/lib/dishMath";

export type DishSummary = {
  dish_key?: string;
  dish_id?: string;
  name: string;
  description: string;
  average: number | null;
  rating_count: number;
  taste: number | null;
  look: number | null;
  texture: number | null;
  aroma: number | null;
  composition: number | null;
  technique: number | null;
  value: number | null;
  sort?: number;
  my_taste?: number | null;
  my_look?: number | null;
  my_texture?: number | null;
  my_aroma?: number | null;
  my_composition?: number | null;
  my_technique?: number | null;
  my_value?: number | null;
  my_note?: string | null;
};

export const eventSetMeeting = (a: {
  eventId: string; category: string; subcategory: string; template: string; kind: string;
  durationMin?: number | null; budget?: number | null;
}) => rpc<void>("event_set_meeting", {
  p_event: a.eventId,
  p_category: a.category,
  p_subcategory: a.subcategory,
  p_template: a.template,
  p_kind: a.kind,
  p_duration: a.durationMin ?? null,
  p_budget: a.budget ?? null,
});

export const eventAddDish = (eventId: string, name: string, description = "") =>
  rpc<string>("event_add_dish", { p_event: eventId, p_name: name, p_description: description });

export const saveDishRating = (dishId: string, scores: Partial<Record<DishAxis, number | null>>, note: string) =>
  rpc<string>("save_dish_rating", {
    p_dish: dishId,
    p_taste: scores.taste ?? null,
    p_look: scores.look ?? null,
    p_texture: scores.texture ?? null,
    p_aroma: scores.aroma ?? null,
    p_composition: scores.composition ?? null,
    p_technique: scores.technique ?? null,
    p_value: scores.value ?? null,
    p_note: note,
  });

export const pinDishSummary = (pinId: string) => rpc<DishSummary[]>("pin_dish_summary", { p_pin: pinId });
export const eventDishBoard = (eventId: string) => rpc<DishSummary[]>("event_dish_board", { p_event: eventId });
