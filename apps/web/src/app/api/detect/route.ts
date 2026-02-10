import { NextRequest, NextResponse } from "next/server";

// Python 后端地址 — 可通过环境变量覆盖
const BACKEND_URL =
    process.env.MOSAIC_BACKEND_URL || "http://localhost:8000";

/**
 * POST /api/detect
 * 前端传 { inputPath, taskId?, detector? }
 * 转发到 Python 后端 POST /detect
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { inputPath, taskId, detector = "nudenet" } = body;

        if (!inputPath) {
            return NextResponse.json(
                { error: "inputPath is required" },
                { status: 400 },
            );
        }

        const payload = {
            taskId: taskId || crypto.randomUUID(),
            inputPath,
            detector,
        };

        const res = await fetch(`${BACKEND_URL}/detect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("[detect] error:", error);
        return NextResponse.json(
            { error: "Failed to submit detection request" },
            { status: 500 },
        );
    }
}

/**
 * GET /api/detect?taskId=xxx
 * 轮询 Python 后端 GET /status/{taskId}
 */
export async function GET(request: NextRequest) {
    try {
        const taskId = request.nextUrl.searchParams.get("taskId");
        if (!taskId) {
            return NextResponse.json(
                { error: "taskId is required" },
                { status: 400 },
            );
        }

        const res = await fetch(`${BACKEND_URL}/status/${taskId}`);
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error("[detect/status] error:", error);
        return NextResponse.json(
            { error: "Failed to query detection status" },
            { status: 500 },
        );
    }
}
