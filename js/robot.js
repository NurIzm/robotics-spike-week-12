// «Мобильная платформа 3»: LEGO's Driving Base 3 for SPIKE Prime (the driving base plus the colour sensor module), built
// procedurally from the step pictures of the SPIKE app. 1 unit = 1 LEGO module (8 mm). Axes of r.group: +X forward (the
// colour-sensor end), +Y up, +Z the robot's right. Origin: on the floor under the middle of the wheel axle; the tyres and the
// caster ball touch Y = 0. ref/bi/NOTES.md «Model decisions» has the numbers and which of them are guesses.
// Geometry and materials are built once; each createRobot() only adds meshes and its own state.
(function () {
  const RA = window.RA;
  const T = THREE;
  const { mergeGeometries, toCreasedNormals } = T.BufferGeometryUtils;
  const Q = Math.PI / 2, TAU = Math.PI * 2, DEG = Math.PI / 180;
  const clamp = T.MathUtils.clamp;
  const smooth = (t) => t * t * (3 - 2 * t);
  const polar = (a, r = 1) => [Math.cos(a) * r, Math.sin(a) * r];

  const PARTS = [
    { id: 'chassis', name: 'Рама', role: 'Держит всё вместе: рамка снизу и две чёрные балки по бокам' },
    { id: 'hub', name: 'Хаб', role: 'Мозг: хранит программу, слушает датчик и управляет моторами' },
    { id: 'motors', name: 'Моторы колёс', role: 'Левый мотор в порту C, правый в порту D' },
    { id: 'wheelL', name: 'Левое колесо', role: 'Стоит прямо на оси мотора C' },
    { id: 'wheelR', name: 'Правое колесо', role: 'Стоит прямо на оси мотора D' },
    { id: 'caster', name: 'Шаровая опора', role: 'Третья точка опоры: шарик катится в любую сторону' },
    { id: 'tool', name: 'Большой мотор', role: 'Порт E: крутит шестерню для инструментов, сегодня отдыхает' },
    { id: 'sensor', name: 'Датчик цвета', role: 'Порт B: смотрит вниз и видит линию' },
    { id: 'cables', name: 'Кабели', role: 'Соединяют моторы и датчик с портами хаба' },
  ];
  const PORTS = { left: 'C', right: 'D', tool: 'E', color: 'B' };
  const WHEEL_R = 3.5, TRACK = 14;            // a 56 mm wheel; the wheels' middles are 112 mm apart
  const SENSOR = { x: 6, z: 5, h: 2 };         // the lens: under hole 2 of the right beam, 16 mm above the floor

  const STAGES = [
    { id: 'frame', title: 'Рамка и два мотора', steps: 'шаги 1–5', parts: 'Пурпурная рамка 7 × 11, два средних мотора, жёлтые оси, чёрные штифты',
      text: 'Положи рамку и поставь на её края два средних мотора: роторами наружу, белой частью вперёд. В каждый ротор вставь жёлтую ось.' },
    { id: 'hub', title: 'Хаб и шаровая опора', steps: 'шаги 6–13', parts: 'Хаб, серые соединители на жёлтых балках, пурпурная квадратная деталь, голубая шаровая опора с шариком, жёлтый зажим',
      text: 'Под передние углы хаба поставь серые соединители на жёлтых балках. Переверни хаб и закрепи сзади шаровую опору: это третья точка, на которую встанет робот.' },
    { id: 'beams', title: 'Хаб на моторы, две балки, кабели', steps: 'шаги 14–24', parts: 'Две чёрные балки на 15 отверстий, бежевые штифты, голубой и зелёный зажимы',
      text: 'Поставь хаб на моторы и закрепи по бокам две длинные чёрные балки: спереди они выступают за хаб. Кабель левого мотора вставь в порт C, правого в порт D.' },
    { id: 'wheels', title: 'Колёса', steps: 'шаги 25–26', parts: 'Два колеса с голубыми шинами, две белые стрелки',
      text: 'Надень колёса на жёлтые оси, вплотную к роторам. На конец каждой оси поставь белую стрелку: по ней видно, как поворачивается колесо. Теперь робот может ехать.' },
    { id: 'tool', title: 'Большой мотор с шестернёй', steps: 'шаги 27–34', parts: 'Большой мотор, красная ось, чёрная шестерня, серые соединители с жёлтыми балками',
      text: 'Вставь в большой мотор красную ось и надень на неё чёрную шестерню. Задвинь мотор спереди между чёрными балками, белой частью вперёд. Кабель вставь в порт E.' },
    { id: 'sensor', title: 'Датчик цвета', steps: 'датчик цвета, шаги 1–4', parts: 'Датчик цвета, два чёрных штифта, бежевый штифт, синий зажим',
      text: 'Повесь датчик цвета под передний конец правой балки, окошком вниз. Кабель закрепи синим зажимом и вставь в порт B.' },
  ];

  /* ---------- Layout, in modules (ref/bi/NOTES.md «Model decisions») ---------- */
  const AXLE_Y = WHEEL_R;                      // direct drive: the rotors' axis is the wheels' axis
  const MOTOR_Z = 4, ROTOR_Z = 5.5;            // the drive motors' middles and outer faces
  const BEAM_Z = 5, BEAM_TOP = 6;              // the black beams; beam hole n is at X = 8 - n
  const GEAR = new T.Vector3(5.5, 5, 0);       // the gear's foot on the large motor's white end
  const BALL = new T.Vector3(-6, 1.25, 0), BALL_R = 1.25;
  const PORT_X = { B: 0.1, C: -2.1, D: -2.1, E: -4.3 }, PORT_Y = 8.04, PLUG_Z = 4.35;   // a plug's outer end
  const PALE = new T.Color('#cddae2');
  const RING_OFF = '#ece3bd';
  const LED_X = -6.25, LED_PITCH = 0.84;
  // Week 9's hub (face +Z, ports A, C, E along y=0, centre button at x=0) laid flat: face up, centre button to the rear, A, C, E on the left.
  const HUB_M = new T.Matrix4().makeBasis(new T.Vector3(-1, 0, 0), new T.Vector3(0, 0, 1), new T.Vector3(0, 1, 0)).setPosition(-7.5, 7, -3.5);

  // Everything merges as plain non-indexed triangles with normals.
  const solid = (g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; };
  const box = (w, h, d, r = 0.05, seg = 1) => solid(new T.RoundedBoxGeometry(w, h, d, seg, r));
  const brick = (w, h, d) => solid(new T.BoxGeometry(w, h, d));
  const cyl = (r, h, seg = 12) => solid(new T.CylinderGeometry(r, r, h, seg));
  // Turned around Y from a profile of [radius, y]; walking the profile, the outside is on the right.
  const lathe = (pts, seg = 24) => solid(new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), seg));
  const flat = (shape) => solid(new T.ShapeGeometry(shape, 4));
  const disc = (r, seg = 14) => solid(new T.CircleGeometry(r, seg));
  const ring = (a, b, seg = 14) => solid(new T.RingGeometry(a, b, seg, 1));

  // Extruded along +Z from 0 to depth; the bevel stays inside the nominal outline.
  const extrude = (shape, depth, bevel = 0.04, curveSegments = 6) => {
    const g = new T.ExtrudeGeometry(shape, { depth: depth - bevel * 2, curveSegments, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1 });
    g.translate(0, 0, bevel);
    g.deleteAttribute('uv');
    return toCreasedNormals(g, 0.6);
  };
  // Same, from a plan drawn in the X-Z plane, standing on y0.
  const plan = (shape, y0, h, bevel, curveSegments) => extrude(shape, h, bevel, curveSegments).rotateX(Q).translate(0, y0 + h, 0);

  const rrect = (x0, y0, x1, y1, r) => {
    const s = new T.Shape();
    s.absarc(x1 - r, y0 + r, r, -Q, 0);
    s.absarc(x1 - r, y1 - r, r, 0, Q);
    s.absarc(x0 + r, y1 - r, r, Q, 2 * Q);
    s.absarc(x0 + r, y0 + r, r, 2 * Q, 3 * Q);
    s.closePath();
    return s;
  };
  // A motor's white end seen from above: square at the back, rounded at the front (x1).
  const head = (x0, x1, z0, z1, r) => {
    const s = new T.Shape();
    s.moveTo(x0, z0);
    s.absarc(x1 - r, z0 + r, r, -Q, 0);
    s.absarc(x1 - r, z1 - r, r, 0, Q);
    s.lineTo(x0, z1);
    s.closePath();
    return s;
  };
  // Outline of a straight Technic beam with n holes along +X, the first at the origin.
  const beamShape = (n, r = 0.49) => {
    const s = new T.Shape();
    s.absarc(0, 0, r, Q, 3 * Q);
    s.absarc(n - 1, 0, r, -Q, Q);
    s.closePath();
    return s;
  };
  const addHole = (shape, x, y, r = 0.38) => { const p = new T.Path(); p.absarc(x, y, r, 0, TAU, true); shape.holes.push(p); };
  const crossShape = (r, w) => {
    const s = new T.Shape();
    [[w, -w], [r, -w], [r, w], [w, w], [w, r], [-w, r], [-w, w], [-r, w], [-r, -w], [-w, -w], [-w, -r], [w, -r]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return s;
  };
  const cog = (r, root, teeth) => {
    const s = new T.Shape(), step = TAU / teeth;
    for (let i = 0; i < teeth; i++) {
      [[root, -0.5], [root, -0.32], [r, -0.22], [r, 0.22], [root, 0.32], [root, 0.5]].forEach(([q, k]) => {
        const [x, y] = polar(i * step + k * step * 0.5, q);
        if (i || k > -0.5) s.lineTo(x, y); else s.moveTo(x, y);
      });
    }
    s.closePath();
    return s;
  };
  // Flat cable through points [x, y, z, ax, ay, az]: (ax, ay, az) is the side its width leans to from that point on,
  // so a path can lie flat, stand on edge and twist in between.
  const ribbon = (pts, W = 0.43, H = 0.045) => {
    let lean = [0, 0, 1];
    const sides = pts.map((p) => new T.Vector3(...(lean = p.length > 3 ? p.slice(3) : lean)));
    const at = pts.map((p) => new T.Vector3(p[0], p[1], p[2]));
    const curve = new T.CatmullRomCurve3(at, false, 'centripetal');
    const n = at.length - 1, pos = [], idx = [];
    const t = new T.Vector3(), w = new T.Vector3(), up = new T.Vector3(), p = new T.Vector3();
    let rows = 0;
    for (let k = 0; k < n; k++) {
      const steps = Math.max(2, Math.ceil(at[k].distanceTo(at[k + 1]) * 4));
      for (let i = k ? 1 : 0; i <= steps; i++, rows++) {
        const u = (k + i / steps) / n;
        curve.getPoint(u, p);
        curve.getTangent(u, t);
        w.lerpVectors(sides[k], sides[k + 1], i / steps).addScaledVector(t, -t.dot(w)).normalize();
        up.crossVectors(t, w);
        for (const [a, b] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) pos.push(p.x + w.x * W * a + up.x * H * b, p.y + w.y * W * a + up.y * H * b, p.z + w.z * W * a + up.z * H * b);
      }
    }
    for (let i = 0; i < rows - 1; i++) for (let k = 0; k < 4; k++) {
      const c0 = i * 4 + k, c1 = i * 4 + ((k + 1) % 4);
      idx.push(c0, c1, c1 + 4, c0, c1 + 4, c0 + 4);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return toCreasedNormals(g, 0.7);
  };

  const FACES = { '+x': [1, 0, 0, 0, Q, 0], '-x': [-1, 0, 0, 0, -Q, 0], '+y': [0, 1, 0, -Q, 0, 0], '-y': [0, -1, 0, Q, 0, 0], '+z': [0, 0, 1, 0, 0, 0], '-z': [0, 0, -1, 0, Math.PI, 0] };
  const compose = (x, y, z, rx, ry, rz) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(1, 1, 1));

  function buildKit() {
    const plastic = (color, roughness = 0.35) => new T.MeshStandardMaterial({ color, roughness, envMapIntensity: 0.35 });
    // Holes carry a darker tone of their part so they read as depth without ambient occlusion.
    // The azure is the set's light one, sampled from LEGO's photo: tyres, motor bodies, rotors and the caster cup.
    const M = {
      azure: plastic('#4fc3e3'), tyre: plastic('#4fc3e3', 0.75), magenta: plastic('#c92e85'), yellow: plastic('#fed920'), white: plastic('#eceded'),
      black: plastic('#16151a'), grey: plastic('#a9b0b5'), blue: plastic('#1f5aa8'), sky: plastic('#6f9fe0'), green: plastic('#2f9a4e'),
      dark: plastic('#2a2d33', 0.6), face: plastic('#dfe2e4', 0.45), plate: plastic('#cdd1d4', 0.5), red: plastic('#c8281f'), tan: plastic('#d8bf8a', 0.45),
      cable: plastic('#e2e5e8', 0.6), plug: plastic('#e6e2d6', 0.5), battery: plastic('#f4ce14'),
      azureRim: plastic('#2f9fc0', 0.5), azureHole: plastic('#17616f', 0.7),
      magentaRim: plastic('#8f1c5d', 0.5), magentaHole: plastic('#4d0a33', 0.7),
      yellowRim: plastic('#e8bb12', 0.5), yellowHole: plastic('#a87d05', 0.7),
      whiteRim: plastic('#d5d8da', 0.5), whiteHole: plastic('#7f868b', 0.7),
      greyRim: plastic('#7c848a', 0.5), greyHole: plastic('#3d4347', 0.7), blackHole: plastic('#050506', 0.8),
      led: new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
      ledWindow: new T.MeshBasicMaterial({ color: '#3b4a54' }),
    };

    const RIM = ring(0.27, 0.38), CORE = disc(0.27);
    const dimple = (add, rim, core, x, y, z, face) => {
      const [nx, ny, nz, ...rot] = FACES[face], o = 0.006;
      add(rim, RIM, x + nx * o, y + ny * o, z + nz * o, ...rot);
      add(core, CORE, x + nx * o, y + ny * o, z + nz * o, ...rot);
    };
    // A beam hole's inside, along Y through a part 1 thick: a sunk rim at each end and the narrower tube between them.
    const BORE = lathe([[0.38, 0.42], [0.285, 0.42], [0.285, -0.42], [0.38, -0.42]], 10);
    const AXLE_END = flat(crossShape(0.27, 0.09));

    const piece = (stage, from, out, fill) => {
      const lists = new Map();
      fill((mat, g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
        if (!lists.has(mat)) lists.set(mat, []);
        lists.get(mat).push(g.clone().applyMatrix4(compose(x, y, z, rx, ry, rz)));
      });
      return { stage, from, out, meshes: [...lists].map(([mat, list]) => ({ mat, geo: mergeGeometries(list) })) };
    };
    // Everything added through it is moved by m afterwards.
    const under = (add, m) => (mat, g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => add(mat, g.clone().applyMatrix4(compose(x, y, z, rx, ry, rz)).applyMatrix4(m));

    // A straight beam 1 thick, n holes along X, the holes along Z.
    const beam = (n) => {
      const s = beamShape(n), holes = [...Array(n).keys()];
      holes.forEach((x) => addHole(s, x, 0));
      return { body: extrude(s, 1, 0.04, 5).translate(0, 0, -0.5), bores: mergeGeometries(holes.map((x) => BORE.clone().rotateX(Q).translate(x, 0, 0))) };
    };
    // Rotations used below: (Q,0,0) lying along X, holes up; (Q,0,Q) lying along Z, holes up; (0,0,Q) standing, holes along Z.
    const addBeam = (add, colour, b, x, y, z, rx = 0, ry = 0, rz = 0) => {
      add(M[colour], b.body, x, y, z, rx, ry, rz);
      add(M[colour + 'Hole'], b.bores, x, y, z, rx, ry, rz);
    };
    const BEAM3 = beam(3), BEAM15 = beam(15);
    const pinUp = (add, mat, x, y, z, len) => {
      add(mat, cyl(0.24, len, 10), x, y + len / 2, z);
      add(M.dark, disc(0.13, 8), x, y + len + 0.005, z, -Q);
    };

    /* ---------- Stage 1: the open frame 7 × 11 and the two drive motors on its ends ---------- */
    const OUT = { motor: [0, 2.5, 0], hub: [0, 9, 0], caster: [-4.5, 2, 0], tool: [6, 2.5, 0], sensor: [4, 0, 3.5] };
    const frame = piece(0, [0, 4, 0], [0, 0, 0], (add) => {
      const s = rrect(-3.5, -5.5, 3.5, 5.5, 0.5), open = new T.Path();
      open.moveTo(-2.5, -4.5); open.lineTo(-2.5, 4.5); open.lineTo(2.5, 4.5); open.lineTo(2.5, -4.5); open.closePath();
      s.holes.push(open);
      for (let x = -3; x <= 3; x++) { addHole(s, x, -5, 0.36); addHole(s, x, 5, 0.36); }
      for (let z = -4; z <= 4; z++) { addHole(s, -3, z, 0.36); addHole(s, 3, z, 0.36); }
      add(M.magenta, plan(s, 1, 1, 0, 4), -2, 0, 0);
      // the holes that open sideways
      for (const z of [-4, -2, 0, 2, 4]) { dimple(add, M.magentaRim, M.magentaHole, -5.5, 1.5, z, '-x'); dimple(add, M.magentaRim, M.magentaHole, 1.5, 1.5, z, '+x'); }
      for (const x of [-4, -2, 0]) { dimple(add, M.magentaRim, M.magentaHole, x, 1.5, 5.5, '+z'); dimple(add, M.magentaRim, M.magentaHole, x, 1.5, -5.5, '-z'); }
    });

    // Medium motor, 9 × 3 × 3: drawn as the right one (x -7.5..1.5, z 2.5..5.5, the rotor's face at z 5.5 around x 0);
    // the left one is the same motor turned over about its long axis.
    const drive = (side) => piece(0, [0, 6, side * 3], OUT.motor, (add0) => {
      const add = side > 0 ? add0 : under(add0, compose(0, 2 * AXLE_Y, 0, Math.PI, 0, 0));
      add(M.azure, box(5.5, 3, 3, 0.1, 2), -4.75, 3.5, MOTOR_Z);
      add(M.white, plan(head(-2.1, 1.5, 2.5, 5.5, 0.6), 2, 3, 0.045, 3));
      // towards the middle of the robot: the rotor's other end, an axle hole between four pin holes
      add(M.azure, disc(0.55, 16), 0, AXLE_Y, 2.494, 0, Math.PI, 0);
      add(M.azureHole, AXLE_END, 0, AXLE_Y, 2.49, 0, Math.PI, 0);
      for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dimple(add, M.whiteRim, M.whiteHole, x, AXLE_Y + y, 2.5, '-z');
      add(M.dark, brick(0.5, 0.9, 0.01), -3.6, 3.5, 5.503);                      // the label
      for (const y of [2.6, 4.4]) dimple(add, M.azureRim, M.azureHole, -6.9, y, 5.5, '+z');
      add(M.azureRim, brick(0.42, 1.1, 0.01), -6.9, 3.5, 5.503);
      add(M.dark, brick(0.01, 0.3, 1), -7.503, 3.5, MOTOR_Z);                   // the cable leaves the end
      for (const x of [1, -7]) for (const z of [3, 5]) pinUp(add0, M.black, x, 5, side * z, 0.8);   // these hold the hub and a black beam
    });
    // The rotor with what LEGO puts in it, in its pivot: the axis along +z, out of the motor. It turns with the wheel.
    const rotor = piece(0, [0, 6, 0], OUT.motor, (add) => {
      const face = under(add, compose(0, 0, 0, Q, 0, 0));
      face(M.azureRim, lathe([[1.46, 0], [1.46, 0.06]], 32));
      face(M.azure, lathe([[1.5, 0.06], [1.5, 0.36], [1.42, 0.46], [0, 0.46]], 32));
      for (let i = 0; i < 4; i++) {
        const [x, z] = polar(i * Q, 1);
        if (i % 2) face(M.black, cyl(0.24, 0.9, 10), x, 0.9, z);                // two black pins for the wheel
        else face(M.azureHole, disc(0.25, 10), x, 0.465, z, -Q);
      }
      add(M.yellow, extrude(crossShape(0.24, 0.085), 3, 0, 1));                 // the yellow axle, 3 long
    });

    /* ---------- Stage 2: the hub (week 9's, laid flat), its front-corner connectors and the ball caster ---------- */
    const hub = piece(1, [0, 8, 0], OUT.hub, (add0) => {
      const add = under(add0, HUB_M);
      add(M.yellow, box(11, 7, 3.15, 0.28, 2), -5.5, 3.5, -0.425);
      add(M.face, extrude(rrect(-11, 0, 0, 7, 0.62), 1, 0.1, 4), 0, 0, 1);
      add(M.battery, box(9.4, 5.4, 0.1, 0.04), -5.5, 3.5, -2.03);
      for (const x of [-10.35, -0.65]) for (const y of [0.65, 6.35]) {
        add(M.grey, cyl(0.42, 0.08, 16), x, y, 2.01, Q);
        add(M.greyRim, disc(0.2, 10), x, y, 2.056);
      }
      add(M.plate, flat(rrect(-2.45, 0.8, -0.95, 6.2, 0.74)), 0, 0, 2.004);
      add(M.plate, disc(1.34, 32), -1.7, 3.5, 2.006);
      add(M.grey, ring(0.52, 0.62, 24), -9.6, 5.5, 2.006);                       // the Bluetooth button, front right
      add(M.white, lathe([[0.52, 0], [0.5, 0.05], [0, 0.05]], 20), -9.6, 5.5, 2, Q);
      add(M.plate, flat(rrect(-10.15, 1.35, -9.05, 2.45, 0.08)), 0, 0, 2.004);
      // Ports: A, C, E along y=0 (the robot's left), B, D, F along y=7; A and B at the front.
      for (const x of [-7.6, -5.4, -3.2]) for (const [y, ny] of [[7, 1], [0, -1]]) {
        add(M.dark, brick(1.5, 0.1, 0.5), x, y + ny * 0.02, 1.04);
        add(M.greyHole, brick(1.2, 0.1, 0.18), x, y + ny * 0.05, 1.04);
      }
      for (const [y, face] of [[7, '+y'], [0, '-y']]) {
        for (const x of [-1, -10]) for (const z of [0.5, -0.5, -1.5]) dimple(add, M.yellowRim, M.yellowHole, x, y, z, face);
        add(M.yellowRim, brick(2.8, 0.03, 0.9), -5.5, y, -1.5);
      }
      add(M.dark, disc(0.92, 24), 0.006, 3.5, -0.3, 0, Q);                       // the speaker, at the rear
      add(M.dark, brick(0.02, 0.9, 0.3), -11.004, 3.5, 0.55);                    // the USB socket, at the front
      for (const [x, face] of [[0, '+x'], [-11, '-x']]) {
        for (const y of [1.5, 5.5]) for (const z of [1, 0, -1]) dimple(add, M.yellowRim, M.yellowHole, x, y, z, face);
      }
    });
    // A grey connector lying across on a yellow 3-hole beam under each front corner of the hub; its free pin holds a black beam.
    const corners = piece(1, [0, 8, 0], [1.5, 4.5, 0], (add) => {
      for (const s of [1, -1]) {
        addBeam(add, 'yellow', BEAM3, 3, 3.5, s > 0 ? 3 : -5, Q, 0, Q);
        add(M.grey, box(1, 1, 3, 0.3, 2), 3, 4.5, s * 4);
        for (const z of [3, 5]) dimple(add, M.greyRim, M.greyHole, 3.5, 4.5, s * z, '+x');
        pinUp(add, M.grey, 3, 5, s * 5, 0.8);
      }
    });
    const caster = piece(1, [0, 8, 0], OUT.caster, (add) => {
      add(M.magenta, box(3, 1, 3, 0.25, 2), -6, 4.5, 0);                         // the square connector under the hub's rear end
      add(M.azure, box(3, 1, 3, 0.2, 2), -6, 3.5, 0);                            // the housing: a holed block, a neck and the cup
      for (const z of [-1, 0, 1]) {
        dimple(add, M.magentaRim, M.magentaHole, -7.5, 4.5, z, '-x');
        dimple(add, M.azureRim, M.azureHole, -7.5, 3.5, z, '-x');
      }
      add(M.azure, cyl(1.15, 0.5, 20), BALL.x, 2.85, 0);
      add(M.azure, lathe([[1.28, -0.45], [1.58, -0.45], [1.62, 0], [1.5, 0.6], [1.22, 1.07], [0.8, 1.41], [0.4, 1.57], [0, 1.62]], 28), BALL.x, BALL.y, 0);
      add(M.white, solid(new T.SphereGeometry(BALL_R, 24, 16)), BALL.x, BALL.y, 0);
    });

    /* ---------- Stage 3: the two black beams ---------- */
    const sideBeam = (side) => piece(2, [0, 6, side * 3], [0, 5.5, 0], (add) => addBeam(add, 'black', BEAM15, -7, 5.5, side * BEAM_Z, Q));

    /* ---------- Stage 4: a wheel in its pivot, the axle along z and the outer side at +z ---------- */
    const wheel = piece(3, [0, 0, 8], [0, 2.5, 5], (add) => {
      add(M.tyre, lathe([[2.72, -0.875], [3.3, -0.875], [3.5, -0.62], [3.5, 0.62], [3.3, 0.875], [2.72, 0.875]], 48), 0, 0, 0, Q);
      add(M.black, toCreasedNormals(lathe([[2.42, -0.8], [2.8, -0.8], [2.8, 0.8], [2.42, 0.8], [2.42, -0.8]], 48), 0.6), 0, 0, 0, Q);
      // four spokes: a cross with pin holes, the axle through its middle
      const s = crossShape(2.5, 0.5), holes = [1, 2].flatMap((d) => [[d, 0], [-d, 0], [0, d], [0, -d]]);
      addHole(s, 0, 0, 0.3);
      holes.forEach(([x, y]) => addHole(s, x, y));
      add(M.black, extrude(s, 0.9, 0.04, 5), 0, 0, -0.35);
      holes.forEach(([x, y]) => add(M.blackHole, BORE, x, y, 0.1, Q));
      // the white pointer on the axle's end shows how the wheel has turned
      const a = Math.asin((0.5 - 0.16) / 2.2), tooth = new T.Shape();
      tooth.absarc(0, 0, 0.5, Math.PI - a, TAU + a);
      tooth.absarc(0, 2.2, 0.16, a, Math.PI - a);
      tooth.closePath();
      add(M.white, extrude(tooth, 0.85, 0.12, 6), 0, 0, 0.62);
    });

    /* ---------- Stage 5: the large motor lying flat at the front, its rotor underneath and the gear on top ---------- */
    const tool = piece(4, [9, 0, 0], OUT.tool, (add) => {
      add(M.azure, box(4.6, 3, 5, 0.1, 2), 1.25, 3.5, 0);
      add(M.white, plan(head(3.4, 7.5, -2.5, 2.5, 0.7), 2, 3, 0.05, 4));
      add(M.azure, lathe([[0, 0], [1.42, 0], [1.5, 0.08], [1.5, 0.55]], 28), GEAR.x, 1.45, 0);   // the rotor's face looks down
      add(M.azureHole, AXLE_END, GEAR.x, 1.445, 0, Q);
      for (let i = 0; i < 4; i++) { const [x, z] = polar(i * Q, 1); dimple(add, M.azureRim, M.azureHole, GEAR.x + x, 1.45, z, '-y'); }
      add(M.azure, disc(0.62, 16), GEAR.x, 5.004, 0, -Q);
      for (const x of [4.1, 6.9]) for (const z of [-1.9, 1.9]) dimple(add, M.whiteRim, M.whiteHole, x, 5, z, '+y');
      for (const z of [-1.35, 1.35]) dimple(add, M.whiteRim, M.whiteHole, 7.5, 3.5, z, '+x');
      for (const z of [-0.5, 0.5]) add(M.whiteRim, brick(0.01, 0.2, 0.45), 7.503, 3.5, z);
      for (const s of [1, -1]) {
        for (const y of [2.6, 4.4]) dimple(add, M.whiteRim, M.whiteHole, 6.2, y, s * 2.5, s > 0 ? '+z' : '-z');
        // a grey connector and a yellow beam stand at each side; black pins through the connector hold the motor to the hub's corners
        add(M.grey, box(1, 3, 1, 0.3, 2), 4, 3.5, s * 3);
        for (const y of [2.5, 4.5]) dimple(add, M.greyRim, M.black, 4.5, y, s * 3, '+x');
        addBeam(add, 'yellow', BEAM3, 4, 2.5, s * 4, 0, 0, Q);
      }
    });
    // The small black gear on a red axle, in its pivot: the foot at the origin, the axis up.
    const gear = piece(4, [9, 0, 0], [6, 5, 0], (add) => {
      add(M.black, plan(cog(0.88, 0.62, 12), 0.04, 0.82, 0.06, 2));
      add(M.black, cyl(0.46, 1, 14), 0, 0.5, 0);
      add(M.red, flat(crossShape(0.3, 0.1)), 0, 1.004, 0, -Q);
    });

    /* ---------- Stage 6: the colour sensor under holes 1 and 3 of the right beam, lens down ---------- */
    const sensor = piece(5, [5, 0, 3], OUT.sensor, (add) => {
      add(M.black, box(3, 1.9, 3, 0.16, 2), SENSOR.x, 4.05, SENSOR.z);
      add(M.white, box(3, 1.15, 3, 0.16, 2), SENSOR.x, SENSOR.h + 0.575, SENSOR.z);
      add(M.black, ring(0.55, 0.95, 24), SENSOR.x, SENSOR.h - 0.004, SENSOR.z, Q);
      add(M.dark, disc(0.55, 20), SENSOR.x, SENSOR.h - 0.003, SENSOR.z, Q);
      add(M.greyRim, disc(0.3, 16), SENSOR.x, SENSOR.h - 0.006, SENSOR.z, Q);
      add(M.black, box(1.3, 1.5, 0.5, 0.2, 2), SENSOR.x, 4.2, SENSOR.z + 1.5);   // the cable's hump on the outer side
      for (const x of [-1.05, 1.05]) add(M.white, brick(0.45, 0.16, 0.01), SENSOR.x + x, 3.3, SENSOR.z + 1.503);
      for (const z of [-0.6, 0.6]) dimple(add, M.dark, M.blackHole, SENSOR.x + 1.5, 4.1, SENSOR.z + z, '+x');
      for (const x of [5, 7]) pinUp(add, M.black, x, 5, BEAM_Z, 0.9);
    });

    /* ---------- Cables: flat ribbons from each device to its port, held by coloured clips ---------- */
    // A clip on a tan pin's axle end: built standing on the origin, its loop towards -z.
    const clip = (stage, from, out, colour, m) => piece(stage, from, out, (add0) => {
      const add = under(add0, m);
      add(M.tan, cyl(0.3, 0.14, 10), 0, 0.07, 0);
      add(M[colour], cyl(0.42, 0.8, 14), 0, 0.54, 0);
      add(M.tan, AXLE_END, 0, 0.945, 0, -Q);
      add(M[colour], box(0.55, 0.4, 1.25, 0.14), 0, 0.52, -0.72);
    });
    const cable = (stage, from, port, side, pts) => piece(stage, from, OUT.hub, (add) => {
      add(M.cable, ribbon(pts.map(([x, y, z, ax, ay, az]) => (ax === undefined ? [x, y, side * z] : [x, y, side * z, ax, ay, side * az]))));
      add(M.plug, box(1.25, 0.62, 0.9, 0.12, 2), PORT_X[port], PORT_Y, side * (PLUG_Z - 0.45));
    });
    // A drive motor's cable, drawn for the right side: out of the motor's end, forward along the gap between the hub and the beam,
    // folded back to the clip on beam hole 12, round a loop behind and into the middle port.
    const driveCable = [
      [-7.5, 3.5, 4], [-8.3, 3.6, 4], [-9.05, 4.4, 4], [-9, 5.5, 4], [-8.3, 6.15, 4], [-7.3, 5.6, 4], [-6.3, 5.16, 4], [1.2, 5.16, 4],
      [1.95, 5.25, 4], [2.2, 5.55, 4], [1.9, 5.85, 4], [0.5, 5.9, 4], [-2.6, 6.1, 4.1], [-4, 6.52, 4.28],
      [-5.6, 6.62, 4.45], [-7.6, 6.95, 4.6], [-8.6, 7.7, 4.7], [-8.4, 8.65, 4.8], [-7.2, 9.05, 4.9], [-5.2, 8.95, 5],
      [-3.4, 8.65, 5.1, 0.6, 0, 0.8], [-2.35, 8.3, 4.95, 1, 0, 0.2], [PORT_X.D, PORT_Y, PLUG_Z, 1, 0, 0],
    ];
    const cables = [
      cable(2, [0, 7, 3], 'D', 1, driveCable),
      cable(2, [0, 7, -3], 'C', -1, driveCable),
      // The large motor's: back under the hub beside the caster, down through the yellow clip, round a low loop behind and up the left side.
      cable(4, [-4, 5, -3], 'E', -1, [
        [-1, 3.5, 0], [-2.2, 3.6, 0.6], [-3.6, 3.9, 1.7], [-4.8, 4.2, 2], [-7, 4.2, 2], [-7.8, 4.05, 1.85], [-8.02, 3.5, 1.72], [-8.02, 2.7, 1.72],
        [-8.25, 1.9, 1.9], [-9.2, 1.05, 2.6], [-10.5, 1.4, 3.6], [-11.1, 3.2, 4.6], [-10.6, 5.6, 5.6], [-9, 7.2, 6.2], [-6.5, 7.8, 6, 0.3, 0, 1],
        [-4.9, 8.05, 5.4, 1, 0, 0.3], [-4.3, 8.1, 4.9, 1, 0, 0], [PORT_X.E, PORT_Y, PLUG_Z],
      ]),
      // The sensor's: up beside the beam, back to the blue clip on hole 6, a tall loop leaning over the hub and into the front port.
      cable(5, [0, 7, 4], 'B', 1, [
        [6, 5, 4], [6, 5.7, 4], [5.7, 6.25, 4.05], [5, 6.45, 4.15], [3.5, 6.5, 4.25], [2, 6.52, 4.28], [1.55, 6.9, 4.45], [1.45, 7.9, 4.6],
        [1.2, 9.1, 4.2, 0, 0.6, 0.8], [0.5, 10.3, 3.5], [-0.8, 11.5, 2.8], [-3, 12.3, 2.4], [-5, 12.3, 2.35], [-6.5, 11.7, 2.8], [-7, 10.8, 3.5],
        [-6.3, 10.1, 4.05], [-4.5, 10, 4.15], [-2.5, 10, 4.2], [-1.2, 9.7, 4.5, 0.4, 0.4, 0.8], [-0.3, 9.1, 4.9, 1, 0, 0.3], [0.08, 8.5, 4.85, 1, 0, 0],
        [PORT_X.B, PORT_Y, PLUG_Z],
      ]),
    ];
    const clips = [
      clip(1, [0, 8, 0], OUT.caster, 'yellow', compose(-7.5, 3.2, -1, 0, 0, Q)),   // on the caster's back, for the large motor's cable
      clip(2, [0, 7, -3], OUT.hub, 'sky', compose(-4, BEAM_TOP, -BEAM_Z, 0, Math.PI, 0)),
      clip(2, [0, 7, 3], OUT.hub, 'green', compose(-4, BEAM_TOP, BEAM_Z, 0, 0, 0)),
      clip(5, [0, 7, 4], OUT.hub, 'blue', compose(2, BEAM_TOP, BEAM_Z, 0, 0, 0)),
    ];

    /* ---------- Per-instance hub parts and the sensor's light share these ---------- */
    const quads = [], order = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const x = LED_X + (r - 2) * LED_PITCH, y = 3.5 + (c - 2) * LED_PITCH, s = LED_PITCH * 0.33, i = quads.length / 3;
      quads.push(x - s, y - s, 2.012, x + s, y - s, 2.012, x + s, y + s, 2.012, x - s, y + s, 2.012);
      order.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }
    const pill = (y0, y1) => extrude(rrect(-2.32, y0, -1.08, y1, 0.6), 0.12, 0.03, 4).translate(0, 0, 2).applyMatrix4(HUB_M);
    const arrow = (y, s) => { const a = new T.Shape(); a.moveTo(-1.95, y); a.lineTo(-1.45, y); a.lineTo(-1.7, y + s * 0.32); a.closePath(); return flat(a); };
    // The sensor's light as it falls on the floor: a warm white disc with a soft edge, so it shows on white paper and on black tape.
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d'), glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    [[0, 'rgba(255,255,255,0.95)'], [0.3, 'rgba(255,251,226,0.9)'], [0.55, 'rgba(255,236,150,0.5)'], [1, 'rgba(255,228,120,0)']].forEach(([at, c]) => glow.addColorStop(at, c));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 64, 64);
    const spotMap = new T.CanvasTexture(cv);
    spotMap.colorSpace = T.SRGBColorSpace;
    return {
      M, frame, drive: { L: drive(-1), R: drive(1) }, rotor, hub, corners, caster, beams: [sideBeam(-1), sideBeam(1)], wheel, tool, gear, sensor, cables, clips,
      ledPos: new T.Float32BufferAttribute(quads, 3).applyMatrix4(HUB_M), ledIndex: order,
      ledWindow: flat(rrect(LED_X - 2.3, 1.2, LED_X + 2.3, 5.8, 0.25)).translate(0, 0, 2.008).applyMatrix4(HUB_M),
      left: pill(0.9, 3.6), right: pill(3.4, 6.1),
      arrows: mergeGeometries([arrow(1.55, -1), arrow(5.45, 1)].map((g) => g.translate(0, 0, 2.123))).applyMatrix4(HUB_M),
      center: lathe([[1, 0], [0.99, 0.2], [0.86, 0.3], [0, 0.32]], 32).rotateX(Q).translate(-1.7, 3.5, 2).applyMatrix4(HUB_M),
      lightRing: ring(1.04, 1.22, 48).translate(-1.7, 3.5, 2.012).applyMatrix4(HUB_M),
      spot: new T.PlaneGeometry(3, 3).rotateX(-Q).translate(SENSOR.x, 0.03, SENSOR.z),
      spotMat: new T.MeshBasicMaterial({ map: spotMap, transparent: true, depthWrite: false }),
      ray: new T.CylinderGeometry(0.5, 1, SENSOR.h - 0.06, 20, 1, true).translate(SENSOR.x, SENSOR.h / 2, SENSOR.z),
      rayMat: new T.MeshBasicMaterial({ color: '#fff0a8', transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide }),
      lens: disc(0.55, 20).rotateX(Q).translate(SENSOR.x, SENSOR.h - 0.01, SENSOR.z),
      lensMat: new T.MeshBasicMaterial({ color: '#fffbe6' }),
    };
  }

  let KIT = null;

  RA.createRobot = () => {
    const K = KIT || (KIT = buildKit());
    const group = new T.Group();
    const parts = {}, fade = {}, clones = {}, pieces = [];
    PARTS.forEach(({ id }) => { group.add((parts[id] = new T.Group())); fade[id] = 0; clones[id] = new Map(); });

    const mesh = (geo, mat, into) => {
      const m = new T.Mesh(geo, mat);
      m.castShadow = m.receiveShadow = true;
      m.userData.base = mat;
      into.add(m);
      return m;
    };
    // A piece in its own group; `at` makes that group a pivot the piece turns about.
    const put = (p, into, at = [0, 0, 0]) => {
      const g = new T.Group();
      p.meshes.forEach(({ geo, mat }) => mesh(geo, mat, g));
      into.add(g);
      pieces.push({ stage: p.stage, from: new T.Vector3(...p.from), out: new T.Vector3(...p.out), at: new T.Vector3(...at), group: g });
      return g;
    };

    put(K.frame, parts.chassis);
    put(K.corners, parts.chassis);
    K.beams.forEach((b) => put(b, parts.chassis));
    const hubGroup = put(K.hub, parts.hub);
    put(K.caster, parts.caster);
    put(K.tool, parts.tool);
    const gear = put(K.gear, parts.tool, GEAR.toArray());
    const sensorGroup = put(K.sensor, parts.sensor);
    K.cables.forEach((c) => put(c, parts.cables).traverse((o) => { o.receiveShadow = false; }));   // a ribbon this thin only collects shadow acne
    K.clips.forEach((c) => put(c, parts.cables));

    // Left and right: the same motor, rotor and wheel; the left pivots are turned round so that +z is always out of the robot.
    const turning = { L: [], R: [] };
    [['L', -1], ['R', 1]].forEach(([k, side]) => {
      put(K.drive[k], parts.motors);
      turning[k] = [put(K.rotor, parts.motors, [0, AXLE_Y, side * ROTOR_Z]), put(K.wheel, parts['wheel' + k], [0, AXLE_Y, side * TRACK / 2])];
      if (side < 0) turning[k].forEach((g) => {
        g.rotation.y = Math.PI;
        const pc = pieces.find((x) => x.group === g);          // the kit's wheel flies in and explodes to +z
        pc.from.z *= -1;
        pc.out.z *= -1;
      });
    });

    // The hub's buttons, ring and LEDs belong to this instance.
    const hubButtons = { left: mesh(K.left, K.M.white, hubGroup), right: mesh(K.right, K.M.white, hubGroup), center: mesh(K.center, K.M.white, hubGroup) };
    mesh(K.arrows, K.M.greyRim, hubGroup);
    const lightMat = new T.MeshBasicMaterial({ color: RING_OFF });
    hubGroup.add(new T.Mesh(K.lightRing, lightMat));
    const ledGeo = new T.BufferGeometry();
    ledGeo.setAttribute('position', K.ledPos);
    ledGeo.setIndex(K.ledIndex);
    ledGeo.setAttribute('color', new T.BufferAttribute(new Float32Array(25 * 4 * 4), 4));
    const led = new T.Mesh(ledGeo, K.M.led);
    led.visible = false;
    led.renderOrder = 1;
    const ledWindow = new T.Mesh(K.ledWindow, K.M.ledWindow);
    ledWindow.visible = false;
    hubGroup.add(ledWindow, led);

    // The sensor's own light travels with the sensor.
    const light = new T.Group();
    light.add(new T.Mesh(K.spot, K.spotMat), new T.Mesh(K.ray, K.rayMat), new T.Mesh(K.lens, K.lensMat));
    light.visible = false;
    sensorGroup.add(light);
    const sensor = new T.Object3D();
    sensor.position.set(SENSOR.x, SENSOR.h, SENSOR.z);
    group.add(sensor);

    let exploded = 0, buildN = STAGES.length - 1, buildT = 1, focus = null;

    const pose = () => {
      pieces.forEach((pc) => {
        pc.group.visible = pc.stage <= buildN;
        const fly = pc.stage === buildN ? 1 - smooth(buildT) : 0;
        pc.group.position.copy(pc.at).addScaledVector(pc.from, fly).addScaledVector(pc.out, exploded);
      });
    };

    const paint = (id) => {
      const f = fade[id];
      parts[id].traverse((m) => {
        const base = m.userData.base;
        if (!base) return;
        if (!f) { m.material = base; return; }
        if (!clones[id].has(base)) clones[id].set(base, base.clone());      // private to this instance, so two models never fade each other
        m.material = clones[id].get(base);
        m.material.color.copy(base.color).lerp(PALE, f * 0.9);
      });
    };

    pose();
    group.updateMatrixWorld(true);
    return {
      group, parts, PARTS, PORTS, WHEEL_R, TRACK, SENSOR, STAGES, sensor, hubButtons, box: new T.Box3().setFromObject(group),
      // A motor's positive direction is clockwise seen from its rotor's face. Both drive rotors look out of the robot, so a
      // positive D rolls the right wheel forward and a positive C rolls the left wheel backward.
      setWheels(c, d) {
        turning.L.forEach((g) => { g.rotation.z = -(+c || 0) * DEG; });
        turning.R.forEach((g) => { g.rotation.z = -(+d || 0) * DEG; });
      },
      // The large motor's rotor looks down: clockwise from below is counterclockwise from above.
      setTool(deg) { gear.rotation.y = (+deg || 0) * DEG; },
      setSensorLight(on) { light.visible = !!on; },
      setMatrix(arr) {
        const c = ledGeo.attributes.color;
        let any = false;
        for (let i = 0; i < 25; i++) {
          const a = arr ? clamp(arr[i] || 0, 0, 100) / 100 : 0;
          any = any || a > 0;
          for (let k = 0; k < 4; k++) c.setXYZW(i * 4 + k, 1, 1, 1, a);
        }
        c.needsUpdate = true;
        led.visible = ledWindow.visible = any;
      },
      setCenterLight(css) { lightMat.color.set(css || RING_OFF); },
      highlight(id) { focus = id || null; },
      setExplode(t) { exploded = clamp(+t || 0, 0, 1); pose(); },
      setBuildStage(n, t) { buildN = Math.floor(clamp(+n || 0, 0, STAGES.length - 1)); buildT = clamp(t === undefined ? 1 : +t || 0, 0, 1); pose(); },
      update(dt) {
        PARTS.forEach(({ id }) => {
          const goal = focus && focus !== id ? 1 : 0;
          if (fade[id] === goal) return;
          const step = RA.reducedMotion ? 1 : (dt || 0) * 5;
          fade[id] = goal > fade[id] ? Math.min(goal, fade[id] + step) : Math.max(goal, fade[id] - step);
          paint(id);
        });
      },
    };
  };
  // The lesson and the simulator read these before any robot is built.
  Object.assign(RA.createRobot, { PARTS, PORTS, WHEEL_R, TRACK, SENSOR, STAGES });
})();
