// The simulator: «Мобильная платформа 3» on a mat with a black line, behind sim.hw, which is all the VM ever touches.
// The mat's canvas is both the picture on the floor and what the colour sensor reads. Time is simulated: fixed steps, one per
// browser task, and the program gets its turn once after each, so the same blocks drive the same path on a fast and a slow computer.
(function () {
  const RA = window.RA;
  const T = THREE;
  const clamp = T.MathUtils.clamp;
  const DEG = Math.PI / 180;
  const wrap = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;

  /* ---------- Numbers to tune ---------- */
  const STEP = 0.01;                  // s of simulated time per physics step; the real sensor also measures 100 times a second
  const MAX_LAG = 0.1;                // s of real time: a page further behind than this slows the clock down instead of jumping
  const SPEED_100 = { C: 1110, D: 1110, E: 1050 };   // °/s at 100 %: the medium motors on C and D, the large one on E (SPIKE's Python reference)
  // A real robot lags because of its motors: a command reaches the wheel after MOTOR_DELAY, and the wheel's speed then changes
  // no faster than MOTOR_ACCEL. Without that a zigzag program glides along the edge like no real robot does.
  // shortcut: both are chosen so that the zigzag swings the lens about a centimetre and a stop from 30 % takes about a centimetre;
  // measure a real platform to replace them.
  const MOTOR_DELAY = 0.03;           // s
  const MOTOR_ACCEL = 4000;           // °/s²
  const CM = 1.25;                    // modules in a centimetre: a module is 8 mm
  const MAT_W = 120, MAT_H = 80;      // cm
  const PX = 20;                      // canvas pixels per centimetre of mat
  const LINE = 2;                     // cm: black electrical tape
  const SPOT = 1.2;                   // cm across: the patch of floor the sensor sees
  // shortcut: our own numbers, LEGO publishes none. White paper reads 95 %, black tape 5 %, anything else by its brightness in the
  // picture; a surface without colour is «чёрный» below DARK % and «белый» from it. Measure the club's mat to replace them.
  const WHITE_PCT = 95, BLACK_PCT = 5, DARK = 50;
  const CHROMA = 60;                  // of 255: from this difference between the colour channels the sensor names a colour
  const LOST_DIST = 5, LOST_TIME = 2; // the line is lost when the lens has been further than this (cm) from it for this long (s)
  const AHEAD = 20;                   // cm: how far along the line the lens may jump forward and still count as following it
  const TURN_FLIP = 15;               // °/s: «виляние» counts a swing only when the robot really turns the other way
  const STILL = 0.3;                  // s without wheel movement before the robot counts as standing
  const TRAIL_STEP = 0.3, TRAIL_W = 0.3, TRAIL_MAX = 8000;   // cm between trail points, cm wide, pieces kept
  const FOLLOW = { dir: [0.25, 0.8, 0.75], dist: 100, ease: 5 };   // the camera behind the robot: direction, modules, 1/s
  const WHOLE = [0, 1, 0.62];         // the camera over the whole mat: from above, leaning towards the viewer
  const NUDGE = 15;                   // ° per press of a turn button
  const SCROLL = 0.09;                // s per column of scrolling text on the hub

  const PAPER = '#ffffff', INK = '#16151a', GREY = '#70777d', FLOOR = '#9ba3a9', MARK = '#00adc4';
  // What the «цвет» mode can answer on these mats, with SPIKE's codes.
  const COLORS = [
    { code: 0, name: 'чёрный', css: INK }, { code: 10, name: 'белый', css: PAPER }, { code: 9, name: 'красный', css: '#e2342b' },
    { code: 7, name: 'жёлтый', css: '#fed920' }, { code: 5, name: 'зелёный', css: '#1f9d55' }, { code: 3, name: 'синий', css: '#1e6fd9' },
  ];
  const rgb = (css) => [1, 3, 5].map((i) => parseInt(css.slice(i, i + 2), 16));
  const hue = ([r, g, b]) => {
    const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    return d ? 60 * (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) : 0;
  };
  const luma = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const HUES = COLORS.slice(2).map((c) => [hue(rgb(c.css)), c]);
  const FLOOR_RGB = rgb(FLOOR), INK_LUMA = luma(rgb(INK));

  /* ---------- Mats ---------- */
  // A line is laid like a turtle walks: from a point and a heading, straight pieces ['s', cm] and arcs ['a', radius, degrees],
  // left turns positive. Returns its middle as points about half a centimetre apart.
  const trace = ([x, z, deg], pieces) => {
    const pts = [x, z];
    let h = deg * DEG;
    pieces.forEach(([kind, a, b]) => {
      const len = kind === 's' ? a : Math.abs(b) * DEG * a, n = Math.ceil(len / 0.5), turn = kind === 's' ? 0 : (b * DEG) / n;
      const d = turn ? 2 * a * Math.sin(Math.abs(turn) / 2) : len / n;      // the chord of one small step
      for (let i = 0; i < n; i++) {
        h += turn / 2;
        x += d * Math.cos(h);
        z -= d * Math.sin(h);
        h += turn / 2;
        pts.push(x, z);
      }
    });
    return pts;
  };
  const band = (g, css, x0, x1, half) => { g.fillStyle = css; g.fillRect(x0, -half, x1 - x0, half * 2); };
  const label = (g, text, x, z) => { g.fillStyle = '#9fb0ba'; g.font = '700 2.2px Arial, sans-serif'; g.fillText(text, x, z); };
  const S2 = Math.acos(1 - 36 / 40) / DEG;      // «Трасса 2»: two arcs of radius 20 that move the line 36 cm sideways
  // Mat coordinates: centimetres, x to the right, z towards the viewer, the middle is 0, 0. `start` is where the lens stands and
  // where the robot looks; a mat with a line starts with the lens on the line's right edge, `at` cm from the line's beginning.
  const MATS = [
    { id: 'probe', name: 'Проба', start: { x: -44, z: 4, h: 0 }, zones: { black: [-24, -30, -18, 30] },
      draw(g) {
        band(g, INK, -24, -18, 30);
        band(g, GREY, -4, 6, 30);
        COLORS.slice(2).forEach((c, i) => band(g, c.css, 18 + i * 10, 26 + i * 10, 12));
        label(g, 'СТАРТ', -52, -9);
      } },
    { id: 'stop', name: 'Стоп-линия', start: { x: -30, z: 4, h: 0 }, zones: { line: [39, -28, 41, 28] },
      draw(g) {
        band(g, INK, 39, 41, 28);
        label(g, 'СТАРТ', -38, -9);
      } },
    { id: 'track1', name: 'Трасса 1', closed: true, from: [-15, 25, 0],
      pieces: [['s', 40], ['a', 25, 180], ['a', 25, -30], ['a', 25, 60], ['a', 25, -30], ['a', 25, 180], ['s', 10]] },
    { id: 'track2', name: 'Трасса 2', closed: true, from: [-14, 28, 0],
      pieces: [['s', 54], ['a', 10, 180], ['s', 10], ['a', 20, -S2], ['a', 20, S2], ['s', 14.2], ['a', 28, 180], ['s', 10]] },
    { id: 'route', name: 'Маршрут', from: [-50, 26, 0], at: 4, zones: { finish: [44, -34, 52, -26] },
      pieces: [['s', 32], ['a', 25, 90], ['s', 6], ['a', 25, -90], ['s', 12]],
      draw(g) { g.fillStyle = COLORS[2].css; g.fillRect(44, -34, 8, 8); } },
  ];
  MATS.forEach((m) => {
    if (!m.pieces) return;
    const p = trace(m.from, m.pieces), n = p.length;
    if (m.closed) {
      if (Math.hypot(p[n - 2] - p[0], p[n - 1] - p[1]) > 0.05) console.error('sim: the line of mat ' + m.id + ' does not close');
      p.length = n - 2;                // the last point is the first one again
    }
    m.path = Float32Array.from(p);
    const i = Math.round((m.at || 0) / 0.5) * 2, h = Math.atan2(p[i + 1] - p[i + 3], p[i + 2] - p[i]);
    // The right edge of the line: half its width to the robot's right.
    m.start = { x: p[i] + (LINE / 2) * Math.sin(h), z: p[i + 1] + (LINE / 2) * Math.cos(h), h: h / DEG };
    m.mark = { x: p[i], z: p[i + 1], h };
  });
  const drawMat = (g, m) => {
    g.fillStyle = PAPER;
    g.fillRect(-MAT_W / 2, -MAT_H / 2, MAT_W, MAT_H);
    g.strokeStyle = '#cfd9df';
    g.lineWidth = 0.3;
    g.strokeRect(-MAT_W / 2 + 0.15, -MAT_H / 2 + 0.15, MAT_W - 0.3, MAT_H - 0.3);
    label(g, m.name.toUpperCase(), -MAT_W / 2 + 3, -MAT_H / 2 + 5);
    if (m.draw) m.draw(g);
    if (!m.path) return;
    // The start mark lies on the line's left side: the lens rides the right edge and never sees it.
    g.save();
    g.translate(m.mark.x, m.mark.z);
    g.rotate(-m.mark.h);
    g.fillStyle = MARK;
    g.fillRect(-0.3, -8, 0.6, 7);
    label(g, 'СТАРТ', 1.2, -5.5);
    g.restore();
    g.beginPath();
    for (let i = 0; i < m.path.length; i += 2) g.lineTo(m.path[i], m.path[i + 1]);
    if (m.closed) g.closePath();
    g.lineWidth = LINE;
    g.lineJoin = 'round';
    g.strokeStyle = INK;
    g.stroke();
  };

  function createSound(onBeep, wait) {
    let ctx = null, main = null, panner = null, volume = 100, tone = null;
    const effects = { pitch: 0, pan: 0 };
    const voices = new Set();
    // Synthesised: the kit's recordings are not ours to ship. Parts are [wave, from Hz, to Hz, seconds]; no wave is a pause.
    const SOUNDS = {
      'Cat Meow 1': [['sawtooth', 430, 800, 0.22], ['sawtooth', 800, 380, 0.4]],
      'Dog Bark 1': [['square', 340, 160, 0.13], [null, 0, 0, 0.07], ['square', 320, 150, 0.17]],
      Laser: [['square', 1800, 180, 0.4]],
      Hello: [['triangle', 300, 430, 0.17], ['triangle', 430, 260, 0.3]],
      Applause: [['noise', 0, 0, 1.2]],
    };
    const apply = () => {
      if (!ctx) return;
      main.gain.value = (volume / 100) * 0.25;
      panner.pan.value = clamp(effects.pan, -100, 100) / 100;
    };
    const rate = () => 2 ** (clamp(effects.pitch, -360, 360) / 120);     // 10 is one semitone, as in Scratch
    const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
    const fade = (at, dur) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1, at + 0.01);
      g.gain.setValueAtTime(1, at + Math.max(0.01, dur - 0.03));
      g.gain.linearRampToValueAtTime(0, at + dur);
      g.connect(main);
      return g;
    };
    const voice = (node, out) => {
      voices.add(node);
      node.onended = () => voices.delete(node);
      node.connect(out);
    };
    const noise = (at, dur) => {
      const n = ctx.createBufferSource();
      n.buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      n.buffer.getChannelData(0).forEach((v, i, a) => { a[i] = (Math.random() - 0.5) * 0.7; });
      voice(n, fade(at, dur));
      n.start(at);
    };
    const osc = (type, f0, f1, at, dur) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0 * rate(), at);
      o.frequency.exponentialRampToValueAtTime(f1 * rate(), at + dur);
      voice(o, fade(at, dur));
      o.start(at);
      o.stop(at + dur);
    };
    const play = (parts) => {
      if (!ctx) return;
      let at = ctx.currentTime;
      parts.forEach(([wave, f0, f1, dur]) => {
        if (wave === 'noise') noise(at, dur);
        else if (wave) osc(wave, f0, f1, at, dur);
        at += dur;
      });
    };
    const silence = () => { voices.forEach((v) => v.stop()); voices.clear(); tone = null; };
    return {
      // Browsers only open audio from a user gesture: Play and the hub's buttons call this.
      unlock() {
        if (!ctx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          ctx = new Ctx();
          main = ctx.createGain();
          panner = ctx.createStereoPanner();
          main.connect(panner).connect(ctx.destination);
          apply();
        }
        ctx.resume();
      },
      // The program waits on the simulated clock; the sound itself plays in real time.
      beep(midi, sec) {
        onBeep();
        play([['square', hz(midi), hz(midi), Math.max(0.05, sec)]]);
        return wait(sec);
      },
      beepStart(midi) {
        onBeep();
        if (tone) tone.stop();
        if (!ctx) return;
        tone = ctx.createOscillator();
        tone.type = 'square';
        tone.frequency.value = hz(midi) * rate();
        voice(tone, main);
        tone.start();
      },
      stop: silence,
      play(name, untilDone) {
        const parts = SOUNDS[name] || SOUNDS.Laser;
        play(parts);
        return untilDone ? wait(parts.reduce((sum, p) => sum + p[3], 0)) : Promise.resolve();
      },
      get volume() { return volume; },
      set volume(v) { volume = clamp(v, 0, 100); apply(); },
      setEffect(name, val) { effects[name] = val; apply(); },
      changeEffect(name, delta) { effects[name] += delta; apply(); },
      clearEffects() { effects.pitch = effects.pan = 0; apply(); },
    };
  }

  // Any alphabet, no font table: the browser draws each letter and its columns are read back for the 5×5 screen.
  function textColumns(text) {
    const SIZE = 12, c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true }), cols = [];
    c.width = SIZE;
    c.height = 7;
    g.font = '7px Arial, sans-serif';
    for (const letter of text) {
      g.clearRect(0, 0, SIZE, 7);
      g.fillText(letter, 1, 6);
      const data = g.getImageData(0, 0, SIZE, 7).data, glyph = [];
      for (let x = 0; x < SIZE; x++) {
        const col = [1, 2, 3, 4, 5].map((y) => data[(y * SIZE + x) * 4 + 3] > 70);
        if (col.some(Boolean)) glyph.push(col);
      }
      cols.push(...(glyph.length ? glyph : [[], []]), []);
    }
    return cols;
  }

  RA.createSim = (container) => {
    const r = RA.createRobot();
    const WHEEL = r.WHEEL_R / CM, TRACK = r.TRACK / CM;          // cm
    r.group.updateMatrixWorld(true);
    const lensAt = r.group.worldToLocal(r.sensor.getWorldPosition(new T.Vector3()));
    const LENS = { f: lensAt.x / CM, s: lensAt.z / CM };         // cm in front of the wheel axle and to the right of the centre line
    const eyeY = (r.box.min.y + r.box.max.y) / 2;
    const stage = RA.stage(container, { fov: 26, shadowBox: 18, camera: [0, 80, 75], target: [0, 0, 0] });
    const { scene, camera } = stage, gl = !!stage.renderer;
    container.classList.toggle('is-flat', !gl);

    let mat = MATS[0], listener = null, ticks = 0, speed = 1;
    const pose = { x: 0, z: 0, h: 0 };                           // the middle of the wheel axle, cm; heading in radians, counterclockwise
    const buttons = { left: false, right: false };
    const emit = (e) => { if (listener) listener(e); };
    const lens = () => {
      const c = Math.cos(pose.h), s = Math.sin(pose.h);
      return { x: pose.x + LENS.f * c + LENS.s * s, z: pose.z - LENS.f * s + LENS.s * c };
    };

    /* ---------- Motors C, D, E ---------- */
    const LAG = Math.round(MOTOR_DELAY / STEP);
    const createMotor = (port) => {
      const MAX = SPEED_100[port], degS = (pct) => (clamp(+pct || 0, -100, 100) * MAX) / 100;
      const M = { pos: 0, vel: 0, want: 0, zero: 0, def: 75, queue: [], cur: null, last: null };
      // A new command ends the promise of the one before at once, and reaches the motor LAG steps later.
      const order = (cmd, waits) => {
        if (M.last) M.last.done();
        M.last = null;
        M.queue.push([ticks + LAG, cmd]);
        return waits ? new Promise((res) => { cmd.done = res; M.last = cmd; }) : undefined;
      };
      const over = () => {
        const c = M.cur;
        M.cur = null;
        if (c.done) c.done();
      };
      M.step = () => {
        while (M.queue.length && M.queue[0][0] < ticks) {
          const c = (M.cur = M.queue.shift()[1]);
          if (c.by !== undefined) c.goal = M.pos + c.by;
          if (c.sec !== undefined) c.until = ticks + Math.round(c.sec / STEP);
        }
        const c = M.cur;
        let want = 0;
        if (c && c.goal !== undefined) {
          const left = c.goal - M.pos;
          if (Math.abs(left) < 0.5 && Math.abs(M.vel) <= 2 * MOTOR_ACCEL * STEP) { M.pos = c.goal; M.vel = 0; over(); }
          else want = Math.sign(left) * Math.min(c.speed, Math.sqrt(2 * MOTOR_ACCEL * Math.abs(left)));
        } else if (c && c.until !== undefined && ticks >= c.until) over();
        else if (c) want = c.speed;
        M.want = want;
        M.vel += clamp(want - M.vel, -MOTOR_ACCEL * STEP, MOTOR_ACCEL * STEP);
        M.pos += M.vel * STEP;
      };
      M.halt = () => {
        if (M.last) M.last.done();
        Object.assign(M, { pos: 0, vel: 0, want: 0, zero: 0, queue: [], cur: null, last: null });
      };
      M.api = {
        run(pct, dir = 1) { order({ speed: degS(pct) * dir }); },
        // shortcut: nothing loads these wheels, so power drives like speed; give it its own curve if a lesson compares the two.
        runPower(pct) { order({ speed: degS(pct) }); },
        stop() { order({ speed: 0 }); },
        runFor(deg, pct) {
          if (!pct) return Promise.resolve();
          return order({ by: (+deg || 0) * Math.sign(pct), speed: Math.abs(degS(pct)) }, true);
        },
        runForSeconds(sec, pct, dir = 1) { return order({ speed: degS(pct) * dir, sec: Math.max(0, +sec || 0) }, true); },
        goTo(deg, mode, pct) {
          const d = wrap(deg) - wrap(M.pos);
          const turnBy = mode === 'clockwise' ? ((d % 360) + 360) % 360 : mode === 'counterclockwise' ? -(((-d % 360) + 360) % 360) : wrap(d);
          return M.api.runFor(turnBy, Math.abs(pct));
        },
        get position() { return wrap(Math.round(M.pos)); },
        get relative() { return Math.round(M.pos - M.zero); },
        set relative(v) { M.zero = M.pos - v; },
        get speedPct() { return Math.round((M.vel / MAX) * 100); },
        get powerPct() { return Math.round((M.want / MAX) * 100); },
        get defaultSpeed() { return M.def; },
        set defaultSpeed(v) { M.def = clamp(v, -100, 100); },
      };
      return M;
    };
    const motors = { C: createMotor('C'), D: createMotor('D'), E: createMotor('E') };

    /* ---------- The mat and the sensor ---------- */
    const sheet = document.createElement('canvas');
    sheet.width = MAT_W * PX;
    sheet.height = MAT_H * PX;
    const ink = sheet.getContext('2d', { willReadFrequently: true });
    ink.setTransform(PX, 0, 0, PX, sheet.width / 2, sheet.height / 2);
    let pixels = null, sight = null;
    // The spot under the lens: every second pixel inside the circle is plenty for a steady mean.
    const SPOT_PX = [], RAD = (SPOT / 2) * PX;
    for (let y = -RAD; y <= RAD; y += 2) for (let x = -RAD; x <= RAD; x += 2) if (x * x + y * y <= RAD * RAD) SPOT_PX.push(x, y);
    // What the sensor sees now: read once per physics step, however often the program asks.
    const look = () => {
      if (sight) return sight;
      const l = lens(), cx = (l.x + MAT_W / 2) * PX - 0.5, cy = (l.z + MAT_H / 2) * PX - 0.5, W = sheet.width, H = sheet.height;
      const sum = [0, 0, 0];
      for (let i = 0; i < SPOT_PX.length; i += 2) {
        const x = cx + SPOT_PX[i], y = cy + SPOT_PX[i + 1], x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        // Between pixels, so the reading changes smoothly while the lens creeps over an edge. Off the mat lies the floor.
        for (let k = 0; k < 4; k++) {
          const px = x0 + (k & 1), py = y0 + (k >> 1), part = (k & 1 ? fx : 1 - fx) * (k >> 1 ? fy : 1 - fy);
          const o = px < 0 || py < 0 || px >= W || py >= H ? -1 : (py * W + px) * 4;
          for (let ch = 0; ch < 3; ch++) sum[ch] += part * (o < 0 ? FLOOR_RGB[ch] : pixels[o + ch]);
        }
      }
      const mean = sum.map((v) => v / (SPOT_PX.length / 2));
      const reflected = clamp(BLACK_PCT + ((WHITE_PCT - BLACK_PCT) * (luma(mean) - INK_LUMA)) / (1 - INK_LUMA), 0, 100);
      // A black-and-white mix has no colour of its own: black or white by its brightness, never a hue.
      let color = COLORS[reflected < DARK ? 0 : 1];
      if (Math.max(...mean) - Math.min(...mean) >= CHROMA) {
        const h = hue(mean), far = (a) => Math.abs(wrap(a - h));
        color = HUES.reduce((best, c) => (far(c[0]) < far(best[0]) ? c : best))[1];
      }
      sight = { x: l.x, z: l.z, reflected, color: color.code, name: color.name, css: `rgb(${mean.map(Math.round).join(',')})` };
      return sight;
    };
    const zoneAt = (l) => Object.keys(mat.zones || {}).find((k) => {
      const [x0, z0, x1, z1] = mat.zones[k];
      return l.x >= x0 && l.x <= x1 && l.z >= z0 && l.z <= z1;
    }) || null;

    /* ---------- The run: what happened since the program started ---------- */
    const fresh = () => ({ on: false, begin: ticks, end: ticks, dist: 0, fwd: 0, top: 0, at: -1, covered: 0, away: 0, spin: 0, lost: false, lostAt: 0,
      laps: 0, lapBegin: ticks, lapTime: 0, lapDist: 0, flips: 0, side: 0, wobble: 0, outside: false, moved: false, seen: {} });
    let run = fresh(), stillFor = STILL, yawZero = 0;
    // The nearest of `count` points of the line from index `from` on: [how many points ahead, how far from the lens].
    const nearest = (l, from, count) => {
      const p = mat.path, n = p.length / 2;
      let best = 0, d = Infinity;
      for (let k = 0; k < count; k++) {
        let i = from + k;
        if (i >= n) { if (!mat.closed) break; i -= n; }
        const q = (p[2 * i] - l.x) ** 2 + (p[2 * i + 1] - l.z) ** 2;
        if (q < d) { d = q; best = k; }
      }
      return [best, Math.sqrt(d)];
    };
    const follow = (l, w) => {
      const n = mat.path.length / 2;
      // The run begins where the lens first meets the line. From there only forwards and only a short way: a robot that cuts
      // across the mat, or circles next to another piece of the line, is not following it.
      if (run.at < 0) {
        const [k, d] = nearest(l, 0, n);
        if (d < LOST_DIST) run.at = k;
      }
      const [k, d] = run.at < 0 ? [0, Infinity] : nearest(l, run.at, AHEAD * 2);
      const on = d < LOST_DIST;
      if (on) { run.at = (run.at + k) % n; run.covered += k; }
      run.away = on ? 0 : run.away + STEP;
      run.spin = on ? 0 : run.spin + (w * STEP) / DEG;
      if (run.away >= LOST_TIME && !run.lost) { run.lost = true; run.lostAt = run.covered / n; }
      if (mat.closed && run.covered >= (run.laps + 1) * n) {
        run.laps++;
        run.lapTime = (ticks - run.lapBegin) * STEP;
        run.wobble = wobble();
        Object.assign(run, { lapBegin: ticks, lapDist: 0, flips: 0 });
      }
    };
    // «Виляние»: how many times per metre of the way the robot swung from turning one way to turning the other.
    const wobble = () => (run.lapDist > 10 ? Math.round(run.flips / (run.lapDist / 100)) : 0);

    /* ---------- The trail of the lens ---------- */
    const trail = new Float32Array(TRAIL_MAX * 4);               // pieces x0, z0, x1, z1 in cm
    let trailN = 0, trailFrom = null, trailOn = true, drawn3d = 0, drawnMap = 0;
    const trailPos = new Float32Array(gl ? TRAIL_MAX * 12 : 0);
    const mark = (l) => {
      if (!trailFrom) { trailFrom = l; return; }
      const dx = l.x - trailFrom.x, dz = l.z - trailFrom.z, len = Math.hypot(dx, dz);
      if (len < TRAIL_STEP) return;
      if (trailN === TRAIL_MAX) {
        // Full: the older half goes.
        trailN /= 2;
        trail.copyWithin(0, trailN * 4);
        trailPos.copyWithin(0, trailN * 12);
        drawn3d = 0;
        drawnMap = -1;
      }
      trail.set([trailFrom.x, trailFrom.z, l.x, l.z], trailN * 4);
      if (gl) {
        // A flat ribbon: two corners at each end, half the width to either side.
        const ox = ((-dz / len) * TRAIL_W * CM) / 2, oz = ((dx / len) * TRAIL_W * CM) / 2, a = trailFrom, o = trailN * 12;
        trailPos.set([a.x * CM + ox, 0, a.z * CM + oz, a.x * CM - ox, 0, a.z * CM - oz, l.x * CM + ox, 0, l.z * CM + oz, l.x * CM - ox, 0, l.z * CM - oz], o);
      }
      trailN++;
      trailFrom = l;
    };
    const wipeTrail = () => { trailN = drawn3d = 0; trailFrom = null; drawnMap = -1; };

    /* ---------- The clock ---------- */
    let tickDone = null, tickPromise = null, sleepers = [];
    const step = () => {
      ticks++;
      motors.C.step();
      motors.D.step();
      motors.E.step();
      // Forward means C counterclockwise and D clockwise: the left rotor looks left, the right one right.
      const vl = -motors.C.vel * DEG * WHEEL, vr = motors.D.vel * DEG * WHEEL, v = (vl + vr) / 2, w = (vr - vl) / TRACK, h = pose.h + w * STEP;
      if (Math.abs(w) < 1e-9) { pose.x += v * STEP * Math.cos(h); pose.z -= v * STEP * Math.sin(h); }
      else { pose.x += (v / w) * (Math.sin(h) - Math.sin(pose.h)); pose.z += (v / w) * (Math.cos(h) - Math.cos(pose.h)); }   // the exact arc
      pose.h = h;
      sight = null;

      const l = lens();
      mark(l);
      run.dist += Math.abs(v) * STEP;
      run.fwd += v * STEP;
      run.top = Math.max(run.top, Math.abs(motors.C.api.powerPct), Math.abs(motors.D.api.powerPct));
      stillFor = Math.abs(motors.C.vel) < 1 && Math.abs(motors.D.vel) < 1 ? stillFor + STEP : 0;
      if (Math.abs(pose.x) > MAT_W / 2 || Math.abs(pose.z) > MAT_H / 2) run.outside = true;
      const zone = zoneAt(l);
      if (zone) run.seen[zone] = true;
      const side = w > TURN_FLIP * DEG ? 1 : w < -TURN_FLIP * DEG ? -1 : 0;
      if (side && side !== run.side) { if (run.side) run.flips++; run.side = side; }
      run.lapDist += Math.abs(v) * STEP;
      if (mat.path) follow(l, w);

      // Wake the program: its code runs right after this task and before the next step, once per step.
      if (sleepers.length) {
        const due = sleepers.filter((s) => s[0] <= ticks);
        sleepers = sleepers.filter((s) => s[0] > ticks);
        due.forEach((s) => s[1]());
      }
      const done = tickDone;
      tickDone = tickPromise = null;
      if (done) done();
    };
    // Steps follow real time × speed, never two in one browser task. rAF would stop in a hidden tab and tie the pace to the screen.
    let clock = 0, starts = 0, owed = 0, lastReal = 0, timer = 0;
    const chan = new MessageChannel();
    const pump = () => {
      const now = performance.now();
      owed = Math.min(owed + ((now - lastReal) / 1000) * speed, MAX_LAG * Math.max(speed, 1));
      lastReal = now;
      if (owed >= STEP) {
        owed -= STEP;
        step();
        chan.port2.postMessage(clock);
      } else timer = setTimeout(pump, ((STEP - owed) / speed) * 1000);
    };
    chan.port1.onmessage = (e) => { if (e.data === clock) pump(); };     // a message from before a stop is stale

    /* ---------- Hub ---------- */
    const ORIENT = { upright: 0, right: 1, upsidedown: 2, left: 3 };
    const screen = new Array(25).fill(0);
    let turned = 0, bright = 100, scrolling = 0;
    const paint = () => {
      const px = new Array(25);
      for (let row = 0; row < 5; row++) for (let c = 0; c < 5; c++) {
        const [y, x] = [[row, c], [c, 4 - row], [4 - row, 4 - c], [4 - c, row]][turned];
        px[y * 5 + x] = (screen[row * 5 + c] * bright) / 100;
      }
      r.setMatrix(px);
      emit({ type: 'display', px });
    };
    const sleep = (sec) => new Promise((res) => sleepers.push([ticks + Math.max(1, Math.round(sec / STEP)), res]));
    const sound = createSound(() => emit({ type: 'beep' }), sleep);
    const display = {
      setImage(arr) { scrolling++; arr.forEach((v, i) => { screen[i] = v; }); paint(); },
      clear() { scrolling++; screen.fill(0); paint(); },
      setPixel(x, y, pct) {
        if (x < 1 || x > 5 || y < 1 || y > 5) return;
        scrolling++;
        screen[(Math.round(y) - 1) * 5 + Math.round(x) - 1] = clamp(pct, 0, 100);
        paint();
      },
      setBrightness(pct) { bright = clamp(pct, 0, 100); paint(); },
      rotate(dir) { turned = (turned + dir + 4) % 4; paint(); },
      setOrientation(name) { turned = ORIENT[name] || 0; paint(); },
      async scroll(text) {
        const mine = ++scrolling, cols = textColumns(text.toUpperCase());
        for (let at = -5; at <= cols.length && mine === scrolling; at++) {
          for (let row = 0; row < 5; row++) for (let c = 0; c < 5; c++) screen[row * 5 + c] = cols[at + c] && cols[at + c][row] ? 100 : 0;
          paint();
          await sleep(SCROLL);
        }
      },
    };

    const hw = {
      ports: { B: 'color', C: 'motor', D: 'motor', E: 'motor' },
      motors: { C: motors.C.api, D: motors.D.api, E: motors.E.api },
      display,
      centerLight(css) { r.setCenterLight(css); emit({ type: 'light', css }); },
      sound,
      sensors: {
        color: () => look().color,
        reflected: () => look().reflected,
        // As the hub's gyro counts it: clockwise is positive.
        angle: (axis) => (axis === 'yaw' ? Math.round(wrap((yawZero - pose.h) / DEG)) : 0),
        resetYaw() { yawZero = pose.h; },
        orientationUp: (name) => name === 'top',              // the hub lies flat, screen up
        button: (side) => buttons[side],
        tilted: () => false,
        gesture: () => false,
        force: () => 0,                                       // not on this robot: the blocks stay in the palette
        distance: () => null,
      },
      now: () => ticks * STEP,
      tick: () => tickPromise || (tickPromise = new Promise((res) => { tickDone = res; })),
      sleep,
      onEvent(fn) { listener = fn; },
      reset() {
        Object.values(hw.motors).forEach((m) => m.stop());
        bright = 100;
        turned = 0;
        display.clear();
        hw.centerLight(null);
        sound.stop();
        sound.clearEffects();
        sound.volume = 100;
      },
    };

    /* ---------- By hand ---------- */
    const press = (side, on) => {
      if (buttons[side] === on) return;
      buttons[side] = on;
      if (on) sound.unlock();
      emit({ type: 'button', side, state: on ? 'pressed' : 'released' });
    };
    // Puts the robot down: the middle of its axle at x, z (cm, kept on the mat), looking along `deg` (counterclockwise, 0 is to the right).
    const place = (x, z, deg) => {
      pose.x = clamp(x, -MAT_W / 2, MAT_W / 2);
      pose.z = clamp(z, -MAT_H / 2, MAT_H / 2);
      if (deg !== undefined) pose.h = deg * DEG;
      sight = trailFrom = null;
      run.moved = true;
    };
    const reset = () => {
      Object.values(motors).forEach((m) => m.halt());
      const s = mat.start, c = Math.cos(s.h * DEG), n = Math.sin(s.h * DEG);
      // From where the lens stands back to the middle of the axle.
      place(s.x - LENS.f * c - LENS.s * n, s.z + LENS.f * n - LENS.s * c, s.h);
      yawZero = pose.h;
      stillFor = STILL;
      run = fresh();
      wipeTrail();
      r.setSensorLight(false);
    };

    /* ---------- The top view: the mat, the trail, the robot as an arrow, the lens as a dot ---------- */
    const map = document.createElement('div');
    map.className = 'sim-map';
    map.setAttribute('role', 'img');
    map.setAttribute('aria-label', 'Поле сверху. Робота можно перетащить мышью или пальцем.');
    const [mapMat, mapTrail, mapBot] = [0, 1, 2].map(() => map.appendChild(document.createElement('canvas')).getContext('2d'));
    container.append(map);
    let mapW = 0, mapPose = '';
    const mapScale = (g) => { const k = g.canvas.width / MAT_W; g.setTransform(k, 0, 0, k, g.canvas.width / 2, g.canvas.height / 2); return k; };
    const paintMapMat = () => {
      mapMat.setTransform(1, 0, 0, 1, 0, 0);
      mapMat.imageSmoothingQuality = 'high';
      mapMat.drawImage(sheet, 0, 0, mapMat.canvas.width, mapMat.canvas.height);
    };
    const paintMap = () => {
      const w = map.clientWidth;
      if (!w) return;
      if (w !== mapW) {
        mapW = w;
        const d = Math.min(devicePixelRatio || 1, 2);
        [mapMat, mapTrail, mapBot].forEach((g) => { g.canvas.width = Math.round(w * d); g.canvas.height = Math.round((w * d * MAT_H) / MAT_W); });
        paintMapMat();
        drawnMap = -1;
        mapPose = '';
      }
      if (drawnMap !== trailN) {
        const k = mapScale(mapTrail);
        if (drawnMap < 0) { mapTrail.clearRect(-MAT_W / 2, -MAT_H / 2, MAT_W, MAT_H); drawnMap = 0; }
        mapTrail.strokeStyle = '#c92e85';
        mapTrail.lineWidth = 1.6 * (mapTrail.canvas.width / mapW) / k;
        mapTrail.lineCap = 'round';
        mapTrail.beginPath();
        for (let i = drawnMap * 4; i < trailN * 4; i += 4) { mapTrail.moveTo(trail[i], trail[i + 1]); mapTrail.lineTo(trail[i + 2], trail[i + 3]); }
        mapTrail.stroke();
        drawnMap = trailN;
      }
      const now = pose.x + ' ' + pose.z + ' ' + pose.h;
      if (now === mapPose) return;
      mapPose = now;
      const g = mapBot, k = mapScale(g), px = g.canvas.width / mapW / k, l = lens();      // px: one CSS pixel in cm
      g.clearRect(-MAT_W / 2, -MAT_H / 2, MAT_W, MAT_H);
      g.save();
      g.translate(pose.x, pose.z);
      g.rotate(-pose.h);
      g.beginPath();
      g.moveTo(8, 0); g.lineTo(-6.5, -6.3); g.lineTo(-3.5, 0); g.lineTo(-6.5, 6.3);
      g.closePath();
      g.fillStyle = '#00adc4';
      g.strokeStyle = '#10202a';
      g.lineWidth = 1.5 * px;
      g.lineJoin = 'round';
      g.fill();
      g.stroke();
      g.restore();
      g.beginPath();
      g.arc(l.x, l.z, Math.max(1.3, 3.5 * px), 0, 7);
      g.fillStyle = '#c92e85';
      g.strokeStyle = '#fff';
      g.fill();
      g.stroke();
    };
    {
      let held = false;
      const drop = (e) => {
        const b = map.getBoundingClientRect();
        place(((e.clientX - b.left) / b.width - 0.5) * MAT_W, ((e.clientY - b.top) / b.height - 0.5) * MAT_H);
      };
      map.addEventListener('pointerdown', (e) => { if (e.button) return; map.setPointerCapture(e.pointerId); held = true; drop(e); });
      map.addEventListener('pointermove', (e) => { if (held) drop(e); });
      ['pointerup', 'pointercancel'].forEach((n) => map.addEventListener(n, () => { held = false; }));
    }

    /* ---------- The 3D picture ---------- */
    let view = RA.reducedMotion ? 'mat' : 'follow', texture = null, trailMesh = null, sized = null, grab = null;
    const at3 = new T.Vector3();
    // How far back along the camera's own direction every corner of the mat comes into the picture.
    const fitMat = () => {
      camera.updateMatrixWorld();
      const m = camera.matrixWorld.elements, tan = Math.tan((camera.fov * DEG) / 2), wide = tan * camera.aspect;
      let d = 0;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = (sx * MAT_W * CM) / 2, z = (sz * MAT_H * CM) / 2;
        d = Math.max(d, x * m[8] + z * m[10] + Math.max(Math.abs(x * m[0] + z * m[2]) / wide, Math.abs(x * m[4] + z * m[6]) / tan));
      }
      return d * 1.05;
    };
    const aim = (target, dir, dist) => {
      const c = stage.controls;
      c.target.copy(target);
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target);
      c.minDistance = dist * 0.35;
      c.maxDistance = dist * 2.2;
    };
    const setView = (name) => {
      view = name === 'mat' ? 'mat' : 'follow';
      if (!gl) return;
      if (view === 'follow') return aim(at3.set(pose.x * CM, eyeY, pose.z * CM), new T.Vector3(...FOLLOW.dir).normalize(), FOLLOW.dist);
      const dir = new T.Vector3(...WHOLE).normalize();
      aim(at3.set(0, 0, 0), dir, 100);
      aim(at3, dir, fitMat());
    };
    if (gl) {
      const slab = new T.Mesh(new T.BoxGeometry((MAT_W + 40) * CM, 1.5, (MAT_H + 40) * CM).translate(0, -0.81, 0),
        new T.MeshStandardMaterial({ color: FLOOR, roughness: 0.8, envMapIntensity: 0.4 }));
      texture = new T.CanvasTexture(sheet);
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = 8;
      const top = new T.Mesh(new T.PlaneGeometry(MAT_W * CM, MAT_H * CM).rotateX(-Math.PI / 2),
        new T.MeshStandardMaterial({ map: texture, roughness: 0.8, envMapIntensity: 0.5 }));
      slab.receiveShadow = top.receiveShadow = true;
      const geo = new T.BufferGeometry(), index = new Uint32Array(TRAIL_MAX * 6);
      for (let i = 0; i < TRAIL_MAX; i++) index.set([0, 1, 2, 2, 1, 3].map((k) => i * 4 + k), i * 6);
      geo.setAttribute('position', new T.BufferAttribute(trailPos, 3).setUsage(T.DynamicDrawUsage));
      geo.setIndex(new T.BufferAttribute(index, 1));
      geo.setDrawRange(0, 0);
      trailMesh = new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#c92e85', side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      trailMesh.frustumCulled = false;
      trailMesh.position.y = 0.02;
      scene.add(slab, top, trailMesh, r.group);
    }
    const draw = (dt) => {
      if (gl) {
        r.group.position.set(pose.x * CM, 0, pose.z * CM);
        r.group.rotation.y = pose.h;
        r.setWheels(motors.C.pos, motors.D.pos);
        r.setTool(motors.E.pos);
        r.update(dt);
        // The shadow's light travels with the robot, so its small sharp map is always under it.
        stage.key.position.set(pose.x * CM - 30, 70, pose.z * CM + 45);
        stage.key.target.position.set(pose.x * CM, 0, pose.z * CM);
        const c = stage.controls;
        if (stage.size !== sized) {
          sized = stage.size;
          if (view === 'mat') aim(c.target, at3.copy(camera.position).sub(c.target).normalize(), fitMat());
        }
        // The camera slides after the robot and keeps the angle the student chose. Not while they carry the robot in this view.
        if (view === 'follow' && !grab) {
          at3.set(pose.x * CM, eyeY, pose.z * CM).sub(c.target).multiplyScalar(1 - Math.exp(-dt * FOLLOW.ease));
          c.target.add(at3);
          camera.position.add(at3);
        }
        if (drawn3d !== trailN) {
          const a = trailMesh.geometry.attributes.position;
          a.addUpdateRange(drawn3d * 12, (trailN - drawn3d) * 12);
          a.needsUpdate = true;
          drawn3d = trailN;
        }
        trailMesh.geometry.setDrawRange(0, trailN * 6);
      }
      paintMap();
      if (sim.onTick) sim.onTick();
    };
    stage.frame(draw);
    // A resize wipes the canvas; drawing at once keeps the splitter drag from flickering.
    if (gl) new ResizeObserver(() => { if (clock) stage.renderer.render(scene, camera); }).observe(container);

    /* ---------- Pointer on the 3D view: the hub's buttons, the robot itself; anything else orbits ---------- */
    const el = gl && stage.renderer.domElement;
    if (el) {
      const ray = new T.Raycaster(), ndc = new T.Vector2(), floor = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
      const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
      const within = (o, root) => { for (; o; o = o.parent) if (o === root) return true; return false; };
      const cast = (e) => {
        const b = el.getBoundingClientRect();
        ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        return ray.ray.intersectPlane(floor, hit);
      };
      let pressed = null;
      const end = () => {
        if (pressed) press(pressed, false);
        pressed = grab = null;
        stage.controls.enabled = true;
      };
      // Capture phase: this has to decide before OrbitControls starts an orbit.
      container.addEventListener('pointerdown', (e) => {
        if (e.target !== el || e.button !== 0) return;
        const onFloor = cast(e);
        // Raycasting sees hidden meshes too: the first visible hit counts.
        const first = ray.intersectObject(r.group, true).filter((x) => shown(x.object))[0];
        if (!first) return;
        const o = first.object, b = r.hubButtons;
        if (within(o, b.center)) emit({ type: 'center' });
        else if (within(o, b.left)) press((pressed = 'left'), true);
        else if (within(o, b.right)) press((pressed = 'right'), true);
        else if (onFloor) grab = { x: pose.x - hit.x / CM, z: pose.z - hit.z / CM };      // carried by the spot of floor under the pointer
        stage.controls.enabled = false;
        el.setPointerCapture(e.pointerId);
      }, true);
      el.addEventListener('pointermove', (e) => { if (grab && cast(e)) place(hit.x / CM + grab.x, hit.z / CM + grab.z); });
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }

    let ticker = 0;
    const sim = {
      hw, stage, robot: r, MATS, COLORS, STEP, LOST_DIST, press, place, reset, setView, onTick: null,
      // One physics step at once, for tests that drive hw from plain JS; a running page steps by itself.
      step,
      setMat(id) {
        mat = MATS.find((m) => m.id === id) || MATS[0];
        drawMat(ink, mat);
        pixels = ink.getImageData(0, 0, sheet.width, sheet.height).data;
        if (texture) texture.needsUpdate = true;
        if (mapW) paintMapMat();
        reset();
        setView(view);
      },
      // One press of a turn button: dir 1 turns left, -1 right.
      turn(dir) { place(pose.x, pose.z, pose.h / DEG + NUDGE * dir); },
      // The program starts: the run's numbers begin again from here and the sensor's light goes on.
      beginRun() {
        run = Object.assign(fresh(), { on: true });
        r.setSensorLight(true);
      },
      endRun() {
        if (!run.on) return;
        Object.assign(run, { on: false, end: ticks });
        r.setSensorLight(false);
      },
      get mat() { return mat; },
      get pose() { return { x: pose.x, z: pose.z, h: wrap(pose.h / DEG) }; },
      get time() { return ticks * STEP; },
      get speed() { return speed; },
      set speed(v) { speed = Math.max(0.01, +v || 1); },
      get sensor() { return look(); },
      get view() { return view; },
      get trail() { return trailOn; },
      set trail(on) {
        trailOn = !!on;
        map.classList.toggle('is-bare', !trailOn);
        if (trailMesh) trailMesh.visible = trailOn;
      },
      get zone() { return zoneAt(lens()); },
      get outside() { return Math.abs(pose.x) > MAT_W / 2 || Math.abs(pose.z) > MAT_H / 2; },
      get still() { return stillFor >= STILL; },
      get run() {
        const n = mat.path ? mat.path.length / 2 : 0;
        return { on: run.on, time: ((run.on ? ticks : run.end) - run.begin) * STEP, dist: run.dist, forward: run.fwd, top: run.top,
          progress: n ? run.covered / n : 0, lost: run.lost, lostAt: run.lostAt, spin: run.spin, laps: run.laps, lapTime: run.lapTime,
          wobble: run.wobble, wobbleNow: wobble(), outside: run.outside, moved: run.moved, seen: run.seen };
      },
      start() {
        if (clock) return;
        clock = ++starts;
        lastReal = performance.now();
        owed = 0;
        pump();
        stage.start();
        if (!gl) ticker = setInterval(() => draw(0.05), 50);       // no WebGL: the map, the blocks and the 2D hub still work
      },
      stop() {
        clock = 0;
        clearTimeout(timer);
        stage.stop();
        clearInterval(ticker);
      },
    };
    sim.setMat(mat.id);
    return sim;
  };
})();
