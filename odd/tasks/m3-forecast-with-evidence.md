# M3 - Forecast with evidence

Seasonal-naive-plus-drift forecasting with empirical quantiles, a rolling-origin
backtest, a MASE/WIS scorecard and a publication gate, versioned in a model
registry. No LLM involved.

## Specs

- S1: "Horizon 1-4 weeks, quantiles p10/p50/p90."
- S2: "Rolling-origin backtest, minimum three windows, per geographic unit."
- S3: "MASE against SeasonalNaive(52) and WIS for the intervals."
- S4: "The last 4-6 epidemiological weeks are flagged provisional (reporting
  delay) and excluded from training."
- S5: "Model registry: artifact, data cut, config and metrics, all versioned."
- S6: "A forecast is published only for units that beat the seasonal baseline
  in backtest; otherwise the API returns insufficient_evidence." (invariant)
- S7: Forecast method (decision L2): seasonal naive + drift for p50, with
  p10/p90 from empirical error quantiles; zero new dependencies.
- S8: "the scorecard per department exists and the publication gate works."
  (done-when)

## Tasks

- T1 (S1, S7): Seasonal drift point forecast plus empirical p10/p90. Route: inline. Commit: 1f1a72b.
- T2 (S2, S4): Rolling-origin backtest with provisional-week exclusion. Route: inline. Commit: 1f1a72b.
- T3 (S3): MASE and WIS metrics. Route: inline. Commit: 1f1a72b.
- T4 (S5): Versioned model registry (artifact, data cut, config, metrics). Route: inline. Commit: 1f1a72b.
- T5 (S6, S8): Scorecard per department plus publication gate. Route: inline. Commit: 1f1a72b.
- T6 (S8): Contract tests and docs. Route: inline. Commit: 1f1a72b.

## Log

- L1: "sigue" (continue after M2; next milestone is M3).
- L2: Forecast method decision: user chose "Estadístico, sin deps nuevas" —
  seasonal naive + drift for p50, p10/p90 by empirical error quantiles, zero
  new dependencies.
- L3: Assumptions recorded: provisional-week default is 6 (conservative end of
  the 4-6 range, configurable); the 52-week lag assumes a regular weekly
  cadence; quantile intervals are in-sample empirical residual quantiles; the
  publication gate is MASE < 1.
- L4: committed as 1f1a72b on feat/m3-forecast-with-evidence ("feat(forecast):
  seasonal-drift forecast with backtest, scorecard and publication gate").
  Branch is chained on feat/m2-deterministic-analysis because the forecast
  reuses vigia.analysis.weekly_series. README.md layout (forecast/) updated in
  the working tree but left uncommitted, as in M2.
