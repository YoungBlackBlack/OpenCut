import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";

export interface MosaicNodeParams {
    /** Bounding box in video pixel coordinates [x1, y1, x2, y2] */
    bbox: number[];
    /** Block size for pixelation effect */
    blockSize: number;
    /** Start time in seconds (absolute timeline time) */
    timeOffset: number;
    /** Duration in seconds */
    duration: number;
    /** Video width (original resolution) */
    videoWidth: number;
    /** Video height (original resolution) */
    videoHeight: number;
}

/**
 * MosaicNode — renders a pixelated mosaic overlay on a specific bounding box
 * region during a time range. Uses canvas pixel manipulation to create the
 * mosaic effect.
 */
export class MosaicNode extends BaseNode<MosaicNodeParams> {
    async render({
        renderer,
        time,
    }: {
        renderer: CanvasRenderer;
        time: number;
    }): Promise<void> {
        const { bbox, blockSize, timeOffset, duration, videoWidth, videoHeight } =
            this.params;

        // Check if we're within the time range
        if (time < timeOffset || time >= timeOffset + duration) {
            return;
        }

        if (bbox.length < 4) return;

        const ctx = renderer.context;
        const [x1, y1, x2, y2] = bbox;

        // Scale bbox from video resolution to canvas resolution
        const scaleX = renderer.width / videoWidth;
        const scaleY = renderer.height / videoHeight;

        const cx1 = Math.max(0, Math.floor(x1 * scaleX));
        const cy1 = Math.max(0, Math.floor(y1 * scaleY));
        const cx2 = Math.min(renderer.width, Math.ceil(x2 * scaleX));
        const cy2 = Math.min(renderer.height, Math.ceil(y2 * scaleY));

        const w = cx2 - cx1;
        const h = cy2 - cy1;

        if (w <= 0 || h <= 0) return;

        // Apply mosaic: read the region, pixelate, write back
        const bs = Math.max(2, blockSize);

        ctx.save();

        // Get the image data for the region
        const imageData = ctx.getImageData(cx1, cy1, w, h);
        const data = imageData.data;

        // Pixelation: for each block, average the colors and fill
        for (let by = 0; by < h; by += bs) {
            for (let bx = 0; bx < w; bx += bs) {
                // Calculate block bounds
                const bw = Math.min(bs, w - bx);
                const bh = Math.min(bs, h - by);

                // Average color in this block
                let r = 0,
                    g = 0,
                    b = 0,
                    a = 0;
                let count = 0;
                for (let dy = 0; dy < bh; dy++) {
                    for (let dx = 0; dx < bw; dx++) {
                        const idx = ((by + dy) * w + (bx + dx)) * 4;
                        r += data[idx];
                        g += data[idx + 1];
                        b += data[idx + 2];
                        a += data[idx + 3];
                        count++;
                    }
                }
                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);
                a = Math.round(a / count);

                // Fill block with average color
                for (let dy = 0; dy < bh; dy++) {
                    for (let dx = 0; dx < bw; dx++) {
                        const idx = ((by + dy) * w + (bx + dx)) * 4;
                        data[idx] = r;
                        data[idx + 1] = g;
                        data[idx + 2] = b;
                        data[idx + 3] = a;
                    }
                }
            }
        }

        ctx.putImageData(imageData, cx1, cy1);
        ctx.restore();
    }
}
