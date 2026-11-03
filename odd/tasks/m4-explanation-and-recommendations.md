# M4 - Explanation and recommendations

Linear-SHAP top-k drivers per geographic unit, a deterministic driver-to-action
table, and an aggregated narrative with a deterministic template fallback. The
LLM writes prose only, never decisions.

## Specs

- S1: "SHAP top-5 drivers per geographic unit."
- S2: "Deterministic action table mapping driver to preventive action. The LLM
  writes prose, never decisions."
- S3: "Optional DeepSeek narrative over an aggregated payload only; deterministic
  template fallback when the API is unavailable."
- S4: SHAP method (decision L2): exact linear SHAP over a ridge model on six
  engineered lag/seasonal features, fit with numpy; top-5 by mean |SHAP|; zero
  new dependencies.

## Tasks

- T1 (S1, S4): Ridge model plus linear SHAP plus top-k drivers. Route: inline. Commit: 92a8676.
- T2 (S2): Deterministic action table plus recommend(). Route: inline. Commit: 92a8676.
- T3 (S3): Narrative template plus optional DeepSeek plus fallback. Route: inline. Commit: 92a8676.
- T4: Contract tests and docs. Route: inline. Commit: 92a8676.

## Log

- L1: "puedes continuar" (continue after M3; next milestone is M4).
- L2: SHAP decision: user chose "SHAP lineal, sin deps" — linear model (ridge in
  numpy) on lag/seasonal features, exact linear SHAP computed by hand, top-5 by
  |SHAP|, zero new dependencies.
- L3: Refactor: extracted ``year_over_year_drift`` from the M3 forecast model so
  M4 reuses the same drift definition in its feature engineering.
- L4: committed as fb4245b (refactor) and 92a8676 (feat) on
  feat/m4-explanation-and-recommendations, chained on the M3 branch because
  the explanation reuses ``year_over_year_drift``. README.md layout (explain/)
  updated in the working tree but left uncommitted, as in M2/M3.
