"use client";

import { useDetectionStore } from "@/stores/detection-store";
import { Loader2, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditorCore } from "@/core";
import { useCallback } from "react";

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

export function DetectionView() {
    const { status, progress, violations, error, startDetection, clearDetections } =
        useDetectionStore();

    const handleDetect = useCallback(() => {
        // Get the video path from the current project's media assets
        const editor = EditorCore.getInstance();
        const project = editor.project.getActiveOrNull();
        if (!project) return;

        // Find the first video media asset
        const scene = project.scenes[0];
        if (!scene) return;

        for (const track of scene.tracks) {
            if (track.type !== "video") continue;
            for (const element of track.elements) {
                if (element.type === "video") {
                    // Use the mediaId to find a usable path
                    // For local dev, we use the media asset's file path
                    startDetection(element.mediaId);
                    return;
                }
            }
        }
    }, [startDetection]);

    const handleJumpTo = useCallback((time: number) => {
        const editor = EditorCore.getInstance();
        editor.playback.seek({ time });
    }, []);

    return (
        <div className="flex h-full flex-col gap-4 p-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-orange-500" />
                <h3 className="text-sm font-semibold">智能检测</h3>
            </div>
            <p className="text-muted-foreground text-xs">
                自动检测视频中的敏感内容，并标记违规区间。
            </p>

            {/* Action button */}
            {status === "idle" && (
                <Button
                    onClick={handleDetect}
                    className="w-full gap-2"
                    variant="default"
                >
                    <Sparkles className="h-4 w-4" />
                    开始检测
                </Button>
            )}

            {/* Progress */}
            {status === "detecting" && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>检测中… {progress}%</span>
                    </div>
                    <div className="bg-muted h-2 w-full rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-orange-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Error */}
            {status === "error" && (
                <div className="space-y-2">
                    <p className="text-sm text-red-500">检测失败：{error}</p>
                    <Button
                        onClick={handleDetect}
                        variant="outline"
                        size="sm"
                        className="w-full"
                    >
                        重试
                    </Button>
                </div>
            )}

            {/* Results */}
            {status === "done" && (
                <div className="flex flex-1 flex-col gap-3 min-h-0">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                            发现 {violations.length} 处违规
                        </span>
                        <Button
                            onClick={clearDetections}
                            variant="secondary"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                        >
                            <Trash2 className="h-3 w-3" />
                            清除
                        </Button>
                    </div>

                    {violations.length === 0 ? (
                        <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-sm">
                            <ShieldAlert className="h-8 w-8 text-green-500" />
                            <span>未检测到违规内容 ✅</span>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1">
                            <div className="space-y-2 pr-2">
                                {violations.map((v, i) => (
                                    <button
                                        key={`${v.startTime}-${v.endTime}-${i}`}
                                        type="button"
                                        className="bg-muted/50 hover:bg-muted w-full rounded-lg p-3 text-left transition-colors"
                                        onClick={() => handleJumpTo(v.startTime)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-orange-500">
                                                {v.type}
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                #{i + 1}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-xs">
                                            {formatTime(v.startTime)} —{" "}
                                            {formatTime(v.endTime)}
                                        </div>
                                        {v.frames.length > 0 && (
                                            <div className="text-muted-foreground mt-1 text-xs">
                                                {v.frames[0].detections.length} 个检测 · 置信度{" "}
                                                {(
                                                    v.frames[0].detections[0]?.confidence * 100
                                                ).toFixed(0)}
                                                %
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    )}

                    {/* Re-detect */}
                    <Button
                        onClick={handleDetect}
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                    >
                        <Sparkles className="h-4 w-4" />
                        重新检测
                    </Button>
                </div>
            )}
        </div>
    );
}
