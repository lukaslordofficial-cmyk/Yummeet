import { rpc } from "@/src/lib/api";

export type PlayParticipant = { id: string; name: string };
export type PlayPick = { prompt: string; names: string[] };

export type FindRank = { id: string; name: string; score: number };
export type FindAnswer = { prompt: string; yes: boolean | null; names: string[] };
export type FindReveal = { prompt: string; yes: string[]; no: string[]; mine: string[]; points: number };
export type FindState = {
  phase: number;
  saved: boolean;
  all_saved: boolean;
  score: number | null;
  answers: FindAnswer[];
  reveal: FindReveal[] | null;
  ranking?: FindRank[] | null;
};

export type TruthPerson = {
  id: string;
  name: string;
  lines: string[];
  guesses: boolean[];
  truth: boolean[] | null;
  line_points: number[] | null;
  points: number | null;
};

export type TruthState = {
  phase: number;
  saved: boolean;
  lines_saved: boolean;
  guesses_saved: boolean;
  all_saved: boolean;
  score: number | null;
  stake: { mine: boolean | null; yes: number; total: number; unanimous: boolean };
  mine: { lines: string[]; lie: number } | null;
  others: TruthPerson[];
  ranking?: FindRank[] | null;
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
  truths?: TruthState | null;
};

export const eventPlayBoard = (eventId: string) => rpc<PlayBoard>("event_play_board", { p_event: eventId });
export const eventPlayStart = (eventId: string, game: string) => rpc<PlayBoard>("event_play_start", { p_event: eventId, p_game: game });
export const eventPlayNext = (eventId: string) => rpc<PlayBoard>("event_play_next", { p_event: eventId });
export const eventFinishMeeting = (eventId: string) => rpc<void>("event_finish_meeting", { p_event: eventId });
export const eventPlayDraw = (eventId: string) => rpc<PlayBoard>("event_play_draw", { p_event: eventId });
export const eventPlayAnswered = (eventId: string) => rpc<PlayBoard>("event_play_answered", { p_event: eventId });
export const eventFindSave = (eventId: string, prompt: string, names: string[]) =>
  rpc<PlayBoard>("event_find_save", { p_event: eventId, p_prompt: prompt, p_names: names });
export const eventFindSubmit = (eventId: string, rows: { prompt: string; yes?: boolean; names?: string[] }[]) =>
  rpc<PlayBoard>("event_find_submit", { p_event: eventId, p_rows: rows });
export const eventTruthSubmit = (eventId: string, lines: string[], lie: number) =>
  rpc<PlayBoard>("event_truth_submit", { p_event: eventId, p_lines: lines, p_lie: lie });
export const eventTruthGuess = (eventId: string, rows: { target: string; marks: boolean[] }[]) =>
  rpc<PlayBoard>("event_truth_guess", { p_event: eventId, p_rows: rows });
export const eventTruthStake = (eventId: string, agreed: boolean) =>
  rpc<PlayBoard>("event_truth_stake", { p_event: eventId, p_agreed: agreed });
