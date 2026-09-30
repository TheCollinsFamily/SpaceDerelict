/**
 * THE GLOBE AS A PLANET (Sep 30 2026; notes/TO-CREATE.md "the globe as a true 3D sphere"; Collins: "is the
 * globe interactable, does it move? can it?"). A WebGL sphere (three.js) that the ship projects over the
 * Directive Desk:
 *
 *  - the planet's own map (public/art/ship/planet.webp) by day, and the lights the insects still have
 *    (public/art/ship/globe/night.webp, tools/art/globe-night.mjs) on its night side, the look of the
 *    menu's loop; ground the brood HOLDS has its lights out and the creep's red veins crawling over it
 *    (drawn here, so they follow what is held), and a counter-attack pulses orange;
 *  - the 16 landing sites placed by their lat/lon (content/campaign.ts), each zone the ground nearest
 *    its site (the same rule as src/ui/globe.ts `zoneAt`), bordered by thin projected lines, the
 *    neighbour links as arcs on the surface;
 *  - it turns slowly by itself while nobody touches it (not with Settings > Reduce motion, not under
 *    automation unless localStorage['broodfall-globe-spin'] = 'on'); drag turns it both ways with
 *    inertia (the tilt is held to +-70 degrees); the wheel zooms within limits; hovering shows a zone
 *    lit and its name, what it is to him and the lights still burning there; a click on a zone or its
 *    marker picks it, and the planet turns to face it; the arrow keys and the turn buttons still work.
 *
 * The markers (SVG `.globe .site`, drawn by campaignUi.ts) sit over the canvas and are moved here every
 * frame, so the page's clicks, hover styles and tests reach them as before. Without WebGL, campaignUi
 * falls back to the flat painter in globe.ts.
 */
import * as THREE from 'three';
import type { Zone } from './globe';

const RAD = Math.PI / 180;
/** How far from its site a zone reaches (src/ui/globe.ts REACH). */
const REACH = 30;
const MAX_ZONES = 20;
const STATE_CODE: Record<Zone['state'], number> = { locked: 0, open: 1, held: 2, attack: 3 };
export const STATE_WORD: Record<Zone['state'], string> = { locked: 'not yet', open: 'can land', held: 'yours', attack: 'under attack' };
/** The globe box is 420 units wide in the SVG's own coordinates. */
const BOX = 420;

/** A place on the unit sphere, in the globe's convention (x east at lon 90, y north, z toward lon 0). */
export function dirOf(lat: number, lon: number): THREE.Vector3 {
  const la = lat * RAD, lo = lon * RAD;
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

const VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorldN;
varying vec3 vView;
void main() {
  vObj = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorldN = normalize(mat3(modelMatrix) * position);
  vView = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform float uHasNight;
uniform vec3 uSun;
uniform float uTime;
uniform int uCount;
uniform vec3 uSite[${MAX_ZONES}];
uniform float uState[${MAX_ZONES}];
uniform int uSel;
uniform int uHover;
varying vec3 vObj;
varying vec3 vWorldN;
varying vec3 vView;

const float PI = 3.14159265;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

void main() {
  vec3 p = normalize(vObj);
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.x, p.z);
  vec2 uv = vec2(fract(lon / (2.0 * PI) + 0.5), clamp(0.5 - lat / PI, 0.001, 0.999));
  vec3 day = texture2D(uDay, uv).rgb;
  vec3 lights = texture2D(uNight, uv).rgb * uHasNight;

  // Which zone: the nearest site within reach; how near the next one is (for the borders).
  float best = -2.0, second = -2.0; int zi = -1;
  for (int i = 0; i < ${MAX_ZONES}; i++) {
    if (i >= uCount) break;
    float d = dot(p, uSite[i]);
    if (d > best) { second = best; best = d; zi = i; } else if (d > second) { second = d; }
  }
  float reach = cos(${REACH.toFixed(1)} * PI / 180.0);
  if (best < reach) zi = -1;
  float st = -1.0;
  for (int i = 0; i < ${MAX_ZONES}; i++) { if (i == zi) st = uState[i]; }

  // Light: the sun on the day side, a soft terminator.
  vec3 n = normalize(vWorldN);
  float sun = dot(n, normalize(uSun));
  float lit = smoothstep(-0.12, 0.35, sun);
  bool sea = day.b > day.r * 1.2 && day.b > day.g * 1.02;
  // Cold and dim even by day: the menu loop's planet is a dying one seen from its night side.
  float grey = dot(day, vec3(0.3, 0.5, 0.2));
  vec3 ground = mix(vec3(grey), day, 0.55) * vec3(0.40, 0.46, 0.50) * (0.05 + 0.95 * lit);
  // The planet the ship sees is a dying one: cold, dark, the lights on its night side.
  vec3 col = ground;
  float night = 1.0 - smoothstep(-0.05, 0.25, sun);
  float held = st == 2.0 ? 1.0 : 0.0;
  float attack = st == 3.0 ? 1.0 : 0.0;
  col += lights * (0.35 + 1.15 * night) * (1.0 - held * 0.92);

  // The creep: red veins over held ground (ridged noise), thickening toward the site, pulsing slowly.
  if (held + attack > 0.0) {
    float v = 1.0 - abs(fbm(p * 9.0) * 2.0 - 1.0);
    float v2 = 1.0 - abs(fbm(p * 23.0 + 3.1) * 2.0 - 1.0);
    float core = smoothstep(reach, 1.0, best);
    float vein = smoothstep(0.93 - 0.06 * core, 0.985, v) + 0.7 * smoothstep(0.95, 0.99, v2) * (0.4 + core);
    float pulse = 0.7 + 0.3 * sin(uTime * 1.6 + fbm(p * 4.0) * 6.0);
    vec3 creep = vec3(0.95, 0.16, 0.09) * vein * pulse + vec3(0.16, 0.015, 0.02) * (0.5 + core);
    if (sea) creep *= 0.5;
    col = mix(col, col * 0.3, held) + creep * (held + attack * 0.5);
    // Burning points in its heart.
    float burn = smoothstep(0.985, 1.0, noise(p * 60.0)) * core;
    col += vec3(1.0, 0.45, 0.12) * burn * 1.6 * held;
  }
  if (attack > 0.0) col += vec3(1.0, 0.55, 0.12) * (0.18 + 0.16 * sin(uTime * 5.0));
  if (st == 1.0) col += vec3(0.35, 0.8, 0.95) * 0.1;

  // The projection's lines: zone borders (where two sites are equally near, or reach ends).
  float w = fwidth(best) * 1.4 + 0.0015;
  float edge = 0.0;
  if (zi >= 0) edge = max(1.0 - smoothstep(0.0, w * 1.6, best - second), 1.0 - smoothstep(0.0, w, best - reach));
  vec3 ec = st == 2.0 ? vec3(1.0, 0.45, 0.4) : st == 3.0 ? vec3(1.0, 0.72, 0.35) : st == 1.0 ? vec3(0.8, 0.97, 1.0) : vec3(0.45, 0.63, 0.7);
  float ek = st == 0.0 ? 0.35 : 0.8;
  if (zi == uSel || zi == uHover) { ec = vec3(1.0); ek = 1.0; }
  col = mix(col, ec, edge * ek);
  if (zi >= 0 && zi == uHover) col += vec3(0.07, 0.09, 0.1);
  if (zi >= 0 && zi == uSel) col += vec3(0.1, 0.12, 0.14);

  // A faint graticule, the rim light of a projection.
  float g1 = abs(fract(lat / (PI / 6.0) + 0.5) - 0.5), g2 = abs(fract(lon / (PI / 6.0) + 0.5) - 0.5);
  float grat = (1.0 - smoothstep(0.0, fwidth(lat / (PI / 6.0)) * 1.2, g1)) + (1.0 - smoothstep(0.0, fwidth(lon / (PI / 6.0)) * 1.2, g2));
  col += vec3(0.5, 0.85, 1.0) * 0.05 * clamp(grat, 0.0, 1.0);
  float fres = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 3.0);
  col += vec3(0.35, 0.7, 0.95) * fres * 0.55;
  gl_FragColor = vec4(col, 1.0);
}`;

const HALO_FRAG = /* glsl */ `
varying vec3 vWorldN;
varying vec3 vView;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vWorldN), normalize(vView))), 2.2);
  gl_FragColor = vec4(vec3(0.35, 0.72, 1.0) * f * 1.1, f);
}`;

export interface GlobeHooks {
  /** A zone or its marker was clicked (not dragged). */
  pick(id: string): void;
  /** What the tooltip says under a zone's name. */
  names(id: string): string;
}

export class Globe3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private planet: THREE.Mesh;
  private links = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private zones: Zone[] = [];
  private selected: string | null = null;
  private hover = -1;
  private box: HTMLElement | null = null;
  private tip: HTMLDivElement;
  /** The view: longitude facing us, tilt (north toward us), camera distance. */
  spin = -10;
  tilt = 18;
  private dist = 4;
  private vel = { spin: 0, tilt: 0 };
  private target: { spin: number; tilt: number } | null = null;
  private lastTouch = -1e9;
  private raf = 0;
  private t0 = performance.now();
  private tPrev = performance.now();
  private lightsIn = new Map<string, number>();
  private nightData: ImageData | null = null;
  private drag: { x: number; y: number; moved: number; id: number; t: number } | null = null;

  constructor(private hooks: GlobeHooks) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'globe-map globe-3d';
    // preserveDrawingBuffer: the beats read its pixels back (tools/shot-ship.mjs).
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.set(0, 0, this.dist);
    const blank = new THREE.DataTexture(new Uint8Array([40, 60, 70, 255]), 1, 1);
    blank.needsUpdate = true;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uDay: { value: blank }, uNight: { value: blank }, uHasNight: { value: 0 },
        uSun: { value: new THREE.Vector3(-0.9, 0.3, 0.3) }, uTime: { value: 0 },
        uCount: { value: 0 }, uSite: { value: Array.from({ length: MAX_ZONES }, () => new THREE.Vector3()) },
        uState: { value: new Array(MAX_ZONES).fill(0) }, uSel: { value: -1 }, uHover: { value: -1 },
      },
    });
    this.mat.extensions = { ...(this.mat.extensions ?? {}), derivatives: true } as THREE.ShaderMaterial['extensions'];
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 96), this.mat);
    this.planet.rotation.order = 'XYZ';
    this.planet.add(this.links);
    this.scene.add(this.planet);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.07, 96, 64), new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: HALO_FRAG, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.scene.add(halo);
    this.tip = document.createElement('div');
    this.tip.className = 'globe-tip';
    this.bind();
  }

  /** Can this browser draw it? */
  static supported(): boolean {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  }

  async load(day: string, night?: string): Promise<void> {
    const loader = new THREE.TextureLoader();
    const tex = async (url: string) => {
      const t = await loader.loadAsync(url);
      t.colorSpace = THREE.NoColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      // No mipmaps: the longitude wraps inside the shader, and a mip chosen across the wrap draws a seam.
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
      return t;
    };
    this.mat.uniforms.uDay.value = await tex(day);
    if (night) {
      try {
        const t = await tex(night);
        this.mat.uniforms.uNight.value = t;
        this.mat.uniforms.uHasNight.value = 1;
        const img = t.image as HTMLImageElement;
        const c = document.createElement('canvas');
        c.width = 768; c.height = 512;
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(img, 0, 0, c.width, c.height);
        this.nightData = g.getImageData(0, 0, c.width, c.height);
        this.countLights();
      } catch { /* no night map: the night side is dark */ }
    }
  }

  /** Put the planet into the desk's globe box (a new box after every drawing of the screen). */
  attach(box: HTMLElement, zones: Zone[], selected: string | null): void {
    const newSel = selected !== this.selected && selected !== null;
    this.box = box;
    this.zones = zones.slice(0, MAX_ZONES);
    this.selected = selected;
    if (this.canvas.parentElement !== box) box.prepend(this.canvas);
    if (this.tip.parentElement !== box) box.append(this.tip);
    const u = this.mat.uniforms;
    u.uCount.value = this.zones.length;
    this.zones.forEach((z, i) => { (u.uSite.value as THREE.Vector3[])[i].copy(dirOf(z.lat, z.lon)); (u.uState.value as number[])[i] = STATE_CODE[z.state]; });
    u.uSel.value = this.zones.findIndex((z) => z.id === selected);
    this.buildLinks();
    this.countLights();
    if (newSel) this.face(selected!);
    this.resize();
    this.frame();
    this.start();
  }

  /** Turn by some degrees (the ◀ ▶ buttons and the arrow keys). */
  turn(deg: number): void {
    this.touch();
    this.target = { spin: (this.target?.spin ?? this.spin) + deg, tilt: this.target?.tilt ?? this.tilt };
    this.start();
  }

  /** Turn the planet so that a site faces us. */
  face(id: string): void {
    const z = this.zones.find((x) => x.id === id);
    if (!z) return;
    this.touch();
    // The short way round.
    const d = ((z.lon - this.spin) % 360 + 540) % 360 - 180;
    this.target = { spin: this.spin + d, tilt: Math.max(-60, Math.min(60, z.lat)) };
    this.start();
  }

  /** Where a site is on the SVG's 420x420 box, and whether it is on the near side. */
  project(lat: number, lon: number): { x: number; y: number; front: boolean } {
    this.planet.rotation.set(this.tilt * RAD, -this.spin * RAD, 0);
    this.planet.updateMatrixWorld(true);
    const v = dirOf(lat, lon).multiplyScalar(1.01).applyMatrix4(this.planet.matrixWorld);
    const toCam = this.camera.position.clone().sub(v).normalize();
    const n = v.clone().normalize();
    const front = n.dot(toCam) > 0.02;
    const s = v.clone().project(this.camera);
    return { x: (s.x + 1) / 2 * BOX, y: (1 - s.y) / 2 * BOX, front };
  }

  /** Lights still burning in a zone (YOKE counts them): bright pixels of the night map inside it. */
  lightsOf(id: string): number | null {
    // One lit pixel of the 768-wide map is some two dozen settlements.
    return this.nightData ? (this.lightsIn.get(id) ?? 0) * 24 : null;
  }

  private countLights(): void {
    const d = this.nightData;
    if (!d || !this.zones.length) return;
    this.lightsIn.clear();
    const sites = this.zones.map((z) => dirOf(z.lat, z.lon));
    const reach = Math.cos(REACH * RAD);
    for (let y = 0; y < d.height; y += 1) {
      const lat = 90 - ((y + 0.5) / d.height) * 180;
      for (let x = 0; x < d.width; x += 1) {
        const o = (y * d.width + x) * 4;
        if (d.data[o] * 0.5 + d.data[o + 1] * 0.4 + d.data[o + 2] * 0.1 < 95) continue;
        const p = dirOf(lat, ((x + 0.5) / d.width) * 360 - 180);
        let best = reach, bi = -1;
        sites.forEach((s, i) => { const k = p.dot(s); if (k > best) { best = k; bi = i; } });
        if (bi < 0) continue;
        const id = this.zones[bi].id;
        this.lightsIn.set(id, (this.lightsIn.get(id) ?? 0) + 1);
      }
    }
  }

  private buildLinks(): void {
    for (const c of [...this.links.children]) { this.links.remove(c); (c as THREE.Line).geometry.dispose(); }
    const known = new Map(this.zones.map((z) => [z.id, z]));
    const mat = new THREE.LineBasicMaterial({ color: 0xc8f5ff, transparent: true, opacity: 0.38 });
    for (const [a, b] of this.pairs) {
      const za = known.get(a), zb = known.get(b);
      if (!za || !zb) continue;
      const va = dirOf(za.lat, za.lon), vb = dirOf(zb.lat, zb.lon);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 32; i++) pts.push(va.clone().lerp(vb, i / 32).normalize().multiplyScalar(1.006));
      this.links.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
  }
  /** Neighbour pairs (set by campaignUi from content/campaign.ts). */
  pairs: Array<[string, string]> = [];

  private idleOn(): boolean {
    if (document.documentElement.classList.contains('reduce-motion')) return false;
    let forced = false;
    try { forced = localStorage.getItem('broodfall-globe-spin') === 'on'; } catch { /* no storage */ }
    if (navigator.webdriver && !forced) return false;
    return !this.selected && this.hover < 0 && !this.drag && performance.now() - this.lastTouch > 4000;
  }

  private touch(): void { this.lastTouch = performance.now(); }

  private resize(): void {
    const w = this.box?.clientWidth || BOX;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, w, false);
  }

  private start(): void {
    if (this.raf) return;
    this.tPrev = performance.now();
    const loop = () => {
      this.raf = 0;
      if (!this.canvas.isConnected || !this.canvas.offsetParent) return; // hidden or gone: stop until attached again
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private frame(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.tPrev) / 1000);
    this.tPrev = now;
    if (this.target) {
      const k = 1 - Math.pow(0.0015, dt);
      this.spin += (this.target.spin - this.spin) * k;
      this.tilt += (this.target.tilt - this.tilt) * k;
      if (Math.abs(this.target.spin - this.spin) < 0.05 && Math.abs(this.target.tilt - this.tilt) < 0.05) {
        this.spin = this.target.spin; this.tilt = this.target.tilt; this.target = null;
      }
    } else if (!this.drag) {
      if (Math.abs(this.vel.spin) + Math.abs(this.vel.tilt) > 0.5) {
        this.spin += this.vel.spin * dt;
        this.tilt = Math.max(-70, Math.min(70, this.tilt + this.vel.tilt * dt));
        const f = Math.pow(0.03, dt);
        this.vel.spin *= f; this.vel.tilt *= f;
      } else if (this.idleOn()) {
        this.spin -= 4 * dt; // one turn in 90 s
      }
    }
    this.planet.rotation.set(this.tilt * RAD, -this.spin * RAD, 0);
    this.camera.position.set(0, 0, this.dist);
    this.camera.lookAt(0, 0, 0);
    this.mat.uniforms.uTime.value = (now - this.t0) / 1000;
    this.mat.uniforms.uHover.value = this.hover;
    this.renderer.render(this.scene, this.camera);
    this.placeMarkers();
  }

  /** The SVG markers follow the planet. */
  private placeMarkers(): void {
    if (!this.box) return;
    for (const g of Array.from(this.box.querySelectorAll<SVGGElement>('.globe .site'))) {
      const z = this.zones.find((x) => x.id === g.dataset.site);
      if (!z) continue;
      const p = this.project(z.lat, z.lon);
      g.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
      const hide = !p.front;
      if (g.classList.contains('behind') !== hide) g.classList.toggle('behind', hide);
    }
  }

  /** The zone under a point of the page, by casting a ray at the planet. */
  private zoneAtClient(cx: number, cy: number): number {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    this.planet.updateMatrixWorld(true);
    const hit = ray.intersectObject(this.planet, false)[0];
    if (!hit) return -1;
    const p = this.planet.worldToLocal(hit.point.clone()).normalize();
    let best = Math.cos(REACH * RAD), bi = -1;
    this.zones.forEach((z, i) => { const k = p.dot(dirOf(z.lat, z.lon)); if (k > best) { best = k; bi = i; } });
    return bi;
  }

  private showTip(i: number, cx: number, cy: number): void {
    if (i < 0 || !this.box) { this.tip.classList.remove('on'); return; }
    const z = this.zones[i];
    const lights = this.lightsOf(z.id);
    const lightWord = lights === null ? '' : z.state === 'held' ? 'lights: out' : `lights still burning: ${lights}`;
    this.tip.innerHTML = `<b>${this.hooks.names(z.id)}</b><span class="st ${z.state}">${STATE_WORD[z.state]}</span>${lightWord ? `<i>${lightWord}</i>` : ''}`;
    const r = this.box.getBoundingClientRect();
    this.tip.style.left = `${cx - r.left + 14}px`;
    this.tip.style.top = `${cy - r.top + 12}px`;
    this.tip.classList.add('on');
  }

  private setHover(i: number): void {
    if (i === this.hover) return;
    this.hover = i;
    this.box?.querySelectorAll('.globe .site.hover').forEach((g) => g.classList.remove('hover'));
    if (i >= 0) this.box?.querySelector(`.globe .site[data-site="${this.zones[i].id}"]`)?.classList.add('hover');
    this.start();
  }

  private bind(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId, t: performance.now() };
      this.target = null;
      this.vel = { spin: 0, tilt: 0 };
      this.touch();
      c.setPointerCapture(e.pointerId);
      c.classList.add('grabbing');
    });
    c.addEventListener('pointermove', (e) => {
      if (this.drag && e.pointerId === this.drag.id) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        this.drag.x = e.clientX; this.drag.y = e.clientY;
        this.drag.moved += Math.abs(dx) + Math.abs(dy);
        // Degrees per pixel shrink as it zooms in, so the ground under the hand keeps up with it.
        const k = 0.42 * (this.dist / 4);
        this.spin -= dx * k;
        this.tilt = Math.max(-70, Math.min(70, this.tilt + dy * k));
        // The flick it coasts on: measured on the real time between moves, held to half a turn a second.
        const now = performance.now();
        const dt = Math.max(1 / 120, (now - this.drag.t) / 1000);
        this.drag.t = now;
        const cap = (v: number) => Math.max(-180, Math.min(180, v));
        this.vel = { spin: cap((-dx * k) / dt * 0.6), tilt: cap((dy * k) / dt * 0.6) };
        this.touch();
        this.tip.classList.remove('on');
        this.start();
        return;
      }
      const i = this.zoneAtClient(e.clientX, e.clientY);
      this.setHover(i);
      this.showTip(i, e.clientX, e.clientY);
    });
    const up = (e: PointerEvent) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const click = this.drag.moved < 6;
      // Held still before letting go: no coast.
      if (performance.now() - this.drag.t > 90) this.vel = { spin: 0, tilt: 0 };
      this.drag = null;
      c.classList.remove('grabbing');
      this.touch();
      if (click) {
        this.vel = { spin: 0, tilt: 0 };
        const i = this.zoneAtClient(e.clientX, e.clientY);
        if (i >= 0) this.hooks.pick(this.zones[i].id);
      }
      this.start();
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { if (!this.drag) { this.setHover(-1); this.tip.classList.remove('on'); } });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = Math.max(3.0, Math.min(5.2, this.dist * Math.exp(e.deltaY * 0.0012)));
      this.touch();
      this.start();
    }, { passive: false });
    // Pinch: two pointers on the canvas.
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    c.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    c.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.dist = Math.max(3.0, Math.min(5.2, this.dist * (pinch / d)));
        pinch = d;
        this.drag = null;
      }
    });
    const drop = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
    c.addEventListener('pointerup', drop);
    c.addEventListener('pointercancel', drop);
    // A marker hovered lights its zone too.
    document.addEventListener('pointerover', (e) => {
      const g = (e.target as Element)?.closest?.('.globe .site') as SVGGElement | null;
      if (!g || !this.box?.contains(g)) return;
      const i = this.zones.findIndex((z) => z.id === g.dataset.site);
      this.setHover(i);
      this.touch();
      this.showTip(i, e.clientX, e.clientY);
    });
    document.addEventListener('pointerout', (e) => {
      const g = (e.target as Element)?.closest?.('.globe .site');
      if (g && this.box?.contains(g) && !this.drag) { this.setHover(-1); this.tip.classList.remove('on'); }
    });
    window.addEventListener('keydown', (e) => {
      if (!this.canvas.isConnected || !this.canvas.offsetParent) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') { this.turn(-30); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { this.turn(30); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { this.touch(); this.target = { spin: this.spin, tilt: Math.min(70, this.tilt + 15) }; this.start(); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { this.touch(); this.target = { spin: this.spin, tilt: Math.max(-70, this.tilt - 15) }; this.start(); e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') { this.dist = Math.max(3.0, this.dist / 1.15); this.start(); }
      else if (e.key === '-') { this.dist = Math.min(5.2, this.dist * 1.15); this.start(); }
    });
    window.addEventListener('resize', () => { if (this.canvas.isConnected) { this.resize(); this.start(); } });
  }
}
