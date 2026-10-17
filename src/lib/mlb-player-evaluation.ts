// Frozen report read from mlb.player_value_models.payload.evaluation in
// Supabase on 2026-10-17. Shared by methodology and performance; not live scores.
export const MLB_PLAYER_EVALUATION = {
  modelVersion: "player-value-v1",
  fittedAt: "2026-10-17T05:01:17.447421Z",
  inputSeason: 2025,
  outcomeSeason: 2026,
  groups: [
    {
      key: "hitter",
      label: "Batters",
      n: 335,
      grade: 0.404339083,
      priorXwoba: 0.3851729862,
      priorProduction: 0.3016249067,
      marcel: 0.3289602033,
    },
    {
      key: "SP",
      label: "Starting pitchers",
      n: 175,
      grade: 0.3888669951,
      priorXwoba: null,
      priorProduction: 0.3337303487,
      marcel: 0.2898454993,
    },
    {
      key: "RP",
      label: "Relievers",
      n: 167,
      grade: 0.1918357777,
      priorXwoba: null,
      priorProduction: 0.0252638047,
      marcel: 0.1048290682,
    },
  ],
} as const;
