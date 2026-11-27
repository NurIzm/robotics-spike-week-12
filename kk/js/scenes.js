// Six machines that keep to a line or a wire, as short looping stories. Each entry is one phase table and build(root, stage) =>
// apply(pose, time, loop); the facts and their sources are in examples.js. A row of the table holds the pose reached at its end,
// a row with text opens a caption step. Every scene is a small diorama: a slab, a path on it, a vehicle that rides the path.
(function () {
  const RA = window.RA;
  const PI = Math.PI;

  const mats = {};
  const mat = (color, o) => {
    const key = color + (o ? JSON.stringify(o) : '');
    return mats[key] || (mats[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.38, envMapIntensity: 0.5 }, o)));
  };

  // Collects shapes and merges them per material, so a rigid part costs one draw call per colour.
  function kit(parent) {
    const sets = new Map();
    const k = {
      geo(g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
        g = (g.index ? g.toNonIndexed() : g).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z);
        if (!sets.has(m)) sets.set(m, []);
        sets.get(m).push(g);
        return k;
      },
      box: (w, h, d, m, x, y, z, rx, ry, rz) => k.geo(new THREE.RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.14), m, x, y, z, rx, ry, rz),
      bar: (w, h, d, m, x, y, z, rx, ry, rz) => k.geo(new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz), // sharp and cheap, for slats and stickers
      cyl: (r, h, m, x, y, z, axis, r2 = r) => k.geo(new THREE.CylinderGeometry(r, r2, h, 20), m, x, y, z, axis === 'z' ? PI / 2 : 0, 0, axis === 'x' ? -PI / 2 : 0),
      done() {
        sets.forEach((list, m) => {
          list.forEach((g) => g.deleteAttribute('uv'));
          const mesh = new THREE.Mesh(list.length > 1 ? THREE.BufferGeometryUtils.mergeGeometries(list) : list[0], m);
          mesh.castShadow = mesh.receiveShadow = !m.transparent; // see-through parts must not throw a solid shadow
          parent.add(mesh);
        });
        return parent;
      },
    };
    return k;
  }

  // The diorama's base: the floor of the story, with a thin edge.
  const slab = (root, w, d, color) => kit(root).box(w, 1.2, d, mat(color, { roughness: 0.85 }), 0, -0.6, 0).done();

  // A path on the floor through [x, z] points; getPointAt(u) walks it at an even pace, u from 0 to 1.
  const path = (pts, closed = false) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed, 'centripetal');

  // A flat band along a path: tape, paint, the slot of a wire. `dash` cuts it into dashes of that many steps.
  function band(root, c, width, color, y = 0.03, dash = 0, n = 300) {
    const pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const p = c.getPointAt(i / n), t = c.getTangentAt(i / n), ox = (t.z * width) / 2, oz = (-t.x * width) / 2;
      pos.push(p.x + ox, y, p.z + oz, p.x - ox, y, p.z - oz);
      if (i < n && (!dash || Math.floor(i / dash) % 2 === 0)) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat(color, { roughness: 0.75 }));
    m.receiveShadow = true;
    root.add(m);
    return m;
  }
  const line = (root, a, b, width, color, dash) => band(root, path([a, b]), width, color, 0.04, dash, 60);

  // Puts obj on the path at u, its local +X along the path and `side` units to its right: the small corrections of a line follower.
  function ride(obj, c, u, side = 0) {
    u = c.closed ? ((u % 1) + 1) % 1 : THREE.MathUtils.clamp(u, 0, 1);
    const p = c.getPointAt(u), t = c.getTangentAt(u);
    obj.position.set(p.x - t.z * side, obj.position.y, p.z + t.x * side);
    obj.rotation.y = Math.atan2(-t.z, t.x);
  }

  // A soft light on the floor: what a sensor feels, or the pulses of a wire's signal.
  const glow = (parent, r, x, z, color = '#ffd36b', y = 0.1) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // A vehicle, nose along +X, wheels on the floor. o: length, width, body height, wheel radius, colours, an optional cab [length, height, x].
  function vehicle(o) {
    const g = new THREE.Group(), k = kit(g), r = o.r || 1.3, body = mat(o.color), tyre = mat('#1e2126', { roughness: 0.8 });
    k.box(o.l, o.h, o.w, body, 0, r * 0.9 + o.h / 2, 0);
    if (o.cab) {
      const [cl, ch, cx] = o.cab, glass = mat('#30414f', { roughness: 0.2 });
      k.box(cl, ch, o.w * 0.84, mat(o.cabColor || o.color), cx, r * 0.9 + o.h + ch / 2 - 0.2, 0);
      k.bar(cl * 0.86, ch * 0.5, o.w * 0.86, glass, cx, r * 0.9 + o.h + ch * 0.55, 0);      // the windows, a dark band round the cab
    }
    const wx = o.l / 2 - r * 1.25;
    [-wx, wx].forEach((x) => [-1, 1].forEach((s) => k.cyl(r, 0.9, tyre, x, r, s * (o.w / 2 - 0.25), 'z').cyl(r * 0.45, 0.95, mat('#c9ced3'), x, r, s * (o.w / 2 - 0.25), 'z')));
    k.done();
    return g;
  }

  /* ---------- 1. The first driverless tow truck, 1950s: a wire in a slot in the floor ---------- */
  function wire(root) {
    slab(root, 104, 58, '#d4ccbf');
    const c = path([[-50, 12], [-26, 12], [-8, 6], [8, -6], [26, -12], [50, -12]]);
    band(root, c, 2, '#8d8477', 0.02);                       // the slot
    band(root, c, 0.45, '#c46f2a', 0.05);                    // the wire in it
    const k = kit(root), post = mat('#5b6670'), board = mat('#9aa4ab'), crate = mat('#b9844f');
    // Shelves along the way, crates on them.
    [[-34, -8, 0], [-6, -18, 0], [16, 16, 0], [38, 6, 0]].forEach(([x, z]) => {
      [-7, 7].forEach((dx) => [-2.4, 2.4].forEach((dz) => k.bar(0.6, 13, 0.6, post, x + dx, 6.5, z + dz)));
      [1, 6, 11].forEach((y, i) => {
        k.bar(15, 0.5, 5.4, board, x, y, z);
        for (let n = 0; n < 3; n++) if ((n + i) % 3) k.box(3.6, 3.2, 3.6, crate, x - 4.6 + n * 4.6, y + 1.85, z);
      });
    });
    k.done();
    const tug = vehicle({ l: 8, w: 5, h: 2.2, r: 1.3, color: '#e07b2a', cab: [3, 2.8, -1.8], cabColor: '#c9661c' });
    kit(tug).bar(2, 0.5, 2.4, mat('#24282d'), 3.3, 0.55, 0).bar(2.4, 0.4, 0.4, mat('#5b6670'), -5, 1.3, 0).done();   // the sensor under the nose, the tow bar
    const feel = glow(tug, 1.6, 3.3, 0, '#ffb347');
    const cart = vehicle({ l: 9, w: 5, h: 0.8, r: 1, color: '#7f8b93' });
    kit(cart).box(3.6, 3, 3.6, crate, -2, 3.3, 0).box(3.6, 3, 3.6, crate, 2.2, 3.3, 0).box(3.4, 2.6, 3.4, crate, -1.8, 6.1, 0).done();
    const pulses = Array.from({ length: 8 }, () => glow(root, 1, 0, 0, '#ffb347', 0.07));
    root.add(tug, cart);
    return (p, time) => {
      pulses.forEach((m, i) => { ride(m, c, (time * 0.04 + i / 8) % 1); m.material.opacity = p.wave * (0.5 + 0.5 * Math.sin(time * 6 + i)); });
      ride(tug, c, p.u, 0.22 * Math.sin(time * 4.5));
      ride(cart, c, p.u - 0.105);
      feel.material.opacity = p.feel * (0.55 + 0.35 * Math.sin(time * 10));
    };
  }

  /* ---------- 2. RCA's model car, 1953: wires laid on the laboratory floor ---------- */
  function lab(root) {
    slab(root, 96, 56, '#e7e1d3');
    const c = path([[-30, 0], [-22, -14], [0, -17], [22, -14], [30, 0], [22, 14], [0, 17], [-22, 14]], true);
    band(root, c, 0.5, '#c46f2a', 0.05);
    const k = kit(root), desk = mat('#7b8790'), panel = mat('#d9dee2'), dial = mat('#2c3640');
    // The engineers' bench at the back, with a panel of dials.
    k.box(40, 7, 7, desk, 0, 3.5, -24).box(36, 9, 1, panel, 0, 11.5, -26.5);
    for (let i = 0; i < 6; i++) k.cyl(1.2, 0.4, dial, -12.5 + i * 5, 12.5, -25.9, 'z').cyl(0.5, 0.4, mat('#e2342b'), -12.5 + i * 5, 9.2, -25.9, 'z');
    k.done();
    const car = vehicle({ l: 10, w: 5, h: 2, r: 1.2, color: '#f0e6cf', cab: [4.6, 2.2, -0.6], cabColor: '#e2342b' });
    kit(car).bar(10.1, 0.5, 5.1, mat('#e2342b'), 0, 2.4, 0).done();      // the stripe along its sides
    const feel = glow(car, 1.8, 3, 0, '#ffb347');
    root.add(car);
    return (p, time) => {
      ride(car, c, p.u, 0.18 * Math.sin(time * 4));
      feel.material.opacity = p.feel * (0.55 + 0.35 * Math.sin(time * 10));
    };
  }

  /* ---------- 3. Volvo Kalmar, 1974: carriers with car bodies follow wires in the floor, no conveyor ---------- */
  function kalmar(root) {
    slab(root, 112, 64, '#b9c2c8');
    const c = path([[-40, 18], [-40, -18], [0, -18], [40, -18], [40, 18], [0, 18]], true);
    band(root, c, 1.6, '#8d979e', 0.02);
    band(root, c, 0.4, '#c46f2a', 0.05);
    const k = kit(root), frame = mat('#fed920'), cab = mat('#5b6670');
    // Two work places by the way: a yellow frame over the path, tool cabinets beside it.
    [[0, -18], [0, 18]].forEach(([x, z]) => {
      [-9, 9].forEach((dx) => [-7, 7].forEach((dz) => k.bar(0.8, 14, 0.8, frame, x + dx, 7, z + dz)));
      [-7, 7].forEach((dz) => k.bar(18.8, 0.8, 0.8, frame, x, 14, z + dz));
      k.box(5, 6, 3, cab, x - 14, 3, z + (z < 0 ? -7 : 7)).box(5, 6, 3, cab, x + 14, 3, z + (z < 0 ? -7 : 7));
    });
    k.done();
    const carriers = ['#e2342b', '#1e6fd9', '#eceded'].map((color) => {
      const g = vehicle({ l: 13, w: 6.4, h: 1, r: 0.9, color: '#f29b1d' }), body = vehicle({ l: 11, w: 5.4, h: 2.4, r: 1.1, color, cab: [5.4, 2.4, -0.8] });
      body.position.y = 1.1;      // the car body stands on the carrier on its own wheels
      g.add(body);
      root.add(g);
      return g;
    });
    return (p, time) => carriers.forEach((g, i) => ride(g, c, p.u + i / 3, 0.15 * Math.sin(time * 3 + i)));
  }

  /* ---------- 4. Tsukuba, 1977: no wires, two cameras watch the road markings ---------- */
  function cameras(root) {
    slab(root, 112, 64, '#8fbf6a');
    const c = path([[-56, 10], [-30, 10], [-10, 2], [10, -8], [30, -12], [56, -12]]);
    band(root, c, 16, '#4a5057', 0.02);
    [-7, 7].forEach((s) => {
      const edge = path(Array.from({ length: 41 }, (_, i) => { const u = i / 40, p = c.getPointAt(u), t = c.getTangentAt(u); return [p.x - t.z * s, p.z + t.x * s]; }));
      band(root, edge, 0.5, '#f4f4f0', 0.04);
    });
    band(root, c, 0.5, '#f4f4f0', 0.04, 6);
    const car = vehicle({ l: 11, w: 5.4, h: 2.4, r: 1.25, color: '#eceded', cab: [5.2, 2.3, -1], cabColor: '#d7dcdf' });
    const k = kit(car), lens = mat('#1d2329', { roughness: 0.2 });
    [-1.4, 1.4].forEach((z) => k.box(1.8, 1.4, 1.2, mat('#2c3640'), 0.6, 7.3, z).cyl(0.45, 0.5, lens, 1.6, 7.3, z, 'x'));
    k.done();
    // What the two cameras look at: the road markings ahead.
    const view = new THREE.MeshBasicMaterial({ color: '#7fdcff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    [-1.4, 1.4].forEach((z) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(4, 16, 18, 1, true).translate(0, -8, 0).rotateZ(1.2), view);
      m.position.set(1.8, 7.3, z);
      car.add(m);
    });
    root.add(car);
    return (p, time) => {
      ride(car, c, p.u, 3.5 + 0.2 * Math.sin(time * 2));        // in its own lane, right of the middle line
      view.opacity = p.look * 0.22;
    };
  }

  /* ---------- 5. Lane keeping: the car drifts to the line, the system notices and brings it back ---------- */
  function lane(root) {
    slab(root, 120, 52, '#9fb38f');
    const road = path([[-60, 0], [60, 0]]);
    band(root, road, 26, '#4a5057', 0.02, 0, 10);
    line(root, [-60, -11], [60, -11], 0.6, '#f4f4f0');
    line(root, [-60, 11], [60, 11], 0.6, '#f4f4f0');
    line(root, [-60, 0], [60, 0], 0.6, '#f4f4f0', 3);
    const lanePath = path([[-58, 5.5], [58, 5.5]]), fast = path([[-58, -5.5], [58, -5.5]]);
    const car = vehicle({ l: 11, w: 5.2, h: 2.2, r: 1.25, color: '#1e6fd9', cab: [5.6, 2, -0.6] });
    const feel = [-1.6, 1.6].map((z) => glow(car, 1.1, 5.2, z, '#ff6a3d'));
    const alarm = new THREE.Mesh(new THREE.RingGeometry(5.8, 6.6, 40).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb000', transparent: true, opacity: 0, depthWrite: false }));
    alarm.position.y = 0.12;
    car.add(alarm);
    const other = vehicle({ l: 11, w: 5.2, h: 2.2, r: 1.25, color: '#eceded', cab: [5.6, 2, -0.6] });
    root.add(car, other);
    return (p, time, loop) => {
      ride(car, lanePath, p.u, -p.side);
      car.rotation.y += p.yaw;
      ride(other, fast, 0.12 + loop * 0.4);
      feel.forEach((m) => { m.material.opacity = p.feel * (0.5 + 0.4 * Math.sin(time * 12)); });
      alarm.material.opacity = p.warn * (0.5 + 0.5 * Math.sin(time * 14));
    };
  }

  /* ---------- 6. RoboCupJunior Rescue Line: white tiles, a black line with a gap, a green marker before a crossing ---------- */
  function rescue(root) {
    const T = 16, k = kit(root), white = mat('#f7f7f4', { roughness: 0.8 }), seam = mat('#d5dade');
    for (let i = -3; i < 3; i++) for (let j = -2; j < 2; j++) k.box(T - 0.3, 1.2, T - 0.3, white, (i + 0.5) * T, -0.6, (j + 0.5) * T);
    k.bar(T * 6 + 0.4, 0.6, T * 4 + 0.4, seam, 0, -0.9, 0).done();
    const ink = '#16151a';
    // A tile is 30 cm, so 16 units: the line is 1 unit (about 2 cm), the green marker 1.4 (about 25 mm).
    line(root, [-48, 8], [-14, 8], 1, ink);
    line(root, [-4, 8], [20, 8], 1, ink);                   // after the gap
    line(root, [20, 8], [48, 8], 1, ink);
    line(root, [20, 8], [20, -32], 1, ink);                // the crossing's branch to the left
    line(root, [20, 8], [20, 32], 1, ink);
    kit(root).bar(1.4, 0.1, 1.4, mat('#1f9d55'), 17.4, 0.06, 6.4).done();   // the green marker: turn left at the crossing
    const c = path([[-46, 8], [-14, 8], [-4, 8], [14, 8], [19, 5.5], [20, 0], [20, -30]]);
    const bot = new THREE.Group(), b = kit(bot);
    b.box(4.4, 2.6, 4.2, mat('#fed920'), -0.4, 3, 0).box(4.6, 0.8, 4.4, mat('#eceded'), -0.4, 4.6, 0)
      .bar(1.2, 1, 3.4, mat('#16151a'), 2.6, 1.4, 0);
    [-1, 1].forEach((s) => b.cyl(1.4, 0.9, mat('#01adc4'), -0.6, 1.4, s * 2.6, 'z'));
    b.done();
    const feel = glow(bot, 1.2, 2.6, 0, '#ffd36b');
    bot.scale.setScalar(1.5);        // about 20 cm long, as such robots are
    root.add(bot);
    return (p, time) => {
      ride(bot, c, p.u, 0.25 * Math.sin(time * 7) * (1 - p.gap));
      feel.material.opacity = 0.35 + 0.3 * Math.sin(time * 10);
    };
  }

  RA.SCENES = [
    {
      id: 'wire', bg: 'linear-gradient(#f3f1ec, #dcd6cb)', camera: [0, 111, 144], target: [0, 0, 0], poster: 6,
      start: { u: 0.13, feel: 0, wave: 0 },
      phases: [
        { s: 2.4, text: 'Едендегі ойықта сигналы бар сым жатыр', wave: 1 },
        { s: 1.8, text: 'Тартқыштың датчигі сымды сезеді', feel: 1 },
        { s: 5, text: 'Жүргізушісіз тартқыш тіркемені сым бойымен сүйрейді', u: 0.55, linear: true },
        { s: 4.6, text: 'Сым бұрылды, тартқыш та оның соңынан', u: 0.95, linear: true },
        { s: 1.2, feel: 0, wave: 0 },
      ],
      build: wire,
    },
    {
      id: 'lab', bg: 'linear-gradient(#f4f1ea, #ded8c9)', camera: [0, 105, 126], target: [0, 2, 0], poster: 5,
      start: { u: 0, feel: 0 },
      phases: [
        { s: 2.2, text: 'Зертхана еденіне сымдар төселген', feel: 1, u: 0.08, linear: true },
        { s: 6, text: 'Кішкентай машина олардың үстімен өзі жүреді', u: 0.55, linear: true },
        { s: 5.8, text: 'және сымдар апаратын жаққа бұрылады', u: 1, linear: true },
      ],
      build: lab,
    },
    {
      id: 'kalmar', bg: 'linear-gradient(#eef1f3, #cfd7dc)', camera: [0, 120, 138], target: [0, 2, 0], poster: 3,
      start: { u: 0 },
      phases: [
        { s: 2, text: 'Цех еденіне сымдар көмілген' },
        { s: 4.6, text: 'Арбалар шанақтарды сымдар бойымен тасиды', u: 0.165 },
        { s: 3, text: 'Жұмыс орнында арба машина құрастырылғанша күтеді' },
        { s: 4.4, text: 'Дайын, енді арба әрі қарай жүреді', u: 1 / 3 },
      ],
      build: kalmar,
    },
    {
      id: 'tsukuba', bg: 'linear-gradient(#eef5ea, #cfe0c4)', camera: [-9, 105, 138], target: [0, 0, 0], poster: 6,
      start: { u: 0.04, look: 0 },
      phases: [
        { s: 2.2, text: 'Бұл жолдың астында сым жоқ' },
        { s: 2, text: 'Екі камера алдағы жол таңбасына қарайды', look: 1 },
        { s: 8.5, text: 'Машина өз жолағымен өзі жүреді', u: 0.94, linear: true },
        { s: 1, look: 0 },
      ],
      build: cameras,
    },
    {
      id: 'lane', bg: 'linear-gradient(#eef3ea, #d2dec8)', camera: [9, 93, 123], target: [0, 0, 2], poster: 7.4,
      start: { u: 0.05, side: 0, yaw: 0, feel: 0, warn: 0 },
      phases: [
        { s: 3, text: 'Машина өз жолағымен жүреді', u: 0.3, linear: true },
        { s: 2.6, text: 'Машина таңба сызығына қарай ауытқып кетті', u: 0.5, side: 4, yaw: 0.07, linear: true },
        { s: 1.4, text: 'Датчиктер сызықты көрді', u: 0.6, side: 4.6, yaw: 0.02, feel: 1, linear: true },
        { s: 1.6, text: 'Жүйе жүргізушіге ескертеді', u: 0.71, warn: 1, linear: true },
        { s: 2.8, text: 'Машина өз жолағына қайтады', u: 0.92, side: 0, yaw: 0, feel: 0, warn: 0, linear: true },
      ],
      build: lane,
    },
    {
      id: 'rescue', bg: 'linear-gradient(#f2f5f7, #d6dde2)', camera: [-15, 117, 129], target: [0, 0, 0], poster: 9.5,
      start: { u: 0, gap: 0 },
      phases: [
        { s: 2.4, text: 'Ақ плиткалар, үстінде қара сызық', u: 0.04, linear: true },
        { s: 3.2, text: 'Робот сызық бойымен жүреді', u: 0.3, linear: true },
        { s: 2.6, text: 'Сызық үзілді: робот сызық қайта басталғанша тура жүреді', u: 0.45, gap: 1, linear: true },
        { s: 0.4, gap: 0, u: 0.47, linear: true },
        { s: 3.4, text: 'Қиылыс алдында жасыл белгі: солға бұрыл', u: 0.8, linear: true },
        { s: 2, u: 1, linear: true },
      ],
      build: rescue,
    },
  ];
})();
