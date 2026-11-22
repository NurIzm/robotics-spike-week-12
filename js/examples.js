// "В жизни": one shared stage, six stories from RA.SCENES swapped inside it, a caption timeline read from the same phase table.
// The stories: machines that keep to a line or a wire, from the 1950s to school competitions.
(function () {
  const RA = window.RA, $ = RA.$;
  const FADE = 0.35; // shortcut: a dip to the background hides the reset at the loop point, make each loop seamless if the dip ever distracts
  const LEVELS = ['Ручное', 'Программа', 'Автономия'];
  const ease = (x) => x * x * x * (x * (6 * x - 15) + 10);
  const at = (list, t) => { // last entry that has started by time t
    let i = list.length - 1;
    while (i && t < list[i].t0) i--;
    return i;
  };
  // The verified facts of each story, merged into RA.SCENES (motion and captions, scenes.js) by id. Sources above each story.
  // `how` is shown as «Линия», `sensors` as «Чем видит».
  const FACTS = {
    // The first driverless tow truck, Barrett Electronics.
    // https://www.mmh.com/article/lets_remember_mac_barrett_father_of_the_agv : Barrett Electronics, 1954, a signal in a wire on the ceiling, later in a slot in the floor
    // https://tamcam.tamu.edu/courses/inen416/Handouts/AGV%20Presentation.pdf (Virginia Tech handout) : 1953, it pulled a trailer and followed an overhead wire in a grocery warehouse
    // https://en.wikipedia.org/wiki/Automated_guided_vehicle : Barrett Electronics, 1950s, a tow truck following a wire in the floor; a sensor under the vehicle reads the wire's field
    // The sources disagree on 1953 or 1954, so the site says «1950-е».
    wire: {
      title: 'Первая тележка', tag: '1950-е', grip: 'Провод в полу',
      where: 'Продуктовый склад в США, 1950-е годы. Тягач без водителя сделала компания Barrett Electronics.',
      does: 'Сам везёт прицеп с товаром по складу.',
      how: 'Провод с электрическим сигналом. Сначала его вешали над головой, потом стали прятать в канавку в полу.',
      sensors: 'Датчик под тягачом чувствует сигнал провода.',
      level: 2, auto: 'Руль тягач держит сам, по датчику. А путь ему задают люди: куда проложили провод, туда он и поедет.',
      common: 'Наш робот тоже едет по линии, которую проложил человек. Только наш датчик видит чёрную ленту светом, а тягач чувствует сигнал в проводе.',
    },
    // RCA Labs.
    // https://en.wikipedia.org/wiki/History_of_self-driving_cars : 1953, RCA Labs, a miniature car guided by wires laid on a laboratory floor;
    //   1957, a full-size demonstration on a 400-foot strip of highway near Lincoln, Nebraska
    lab: {
      title: 'Модель машины', tag: '1953', grip: 'Провода на полу',
      where: 'Лаборатория компании RCA в США, 1953 год.',
      does: 'Маленькая модель машины сама ехала по лаборатории. В 1957 году так же показали настоящую машину на участке шоссе длиной около 120 метров у города Линкольн в Америке.',
      how: 'Провода, проложенные по полу лаборатории.',
      sensors: 'Машину вели провода: она ехала туда, куда они проложены.',
      level: 2, auto: 'Водитель не нужен, но ехать можно только там, где лежат провода.',
      common: 'Почти наш урок: модель ехала по линии на полу. Только линией был провод, а не чёрная лента.',
    },
    // Volvo Kalmar Assembly.
    // https://en.wikipedia.org/wiki/Volvo_Kalmar_Assembly : opened in 1974; battery-driven carriers, one car body each, followed wires embedded in the floor
    //   instead of a fixed line; they could be parked in buffer zones, e.g. to cope with missing parts
    // https://tamcam.tamu.edu/courses/inen416/Handouts/AGV%20Presentation.pdf : Kalmar's computer-controlled AGVs in place of a conveyor assembly line
    // The sources disagree on how many carriers there were, so the site gives no number.
    kalmar: {
      title: 'Автозавод', tag: '1974', grip: 'Провода в полу',
      where: 'Завод Volvo в городе Кальмар, Швеция. Он открылся в 1974 году.',
      does: 'Тележки на аккумуляторах возят кузова машин по цеху, на каждой одна машина. Конвейера нет.',
      how: 'Провода, заложенные в пол цеха.',
      sensors: 'Тележка чувствует провод в полу и едет вдоль него.',
      level: 2, auto: 'Тележка едет по проводу сама. Её можно отправить в сторону и поставить ждать, например если не хватает деталей.',
      common: 'Тоже едет сама по проложенному пути и останавливается, когда нужно. Наш робот видит чёрную линию, а тележка чувствует провод в полу.',
    },
    // Tsukuba Mechanical Engineering Laboratory.
    // https://en.wikipedia.org/wiki/History_of_self-driving_cars : 1977, the first self-driving car that did not depend on wires under the road;
    //   it tracked street markings with two cameras, at up to 30 km/h
    tsukuba: {
      title: 'Машина с камерами', tag: '1977', grip: 'Разметка',
      where: 'Лаборатория машиностроения в городе Цукуба, Япония, 1977 год.',
      does: 'Машина сама едет по дороге, до 30 километров в час.',
      how: 'Разметка на дороге. Проводов под дорогой нет.',
      sensors: 'Две камеры смотрят на разметку.',
      level: 2, auto: 'Это первая машина без водителя, которой не нужны провода под дорогой: путь ей показывает разметка.',
      common: 'Наш робот тоже смотрит на линию, только одним датчиком цвета вниз, а эта машина двумя камерами вперёд.',
    },
    // Lane departure warning and lane keeping.
    // https://en.wikipedia.org/wiki/Lane_departure_warning_system : lane-keeping systems find the lane lines with a forward camera and fail when the lines
    //   are faded, missing or under snow; Nissan Cima, Japan, 2001; Citroën, 2005, infrared sensors under the car read the road markings
    lane: {
      title: 'Удержание полосы', tag: '2001', grip: 'Разметка',
      where: 'Обычные машины на шоссе. Одна из первых таких систем появилась в 2001 году в Японии, на машине Nissan.',
      does: 'Следит, чтобы машина не съехала со своей полосы.',
      how: 'Линии разметки между полосами.',
      sensors: 'Камера впереди находит линии разметки. А у Citroën в 2005 году разметку искали инфракрасные датчики под машиной: они смотрели вниз, как наш датчик цвета.',
      level: 0, auto: 'Машину ведёт водитель, система только предупреждает или подруливает. Если разметка стёрлась или её замело снегом, система её не видит.',
      common: 'Как и нашему роботу, ей нужна чёткая линия. На стёртой разметке она теряется так же, как наш робот на бледной линии.',
    },
    // RoboCupJunior Rescue Line.
    // https://junior.robocup.org/history/ : RoboCupJunior began in 1998
    // https://junior.robocup.org/rcj-rescue-line/ : an autonomous robot follows a black line past obstacles and debris, rescues victims and reaches an end zone
    // https://junior.robocup.org/wp-content/uploads/2026/11/RCJRescueLine2027-final.pdf : white 30 cm tiles; a black line 1-2 cm wide; gaps up to 20 cm,
    //   only on straight sections; green 25 mm markers at crossings show the way, no marker means straight on
    // https://sites.google.com/education.nsw.gov.au/robocup-links/line-rescue : the school level is raced with LEGO EV3 or SPIKE Prime robots
    rescue: {
      title: 'Соревнования', tag: 'RoboCupJunior', grip: 'Чёрная линия',
      where: 'Соревнования роботов RoboCupJunior, лига Rescue Line («Спасатели, линия»). RoboCupJunior проходят с 1998 года.',
      does: 'Робот сам проезжает трассу по чёрной линии: с разрывами, перекрёстками и препятствиями, а в конце спасает «пострадавших».',
      how: 'Чёрная линия шириной 1–2 см на белых плитках 30 × 30 см. Разрыв в линии бывает до 20 см.',
      sensors: 'Какие датчики поставить, решают сами школьники. На школьных соревнованиях часто едут роботы LEGO SPIKE Prime с датчиками цвета. Зелёный квадрат 25 мм перед перекрёстком показывает, куда свернуть.',
      level: 2, auto: 'Полная автономия: робот сам решает, куда ехать. Люди только ставят его на старт.',
      common: 'Это наш урок, только трасса сложнее: такая же чёрная линия, а робот не должен потерять её на разрыве и на перекрёстке.',
    },
  };
  const pose = {};
  let stage, box, ui, cur = null, time = 0, playing = false, step = -1;
  // Ids of stories that no longer exist are dropped, so they cannot count towards the three seen.
  const seen = new Set([].concat(RA.store.get('examples.seen', [])).filter((id) => RA.SCENES.some((s) => s.id === id)));

  // Turns a scene's table into running times, whole poses and caption steps.
  function prepare(sc) {
    sc.poses = [sc.start];
    sc.total = 0;
    sc.steps = [];
    sc.phases.forEach((row, i) => {
      const { s, text, linear, ...to } = row;
      sc.poses.push(Object.assign({}, sc.poses[i], to));
      if (text) sc.steps.push({ text, t0: sc.total, s: 0 });
      sc.steps[sc.steps.length - 1].s += s;
      row.t0 = sc.total;
      sc.total += s;
    });
  }

  function sample(sc, t) {
    const i = at(sc.phases, t), r = sc.phases[i], raw = Math.min(1, (t - r.t0) / r.s), k = r.linear ? raw : ease(raw), a = sc.poses[i], b = sc.poses[i + 1];
    for (const key in b) pose[key] = a[key] + (b[key] - a[key]) * k;
  }

  function paintStep(t) {
    const i = at(cur.steps, t);
    if (i !== step) {
      step = i;
      ui.now.textContent = cur.steps[i].text;
      ui.steps.forEach((el, n) => {
        el.classList.toggle('is-now', n === i);
        el.classList.toggle('is-past', n < i);
        if (n === i) el.setAttribute('aria-current', 'step');
        else el.removeAttribute('aria-current');
      });
    }
    ui.steps[i].style.setProperty('--p', Math.min(1, (t - cur.steps[i].t0) / cur.steps[i].s));
  }

  function draw() {
    const t = time % cur.total;
    sample(cur, t);
    cur.apply(pose, time, t / cur.total);
    paintStep(t);
    if (stage.renderer) stage.renderer.domElement.style.opacity = playing ? Math.min(1, t / FADE, (cur.total - t) / FADE) : 1;
  }

  function paintToggle() {
    ui.toggle.setAttribute('aria-label', playing ? 'Пауза' : 'Смотреть');
    ui.toggle.dataset.state = playing ? 'playing' : 'paused';
    ui.toggle.classList.toggle('is-waiting', !playing && RA.reducedMotion);
  }

  function frameCamera() {
    if (!cur) return;
    // Pull back on narrow canvases so the whole story stays in the frame.
    const fit = Math.max(1, 1.42 / (stage.size.w / stage.size.h));
    const eye = new THREE.Vector3(...cur.camera), target = new THREE.Vector3(...cur.target);
    stage.camera.position.copy(target).addScaledVector(eye.sub(target), fit);
    stage.target.copy(target);
    if (stage.controls) {
      stage.controls.target.copy(target);
      stage.controls.update();
    }
  }

  function fill(sc) {
    ui.grip.textContent = sc.grip;
    $('#ex-where').textContent = sc.where;
    $('#ex-does').textContent = sc.does;
    $('#ex-how').textContent = sc.how;
    $('#ex-sensors').textContent = sc.sensors;
    $('#ex-auto').textContent = sc.auto;
    $('#ex-common').textContent = sc.common;
    RA.$$('#ex-levels span').forEach((el, i) => el.classList.toggle('is-on', i === sc.level));
    ui.stepList.replaceChildren(...sc.steps.map((st) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ex__step';
      b.innerHTML = '<i class="ex__hole"></i><span></span>';
      b.lastChild.textContent = st.text;
      b.addEventListener('click', () => seek(st.t0));
      li.append(b);
      return li;
    }));
    ui.steps = RA.$$('.ex__step', ui.stepList);
    step = -1;
    RA.$$('.ex__item').forEach((el) => {
      const on = el.dataset.id === sc.id;
      el.classList.toggle('is-current', on);
      el.classList.toggle('is-seen', seen.has(el.dataset.id));
      if (on) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
  }

  function show(id) {
    const sc = RA.SCENES.find((s) => s.id === id) || RA.SCENES[0];
    if (sc === cur) return;
    if (cur && cur.root) cur.root.visible = false;
    if (RA.webgl && !sc.root) {
      sc.root = new THREE.Group();
      stage.scene.add(sc.root);
      sc.apply = sc.build(sc.root, stage);
    }
    if (!sc.apply) sc.apply = () => {};
    if (sc.root) sc.root.visible = true;
    cur = sc;
    box.style.background = sc.bg;
    if (stage.renderer) stage.renderer.domElement.setAttribute('aria-label', sc.title + '. ' + sc.does);
    seen.add(sc.id);
    RA.store.set('examples.seen', [...seen]);
    if (seen.size >= 3) RA.progress.mark('examples');
    fill(sc);
    frameCamera();
    playing = !RA.reducedMotion;
    time = playing ? FADE : sc.poster; // a reduced-motion viewer gets a telling still and waits for the button
    paintToggle();
    draw();
  }

  function seek(t) {
    time = t;
    draw();
  }

  function init(view) {
    box = $('#ex-stage', view);
    ui = { now: $('#ex-now', view), stepList: $('#ex-steps', view), toggle: $('#ex-toggle', view), grip: $('#ex-grip', view), steps: [] };
    RA.SCENES.forEach((sc) => prepare(Object.assign(sc, FACTS[sc.id])));
    $('#ex-levels', view).innerHTML = LEVELS.map((l) => '<span>' + l + '</span>').join('');
    $('#ex-list', view).innerHTML = RA.SCENES.map((s) => '<li><button type="button" class="ex__item" data-id="' + s.id + '"><i class="ex__hole"></i>' +
      '<b>' + s.title + '</b><em>' + s.tag + '</em></button></li>').join('');
    $('#ex-list', view).addEventListener('click', (e) => {
      const b = e.target.closest('.ex__item');
      if (b) show(b.dataset.id);
    });
    ui.toggle.addEventListener('click', () => {
      playing = !playing;
      paintToggle();
    });
    stage = RA.stage(box, { fov: 24, near: 4, far: 1400, shadowBox: 76, maxDpr: 1.5, camera: [0, 30, 100], target: [0, 8, 0] });
    if (stage.renderer) {
      stage.key.position.set(-34, 90, 60);
      stage.key.intensity = 1.25; // the scenes bring saturated toy colours, the stage defaults would burn them out
      stage.key.shadow.camera.far = 260;
      stage.key.shadow.camera.updateProjectionMatrix();
      stage.controls.minDistance = 30;
      stage.controls.maxDistance = 240;
      stage.renderer.domElement.style.touchAction = 'pan-y'; // a phone can still scroll the page across the canvas
      stage.renderer.domElement.setAttribute('role', 'img');
    }
    stage.frame((dt) => {
      if (!cur) return;
      if (playing) time += dt;
      draw();
    });
    new ResizeObserver(frameCamera).observe(box);
    show(RA.SCENES[0].id);
  }

  RA.view('examples', {
    init,
    enter() { stage.start(); },
    leave() { stage.stop(); },
  });

  RA.examples = { show, seek, get stage() { return stage; } }; // the QA script drives the stills through this
})();
