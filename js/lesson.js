// The lesson: the robot in 3D, what its colour sensor reads, the threshold, the zigzag rule seen from above, the build stepper, a quiz.
// The three experiments are plain 2D and need no WebGL. The two 3D stages are built on first sight and run only while on screen.
(function () {
  const RA = window.RA, T = THREE, { $, $$ } = RA;
  const live = !RA.reducedMotion;
  const DEG = Math.PI / 180;
  const BOT = RA.createRobot;          // the model's constants are on the factory too: PARTS, TRACK, WHEEL_R, SENSOR
  const CM = 0.8;                      // one module is 8 mm
  // As the simulator reads its mats (SPEC §8): white paper about 95 %, black tape about 5 %, a round spot of about 1.2 cm, LEGO's threshold.
  const WHITE = 95, BLACK = 5, SPOT = 0.6, THRESHOLD = 50;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // The share of a round spot (radius r) that lies beyond a straight border s away from its middle.
  const beyond = (s, r) => { const u = clamp(s / r, -1, 1); return (Math.acos(u) - u * Math.sqrt(1 - u * u)) / Math.PI; };

  /* ---------- The robot from above: one drawing for the pictures, the port plan and the zigzag ---------- */
  // Modules, forward is up. The body is LEGO's (SPEC §1: hub 11 × 7, beams 15 long with the axle under their middle); the wheels and the lens come from the model.
  function drawBot(root) {
    const { TRACK, WHEEL_R: R, SENSOR: S } = BOT, ink = 'stroke="#10202a" stroke-width="0.25"';
    const wheel = (x) => `<rect x="${x - 0.9}" y="${-R}" width="1.8" height="${2 * R}" rx="0.6" fill="#01adc4" ${ink}/>`;
    $('.les-defs', root).insertAdjacentHTML('beforeend', `<symbol id="les-bot" viewBox="-9 -8 18 16">
      ${wheel(-TRACK / 2)}${wheel(TRACK / 2)}
      <path d="M-4.5-1.5h1v9h-1zM3.5-1.5h1v9h-1z" fill="#01adc4"/>
      <rect x="-5.5" y="-7.5" width="1" height="15" rx="0.5" fill="#16151a"/><rect x="4.5" y="-7.5" width="1" height="15" rx="0.5" fill="#16151a"/>
      <rect x="-2.5" y="-7.5" width="5" height="4.6" rx="0.5" fill="#eceded" ${ink}/>
      <circle cy="-5.5" r="0.85" fill="#16151a"/><circle cy="-5.5" r="0.3" fill="#d01012"/>
      <rect x="-3.5" y="-3.5" width="7" height="11" rx="0.9" fill="#fed920" ${ink}/>
      <rect x="-2.9" y="-2.9" width="5.8" height="9.8" rx="0.5" fill="#eceded"/>
      <circle cy="5.6" r="0.9" fill="#fff" ${ink}/>
      <rect x="${S.z - 1.5}" y="${-S.x - 1.5}" width="3" height="3" rx="0.4" fill="#16151a"/>
      <circle cx="${S.z}" cy="${-S.x}" r="0.75" fill="none" stroke="#eceded" stroke-width="0.3"/>
    </symbol>`);
  }

  // The plan: the hub's six ports, a letter on every device, and where the lens is from the axle and from the centre line.
  function drawPlan(root) {
    const S = BOT.SENSOR, half = BOT.TRACK / 2, mm = (v) => Math.round(v * 8);
    const tag = (x, y, letter, cls) => `<g class="les-plan__port ${cls}"><circle cx="${x}" cy="${y}" r="0.85"/><text x="${x}" y="${y + 0.42}">${letter}</text></g>`;
    const hub = (side, letters) => [...letters].map((l, i) => tag(side * 2.4, i * 2, l, 'AF'.includes(l) ? 'is-free' : '')).join('');   // each row from front to rear
    $('#les-plan', root).innerHTML = `<svg viewBox="-9.6 -11.3 24.2 20" role="img" aria-label="Робот сверху: к порту C подключено левое колесо, к D правое, к E большой мотор спереди, к B датчик цвета спереди справа. Порты A и F свободны.">
      <use href="#les-bot" x="-9" y="-8" width="18" height="16"/>
      <path class="les-plan__axis" d="M-9.3 0H10.6M0-10.6V8.4"/>
      ${hub(-1, 'ACE')}${hub(1, 'BDF')}
      ${tag(-half, 2.2, 'C', 'is-dev')}${tag(half, 2.2, 'D', 'is-dev')}${tag(-1.5, -4.2, 'E', 'is-dev')}${tag(S.z + 2.4, -S.x - 2.4, 'B', 'is-dev')}
      <path class="les-plan__dim" d="M${S.z + 0.9} ${-S.x}H10.6M10.2 0V${-S.x}M${S.z} ${-S.x - 0.9}V-10.6M0-10.2H${S.z}"/>
      <text class="les-plan__mm" x="10.6" y="${-S.x / 2 + 0.4}">${mm(S.x)} мм</text>
      <text class="les-plan__mm les-plan__mm--mid" x="${S.z / 2}" y="-10.6">${mm(S.z)} мм</text>
    </svg>`;
  }

  /* ---------- What the sensor reads: a strip of surfaces under a sensor you drag ---------- */
  // [caption, colour, reflected light %, the colour mode's answer, width in cm, a line about it].
  // shortcut: the numbers for grey and the colours are the page's own (brightness on the simulator's scale), measure a real strip when the class has one.
  const PAPER = 'Цветная бумага. Режим «цвет» называет её, а число говорит только, сколько света вернулось.';
  const STRIP = [
    ['белая бумага', '#ffffff', WHITE, 'белый', 6, 'Белая бумага: почти весь свет вернулся.'],
    ['чёрная лента', '#16151a', BLACK, 'чёрный', 5, 'Чёрная лента: свет почти не вернулся.'],
    ['белая бумага', '#ffffff', WHITE, 'белый', 4, 'Белая бумага: почти весь свет вернулся.'],
    ['серая бумага', '#9aa0a6', 60, 'белый', 4, 'Серая бумага: число между чёрным и белым. Слова «серый» у датчика нет, и режим «цвет» даёт другой ответ.'],
    ['красная', '#ff000c', 24, 'красный', 4, PAPER],
    ['зелёная', '#00a845', 49, 'зелёный', 4, PAPER],
    ['синяя', '#0090f5', 48, 'синий', 4, PAPER],
    ['жёлтая', '#ffe360', 84, 'жёлтый', 4, PAPER],
  ];

  function initSee(root) {
    const svg = $('#les-see-svg', root), head = $('#les-see-head', svg), spot = $('#les-see-spot', svg), back = $('#les-see-back', svg);
    const out = $('#les-see-num', root), bar = $('#les-see-bar', root), name = $('#les-see-name', root), sw = $('#les-see-sw', root), note = $('#les-see-note', root);
    // Picture units per cm, where the strip starts, and how far the sensor goes: its body stays over the strip.
    const PX = 20, X0 = 10, LEN = STRIP.reduce((sum, p) => sum + p[4], 0), MIN = 1.6, MAX = LEN - 1.6;
    let at = 0, pos = 3;
    $('#les-see-strip', svg).innerHTML = STRIP.map(([label, css, , , w]) => {
      const x = X0 + at * PX;
      at += w;
      return `<rect x="${x}" y="122" width="${w * PX}" height="48" fill="${css}"/><text class="les-see__lbl" x="${x + w * PX / 2}" y="192">${label}</text>`;
    }).join('') + `<rect class="les-see__edge" x="${X0}" y="122" width="${LEN * PX}" height="48"/>`;

    const draw = () => {
      let read = 0, from = 0, top = STRIP[0], most = 0;
      STRIP.forEach((p) => {
        const share = beyond(from - pos, SPOT) - beyond(from + p[4] - pos, SPOT);   // how much of the spot lies on this surface
        from += p[4];
        read += share * p[2];
        if (share > most) { most = share; top = p; }
      });
      const pct = Math.round(read), x = X0 + pos * PX, w = 0.5 + read * 0.05;
      head.setAttribute('transform', `translate(${x})`);
      spot.setAttribute('cx', x);
      back.setAttribute('d', `M${-w} 120V106H${-w - 4}L0 95L${w + 4} 106H${w}V120Z`);   // the more light comes back, the fatter the arrow
      out.textContent = pct;
      bar.style.setProperty('--v', pct);
      name.textContent = top[3];
      sw.style.background = top[1];
      note.textContent = most > 0.99 ? top[5] : 'Граница: под датчиком сразу две поверхности, и число получается между ними.';
      svg.setAttribute('aria-valuenow', Math.round((pos - MIN) / (MAX - MIN) * 100));
      svg.setAttribute('aria-valuetext', `${top[0]}: отражённый свет ${pct} %, цвет ${top[3]}`);
    };
    const set = (v) => { pos = clamp(v, MIN, MAX); draw(); };
    const under = (e) => { const r = svg.getBoundingClientRect(); return ((e.clientX - r.left) / r.width * 720 - X0) / PX; };
    svg.addEventListener('pointerdown', (e) => { svg.setPointerCapture(e.pointerId); set(under(e)); });
    svg.addEventListener('pointermove', (e) => { if (svg.hasPointerCapture(e.pointerId)) set(under(e)); });
    svg.addEventListener('keydown', (e) => {
      const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (e.key === 'Home') set(MIN);
      else if (e.key === 'End') set(MAX);
      else if (dir) set(pos + dir * (e.shiftKey ? 1 : 0.2));
      else return;
      e.preventDefault();
    });
    draw();
  }

  /* ---------- The threshold: the middle of two readings ---------- */
  function initThr(root) {
    const lo = $('#les-thr-b', root), hi = $('#les-thr-w', root), scale = $('#les-scale', root);
    const draw = () => {
      const b = +lo.value, w = +hi.value, t = String((b + w) / 2).replace('.', ',');
      scale.style.setProperty('--b', b);
      scale.style.setProperty('--w', w);
      scale.style.setProperty('--t', (b + w) / 2);
      $('#les-thr-bn', root).textContent = $('#les-thr-bo', root).textContent = b;
      $('#les-thr-wn', root).textContent = $('#les-thr-wo', root).textContent = w;
      $('#les-thr-t', root).textContent = t;
      $('#les-thr-sum', root).textContent = `(${b} + ${w}) / 2 = ${t}`;
    };
    lo.addEventListener('input', draw);
    hi.addEventListener('input', draw);
    $$('[data-thr]', root).forEach((btn) => btn.addEventListener('click', () => {
      [lo.value, hi.value] = btn.dataset.thr.split(',');
      draw();
    }));
    draw();
  }

  /* ---------- The zigzag from above: the rule of the program on the page's own small model of the robot ---------- */
  function makeZig(root) {
    const { TRACK, WHEEL_R, SENSOR } = BOT, track = TRACK * CM, ahead = SENSOR.x * CM, aside = SENSOR.z * CM;
    const WIDE = 2, AMP = 5, LEN = 100;       // the line: 2 cm wide as in the simulator (SPEC §8), a gentle wave that repeats every metre
    const SPEED = 30, STEER = 30;             // LEGO's numbers, as in the program below
    // 100 % of a medium motor is 1110 degrees a second (SPEC §8). The inner wheel runs at speed × (1 − steering / 50) (SPEC §1).
    const full = 1110 * DEG * WHEEL_R * CM, fast = SPEED / 100 * full, slow = fast * (1 - STEER / 50);
    // shortcut: a real robot's lag as two round numbers (the wheels obey 0.05 s late and gain 200 % of speed a second), which swings
    // the lens about a centimetre; the simulator on the «Программа» screen has the tuned motor model.
    const DT = 0.01, LAG = 5, ACC = 2 * full * DT;      // 100 steps a second, as often as the sensor measures
    const mid = (x) => AMP * Math.sin(2 * Math.PI * x / LEN), slope = (x) => AMP * 2 * Math.PI / LEN * Math.cos(2 * Math.PI * x / LEN);

    const world = $('#les-zig-world', root), bot = $('#les-zig-bot', root), trail = $('#les-zig-trail', root);
    const out = $('#les-zig-num', root), bar = $('#les-zig-bar', root), say = $('#les-zig-say', root);
    const branch = { true: $('#les-zig-then', root), false: $('#les-zig-else', root) };
    const play = $('#les-zig-play', root), slowBtn = $('#les-zig-slow', root);
    let line = '';
    for (let x = -LEN; x <= 2 * LEN; x += 2) line += `${x === -LEN ? 'M' : 'L'}${(-mid(x)).toFixed(2)} ${-x}`;
    $('#les-zig-line', root).setAttribute('d', line);
    const eye = $('#les-zig-eye', root);
    eye.setAttribute('cx', aside);
    eye.setAttribute('cy', -ahead);

    // The floor's x runs along the line and y to the robot's left; the picture shows x upwards. The robot starts with its lens on
    // the line's right edge, where the wave is flat.
    let x = LEN / 4 - ahead, y = mid(LEN / 4) - WIDE / 2 + aside, th = 0, vl = 0, vr = 0, read = THRESHOLD, dark = false, shown = null, n = 0;
    const orders = [], dots = [];
    const lens = () => [x + ahead * Math.cos(th) + aside * Math.sin(th), y + ahead * Math.sin(th) - aside * Math.cos(th)];
    const step = () => {
      const [lx, ly] = lens(), off = Math.abs(ly - mid(lx)) * Math.cos(Math.atan(slope(lx)));   // the lens's distance from the line's middle
      read = WHITE - (WHITE - BLACK) * beyond(off - WIDE / 2, SPOT);
      dark = read < THRESHOLD;
      orders.push(dark ? [fast, slow] : [slow, fast]);     // [left wheel, right wheel]: on dark steer right, so the right wheel is the slow one
      const [l, r] = orders.length > LAG ? orders.shift() : [0, 0];
      vl += clamp(l - vl, -ACC, ACC);
      vr += clamp(r - vr, -ACC, ACC);
      x += (vl + vr) / 2 * Math.cos(th) * DT;
      y += (vl + vr) / 2 * Math.sin(th) * DT;
      th += (vr - vl) / track * DT;
      if (++n % 3 === 0) { dots.push([lx, ly]); if (dots.length > 70) dots.shift(); }
    };
    const draw = () => {
      const up = x - Math.floor(x / LEN) * LEN;      // the line repeats, so the picture only ever shows one stretch of it
      world.setAttribute('transform', `translate(0 ${up.toFixed(2)})`);
      bot.setAttribute('transform', `translate(${(-y).toFixed(2)} ${(-up).toFixed(2)}) rotate(${(-th / DEG).toFixed(1)})`);
      trail.setAttribute('points', dots.map(([px, py]) => `${(-py).toFixed(2)},${(x - up - px).toFixed(2)}`).join(' '));
      out.textContent = Math.round(read);
      bar.style.setProperty('--v', Math.round(read));
      if (dark === shown) return;
      shown = dark;
      branch[dark].classList.add('is-on');
      branch[!dark].classList.remove('is-on');
      say.textContent = dark ? 'Темнее порога: вправо.' : 'Светлее порога: влево.';
    };

    let raf = 0, last = 0, bank = 0, playing = live, seen = false, rate = 1;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      bank += clamp((now - last) / 1000, 0, 0.05) * rate;     // a slow computer slows the robot down, it never jumps
      last = now;
      for (; bank >= DT; bank -= DT) step();
      draw();
    };
    const sync = () => {
      const run = playing && seen;
      if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
      play.textContent = playing ? 'Пауза' : 'Пуск';
      play.setAttribute('aria-pressed', playing);
    };
    play.addEventListener('click', () => { playing = !playing; sync(); });
    slowBtn.addEventListener('click', () => {
      rate = rate === 1 ? 0.25 : 1;
      slowBtn.setAttribute('aria-pressed', rate !== 1);
    });
    step();
    draw();
    sync();
    return { start() { seen = true; sync(); }, stop() { seen = false; sync(); } };
  }

  /* ---------- 3D helpers ---------- */
  function shadowCatcher() {
    const m = new T.Mesh(new T.PlaneGeometry(240, 240), new T.ShadowMaterial({ opacity: 0.16 }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.02;
    m.receiveShadow = true;
    return m;
  }

  // A white sheet with a black line whose right edge is under the lens: where the robot rides.
  function sheet() {
    const wide = 2 / CM, paper = new T.Mesh(new T.PlaneGeometry(46, 36), new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }));
    const tape = new T.Mesh(new T.PlaneGeometry(46, wide), new T.MeshBasicMaterial({ color: '#16151a' }));
    paper.rotation.x = tape.rotation.x = -Math.PI / 2;
    paper.receiveShadow = true;
    tape.position.set(0, 0.005, BOT.SENSOR.z - wide / 2);
    return new T.Group().add(paper, tape);
  }

  // A stage looking at the robot from a direction [az, up]: az 0 is its right side (+Z), a quarter turn is its front (+X).
  function botStage(el, [az, up]) {
    const dir = [Math.sin(az) * Math.cos(up), Math.sin(up), Math.cos(az) * Math.cos(up)];
    const stage = RA.stage(el, { fov: 22, maxDpr: 1.5, camera: dir.map((v, i) => v * 100 + (i === 1 ? 4 : 0)), target: [0, 4, 0] });
    if (stage.controls) {
      stage.controls.enableZoom = false;      // the wheel must keep scrolling the page
      stage.renderer.domElement.style.touchAction = 'pan-y';
    }
    return stage;
  }

  // Keeps a box in view whatever the model looks like: the target glides to its centre, the camera keeps its direction.
  function fitter(stage, obj) {
    const box = new T.Box3(), one = new T.Box3(), mid = new T.Vector3(), d = new T.Vector3();
    const ax = [new T.Vector3(), new T.Vector3(), new T.Vector3()], corners = Array.from({ length: 8 }, () => new T.Vector3());
    const tan = Math.tan((stage.camera.fov * DEG) / 2);
    let snap = true;
    return {
      // Without a box: what is visible now (build stages, exploded view).
      measure(b) {
        if (b) box.copy(b);
        else {
          box.makeEmpty();
          obj.updateMatrixWorld(true);
          obj.traverseVisible((o) => { if (o.isMesh) box.union(one.setFromObject(o)); });
        }
        if (box.isEmpty()) return;
        box.getCenter(mid);
        corners.forEach((c, i) => c.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(mid));
      },
      step(dt) {
        const c = stage.controls, cam = stage.camera;
        if (!c) return;
        const k = snap || !live ? 1 : 1 - Math.exp(-dt * 3);
        snap = false;
        d.copy(mid).sub(c.target).multiplyScalar(k);
        c.target.add(d);
        cam.position.add(d);
        // Every corner of the box must fit across and up the view; the corners nearer the camera need more room.
        cam.updateMatrixWorld();
        ax.forEach((a, i) => a.setFromMatrixColumn(cam.matrixWorld, i));
        let want = 0;
        corners.forEach((p) => {
          want = Math.max(want, Math.max(Math.abs(p.dot(ax[0])) / (tan * cam.aspect), Math.abs(p.dot(ax[1])) / tan) + p.dot(ax[2]));
        });
        const now = cam.position.distanceTo(c.target);
        cam.position.sub(c.target).setLength(now + (want * 1.08 - now) * k).add(c.target);
      },
    };
  }

  // Turns the camera round its target to a view [az, up], the short way round, until someone drags the model.
  function turner(stage) {
    const sph = new T.Spherical(), off = new T.Vector3(), c = stage.controls;
    let az = 0, polar = 0, turning = false;
    if (c) c.addEventListener('start', () => { turning = false; });   // a drag wins over the automatic turn
    return {
      to([a, up]) { az = a; polar = Math.PI / 2 - up; turning = true; },
      step(dt) {
        if (!turning || !c) return;
        sph.setFromVector3(off.copy(stage.camera.position).sub(c.target));   // theta is our az, phi is measured from straight up
        const k = live ? 1 - Math.exp(-dt * 3) : 1;
        const da = Math.atan2(Math.sin(az - sph.theta), Math.cos(az - sph.theta)), dp = polar - sph.phi;
        sph.theta += da * k;
        sph.phi += dp * k;
        if (Math.abs(da) + Math.abs(dp) < 0.01) turning = false;
        stage.camera.position.copy(c.target).add(off.setFromSpherical(sph));
      },
    };
  }

  /* ---------- Our robot: parts and ports ---------- */
  // Views [az, up]: LEGO's cover picture (from the front-right, above), and the side a part shows best from.
  const COVER = [0.95, 0.42];
  const VIEW = {
    hub: [0.95, 1.05], motors: [0.35, 0.3], wheelL: [Math.PI - 0.5, 0.2], wheelR: [0.5, 0.2],
    caster: [-1.1, 0.12], tool: [1.35, 0.6], sensor: [0.85, 0.16], cables: [-0.9, 0.75],
  };

  function makeBot(root, sel) {
    const stage = botStage($('#les-bot-stage', root), COVER);
    const r = BOT(), fit = fitter(stage, r.group), turn = turner(stage);
    stage.scene.add(r.group, sheet());
    fit.measure(r.box);
    const list = $('#les-parts', root), name = $('#les-part-name', root), role = $('#les-part-role', root), all = role.textContent;

    sel.apply = () => {
      const p = r.PARTS.find((x) => x.id === sel.part);
      r.highlight(p ? p.id : null);
      r.setSensorLight(!p || p.id === 'sensor');      // the lens shines on the edge of the line
      name.textContent = p ? p.name : 'Весь робот';
      role.textContent = p ? p.role : all;
      $$('[data-part]', list).forEach((b) => b.setAttribute('aria-pressed', b.dataset.part === (p ? p.id : '')));
      turn.to((p && VIEW[p.id]) || COVER);
    };
    sel.apply();

    stage.frame((dt) => {
      turn.step(dt);
      fit.step(dt);
      r.update(dt);
    });
    return stage;
  }

  function initParts(root) {
    const sel = { part: '', apply() {} };
    // Drawn now, not when the 3D stage scrolls in: by then a keyboard user has tabbed past them.
    $('#les-parts', root).innerHTML = [{ id: '', name: 'Весь робот' }, ...BOT.PARTS]
      .map((p) => `<button type="button" data-part="${p.id}" aria-pressed="${p.id === ''}">${p.name}</button>`).join('');
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-part]');
      if (!b) return;
      sel.part = b.dataset.part;
      sel.apply();
    });
    return sel;
  }

  /* ---------- Build stepper ---------- */
  function makeBuild(root) {
    // The caster hides under the hub's rear end and the sensor under the right beam's front end: those two stages are shown from there.
    const FROM = [0.95, 0.5], REAR = [-1.1, 0.14], LOW = [0.85, 0.2];
    const stage = botStage($('#les-build-stage', root), FROM);
    const r = BOT(), fit = fitter(stage, r.group), turn = turner(stage);
    stage.scene.add(r.group, shadowCatcher());
    const S = r.STAGES, last = S.length - 1, plays = live && !!stage.renderer;
    const rail = $('#les-rail', root), prev = $('#les-stage-prev', root), next = $('#les-stage-next', root), explode = $('#les-explode', root);
    // One hole per instruction step: «шаги 1–5» is five holes. The last stage is the sensor's own build, with its own step numbers.
    rail.innerHTML = S.map((s, i) => {
      const m = /(\d+)\D+(\d+)/.exec(s.steps), n = m ? m[2] - m[1] + 1 : 1;
      return `<li style="flex:${n} 1 0"${i === last ? ' class="is-new"' : ''}><button type="button" data-stage="${i}" aria-label="Этап ${i + 1}: ${s.title}, ${s.steps}">${'<i></i>'.repeat(n)}</button><span>${m ? m[1] + '–' + m[2] : ''}</span></li>`;
    }).join('');
    const items = $$('li', rail);
    let n = 0, tween = 1, aim = FROM;

    const show = (i, animate) => {
      n = i;
      r.setBuildStage(n, 1);
      fit.measure();
      tween = animate && plays ? 0 : 1;
      r.setBuildStage(n, tween);
      const s = S[n];
      $('#les-stage-n', root).textContent = `Этап ${n + 1} из ${last + 1}.`;
      $('#les-stage-steps', root).textContent = `В инструкции: ${s.steps}`;
      $('#les-stage-title', root).textContent = s.title;
      $('#les-stage-text', root).textContent = s.text;
      $('#les-stage-parts', root).textContent = [].concat(s.parts).join(', ');
      items.forEach((li, k) => {
        li.classList.toggle('is-done', k < n);
        li.classList.toggle('is-now', k === n);
        if (k === n) li.firstChild.setAttribute('aria-current', 'step');
        else li.firstChild.removeAttribute('aria-current');
      });
      prev.disabled = n === 0;
      next.disabled = n === last;
    };
    const go = (i) => {
      explode.value = 0;
      r.setExplode(0);
      show(i, true);
      const want = i === 1 ? REAR : i === last ? LOW : FROM;
      if (want !== aim) turn.to((aim = want));     // only when the side changes: a model someone turned stays as it is
    };

    rail.addEventListener('click', (e) => { const b = e.target.closest('[data-stage]'); if (b) go(+b.dataset.stage); });
    prev.addEventListener('click', () => go(n - 1));
    next.addEventListener('click', () => go(n + 1));
    // Taking a model apart starts from the whole model.
    explode.addEventListener('input', () => {
      if (n !== last) show(last, false);
      r.setExplode(explode.value / 100);
      fit.measure();
    });
    show(0, false);

    stage.frame((dt) => {
      if (tween < 1) {
        tween = Math.min(1, tween + dt / 0.9);
        r.setBuildStage(n, tween);
      }
      turn.step(dt);
      fit.step(dt);
      r.update(dt);
    });
    return stage;
  }

  /* ---------- Quiz ---------- */
  const QUIZ = [
    { q: 'Что измеряет датчик цвета в режиме отражённого света?', a: ['Сколько его собственного света вернулось от пола', 'Какого цвета пол', 'Сколько сантиметров до пола'], ok: 0,
      why: 'Датчик светит вниз своим белым светом и измеряет, сколько вернулось: от 0 до 100 %. Название цвета даёт другой режим, «цвет».' },
    { q: 'Где число отражённого света больше?', a: ['На чёрной ленте', 'На белой бумаге', 'Везде одинаково'], ok: 1,
      why: 'Белая бумага возвращает почти весь свет: в нашем симуляторе около 95 %. Чёрная лента почти ничего: около 5 %.' },
    { q: 'На чёрном датчик показал 20 %, на белом 90 %. Какой взять порог?', a: ['70', '110', '55'], ok: 2,
      why: 'Порог — середина между двумя показаниями: (20 + 90) / 2 = 55.' },
    { q: 'Почему робот с одним датчиком едет по краю линии, а не по середине?', a: ['На краю линия шире', 'По середине датчик ничего не видит', 'На краю понятно, куда он съехал: стало темнее или светлее'], ok: 2,
      why: 'На середине датчик видит чёрное, куда бы робот ни сместился. На краю иначе: стало темнее — заехал на линию, стало светлее — уходит от неё.' },
    { q: 'Робот слетает с линии на повороте. Что попробовать?', a: ['Уменьшить скорость или сделать поворот круче', 'Увеличить скорость', 'Переставить датчик в другой порт'], ok: 0,
      why: 'На большой скорости робот не успевает повернуть. Помогает ехать медленнее или поворачивать круче: например, 50 и −50 вместо 30 и −30.' },
  ];
  const VERDICT = ['Вернись к уроку и попробуй ещё раз.', 'Вернись к уроку и попробуй ещё раз.', 'Неплохо. Вернись к разделам, где были ошибки, и попробуй ещё раз.', 'Хорошо. Осталось чуть-чуть.', 'Отлично, почти всё верно.', 'Отлично, всё верно.'];

  function initQuiz(root) {
    const box = $('#les-quiz-box', root), pins = $('#les-quiz-pins', root), lastLine = $('#les-quiz-last', root);
    let i = 0, marks = [];
    const paintPins = () => {
      pins.innerHTML = QUIZ.map((q, k) => `<i class="${k in marks ? (marks[k] ? 'is-right' : 'is-wrong') : k === i ? 'is-now' : ''}"></i>`).join('');
      pins.setAttribute('aria-label', `Верных ответов: ${marks.filter(Boolean).length} из ${QUIZ.length}`);
    };
    const paintLast = () => {
      const past = RA.store.get('lessonQuiz', null);
      lastLine.textContent = past ? `Прошлый результат: ${past.score} из ${past.total}` : '';
    };
    const ask = () => {
      const q = QUIZ[i];
      box.innerHTML = `<div class="les-quiz__ask"><p class="les-quiz__q">${q.q}</p><p class="les-quiz__why" aria-live="polite"></p><div class="les-quiz__foot"></div></div>
        <div class="les-opts">${q.a.map((a, k) => `<button type="button" class="les-opt" data-a="${k}">${a}</button>`).join('')}</div>`;
      paintLast();
      paintPins();
    };
    const answer = (k) => {
      const q = QUIZ[i], right = k === q.ok;
      marks[i] = right;
      $$('.les-opt', box).forEach((b, n) => {
        b.disabled = true;
        if (n === q.ok) b.classList.add('is-right');
        else if (n === k) b.classList.add('is-wrong');
      });
      $('.les-quiz__why', box).innerHTML = `<b>${right ? 'Верно.' : 'Не совсем.'}</b> ${q.why}`;
      $('.les-quiz__foot', box).innerHTML = `<button type="button" class="btn" data-next>${i < QUIZ.length - 1 ? 'Следующий вопрос' : 'Узнать результат'}</button>`;
      $('[data-next]', box).focus({ preventScroll: true });
      paintPins();
    };
    const finish = () => {
      const score = marks.filter(Boolean).length;
      RA.store.set('lessonQuiz', { score, total: QUIZ.length });
      RA.progress.mark('lesson');
      lastLine.textContent = '';
      box.innerHTML = `<div class="les-quiz__end"><p class="les-quiz__score">${score} из ${QUIZ.length}</p><p class="les-quiz__q">${VERDICT[score]}</p>
        <div class="les-quiz__foot"><a class="btn" href="#examples">Дальше: в жизни</a><button type="button" class="btn" data-again>Пройти ещё раз</button></div></div>`;
      paintPins();
    };
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.a) answer(+b.dataset.a);
      else if ('next' in b.dataset) { i += 1; if (i < QUIZ.length) ask(); else finish(); }
      else if ('again' in b.dataset) { i = 0; marks = []; ask(); }
    });
    ask();
  }

  /* ---------- View ---------- */
  let active = false;
  const syncs = [];

  // Builds its part on first sight of el, then runs it only while el is both on screen and in the current view.
  function watch(el, make) {
    let stage = null, seen = false;
    const sync = () => {
      if (seen && active && !stage) stage = make();
      if (!stage) return;
      if (seen && active) stage.start();
      else stage.stop();
    };
    // The top bar covers the first 64px, and a box that merely touches the edge still counts: hence 65.
    new IntersectionObserver((list) => { seen = list[list.length - 1].isIntersecting; sync(); }, { rootMargin: '-65px 0px 0px' }).observe(el);
    syncs.push(sync);
  }

  RA.view('lesson', {
    init(root) {
      drawBot(root);
      drawPlan(root);
      $$('[data-geo]', root).forEach((el) => { el.textContent = Math.round(BOT.SENSOR[el.dataset.geo] * 8); });   // modules to millimetres
      initSee(root);
      initThr(root);
      initQuiz(root);
      const sel = initParts(root), zig = makeZig(root);
      watch($('#les-zig', root), () => zig);
      watch($('#les-bot-stage', root), () => makeBot(root, sel));
      watch($('#les-build-stage', root), () => makeBuild(root));
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-to]');
        if (b) $('#' + b.dataset.to).scrollIntoView({ behavior: live ? 'smooth' : 'auto' });
      });
    },
    enter() { active = true; syncs.forEach((s) => s()); },
    leave() { active = false; syncs.forEach((s) => s()); },
  });
})();
