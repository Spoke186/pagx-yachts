import type { createClock } from '@pagx/motion'

// Hero water physics (#82). The Kling loop holds the yacht on one pixel and its wake starts at a hard line on the
// transom, so the boat reads as pasted on. This pass draws the video through a shader that lets the hull ride the swell
// (pitch, roll, heave), drifts the drone, ripples the water around the hull, casts the hull's shadow, and boils foam
// out of the transom and off the bow; along the sides the video's own foam is set flowing. Hull geometry is measured on each render, in video pixels.
const HULL = {
  d: { stern: [960, 541], bow: [1796, 518], beam: 96 },  // hero-d.mp4, 1920×1080, bow to the right
  m: { stern: [360, 590], bow: [360, 125], beam: 62 },   // hero-m.mp4, 720×1280, bow up
}

const VERT = `#version 300 es
in vec2 p; out vec2 vUv;
void main() { vUv = p * .5 + .5; gl_Position = vec4(p, 0, 1); }`

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uV;
uniform vec2 uRes, uVid, uA, uB;
uniform float uT, uW, uQ;
in vec2 vUv; out vec4 o;

float h(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int k = 0; k < 4; k++) { s += a * n(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 tex(vec2 px) { return texture(uV, clamp(px / uVid, 0., 1.)).rgb; }

void main() {
  float t = uT;
  // screen to video pixels (cover, 3% overscan so the drift never shows an edge), then the drone drifts
  vec2 frag = vec2(vUv.x, 1. - vUv.y) * uRes;
  float sc = max(uRes.x / uVid.x, uRes.y / uVid.y) * 1.03;
  vec2 c = uVid * .5;
  vec2 p = (frag - uRes * .5) / sc + c;
  p += vec2(sin(t * .23) * 6., sin(t * .17 + 1.) * 4.);
  p = c + rot(sin(t * .13) * .003) * (p - c);

  // hull frame: s runs 0 at the transom to 1 at the stem, l is the distance off the centreline in half-beams
  vec2 ax = uB - uA; float L = length(ax); vec2 d = ax / L, nn = vec2(-d.y, d.x);
  vec2 q = p - uA; float X = dot(q, d), Y = dot(q, nn), s = X / L, l = Y / uW;
  float w = s < .72 ? 1. : sqrt(max(0., 1. - pow((s - .72) / .28, 2.)));
  float out_ = max((abs(l) - w) * uW, max(-X, X - L));
  float hull = 1. - smoothstep(-1.5, 1.5, out_);

  // the hull rides the swell: roll and pitch about its middle, a little heave
  vec2 hc = uA + ax * .5;
  float roll = sin(t * 1.1) * .0035 + sin(t * .63) * .002;
  vec2 ph = hc + rot(roll) * (p - hc) / (1. + sin(t * .8 + .5) * .004);

  // water streams aft past the hull; ripples get stronger close to it
  float V = L * .45;
  vec2 fl = vec2(X + t * V, Y);
  float near = exp(-max(abs(l) - w, 0.) * 1.3) * smoothstep(-.6, 0., s);
  vec2 dsp = (vec2(fbm(fl / 26.), fbm(fl / 26. + 7.3)) - .5) * (2. + 7. * near) * uQ;
  vec3 col = mix(tex(p + dsp), tex(ph), hull);

  // the hull's shadow on the water, down-sun
  float sh = step(0., l) * (1. - smoothstep(0., .45, l - w)) * smoothstep(-.02, .12, s) * smoothstep(1.02, .8, s);
  col *= 1. - .32 * sh * (1. - hull);

  // foam: boiling out of the transom (over its edge, to hide the hard line) and peeling off the bow
  float spread = 1.05 + max(-s, 0.) * 1.4;
  float churn = smoothstep(-.5, -.02, s) * (1. - smoothstep(-.004, .014, s)) * (1. - smoothstep(spread * .5, spread, abs(l)));
  float bow = smoothstep(.04, .2, abs(l) - w) * (1. - smoothstep(.2, .7, abs(l) - w)) * smoothstep(.6, .76, s) * smoothstep(.98, .84, s) * .7;
  float dens = max(churn, bow) * (1. - hull * step(.014, s));
  if (dens > .001) {
    vec2 P = fl / (uW * .2);
    P += (vec2(fbm(P * .5 + t * .4), fbm(P * .5 - t * .3 + 3.1)) - .5) * 2.2;
    float lace = 1. - abs(2. * fbm(P) - 1.);
    float v = lace * lace * .7 + fbm(P * 2.6 + 5.) * .45;
    float foam = smoothstep(.72 - .5 * dens, 1.05 - .4 * dens, v) * smoothstep(0., .2, dens);
    col = mix(col, vec3(.36, .62, .7), dens * .18 * (1. - hull));
    col = mix(col, mix(vec3(.8, .88, .93), vec3(.96, .97, .98), v), foam * .85);
  }
  o = vec4(col, 1);
}`

type Clock = NonNullable<ReturnType<typeof createClock>>

export function wake(v: HTMLVideoElement, portrait: boolean, clock: Clock, quality: 1 | 0) {
  const cv = document.createElement('canvas')
  cv.className = 'hero-gl'
  cv.setAttribute('aria-hidden', 'true')
  const gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' })
  if (!gl) return
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s }
  const pr = gl.createProgram()!
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT))
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(pr)
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return
  gl.useProgram(pr)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const u = (k: string) => gl.getUniformLocation(pr, k)
  const hull = portrait ? HULL.m : HULL.d
  gl.uniform2fv(u('uA'), hull.stern)
  gl.uniform2fv(u('uB'), hull.bow)
  gl.uniform1f(u('uW'), hull.beam)
  gl.uniform1f(u('uQ'), quality)
  const uRes = u('uRes'), uVid = u('uVid'), uT = u('uT')

  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, quality ? 1.5 : 1)
    cv.width = Math.round(cv.clientWidth * dpr)
    cv.height = Math.round(cv.clientHeight * dpr)
    gl.viewport(0, 0, cv.width, cv.height)
    gl.uniform2f(uRes, cv.width, cv.height)
  }
  v.after(cv)
  addEventListener('resize', size)
  size()

  let fresh = true, shown = false
  const onFrame = () => { fresh = true; v.requestVideoFrameCallback?.(onFrame) }
  if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(onFrame)
  clock.add((ms) => {
    if (v.paused || v.readyState < 2) return
    if (fresh || !('requestVideoFrameCallback' in v)) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v)
      gl.uniform2f(uVid, v.videoWidth, v.videoHeight)
      fresh = false
    }
    gl.uniform1f(uT, ms / 1000)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    if (!shown) { shown = true; cv.classList.add('on') }
  })
}
