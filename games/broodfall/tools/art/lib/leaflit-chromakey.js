// Snapshot of class ChromaKey from Leaflit's AI VTuber Studio (model-exporter.js), taken 2026-10-02.
// Used only when the frontend repo is not on this machine. Do not edit: fix the studio instead.
class ChromaKey {
    constructor() {
        this.keyR = 0;
        this.keyG = 255;
        this.keyB = 0;
        this.similarity = 0.40;     // 0-1 (OBS default: 400/1000)
        this.smoothness = 0.08;     // 0-1 (OBS default: 80/1000)
        this.spillSuppression = 0.10; // 0-1 (OBS default: 100/1000)
        this.postSaturation = 1;    // 0-2
        this.postBrightness = 1;    // 0.5-1.5
        this.edgeFadeWidth = 0;     // 0-200 pixels (0 = off)
        this.antiAlias = false;     // smooth jagged edges
        this.smokeCleanup = false;  // neutralize key-colored VFX (smoke, etc.)

        // Pre-computed YUV key color (updated when key color changes)
        this._keyU = 0;
        this._keyV = 0;
        this._updateKeyUV();
    }

    setKeyColor(r, g, b) {
        this.keyR = r;
        this.keyG = g;
        this.keyB = b;
        this._updateKeyUV();
    }

    setKeyColorHex(hex) {
        hex = hex.replace('#', '');
        this.keyR = parseInt(hex.substr(0, 2), 16);
        this.keyG = parseInt(hex.substr(2, 2), 16);
        this.keyB = parseInt(hex.substr(4, 2), 16);
        this._updateKeyUV();
    }

    /**
     * Pre-compute the key color in YUV space (U and V components).
     * Uses the BT.601 YUV matrix (same as OBS).
     */
    _updateKeyUV() {
        const r = this.keyR / 255, g = this.keyG / 255, b = this.keyB / 255;
        this._keyU = -0.148736 * r - 0.331264 * g + 0.5 * b;
        this._keyV =  0.5 * r - 0.418688 * g - 0.081312 * b;
    }

    /**
     * OBS CORE: Chroma Distance
     * Ported from OBS chroma_key_filter.effect GetChromaDist()
     * Converts RGB to YUV, returns Euclidean distance in UV plane to key color.
     */
    _getChromaDist(r, g, b) {
        const rf = r / 255, gf = g / 255, bf = b / 255;
        const u = -0.148736 * rf - 0.331264 * gf + 0.5 * bf;
        const v =  0.5 * rf - 0.418688 * gf - 0.081312 * bf;
        const du = u - this._keyU;
        const dv = v - this._keyV;
        return Math.sqrt(du * du + dv * dv);
    }

    /**
     * OBS CORE: Box-Filtered Chroma Distance
     * Ported from OBS GetBoxFilteredChromaDist()
     * Samples 4 cardinal neighbors + center pixel, weighted average.
     * This smooths the chroma distance across a neighborhood, preventing
     * single-pixel noise and producing smoother edges (less jaggies).
     *
     * IMPORTANT: After our flood fill step, alpha=0 pixels still contain
     * key-color RGB data. We must skip them \u{2014} otherwise their low chroma
     * distance contaminates the average and makes foreground edge pixels
     * incorrectly transparent.
     *
     * Weighting: valid neighbors x 2 + center x 1, normalized.
     */
    _getBoxFilteredDist(x, y, data, w, h) {
        const idx = (y * w + x) * 4;
        const centerDist = this._getChromaDist(data[idx], data[idx + 1], data[idx + 2]);

        let distSum = centerDist; // Center weighted 1x
        let totalWeight = 1;

        // 4 cardinal neighbors \u{2014} only include if opaque (not flood-filled)
        const offsets = [
            x > 0 ? idx - 4 : -1,
            x < w - 1 ? idx + 4 : -1,
            y > 0 ? idx - w * 4 : -1,
            y < h - 1 ? idx + w * 4 : -1
        ];

        for (const ni of offsets) {
            if (ni >= 0 && data[ni + 3] > 0) {
                distSum += this._getChromaDist(data[ni], data[ni + 1], data[ni + 2]) * 2;
                totalWeight += 2;
            }
        }

        return distSum / totalWeight;
    }

    /**
     * Check if a pixel matches the background color within tolerance.
     */
    isBackgroundPixel(data, idx, bgColor, tolerance) {
        const dr = Math.abs(data[idx] - bgColor.r);
        const dg = Math.abs(data[idx + 1] - bgColor.g);
        const db = Math.abs(data[idx + 2] - bgColor.b);
        return (dr + dg + db) / 3 <= tolerance;
    }

    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}
    //  MAIN PROCESS \u{2014} Clean 4-step pipeline
    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}

    process(imageData) {
        const bgColor = { r: this.keyR, g: this.keyG, b: this.keyB };
        const tolerance = this.similarity * 110;

        // Step 1: Edge flood fill \u{2014} remove background connected to borders
        this.edgeFloodFill(imageData, bgColor, tolerance);

        // Step 2: OBS chroma key \u{2014} box-filtered alpha mask + spill suppression
        this._obsChromaKey(imageData);

        // Step 3: Periphery outline blackout \u{2014} anime-specific edge cleanup.
        // Styles WITHOUT inked outlines (photoreal, 3D render) skip it: on
        // them the blackout paints a dark rotoscope rim instead of cleaning.
        if (!this._outlineFreeStyle()) {
            this._peripheryBlackout(imageData, bgColor);
        }

        // Step 3.5: VFX background cleanup \u{2014} plate-assisted haze removal.
        // Only runs when the exporter attached a temporal background plate
        // mask (bgPlateMask); single-frame callers behave exactly as before.
        if (this.bgPlateMask) {
            this._vfxBackgroundCleanup(imageData);
        }

        // Step 4: Smoke cleanup \u{2014} optional toggle for VFX elements
        if (this.smokeCleanup) {
            this._smokeCleanup(imageData, bgColor);
        }

        // Post-processing: saturation + brightness
        if (this.postSaturation !== 1 || this.postBrightness !== 1) {
            this._postProcess(imageData);
        }
    }

    // The model's art style decides outline handling (set in the studio's
    // 🎨 picker, persisted on the live model). Photoreal and 3D-render
    // characters have no inked edges to restore \u{2014} the blackout would ADD one.
    _outlineFreeStyle() {
        try {
            const m = JSON.parse(localStorage.getItem('rfab_vtuber_live_model') || '{}');
            return m.styleKey === 'photoreal' || m.styleKey === 'render3d';
        } catch (e) { return false; }
    }

    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}
    //  STEP 1: Edge Flood Fill
    //  BFS from image borders \u{2014} removes background connected to edges.
    //  OBS doesn't need this (it processes every pixel in real-time),
    //  but we need it because we export to transparent PNG where
    //  interior pockets of key color (e.g. between legs) must be
    //  handled separately from outer background.
    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}

    edgeFloodFill(imageData, bgColor, tolerance) {
        const { data, width, height } = imageData;
        const totalPixels = width * height;
        const visited = new Uint8Array(totalPixels);
        const queue = [];

        // Seed from all edge pixels matching background
        for (let x = 0; x < width; x++) {
            const topIdx = x;
            const botIdx = (height - 1) * width + x;
            if (this.isBackgroundPixel(data, topIdx * 4, bgColor, tolerance)) {
                queue.push(topIdx); visited[topIdx] = 1;
            }
            if (this.isBackgroundPixel(data, botIdx * 4, bgColor, tolerance)) {
                queue.push(botIdx); visited[botIdx] = 1;
            }
        }
        for (let y = 1; y < height - 1; y++) {
            const leftIdx = y * width;
            const rightIdx = y * width + (width - 1);
            if (this.isBackgroundPixel(data, leftIdx * 4, bgColor, tolerance)) {
                queue.push(leftIdx); visited[leftIdx] = 1;
            }
            if (this.isBackgroundPixel(data, rightIdx * 4, bgColor, tolerance)) {
                queue.push(rightIdx); visited[rightIdx] = 1;
            }
        }

        // BFS flood fill
        let head = 0;
        while (head < queue.length) {
            const pixelIdx = queue[head++];
            const x = pixelIdx % width;
            const y = Math.floor(pixelIdx / width);
            const neighbors = [];
            if (x > 0) neighbors.push(pixelIdx - 1);
            if (x < width - 1) neighbors.push(pixelIdx + 1);
            if (y > 0) neighbors.push(pixelIdx - width);
            if (y < height - 1) neighbors.push(pixelIdx + width);
            for (const nIdx of neighbors) {
                if (visited[nIdx] === 0) {
                    if (this.isBackgroundPixel(data, nIdx * 4, bgColor, tolerance)) {
                        visited[nIdx] = 1;
                        queue.push(nIdx);
                    } else {
                        visited[nIdx] = 2;
                    }
                }
            }
        }

        // Apply transparency to background pixels
        for (let i = 0; i < totalPixels; i++) {
            if (visited[i] === 1) {
                data[i * 4 + 3] = 0;
            }
        }
        return imageData;
    }

    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}
    //  STEP 2: OBS Chroma Key
    //  Direct port of OBS Studio's ProcessChromaKey shader.
    //
    //  For each opaque pixel:
    //  1. Compute box-filtered chroma distance (smooth edges)
    //  2. Alpha mask: fullMask = pow(clamp((dist-sim)/smooth, 0, 1), 1.5)
    //  3. Spill: spillVal = pow(clamp((dist-sim)/spill, 0, 1), 1.5)
    //     rgb = lerp(luminance, rgb, spillVal)
    //
    //  Replaces old Steps 2-3.6 with a single clean pass.
    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}

    _obsChromaKey(imageData) {
        const { data, width, height } = imageData;
        const total = width * height;
        const sim = this.similarity;
        const smooth = Math.max(0.002, this.smoothness);
        const spill = Math.max(0.002, this.spillSuppression);

        // SCREEN UNMIX (Vlahos-style), replaces the gray-lerp spill for
        // screen-like keys: a pixel containing k of the key (ghosted body
        // during a teleport dissolve, translucent cube, motion-blur streak,
        // edge fringe) becomes k-TRANSPARENT and the key's light is
        // subtracted back out \u{2014} a black suit seen through the ghost stays
        // black at partial alpha instead of washing to pale gray.
        // k = key-channel excess: for green, (G \u{2212} max(R,B)) / ref.
        const hiR = this.keyR > 127, hiG = this.keyG > 127, hiB = this.keyB > 127;
        const nHi = (hiR ? 1 : 0) + (hiG ? 1 : 0) + (hiB ? 1 : 0);
        const refExc = Math.min(hiR ? this.keyR : 255, hiG ? this.keyG : 255, hiB ? this.keyB : 255)
            - Math.max(hiR ? 0 : this.keyR, hiG ? 0 : this.keyG, hiB ? 0 : this.keyB);
        const screenKey = nHi >= 1 && nHi <= 2 && refExc >= 100;

        // Build distance-from-transparent map (BFS, max depth 4).
        // Smoothness alpha is ONLY applied to pixels near edges (depth 1-4).
        // Interior pixels use binary keying \u{2014} this prevents video compression
        // noise from making the entire character semi-transparent.
        const EDGE_DEPTH = 4;
        const edgeDist = new Uint8Array(total);
        edgeDist.fill(255);
        const queue = [];
        for (let i = 0; i < total; i++) {
            if (data[i * 4 + 3] === 0) { edgeDist[i] = 0; queue.push(i); }
        }
        let head = 0;
        while (head < queue.length) {
            const pi = queue[head++];
            const dd = edgeDist[pi];
            if (dd >= EDGE_DEPTH) continue;
            const px = pi % width, py = (pi - px) / width;
            if (px > 0     && edgeDist[pi - 1] > dd + 1) { edgeDist[pi - 1] = dd + 1; queue.push(pi - 1); }
            if (px < width - 1 && edgeDist[pi + 1] > dd + 1) { edgeDist[pi + 1] = dd + 1; queue.push(pi + 1); }
            if (py > 0     && edgeDist[pi - width] > dd + 1) { edgeDist[pi - width] = dd + 1; queue.push(pi - width); }
            if (py < height - 1 && edgeDist[pi + width] > dd + 1) { edgeDist[pi + width] = dd + 1; queue.push(pi + width); }
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                // Skip already-transparent pixels (from flood fill)
                if (data[idx + 3] === 0) continue;

                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                const pixIdx = y * width + x;
                const depth = edgeDist[pixIdx];

                // Box-filtered chroma distance (smooth edges like OBS)
                const chromaDist = this._getBoxFilteredDist(x, y, data, width, height);

                // OBS formula: baseMask = chromaDist - similarity
                const baseMask = chromaDist - sim;

                // Alpha masking \u{2014} edge-aware
                if (depth <= EDGE_DEPTH) {
                    // EDGE PIXEL: Apply full OBS smoothness formula
                    // fullMask = pow(saturate(baseMask / smoothness), 1.5)
                    const fullMask = Math.pow(Math.max(0, Math.min(1, baseMask / smooth)), 1.5);
                    data[idx + 3] = Math.round(data[idx + 3] * fullMask);
                } else {
                    // INTERIOR PIXEL: Binary keying only
                    // If chroma distance <= similarity, it's key color \u{2014} remove it
                    if (baseMask <= 0) {
                        data[idx + 3] = 0;
                    }
                    // Otherwise keep fully opaque \u{2014} no smoothness fade
                }

                if (screenKey) {
                    // Screen unmix: translucency + true despill (see header)
                    const hi = Math.min(hiR ? r : 255, hiG ? g : 255, hiB ? b : 255);
                    const lo = Math.max(hiR ? 0 : r, hiG ? 0 : g, hiB ? 0 : b);
                    const k = Math.max(0, Math.min(1, (hi - lo) / refExc));
                    if (k > 0.03) {
                        if (k >= 0.97) {
                            data[idx + 3] = 0;
                        } else {
                            data[idx + 3] = Math.round(data[idx + 3] * (1 - k));
                            const inv = 1 / (1 - k);
                            data[idx]     = Math.max(0, Math.min(255, Math.round((r - k * this.keyR) * inv)));
                            data[idx + 1] = Math.max(0, Math.min(255, Math.round((g - k * this.keyG) * inv)));
                            data[idx + 2] = Math.max(0, Math.min(255, Math.round((b - k * this.keyB) * inv)));
                        }
                    }
                } else {
                    // Non-screen keys: original OBS gray-lerp spill suppression
                    // spillVal = pow(saturate(baseMask / spill), 1.5)
                    const spillVal = Math.pow(Math.max(0, Math.min(1, baseMask / spill)), 1.5);
                    if (spillVal < 0.999) {
                        // BT.709 luminance
                        const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
                        data[idx]     = Math.max(0, Math.min(255, Math.round(lum + (r - lum) * spillVal)));
                        data[idx + 1] = Math.max(0, Math.min(255, Math.round(lum + (g - lum) * spillVal)));
                        data[idx + 2] = Math.max(0, Math.min(255, Math.round(lum + (b - lum) * spillVal)));
                    }
                }
            }
        }
    }

    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}
    //  STEP 3.5: VFX Background Cleanup (plate-assisted)
    //  The teleport failure (field report 2026-07-22): heavy VFX makes the
    //  provider RELIGHT the scene \u{2014} the green around the effect becomes a
    //  khaki haze chromatically nowhere near the key, so per-frame color
    //  alone can't tell haze from a real object (a gray cube IS the same
    //  color). Across frames the truth is visible: the exporter marks
    //  pixels whose temporal majority is bare key color (bgPlateMask).
    //  Whatever the normal key left OPAQUE there is:
    //    - bright (glow/lightning/white VFX)  \u{2192} kept \u{2014} additive light,
    //    - locally sharp (cube edges, objects) \u{2192} kept,
    //    - small (cube interiors)              \u{2192} kept,
    //    - acres of dim smooth pixels          \u{2192} the haze \u{2014} removed.
    //  Character pixels are never on the mask (their temporal majority is
    //  the character, not the key), so the character can't be touched.
    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}

    _vfxBackgroundCleanup(imageData) {
        const { data, width, height } = imageData;
        const mask = this.bgPlateMask;
        if (!mask || mask.length !== width * height) return;
        const total = width * height;

        // Unprotected survivors on plate-background = haze candidates
        const cand = new Uint8Array(total);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                if (!mask[i]) continue;
                const idx = i * 4;
                if (data[idx + 3] === 0) continue;
                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                if (r * 0.2126 + g * 0.7152 + b * 0.0722 >= 200) continue;   // bright = additive glow
                let grad = 0;
                if (x < width - 1) {
                    const j = idx + 4;
                    grad = Math.abs(r - data[j]) + Math.abs(g - data[j + 1]) + Math.abs(b - data[j + 2]);
                }
                if (grad < 48 && y < height - 1) {
                    const j = idx + width * 4;
                    grad = Math.max(grad, Math.abs(r - data[j]) + Math.abs(g - data[j + 1]) + Math.abs(b - data[j + 2]));
                }
                if (grad >= 48) continue;   // sharp local detail = an object
                cand[i] = 1;
            }
        }

        // Connected components: only LARGE smooth blobs are haze. Cube
        // interiors and small remnants stay (they read as intended VFX).
        const MIN_HAZE = Math.max(600, Math.round(total * 0.003));
        const seen = new Uint8Array(total);
        const stack = [];
        const comp = [];
        for (let s = 0; s < total; s++) {
            if (!cand[s] || seen[s]) continue;
            comp.length = 0;
            stack.length = 0;
            stack.push(s);
            seen[s] = 1;
            while (stack.length) {
                const p = stack.pop();
                comp.push(p);
                const px = p % width, py = (p - px) / width;
                if (px > 0 && cand[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
                if (px < width - 1 && cand[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
                if (py > 0 && cand[p - width] && !seen[p - width]) { seen[p - width] = 1; stack.push(p - width); }
                if (py < height - 1 && cand[p + width] && !seen[p + width]) { seen[p + width] = 1; stack.push(p + width); }
            }
            if (comp.length >= MIN_HAZE) {
                for (const p of comp) data[p * 4 + 3] = 0;
            }
        }
    }

    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}
    //  STEP 3: Periphery Outline Blackout (anime-specific)
    //  Darkens key-contaminated pixels within 2px of transparent edges.
    //  In anime art, edges are always dark outlines \u{2014} any remaining
    //  key color contamination at boundaries should become outline.
    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}

    _peripheryBlackout(imageData, bgColor) {
        const d = imageData.data;
        const w = imageData.width;
        const h = imageData.height;
        const total = w * h;
        const keyMax = Math.max(bgColor.r, bgColor.g, bgColor.b);
        const isKeyR = bgColor.r > keyMax * 0.7;
        const isKeyG = bgColor.g > keyMax * 0.7;
        const isKeyB = bgColor.b > keyMax * 0.7;

        // Build distance-from-transparent map (BFS, max depth 2)
        const edgeDist = new Uint8Array(total);
        edgeDist.fill(255);
        const queue = [];
        for (let i = 0; i < total; i++) {
            if (d[i * 4 + 3] === 0) { edgeDist[i] = 0; queue.push(i); }
        }
        let head = 0;
        while (head < queue.length) {
            const pi = queue[head++];
            const dist = edgeDist[pi];
            if (dist >= 2) continue;
            const px = pi % w, py = (pi - px) / w;
            if (px > 0     && edgeDist[pi - 1] > dist + 1) { edgeDist[pi - 1] = dist + 1; queue.push(pi - 1); }
            if (px < w - 1 && edgeDist[pi + 1] > dist + 1) { edgeDist[pi + 1] = dist + 1; queue.push(pi + 1); }
            if (py > 0     && edgeDist[pi - w] > dist + 1) { edgeDist[pi - w] = dist + 1; queue.push(pi - w); }
            if (py < h - 1 && edgeDist[pi + w] > dist + 1) { edgeDist[pi + w] = dist + 1; queue.push(pi + w); }
        }

        for (let i = 0; i < total; i++) {
            const dist = edgeDist[i];
            if (dist === 0 || dist > 2) continue;
            const idx = i * 4;
            if (d[idx + 3] < 200) continue; // Skip semi-transparent (wings, hair)

            const r = d[idx], g = d[idx + 1], b = d[idx + 2];

            // Check for key color contamination in channel pattern
            let contamination = 0;
            if (isKeyR && isKeyB && !isKeyG) {
                // Magenta: R and/or B elevated vs G
                const exR = Math.max(0, r - g);
                const exB = Math.max(0, b - g);
                contamination = Math.max(exR, exB);
            } else if (isKeyR && isKeyG && !isKeyB) {
                const exR = Math.max(0, r - b);
                const exG = Math.max(0, g - b);
                contamination = Math.max(exR, exG);
            } else if (isKeyG && !isKeyR && !isKeyB) {
                contamination = Math.max(0, g - Math.max(r, b));
            } else if (isKeyB && !isKeyR && !isKeyG) {
                contamination = Math.max(0, b - Math.max(r, g));
            } else if (isKeyR && !isKeyG && !isKeyB) {
                contamination = Math.max(0, r - Math.max(g, b));
            }

            const threshold = dist === 1 ? 8 : 20;
            if (contamination <= threshold) continue;

            const distFade = dist === 1 ? 1.0 : 0.6;
            const strength = Math.min(1, (contamination - threshold) / 60) * distFade;
            const lum = r * 0.299 + g * 0.587 + b * 0.114;
            const darkTarget = Math.min(lum * 0.25, 35);
            d[idx]     = Math.round(r * (1 - strength) + darkTarget * strength);
            d[idx + 1] = Math.round(g * (1 - strength) + darkTarget * strength);
            d[idx + 2] = Math.round(b * (1 - strength) + darkTarget * strength);
        }
    }

    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}
    //  STEP 4: Smoke Cleanup (optional toggle)
    //  Converts remaining key-colored elements (smoke, VFX) into
    //  semi-transparent dark gray. Uses YCbCr chroma distance.
    //  Protected body zone prevents interior damage.
    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}

    _smokeCleanup(imageData, bgColor) {
        const d = imageData.data;
        const w = imageData.width;
        const h = imageData.height;
        const total = w * h;
        const keyCb = 128 + (-0.168736 * bgColor.r - 0.331264 * bgColor.g + 0.5 * bgColor.b);
        const keyCr = 128 + (0.5 * bgColor.r - 0.418688 * bgColor.g - 0.081312 * bgColor.b);
        const SMOKE_THRESHOLD = 40;
        const SMOKE_SOFTEDGE = 60;
        const BODY_DEPTH = 6;

        // BFS: distance from nearest transparent pixel
        const distFromTP = new Uint8Array(total);
        distFromTP.fill(255);
        const bfsQ = [];
        for (let i = 0; i < total; i++) {
            if (d[i * 4 + 3] === 0) { distFromTP[i] = 0; bfsQ.push(i); }
        }
        let bfsHead = 0;
        while (bfsHead < bfsQ.length) {
            const pi = bfsQ[bfsHead++];
            const dd = distFromTP[pi];
            if (dd >= BODY_DEPTH) continue;
            const px = pi % w, py = (pi - px) / w;
            if (px > 0     && distFromTP[pi - 1] > dd + 1) { distFromTP[pi - 1] = dd + 1; bfsQ.push(pi - 1); }
            if (px < w - 1 && distFromTP[pi + 1] > dd + 1) { distFromTP[pi + 1] = dd + 1; bfsQ.push(pi + 1); }
            if (py > 0     && distFromTP[pi - w] > dd + 1) { distFromTP[pi - w] = dd + 1; bfsQ.push(pi - w); }
            if (py < h - 1 && distFromTP[pi + w] > dd + 1) { distFromTP[pi + w] = dd + 1; bfsQ.push(pi + w); }
        }

        for (let j = 0; j < d.length; j += 4) {
            if (d[j + 3] < 1) continue;
            const pxIdx = j >> 2;
            const depth = distFromTP[pxIdx];
            if (depth > BODY_DEPTH) continue;

            const r = d[j], g = d[j + 1], b = d[j + 2];
            const cb = 128 + (-0.168736 * r - 0.331264 * g + 0.5 * b);
            const cr = 128 + (0.5 * r - 0.418688 * g - 0.081312 * b);
            const dcb = cb - keyCb, dcr = cr - keyCr;
            const chromaDist = Math.sqrt(dcb * dcb + dcr * dcr);

            if (chromaDist >= SMOKE_THRESHOLD + SMOKE_SOFTEDGE) continue;

            let contamination;
            if (chromaDist < SMOKE_THRESHOLD) {
                contamination = 1.0;
            } else {
                contamination = 1.0 - (chromaDist - SMOKE_THRESHOLD) / SMOKE_SOFTEDGE;
            }
            contamination = Math.pow(contamination, 0.7);
            contamination *= Math.max(0, 1 - depth / BODY_DEPTH);
            if (contamination < 0.01) continue;

            const lum = r * 0.299 + g * 0.587 + b * 0.114;
            const origAlpha = d[j + 3];

            if (origAlpha < 200) {
                // Semi-transparent pixel (wings, hair, VFX details):
                // Desaturate key color instead of removing alpha.
                const darkVal = Math.min(lum * 0.5, 80);
                d[j]     = Math.round(r * (1 - contamination * 0.7) + darkVal * (contamination * 0.7));
                d[j + 1] = Math.round(g * (1 - contamination * 0.7) + darkVal * (contamination * 0.7));
                d[j + 2] = Math.round(b * (1 - contamination * 0.7) + darkVal * (contamination * 0.7));
                d[j + 3] = Math.round(origAlpha * (1 - contamination * 0.3));
            } else {
                // Fully opaque key-colored pixel (actual smoke):
                const darkVal = Math.min(lum * 0.2, 30);
                d[j]     = Math.round(r * (1 - contamination) + darkVal * contamination);
                d[j + 1] = Math.round(g * (1 - contamination) + darkVal * contamination);
                d[j + 2] = Math.round(b * (1 - contamination) + darkVal * contamination);
                d[j + 3] = Math.round(origAlpha * (1 - contamination * 0.85));
            }
        }
    }

    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}
    //  POST-PROCESSING: Saturation + Brightness
    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}

    _postProcess(imageData) {
        const d = imageData.data;
        const sat = this.postSaturation;
        const bright = this.postBrightness;
        for (let j = 0; j < d.length; j += 4) {
            if (d[j + 3] === 0) continue;
            let r = d[j], g = d[j + 1], b = d[j + 2];

            if (bright !== 1) {
                r = Math.round(r * bright);
                g = Math.round(g * bright);
                b = Math.round(b * bright);
            }

            if (sat !== 1) {
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                r = Math.round(lum + (r - lum) * sat);
                g = Math.round(lum + (g - lum) * sat);
                b = Math.round(lum + (b - lum) * sat);
            }

            d[j]     = Math.max(0, Math.min(255, r));
            d[j + 1] = Math.max(0, Math.min(255, g));
            d[j + 2] = Math.max(0, Math.min(255, b));
        }
    }

    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}
    //  EDGE FADE \u{2014} Fade alpha near left/right/top borders
    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}

    applyEdgeFade(imageData, fadeWidth) {
        if (fadeWidth <= 0) return;
        const { data, width, height } = imageData;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                if (data[idx + 3] === 0) continue;

                // Calculate minimum distance to left, right, or top edge
                let edgeFactor = 1;
                const leftDist = x;
                const rightDist = width - 1 - x;
                const topDist = y;
                // No bottom fade \u{2014} screen naturally cuts off there

                const minDist = Math.min(leftDist, rightDist, topDist);

                if (minDist < fadeWidth) {
                    // Smooth fade using squared curve for natural falloff
                    const t = minDist / fadeWidth;
                    edgeFactor = t * t; // Quadratic ease-in
                }

                if (edgeFactor < 1) {
                    data[idx + 3] = Math.round(data[idx + 3] * edgeFactor);
                }
            }
        }
    }

    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}
    //  ANTI-ALIASING \u{2014} Smooth jagged alpha edges via 3x3 kernel
    //  O(n) single pass, ~1-3ms per 1080p frame.
    // \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}

    applyAntiAlias(imageData) {
        const { data, width, height } = imageData;
        const total = width * height;

        // Reuse cached buffer to avoid per-frame allocation (GC pressure)
        if (!this._aaBuffer || this._aaBuffer.length < total) {
            this._aaBuffer = new Uint8Array(total);
        }
        const origAlpha = this._aaBuffer;

        // Copy alpha channel
        for (let i = 0; i < total; i++) {
            origAlpha[i] = data[i * 4 + 3];
        }

        // Pre-compute row offsets
        const W = width;

        for (let y = 1; y < height - 1; y++) {
            const rowStart = y * W;
            for (let x = 1; x < W - 1; x++) {
                const i = rowStart + x;
                const alpha = origAlpha[i];

                // Skip transparent and semi-transparent pixels
                if (alpha < 128) continue;

                // Fast cardinal-only edge check (avoid full kernel for interior)
                const aUp    = origAlpha[i - W];
                const aDown  = origAlpha[i + W];
                const aLeft  = origAlpha[i - 1];
                const aRight = origAlpha[i + 1];

                if (aUp >= 128 && aDown >= 128 && aLeft >= 128 && aRight >= 128) {
                    // Also check diagonals
                    if (origAlpha[i - W - 1] >= 128 && origAlpha[i - W + 1] >= 128 &&
                        origAlpha[i + W - 1] >= 128 && origAlpha[i + W + 1] >= 128) {
                        continue; // Fully interior pixel, skip
                    }
                }

                // Unrolled 3x3 weighted kernel
                // Cardinal neighbors (weight 2), diagonals (weight 1), center (weight 2)
                // Total max weight = 4 cardinals*2 + 4 diagonals*1 + 1 center*2 = 14
                let opaqueW = 0;
                if (alpha >= 128)                      opaqueW += 2; // center
                if (aUp >= 128)                        opaqueW += 2; // up
                if (aDown >= 128)                      opaqueW += 2; // down
                if (aLeft >= 128)                      opaqueW += 2; // left
                if (aRight >= 128)                     opaqueW += 2; // right
                if (origAlpha[i - W - 1] >= 128)       opaqueW += 1; // top-left
                if (origAlpha[i - W + 1] >= 128)       opaqueW += 1; // top-right
                if (origAlpha[i + W - 1] >= 128)       opaqueW += 1; // bottom-left
                if (origAlpha[i + W + 1] >= 128)       opaqueW += 1; // bottom-right

                const smoothAlpha = Math.round((opaqueW / 14) * 255);

                // Only reduce alpha, never increase it
                if (smoothAlpha < alpha) {
                    data[i * 4 + 3] = smoothAlpha;
                }
            }
        }
    }
}