# Resequiz 14.2 – Verified Active Bank

14.2 changes the quality policy from **review warnings** to **verified-only active play**.

- Active questions: **7601**
- Active questions with verification record: **7601**
- Active questions needing review: **0**
- Unverified questions moved to quarantine: **1586**
- Newly verified in 14.2: **367**

No unresolved question was marked verified merely to increase the count. Quarantined questions are retained in `app/data/question-quarantine-14.2.json` and can be restored after source review.

New verification methods: `{'chemistry': 117, 'travel': 250}`.

The chemistry checks use IUPAC's periodic-table reference. Travel questions reuse country/capital facts already verified by the 14.1 structured country cross-check. Formula questions are recomputed deterministically.
