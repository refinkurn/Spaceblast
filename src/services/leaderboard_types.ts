// What the game sends to and gets from the leaderboard (POST/GET /api/scores).

export interface ScoreSubmission {
  device_uuid: string;
  display_name: string;
  /** "stage_<sector>_<n>", see score.ts stageId(). */
  stage_id: string;
  score: number;
  completion_time_seconds: number;
  hearts_left: number;
  stars: number;
}

export interface ScoreRow {
  rank: number;
  display_name: string;
  score: number;
  completion_time_seconds: number;
  stars: number;
}

/** GET /api/scores?stage=stage_1_3&device=<uuid> */
export interface TopScores {
  stage_id: string;
  top: ScoreRow[];
  /** This device's best on the stage and its rank, if it has one. */
  you?: ScoreRow;
}

/** POST answer. `name` is what was saved (the server may replace a rude one). */
export type SubmitReply = { ok: true; rank: number; best: number; name: string } | { ok: false; reason: string };

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
