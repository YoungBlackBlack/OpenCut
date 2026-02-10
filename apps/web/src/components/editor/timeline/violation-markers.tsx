"use client";

import { useDetectionStore } from "@/stores/detection-store";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";

interface ViolationMarkersProps {
    zoomLevel: number;
    dynamicTimelineWidth: number;
}

/**
 * Renders red semi-transparent markers on the timeline header
 * for each detected NSFW violation interval.
 */
export function ViolationMarkers({
    zoomLevel,
    dynamicTimelineWidth,
}: ViolationMarkersProps) {
    const { violations, status } = useDetectionStore();

    if (status !== "done" || violations.length === 0) {
        return null;
    }

    const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;

    return (
        <div
            className="pointer-events-none relative h-2 overflow-hidden"
            style={{ width: `${dynamicTimelineWidth}px` }}
        >
            {violations.map((v, i) => {
                const left = v.startTime * pixelsPerSecond;
                const width = Math.max(
                    2,
                    (v.endTime - v.startTime) * pixelsPerSecond,
                );
                return (
                    <div
                        key={`violation-${v.startTime}-${i}`}
                        className="absolute top-0 h-full rounded-sm bg-red-500/60"
                        style={{ left: `${left}px`, width: `${width}px` }}
                        title={`${v.type}: ${v.startTime.toFixed(1)}s - ${v.endTime.toFixed(1)}s`}
                    />
                );
            })}
        </div>
    );
}
