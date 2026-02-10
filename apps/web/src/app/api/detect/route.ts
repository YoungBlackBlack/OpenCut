import { NextRequest, NextResponse } from "next/server";

// Python 后端地址 — 可通过环境变量覆盖
const BACKEND_URL =
    process.env.MOSAIC_BACKEND_URL || "http://localhost:8000";

/**
 * POST /api/detect
 *
 * Accepts either:
 * 1. JSON body  { inputPath, taskId?, detector? }  — direct path mode
 * 2. FormData   with field "file" (video)           — upload-first mode
 *
 * In upload mode the file is first sent to the Python backend POST /upload,
 * which saves it to disk and returns { filePath }.
 * Then POST /detect is called with that filePath as inputPath.
 */
export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get("content-type") || "";

        let inputPath: string;
        let taskId: string | undefined;
        let detector = "nudenet";

        if (contentType.includes("multipart/form-data")) {
            // ── Upload-first mode ──
            const formData = await request.formData();
            const file = formData.get("file") as File | null;
            taskId = (formData.get("taskId") as string) || undefined;
            detector = (formData.get("detector") as string) || detector;

            if (!file) {
                return NextResponse.json(
                    { error: "file is required in form data" },
                    { status: 400 },
                );
            }

            // Forward file to Python backend /upload
            const uploadForm = new FormData();
            uploadForm.append("file", file, file.name);

            const uploadRes = await fetch(`${BACKEND_URL}/upload`, {
                method: "POST",
                body: uploadForm,
            });

            if (!uploadRes.ok) {
                const err = await uploadRes.text();
                return NextResponse.json(
                    { error: `Upload failed: ${err}` },
                    { status: uploadRes.status },
                );
            }

            const uploadData = await uploadRes.json();
            inputPath = uploadData.filePath;
        } else {
            // ── JSON body mode ──
            const body = await request.json();
            inputPath = body.inputPath;
            taskId = body.taskId;
            detector = body.detector || detector;

            if (!inputPath) {
                return NextResponse.json(
                    { error: "inputPath is required" },
                    { status: 400 },
                );
            }
        }

        // ── Call /detect ──
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
