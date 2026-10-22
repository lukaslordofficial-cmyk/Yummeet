import { rpc } from "@/src/lib/api";

export type PlayParticipant = { id: string; name: string };
export type PlayPick = { prompt: string; names: string[] };

export type FindAnswer = { prompt: string; yes: boolean | null; names: string[] };
export type FindReveal = { prompt: string; yes: string[]; no: string[]; mine: string[]; points: number };
export type FindState = {
  phase: number;
  saved: boolean;
  all_saved: boolean;
  score: number | null;
  answers: FindAnswer[];
  reveal: FindReveal[] | null;
};

export type PlayBoard = {
  status: "lobby" | "live" | "finished" | string;
  game_key: string | null;
  round_no: number;
  notice: string | null;
  limit: number;
  games: string[];
  your_turn: boolean;
  turn_name: string | null;
  participants: PlayParticipant[];
  questions: string[];
  prompts: string[];
  my_question: string | null;
  my_answered: boolean;
  my_picks: PlayPick[];
  find?: FindState | null;
};

export const eventPlayBoard = (eventId: string) => rpc<PlayBoard>("event_play_board", { p_event: eventId });
export const eventPlayStart = (eventId: string, game: string) => rpc<PlayBoard>("event_play_start", { p_event: eventId, p_game: game });
export const eventPlayDraw = (eventId: string) => rpc<PlayBoard>("event_play_draw", { p_event: eventId });
export const eventPlayAnswered = (eventId: string) => rpc<PlayBoard>("event_play_answered", { p_event: eventId });
export const eventFindSave = (eventId: string, prompt: string, names: string[]) =>
  rpc<PlayBoard>("event_find_save", { p_event: eventId, p_prompt: prompt, p_names: names });
export const eventFindSubmit = (eventId: string, rows: { prompt: string; yes?: boolean; names?: string[] }[]) =>
  rpc<PlayBoard>("event_find_submit", { p_event: eventId, p_rows: rows });
