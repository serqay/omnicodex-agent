# Project Instructions for AI Agents

@[Design System](DESIGN.md)

## UI & Frontend Guardrails (STRICTLY ENFORCED)

1. **NO AI SLOP AESTHETICS:**
   - STRICTLY FORBIDDEN: Purple/indigo/blue/cyan/pink gradients, neon glows, blurred floating blobs (`backdrop-blur` abuse), and generic mesh backgrounds.
   - STRICTLY FORBIDDEN: The "3-column card grid where every card has a colored circle icon at the top, a bold title, and 2 lines of muted text".
   - STRICTLY FORBIDDEN: Sparkle icons (✨), "AI-Powered / Next-Gen / Beta" pill badges above headings, fake metrics ("+99.9% efficiency", "10x faster"), and fake user testimonial avatars.

2. **NO ARBITRARY STYLES:**
   - NEVER use magic arbitrary values in Tailwind/CSS (e.g., `w-[347px]`, `bg-[#1a1b26]`, `p-[13px]`). Use ONLY tokens and scales defined in `@[Design System](DESIGN.md)`.

3. **COMPONENT REUSE FIRST:**
   - Before writing any HTML `<button>`, `<input>`, `<dialog>`, or `<select>`, check the existing UI components directory. Always import and compose existing primitives.

4. **DENSITY & HIERARCHY:**
   - Prefer crisp `1px` borders, subtle background shifts, tabular numbers, and left-aligned layouts over heavy drop-shadows and oversized padding.

5. **SELF-VERIFICATION (Browser Subagent):**
   - After completing any UI task, if a dev server is available, open the page via Browser Subagent, inspect the rendered layout for visual alignment, contrast, and overflow issues, and fix them before finishing the task.
