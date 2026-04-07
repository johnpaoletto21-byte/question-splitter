"use strict";
/**
 * core/segmentation-contract/types.ts
 *
 * Normalized Agent 1 output contract — the shape that all segmentation
 * adapters must produce and all orchestrator steps must consume.
 *
 * Design constraints (from Layer B):
 *   - INV-2: Agent 1 defines targets only (no bbox_1000 — that is Agent 2 scope).
 *   - INV-3: max 2 regions per target in V1.
 *   - INV-4: review_comment stays in agent outputs and summary; not in final result rows.
 *   - INV-9: No provider SDK types here — this is core, adapter-clean.
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=types.js.map