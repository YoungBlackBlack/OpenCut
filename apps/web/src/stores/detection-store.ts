import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Detection {
    class: string;
    confidence: number;
    bbox: number[]; // [x1, y1, x2, y2]
}

export interface ViolationFrame {
    time: number;
    frameIndex: number;
    detections: Detection[];
}

export interface Violation {
    startTime: number; // seconds
    endTime: number;
    type: string; // e.g. "nipple"
    frames: ViolationFrame[];
}

export type DetectionStatus = "idle" | "detecting" | "done" | "error";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface DetectionStore {
    // State
    status: DetectionStatus;
    progress: number; // 0-100
    taskId: string | null;
    violations: Violation[];
    error: string | null;
    videoPath: string | null; // server-side path of the video being detected

    // Actions
    startDetection: (videoPath: string) => Promise<void>;
    pollStatus: (taskId: string) => Promise<void>;
    clearDetections: () => void;
    setViolations: (violations: Violation[]) => void;
}

const POLL_INTERVAL = 2000; // ms

export const useDetectionStore = create<DetectionStore>((set, get) => ({
    status: "idle",
    progress: 0,
    taskId: null,
    violations: [],
    error: null,
    videoPath: null,

    startDetection: async (videoPath: string) => {
        set({
            status: "detecting",
            progress: 0,
            violations: [],
            error: null,
            videoPath,
        });

        try {
            const res = await fetch("/api/detect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inputPath: videoPath }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Detection request failed");
            }

            const data = await res.json();
            const taskId = data.taskId;
            set({ taskId });

            // Start polling
            get().pollStatus(taskId);
        } catch (error: unknown) {
            set({
                status: "error",
                error:
                    error instanceof Error ? error.message : "Unknown error",
            });
        }
    },

    pollStatus: async (taskId: string) => {
        const poll = async () => {
            try {
                const res = await fetch(
                    `/api/detect?taskId=${encodeURIComponent(taskId)}`,
                );
                if (!res.ok) throw new Error("Status query failed");

                const data = await res.json();
                const { state, progress, result } = data;

                if (state === "completed" && result) {
                    // Parse the detection result into violations
                    const violations = parseDetectionResult(result);
                    set({
                        status: "done",
                        progress: 100,
                        violations,
                    });
                    return; // stop polling
                }

                if (state === "failed") {
                    set({
                        status: "error",
                        error: data.error || "Detection failed",
                    });
                    return; // stop polling
                }

                // Still processing
                set({ progress: Math.round(progress * 100) });
                setTimeout(poll, POLL_INTERVAL);
            } catch {
                set({ status: "error", error: "Polling failed" });
            }
        };

        poll();
    },

    clearDetections: () => {
        set({
            status: "idle",
            progress: 0,
            taskId: null,
            violations: [],
            error: null,
            videoPath: null,
        });
    },

    setViolations: (violations: Violation[]) => {
        set({ violations, status: "done" });
    },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse the Python backend detection result into Violation[]
 *
 * Backend result format (from /status → result):
 * {
 *   detections: { [frameIndex]: [{ label, confidence, bbox }] },
 *   segments: [{ frameStart, frameEnd, bbox, label }],
 *   fps, totalFrames, width, height
 * }
 */
function parseDetectionResult(result: Record<string, unknown>): Violation[] {
    const segments = (result.segments as Array<Record<string, unknown>>) || [];
    const fps = (result.fps as number) || 30;

    return segments.map((seg) => {
        const frameStart = seg.frameStart as number;
        const frameEnd = seg.frameEnd as number;
        const label = (seg.label as string) || "nsfw";
        const bbox = (seg.bbox as number[]) || [];

        return {
            startTime: frameStart / fps,
            endTime: frameEnd / fps,
            type: label,
            frames: [
                {
                    time: frameStart / fps,
                    frameIndex: frameStart,
                    detections: [
                        {
                            class: label,
                            confidence: 0.9,
                            bbox,
                        },
                    ],
                },
            ],
        };
    });
}
