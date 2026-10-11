// ═══════════════════════════════════════════════════
//  TRAFFIC INTERSECTION SIMULATION ENGINE
//  Ported from C++/Qt5 original by KimangKhenng
// ═══════════════════════════════════════════════════

// ── Constants (mirroring the C++ defines) ──────────
const ACCER = 0.08;
const MAX_SPEED = 2.2;
const GAP_ACCEPTANCE = 40;
const CANVAS_W = 800;
const CANVAS_H = 600;

// ── Intersection geometry ──────────────────────────
const CX = CANVAS_W / 2;   // 400
const CY = CANVAS_H / 2;   // 300

// Road widths (3 lanes each direction)
const LANE_W = 18;
const ROAD_W = LANE_W * 3;
const HALF_RD = ROAD_W / 2;

// ── Lane offsets from road center ─────────────────
// Vertical road (N<->S): x offsets from CX
// Traffic moves in lanes; 3 lanes per direction
// NS lanes: leftmost lane = CX - HALF_RD + LANE_W*0.5 etc.
// We define lanes as the 3 right-hand lanes for each direction

// ── Enum mirrors ───────────────────────────────────
const DIR = { LEFT_TURNING: 'left', RIGHT_TURNING: 'right', THROUGH: 'through' };
const REGION = { NS: 'NS', SN: 'SN', WE: 'WE', EW: 'EW' };
const PHASE = { GREEN: 'green', LEFT_GREEN: 'left-green', YELLOW: 'yellow', RED: 'red' };

// ─────────────────────────────────────────────────
//  PATH BUILDER  (mirrors VehiclesGenerator.cpp)
//  Returns array of {x,y} waypoints
// ─────────────────────────────────────────────────
function buildPath(region, dir, laneIdx) {
  // laneIdx: 0,1,2 → three lanes per approach
  const pts = [];

  // Helper: interpolate straight line into N points
  function linePts(x1,y1,x2,y2,n=60) {
    const res = [];
    for(let i=0;i<=n;i++) {
      res.push({ x: x1+(x2-x1)*i/n, y: y1+(y2-y1)*i/n });
    }
    return res;
  }
  // Quadratic bezier
  function bezierPts(x1,y1,cx2,cy2,x3,y3,n=50) {
    const res = [];
    for(let i=0;i<=n;i++) {
      const t=i/n, mt=1-t;
      res.push({ x: mt*mt*x1+2*mt*t*cx2+t*t*x3, y: mt*mt*y1+2*mt*t*cy2+t*t*y3 });
    }
    return res;
  }

  // Lane x/y coords (3 lanes, right-hand traffic)
  const nsLanes = [CX - LANE_W*2.5, CX - LANE_W*1.5, CX - LANE_W*0.5]; // N→S approach left to right
  const snLanes = [CX + LANE_W*0.5, CX + LANE_W*1.5, CX + LANE_W*2.5]; // S→N approach
  const weLanes = [CY - LANE_W*2.5, CY - LANE_W*1.5, CY - LANE_W*0.5]; // W→E approach
  const ewLanes = [CY + LANE_W*0.5, CY + LANE_W*1.5, CY + LANE_W*2.5]; // E→W approach

  if (region === REGION.NS) {
    const lx = nsLanes[laneIdx] ?? nsLanes[1];
    const stopY = CY - HALF_RD - 2;
    // Approach
    pts.push(...linePts(lx, -20, lx, stopY));
    if (dir === DIR.THROUGH) {
      pts.push(...linePts(lx, stopY, lx, CANVAS_H+20));
    } else if (dir === DIR.LEFT_TURNING) {
      pts.push(...bezierPts(lx, stopY, lx, CY, CX-HALF_RD-30, CY));
      pts.push(...linePts(CX-HALF_RD-30, CY, -20, CY));
    } else { // right turn
      pts.push(...bezierPts(lx, stopY, lx, CY, CX+HALF_RD+30, CY));
      pts.push(...linePts(CX+HALF_RD+30, CY, CANVAS_W+20, CY));
    }
  } else if (region === REGION.SN) {
    const lx = snLanes[laneIdx] ?? snLanes[1];
    const stopY = CY + HALF_RD + 2;
    pts.push(...linePts(lx, CANVAS_H+20, lx, stopY));
    if (dir === DIR.THROUGH) {
      pts.push(...linePts(lx, stopY, lx, -20));
    } else if (dir === DIR.LEFT_TURNING) {
      pts.push(...bezierPts(lx, stopY, lx, CY, CX+HALF_RD+30, CY));
      pts.push(...linePts(CX+HALF_RD+30, CY, CANVAS_W+20, CY));
    } else {
      pts.push(...bezierPts(lx, stopY, lx, CY, CX-HALF_RD-30, CY));
      pts.push(...linePts(CX-HALF_RD-30, CY, -20, CY));
    }
  } else if (region === REGION.WE) {
    const ly = weLanes[laneIdx] ?? weLanes[1];
    const stopX = CX - HALF_RD - 2;
    pts.push(...linePts(-20, ly, stopX, ly));
    if (dir === DIR.THROUGH) {
      pts.push(...linePts(stopX, ly, CANVAS_W+20, ly));
    } else if (dir === DIR.LEFT_TURNING) {
      pts.push(...bezierPts(stopX, ly, CX, ly, CX, CY-HALF_RD-30));
      pts.push(...linePts(CX, CY-HALF_RD-30, CX, -20));
    } else {
      pts.push(...bezierPts(stopX, ly, CX, ly, CX, CY+HALF_RD+30));
      pts.push(...linePts(CX, CY+HALF_RD+30, CX, CANVAS_H+20));
    }
  } else { // EW
    const ly = ewLanes[laneIdx] ?? ewLanes[1];
    const stopX = CX + HALF_RD + 2;
    pts.push(...linePts(CANVAS_W+20, ly, stopX, ly));
    if (dir === DIR.THROUGH) {
      pts.push(...linePts(stopX, ly, -20, ly));
    } else if (dir === DIR.LEFT_TURNING) {
      pts.push(...bezierPts(stopX, ly, CX, ly, CX, CY+HALF_RD+30));
      pts.push(...linePts(CX, CY+HALF_RD+30, CX, CANVAS_H+20));
    } else {
      pts.push(...bezierPts(stopX, ly, CX, ly, CX, CY-HALF_RD-30));
      pts.push(...linePts(CX, CY-HALF_RD-30, CX, -20));
    }
  }
  return pts;
}

// Stop point index (vehicles brake here if red)
// Approach is ~60 pts, stop zone is around index 57-62
const STOP_PT_START = 57;
const STOP_PT_END   = 64;
const INSIDE_JUNC_START = 65;
const INSIDE_JUNC_END   = 80;

// ─────────────────────────────────────────────────
//  VEHICLE CLASS
// ─────────────────────────────────────────────────
let _vehicleId = 0;
const CAR_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e','#06b6d4',
  '#6366f1','#ec4899','#14b8a6','#f59e0b','#8b5cf6',
  '#10b981','#3b82f6','#e11d48','#7c3aed','#0891b2'
];

class Vehicle {
  constructor(region, dir, laneIdx, sightseeing=true, lightsOn=true) {
    this.id = _vehicleId++;
    this.region = region;
    this.dir = dir;
    this.laneIdx = laneIdx;
    this.sightseeing = sightseeing;
    this.lightsOn = lightsOn;

    this.path = buildPath(region, dir, laneIdx);
    this.ptIdx = 0;
    this.speed = 0;
    this.accel = ACCER;
    this.deletable = false;
    this.leader = null;
    this.color = CAR_COLORS[this.id % CAR_COLORS.length];
    this.width = 18;
    this.height = 10;
    this.showVision = false;
    this.showPath = false;

    // Initial position
    if (this.path.length > 0) {
      this.x = this.path[0].x;
      this.y = this.path[0].y;
    }
    this.angle = 0;
  }

  get isInStopZone() {
    return this.ptIdx > STOP_PT_START && this.ptIdx < STOP_PT_END;
  }
  get isInsideIntersection() {
    return this.ptIdx > INSIDE_JUNC_START && this.ptIdx < INSIDE_JUNC_END;
  }
  get destPt() {
    return this.path[this.ptIdx] ?? null;
  }
  getSpeed() { return this.speed; }

  distanceTo(other) {
    const dx = other.x - this.x, dy = other.y - this.y;
    return Math.sqrt(dx*dx + dy*dy);
  }

  accelerate(leader) {
    if (leader) {
      const d = this.distanceTo(leader);
      if (d > 0) {
        this.accel = 3 * (leader.speed - this.speed) / d;
      }
    } else {
      this.accel = ACCER;
    }
    this.speed = Math.min(this.speed + this.accel, MAX_SPEED);
    if (this.speed < 0) this.speed = 0;
  }

  update(lights, vehicles) {
    if (this.ptIdx >= this.path.length) { this.deletable = true; return; }

    // Traffic light stop
    if (this.isInStopZone && this.lightsOn) {
      const light = lights.get(this.region);
      if (light && !light.isAllowed(this.dir)) {
        this.speed = 0;
        return;
      }
    }

    // Sightseeing collision avoidance
    if (this.sightseeing) {
      this.leader = this._findLeader(vehicles);
      if (this.leader) {
        const d = this.distanceTo(this.leader);
        if (d < LANE_W * 1.5) { // too close — full stop
          this.speed = 0;
          return;
        }
        this.accelerate(this.leader);
      } else {
        this.leader = null;
        this.accelerate(null);
      }
    } else {
      this.leader = null;
      this.accelerate(null);
    }

    // Move toward current waypoint
    const dest = this.destPt;
    if (!dest) { this.deletable = true; return; }
    const dx = dest.x - this.x, dy = dest.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist <= this.speed + 0.5) {
      this.ptIdx++;
      if (this.ptIdx >= this.path.length) { this.deletable = true; return; }
      const nd = this.path[this.ptIdx];
      this.angle = Math.atan2(nd.y - this.y, nd.x - this.x);
    } else {
      this.angle = Math.atan2(dy, dx);
      this.x += Math.cos(this.angle) * this.speed;
      this.y += Math.sin(this.angle) * this.speed;
    }
  }

  _findLeader(vehicles) {
    // Find closest vehicle in the same region/path ahead that is within sight range
    let closest = null, minD = GAP_ACCEPTANCE;
    for (const v of vehicles) {
      if (v === this || v.deletable) continue;
      // Same region, and further along path
      if (v.region !== this.region) continue;
      if (v.ptIdx <= this.ptIdx) continue;
      const d = this.distanceTo(v);
      if (d < minD) { minD = d; closest = v; }
    }
    return closest;
  }

  draw(ctx, showVision, showPath) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Car body
    const w = this.width, h = this.height;
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, 3);
    ctx.fillStyle = this.color;
    ctx.fill();

    // Windshield
    ctx.beginPath();
    ctx.roundRect(w/2-6, -h/2+2, 5, h-4, 1);
    ctx.fillStyle = 'rgba(200,230,255,0.5)';
    ctx.fill();

    // Headlights
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath(); ctx.arc(w/2-1, -h/4, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w/2-1,  h/4, 1.5, 0, Math.PI*2); ctx.fill();

    ctx.restore();

    // Vision cone
    if (showVision && this.sightseeing) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.strokeStyle = this.leader ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.3)';
      ctx.strokeRect(this.width/2, -5, GAP_ACCEPTANCE, 10);
      ctx.restore();
    }

    // Path
    if (showPath && this.path.length > this.ptIdx) {
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(99,102,241,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      for (let i = this.ptIdx; i < this.path.length; i += 4) {
        ctx.lineTo(this.path[i].x, this.path[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ─────────────────────────────────────────────────
//  TRAFFIC LIGHT STATE MACHINE
//  Mirrors the Qt state machine in trafficlight.cpp
//  Phase sequence: MainGreen → LeftGreen → Yellow → Red → Yellow → MainGreen
// ─────────────────────────────────────────────────
class TrafficLight {
  constructor(region, { greenDur, leftDur, yellowDur, redDur }, initialPhase='GREEN') {
    this.region = region;
    this.greenDur  = greenDur  * 1000;
    this.leftDur   = leftDur   * 1000;
    this.yellowDur = yellowDur * 1000;
    this.redDur    = redDur    * 1000;

    // Phase sequence
    this.phases = [
      { name: PHASE.GREEN,       dur: () => this.greenDur  },
      { name: PHASE.LEFT_GREEN,  dur: () => this.leftDur   },
      { name: PHASE.YELLOW,      dur: () => this.yellowDur },
      { name: PHASE.RED,         dur: () => this.redDur    },
      { name: PHASE.YELLOW,      dur: () => this.yellowDur },
    ];
    // NS/SN start green, WE/EW start red (offset)
    this.phaseIdx = (region === REGION.WE || region === REGION.EW) ? 3 : 0;
    this.phaseElapsed = 0;
    this.enabled = true;
  }

  get phase() { return this.phases[this.phaseIdx].name; }

  get phaseTimeLeft() {
    return Math.max(0, this.phases[this.phaseIdx].dur() - this.phaseElapsed);
  }

  isAllowed(dir) {
    if (!this.enabled) return true;
    switch (dir) {
      case DIR.LEFT_TURNING:  return this.phase === PHASE.LEFT_GREEN;
      case DIR.RIGHT_TURNING: return this.phase === PHASE.GREEN;
      case DIR.THROUGH:       return this.phase === PHASE.GREEN;
      default: return false;
    }
  }

  update(dtMs) {
    if (!this.enabled) return;
    this.phaseElapsed += dtMs;
    if (this.phaseElapsed >= this.phases[this.phaseIdx].dur()) {
      this.phaseElapsed -= this.phases[this.phaseIdx].dur();
      this.phaseIdx = (this.phaseIdx + 1) % this.phases.length;
    }
  }
}

// ─────────────────────────────────────────────────
//  VEHICLE GENERATOR  (mirrors Generator.cpp)
// ─────────────────────────────────────────────────
class Generator {
  constructor(sim, config) {
    this.sim = sim;
    this.config = config;
    this.timers = { NS:0, SN:0, WE:0, EW:0 };
    this.running = false;
  }

  update(dtMs, speedMult) {
    if (!this.running) return;
    const dt = dtMs * speedMult;
    for (const reg of [REGION.NS, REGION.SN, REGION.WE, REGION.EW]) {
      this.timers[reg] += dt;
      const interval = this._rateFor(reg) * 1000;
      if (this.timers[reg] >= interval) {
        this.timers[reg] = 0;
        this._spawn(reg);
      }
    }
  }

  _rateFor(reg) {
    switch(reg) {
      case REGION.NS: return this.config.rateNS;
      case REGION.SN: return this.config.rateSN;
      case REGION.WE: return this.config.rateWE;
      case REGION.EW: return this.config.rateEW;
    }
  }

  _spawn(reg) {
    const m = this.config.genMethod;
    let dir, lane;
    if (m === 'NO_TURN') {
      dir = DIR.THROUGH;
      lane = Math.floor(Math.random()*3);
    } else if (m === 'ONLY_TURN') {
      dir = Math.random()<0.5 ? DIR.LEFT_TURNING : DIR.RIGHT_TURNING;
      lane = 0;
    } else if (m === 'GEN_3') {
      const r = Math.floor(Math.random()*3);
      dir = [DIR.RIGHT_TURNING, DIR.THROUGH, DIR.LEFT_TURNING][r];
      lane = Math.floor(Math.random()*3);
    } else { // GEN_5
      const r = Math.floor(Math.random()*5);
      dir = [DIR.RIGHT_TURNING, DIR.THROUGH, DIR.THROUGH, DIR.THROUGH, DIR.LEFT_TURNING][r];
      lane = Math.floor(Math.random()*3);
    }
    const v = new Vehicle(reg, dir, lane, this.config.sightseeing, this.config.lightsOn);
    v.showVision = this.sim.showVision;
    v.showPath   = this.sim.showPath;
    this.sim.addVehicle(v);
  }

  start()  { this.running = true; }
  stop()   { this.running = false; }
  reset()  { this.timers = { NS:0, SN:0, WE:0, EW:0 }; }
}

// ─────────────────────────────────────────────────
//  METRICS COLLECTOR
// ─────────────────────────────────────────────────
class Metrics {
  constructor() {
    this.totalVehicles = 0;
    this.activeVehicles = 0;
    this.queuedVehicles = 0;
    this.throughput = 0;      // vehicles completed in last minute
    this._completedLog = [];  // timestamps of completions
    this.congestion = 0;
    this.elapsed = 0;         // ms
    this.history = { vehicles:[], congestion:[], throughput:[] };
    this._lastHistoryPush = 0;
  }

  recordCompletion() {
    this._completedLog.push(Date.now());
  }

  update(vehicles, dtMs) {
    this.elapsed += dtMs;
    // prune old completions
    const now = Date.now();
    this._completedLog = this._completedLog.filter(t => now - t < 60000);
    this.throughput = this._completedLog.length;

    this.totalVehicles  = vehicles.length;
    this.activeVehicles = vehicles.filter(v => v.speed > 0.05).length;
    this.queuedVehicles = this.totalVehicles - this.activeVehicles;
    this.congestion = this.totalVehicles > 0
      ? this.queuedVehicles / this.totalVehicles : 0;

    // History every ~2s
    this._lastHistoryPush += dtMs;
    if (this._lastHistoryPush > 2000) {
      this._lastHistoryPush = 0;
      const MAX_H = 30;
      if (this.history.vehicles.length >= MAX_H) {
        this.history.vehicles.shift();
        this.history.congestion.shift();
        this.history.throughput.shift();
      }
      this.history.vehicles.push(this.totalVehicles);
      this.history.congestion.push(+(this.congestion*100).toFixed(1));
      this.history.throughput.push(this.throughput);
    }
  }
}

// ─────────────────────────────────────────────────
//  SIMULATION CORE
// ─────────────────────────────────────────────────
class Simulation {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.config = config;
    this.state  = 'stopped'; // running | paused | stopped
    this.speedMult = 1;

    this.vehicles = [];
    this.lights = new Map();
    this.generator = null;
    this.metrics = new Metrics();

    this.showVision = false;
    this.showPath   = false;

    this._lastTime = 0;
    this._rafId = null;
    this._resize();
  }

  _resize() {
    const wrap = this.canvas.parentElement;
    const ratio = window.devicePixelRatio || 1;
    const aw = wrap.clientWidth, ah = wrap.clientHeight;
    const scale = Math.min(aw/CANVAS_W, ah/CANVAS_H);
    this.canvas.width  = CANVAS_W * ratio;
    this.canvas.height = CANVAS_H * ratio;
    this.canvas.style.width  = (CANVAS_W * scale) + 'px';
    this.canvas.style.height = (CANVAS_H * scale) + 'px';
    this.ctx.scale(ratio, ratio);
    this._scale = scale;
  }

  init(config) {
    this.config = { ...this.config, ...config };
    this.vehicles = [];
    this.metrics = new Metrics();

    // Create 4 traffic lights, offset so NS/SN are opposite to WE/EW
    const ld = { greenDur: this.config.greenDuration, leftDur: this.config.leftDuration, yellowDur: this.config.yellowDuration, redDur: this.config.redDuration };
    this.lights = new Map([
      [REGION.NS, new TrafficLight(REGION.NS, ld, 'GREEN')],
      [REGION.SN, new TrafficLight(REGION.SN, ld, 'GREEN')],
      [REGION.WE, new TrafficLight(REGION.WE, ld, 'RED')],
      [REGION.EW, new TrafficLight(REGION.EW, ld, 'RED')],
    ]);
    // NS/SN green, WE/EW red — already done by phaseIdx in constructor

    this.generator = new Generator(this, this.config);
    this.generator.start();
  }

  addVehicle(v) { this.vehicles.push(v); }

  start(config) {
    this.init(config ?? this.config);
    this.state = 'running';
    this._lastTime = performance.now();
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._loop();
  }

  pause() {
    this.state = 'paused';
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this._lastTime = performance.now();
    this._loop();
  }

  stop() {
    this.state = 'stopped';
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    this.vehicles = [];
    this.generator?.stop();
  }

  updateConfig(partial) {
    this.config = { ...this.config, ...partial };
    if (this.generator) this.generator.config = this.config;
    if (partial.lightsOn !== undefined) {
      this.lights.forEach(l => l.enabled = partial.lightsOn);
    }
    if (['greenDuration','leftDuration','yellowDuration','redDuration'].some(k => k in partial)) {
      this.lights.forEach(l => {
        l.greenDur  = this.config.greenDuration  * 1000;
        l.leftDur   = this.config.leftDuration   * 1000;
        l.yellowDur = this.config.yellowDuration * 1000;
        l.redDur    = this.config.redDuration    * 1000;
      });
    }
    if (partial.sightseeing !== undefined) {
      this.vehicles.forEach(v => v.sightseeing = partial.sightseeing);
    }
  }

  _loop() {
    this._rafId = requestAnimationFrame(ts => {
      const rawDt = Math.min(ts - this._lastTime, 50); // cap at 50ms
      this._lastTime = ts;
      const dt = rawDt * this.speedMult;

      // Update traffic lights
      this.lights.forEach(l => l.update(dt));

      // Update vehicles
      this.vehicles.forEach(v => {
        v.update(this.lights, this.vehicles);
        v.showVision = this.showVision;
        v.showPath   = this.showPath;
      });

      // Remove completed + record throughput
      this.vehicles = this.vehicles.filter(v => {
        if (v.deletable) { this.metrics.recordCompletion(); return false; }
        return true;
      });

      // Spawn
      this.generator?.update(rawDt, this.speedMult);

      // Metrics
      this.metrics.update(this.vehicles, rawDt);

      // Draw
      this._draw();

      if (this.state === 'running') this._loop();
    });
  }

  // ─────────────────────────────────────────
  //  RENDERER
  // ─────────────────────────────────────────
  _draw() {
    const ctx = this.ctx;
    const W = CANVAS_W, H = CANVAS_H;

    // Background
    ctx.fillStyle = '#1a2332';
    ctx.fillRect(0, 0, W, H);

    this._drawRoad(ctx, W, H);
    this._drawMarkings(ctx, W, H);
    this._drawTrafficLights(ctx);
    this.vehicles.forEach(v => v.draw(ctx, this.showVision, this.showPath));
  }

  _drawRoad(ctx, W, H) {
    // Side grass/pavement
    ctx.fillStyle = '#1e3a1e';
    ctx.fillRect(0, 0, W, H);

    // Road asphalt — vertical strip
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(CX - HALF_RD, 0, ROAD_W, H);
    // Road asphalt — horizontal strip
    ctx.fillRect(0, CY - HALF_RD, W, ROAD_W);

    // Intersection box
    ctx.fillStyle = '#374151';
    ctx.fillRect(CX - HALF_RD, CY - HALF_RD, ROAD_W, ROAD_W);

    // Sidewalks / kerb
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    // Vertical kerbs
    ctx.beginPath();
    ctx.moveTo(CX - HALF_RD, 0); ctx.lineTo(CX - HALF_RD, CY - HALF_RD);
    ctx.moveTo(CX + HALF_RD, 0); ctx.lineTo(CX + HALF_RD, CY - HALF_RD);
    ctx.moveTo(CX - HALF_RD, CY + HALF_RD); ctx.lineTo(CX - HALF_RD, H);
    ctx.moveTo(CX + HALF_RD, CY + HALF_RD); ctx.lineTo(CX + HALF_RD, H);
    // Horizontal kerbs
    ctx.moveTo(0, CY - HALF_RD); ctx.lineTo(CX - HALF_RD, CY - HALF_RD);
    ctx.moveTo(0, CY + HALF_RD); ctx.lineTo(CX - HALF_RD, CY + HALF_RD);
    ctx.moveTo(CX + HALF_RD, CY - HALF_RD); ctx.lineTo(W, CY - HALF_RD);
    ctx.moveTo(CX + HALF_RD, CY + HALF_RD); ctx.lineTo(W, CY + HALF_RD);
    ctx.stroke();

    // Zebra crossings (pedestrian)
    this._drawZebra(ctx);
  }

  _drawZebra(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    const stripeW = 6, stripes = 4, zLen = ROAD_W;
    // North crossing
    for(let i=0;i<stripes;i++) {
      ctx.fillRect(CX-HALF_RD+i*(zLen/stripes)+2, CY-HALF_RD-14, zLen/stripes-4, 10);
    }
    // South crossing
    for(let i=0;i<stripes;i++) {
      ctx.fillRect(CX-HALF_RD+i*(zLen/stripes)+2, CY+HALF_RD+4,  zLen/stripes-4, 10);
    }
    // West crossing
    for(let i=0;i<stripes;i++) {
      ctx.fillRect(CX-HALF_RD-14, CY-HALF_RD+i*(zLen/stripes)+2, 10, zLen/stripes-4);
    }
    // East crossing
    for(let i=0;i<stripes;i++) {
      ctx.fillRect(CX+HALF_RD+4,  CY-HALF_RD+i*(zLen/stripes)+2, 10, zLen/stripes-4);
    }
  }

  _drawMarkings(ctx, W, H) {
    ctx.setLineDash([14, 10]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';

    // Lane dividers — vertical road (3 lanes each direction)
    const nsLaneBounds = [CX - HALF_RD, CX - LANE_W, CX, CX + LANE_W, CX + HALF_RD];
    nsLaneBounds.slice(1,-1).forEach(lx => {
      // Skip in intersection
      ctx.beginPath();
      ctx.moveTo(lx, 0);      ctx.lineTo(lx, CY - HALF_RD - 2);
      ctx.moveTo(lx, CY + HALF_RD + 2); ctx.lineTo(lx, H);
      ctx.stroke();
    });
    // Centre divider — double yellow
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(234,179,8,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CX-1, 0);      ctx.lineTo(CX-1, CY-HALF_RD);
    ctx.moveTo(CX-1, CY+HALF_RD); ctx.lineTo(CX-1, H);
    ctx.moveTo(CX+1, 0);      ctx.lineTo(CX+1, CY-HALF_RD);
    ctx.moveTo(CX+1, CY+HALF_RD); ctx.lineTo(CX+1, H);
    ctx.stroke();

    // Lane dividers — horizontal road
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    const weLaneBounds = [CY - HALF_RD, CY - LANE_W, CY, CY + LANE_W, CY + HALF_RD];
    weLaneBounds.slice(1,-1).forEach(ly => {
      ctx.beginPath();
      ctx.moveTo(0, ly);      ctx.lineTo(CX-HALF_RD-2, ly);
      ctx.moveTo(CX+HALF_RD+2, ly); ctx.lineTo(W, ly);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(234,179,8,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, CY-1);       ctx.lineTo(CX-HALF_RD, CY-1);
    ctx.moveTo(CX+HALF_RD, CY-1); ctx.lineTo(W, CY-1);
    ctx.moveTo(0, CY+1);       ctx.lineTo(CX-HALF_RD, CY+1);
    ctx.moveTo(CX+HALF_RD, CY+1); ctx.lineTo(W, CY+1);
    ctx.stroke();
    ctx.setLineDash([]);

    // Direction arrows
    this._drawArrows(ctx);
  }

  _drawArrows(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    const drawArrow = (x, y, angle) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(4, 0); ctx.lineTo(2, 0);
      ctx.lineTo(2, 7);  ctx.lineTo(-2, 7); ctx.lineTo(-2, 0);
      ctx.lineTo(-4, 0); ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    // NS arrows (pointing down) at y=120
    drawArrow(CX - LANE_W*2, 120, Math.PI/2);
    drawArrow(CX - LANE_W,   120, Math.PI/2);
    drawArrow(CX,             120, Math.PI/2);
    // SN arrows (pointing up) at y=H-120
    drawArrow(CX + LANE_W*0, CANVAS_H-120, -Math.PI/2);
    drawArrow(CX + LANE_W,   CANVAS_H-120, -Math.PI/2);
    drawArrow(CX + LANE_W*2, CANVAS_H-120, -Math.PI/2);
    // WE arrows (pointing right) at x=120
    drawArrow(120, CY - LANE_W*2, 0);
    drawArrow(120, CY - LANE_W,   0);
    drawArrow(120, CY,             0);
    // EW arrows (pointing left) at x=W-120
    drawArrow(CANVAS_W-120, CY+LANE_W*0, Math.PI);
    drawArrow(CANVAS_W-120, CY+LANE_W,   Math.PI);
    drawArrow(CANVAS_W-120, CY+LANE_W*2, Math.PI);
  }

  _drawTrafficLights(ctx) {
    const specs = [
      { reg: REGION.NS, x: CX - HALF_RD - 18, y: CY - HALF_RD - 18 },
      { reg: REGION.SN, x: CX + HALF_RD + 4,  y: CY + HALF_RD + 4  },
      { reg: REGION.WE, x: CX - HALF_RD - 18, y: CY + HALF_RD + 4  },
      { reg: REGION.EW, x: CX + HALF_RD + 4,  y: CY - HALF_RD - 18 },
    ];
    specs.forEach(({ reg, x, y }) => {
      const light = this.lights.get(reg);
      if (!light) return;
      const phase = light.enabled ? light.phase : null;

      // Housing
      ctx.fillStyle = '#1f2937';
      ctx.beginPath(); ctx.roundRect(x, y, 14, 14, 3); ctx.fill();

      // Bulb
      const colMap = {
        [PHASE.GREEN]:      '#22c55e',
        [PHASE.LEFT_GREEN]: '#06b6d4',
        [PHASE.YELLOW]:     '#eab308',
        [PHASE.RED]:        '#ef4444',
      };
      const col = phase ? colMap[phase] : '#374151';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x+7, y+7, 5, 0, Math.PI*2); ctx.fill();
      if (phase) {
        ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });
  }
}

// ── Export to global ──────────────────────────────
window.Simulation = Simulation;
window.REGION = REGION;
window.PHASE  = PHASE;
