# Self-Management Prompts

Copy-paste these into **New Discussion** when dogfooding OceanTechAI Core.

---

## Daily / Strategic

1. **What should OceanTechAI improve next?**
   ```
   What should OceanTechAI improve next? Review journals, open proposals, and recent decisions. Propose the single highest-leverage improvement for Founder approval.
   ```

2. **Architecture review**
   ```
   Review the current OceanTechAI architecture and propose the next highest-leverage improvement. Consider debate engine, execution layer, memory, and executive dashboard.
   ```

3. **7-day dogfooding plan**
   ```
   Propose a 7-day dogfooding plan for OceanTechAI. Each day should have one concrete discussion topic, expected outcome, and success metric. Keep scope MVP-friendly.
   ```

---

## Feature Design

4. **Agent Reputation System v2**
   ```
   Design Agent Reputation System v2 for OceanTechAI. Include scoring formula, UI surfaces, governance constraints, and how reputation affects debate weighting.
   ```

5. **Executive Dashboard for daily use**
   ```
   Improve the Executive Dashboard for daily Founder use. What should the morning brief show? What actions should be one click away? Propose MVP changes only.
   ```

---

## Risk & Quality

6. **Self-improvement loop risks**
   ```
   Identify risks in the current self-improvement loop (journals → recommendations → autonomous suggestions → discussions → proposals). What could go wrong? What guardrails are missing?
   ```

---

## Tips

- Use project **OceanTechAI Core** (`oceantechai-core`) for dogfooding.
- Run debates in **mock mode** first (`AI_PROVIDER_MODE=mock`).
- After approve, optionally **Execute to GitHub** if `GITHUB_*` env is set.
- Check **Executive Dashboard** after each debate for journals and recommendations.
