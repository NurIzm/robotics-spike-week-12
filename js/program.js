// The program view: blocks on the left, the robot on its mat on the right, the six tasks on top.
(function () {
  const RA = window.RA;
  const { $, $$ } = RA;

  /* ---------- Numbers the checks use ---------- */
  const SLACK = 10;        // task 1: how far the typed threshold may be from the middle of white and black
  const PAST = 3;          // task 2: cm past the line that still count as «on it»: LEGO's 50 % stops about 2 cm past, 100 % about 8
  // Measured on «Трасса 2» (steering ±50): 30 % laps in 30 s, 40 % in 22.8, 50 % in 18.4, 55 % in 16.9, from 60 % it flies off the tight bend.
  const LAP_LIMIT = 24;    // task 4: s for one lap of «Трасса 2»
  // Measured: the proportional rule with a factor of 0.8–2 swings 1–2 times a metre, any zigzag 25 and more, a factor of 3 hunts at 125.
  const WOBBLE_MAX = 6;    // task 5: «виляние», swings per metre
  const PROGRESS = 0.9;    // task 6: share of the route the lens must have followed
  const IDLE = 2;          // s of a run without movement before the check says why
  const STUCK = 6;         // s of driving without getting further along the line
  const KEEP = 5;          // rows in the tables of attempts
  const comma = (v, d = 1) => v.toFixed(d).replace('.', ',');

  const TASKS = [
    { title: 'Что видит датчик', mat: 'probe',
      goal: 'Программа не нужна. Перетащи робота мышью на карте справа вверху или прямо на поле. Поставь датчик на белое, на чёрную полосу и на её край и смотри на шкалу внизу. Потом впиши порог.',
      hint: 'Розовая точка на карте — это датчик. Порог — середина между белым и чёрным: сложи их и раздели пополам. Например, (90 + 10) : 2 = 50.',
      ready: 'Перетащи робота так, чтобы датчик встал на белое, на чёрное и на границу. Стрелки ← и → поворачивают робота.' },
    { title: 'Стоп на линии', mat: 'stop',
      goal: 'Робот должен доехать до чёрной линии и остановиться на ней. Сейчас он её не замечает и уезжает с поля.',
      hint: 'После «начать движение» поставь «ждать до» из «Управления». В него вставь «B отражённый свет < 50 %?» из «Датчиков». Последний блок: «остановить движение».',
      ready: 'Нажми запуск и смотри, где остановится робот.',
      idle: 'Робот не сдвинулся. Проверь «установить моторы для движения C+D» и условие в «ждать до»: робот ждёт, пока отражённый свет станет меньше 50.' },
    { title: 'Зигзаг по линии', mat: 'track1',
      goal: 'Научи робота ехать по краю линии и пройти целый круг. На чёрном пусть поворачивает вправо, на белом влево.',
      hint: 'В «если» (датчик видит чёрное: меньше 50) положи «начать движение вправо: 30», в «иначе» — «начать движение влево: -30». Блок есть в «Движении». Руль поворачивают кружком или вписывают число.',
      ready: 'Нажми запуск. Датчик робота стоит на правом краю линии.',
      idle: 'Робот стоит: в «если» и в «иначе» пока нет блоков «начать движение».' },
    { title: 'Быстрее!', mat: 'track2',
      goal: `На этой трассе крутой поворот. Пройди круг быстрее чем за ${LAP_LIMIT} секунды: меняй скорость движения и оба числа руля.`,
      hint: 'На крутом повороте руля 30 не хватает: попробуй вправо: 50 и влево: -50. С таким рулём можно ехать быстрее, 40–50 %. Слишком быстро, и робот вылетит.',
      ready: 'Нажми запуск. Каждая попытка попадёт в таблицу.' },
    { title: 'Плавный руль', mat: 'track2',
      goal: `Сделай руль плавным: чем дальше датчик от края линии, тем круче поворот. Пройди круг с вилянием не больше ${WOBBLE_MAX}.`,
      hint: 'Вставь выражение «(50 − B отражённый свет) × 0.5» в «начать движение» вместо «прямо: 0». С 0.5 робот не успевает в повороте: попробуй 1 или 1.2.',
      ready: 'Нажми запуск. Виляние — сколько раз на метр пути робот меняет поворот.' },
    { title: 'Стоп на красном', mat: 'route',
      goal: 'Робот везёт груз по линии. Пусть он остановится на красном поле в конце пути. Сейчас он доезжает и не останавливается.',
      hint: 'Возьми «повторять пока не» из «Управления» вместо «повторять всегда». Условие: «B цвет красный?» из «Датчиков». После цикла поставь «остановить движение».',
      ready: 'Нажми запуск и смотри, где остановится робот.' },
  ];
  const program = (i, kind) => ((RA.PROGRAMS || [])[i] || {})[kind] || '<xml></xml>';
  const key = (i) => 'program.xml.' + i;

  let root, sim, bl, vm, split;
  let task = 0, watch = {};
  const probe = { white: null, black: null, border: null };
  let tries = {};                                          // tasks 4 and 5: the attempts, newest first

  const show = (sel, v) => {
    const el = $(sel), text = String(v).replace('-', '−');
    if (el.textContent !== text) el.textContent = text;
  };
  const say = (text, kind) => {
    const s = $('#task-status');
    s.textContent = text;
    s.dataset.kind = kind || '';
  };
  const warn = (text) => { say(text, 'warn'); RA.toast(text, 'warn'); };

  const paintTabs = () => {
    const done = RA.store.get('program.tasks', {});
    $$('.tasks__tab').forEach((b, i) => {
      b.setAttribute('aria-pressed', i === task);
      b.classList.toggle('is-done', !!done[i]);
    });
  };
  const solved = (i, text) => {
    say(text, 'ok');
    RA.toast(text, 'ok');
    const done = RA.store.get('program.tasks', {});
    if (done[i]) return;
    done[i] = true;
    RA.store.set('program.tasks', done);
    paintTabs();
    if (TASKS.every((t, n) => done[n])) RA.progress.mark('program');
  };

  /* ---------- Task 1: what the sensor reads on white, on black and on the border ---------- */
  const paintProbe = () => ['white', 'black', 'border'].forEach((k) => show('#probe-' + k, probe[k] === null ? '…' : probe[k] + ' %'));
  const checkProbe = () => {
    if (task !== 0) return;
    const { white, black, border } = probe, typed = $('#probe-thr').value.trim();
    const left = [[white, 'белое'], [black, 'чёрное'], [border, 'границу']].filter(([v]) => v === null).map(([, n]) => n);
    if (left.length) return say('Ещё поставь датчик на ' + left.join(', ') + '.');
    if (typed === '') return say('Все три числа есть. Теперь впиши порог: середину между белым и чёрным.');
    if (Math.abs(+typed - (white + black) / 2) <= SLACK) {
      solved(0, `Верно: порог ${typed} % посередине между белым (${white} %) и чёрным (${black} %). Меньше порога — линия, больше — бумага.`);
    } else warn(`Порог ${typed} % не посередине между белым и чёрным. Сложи их и раздели пополам.`);
  };
  const watchProbe = () => {
    const s = sim.sensor, v = Math.round(s.reflected), [x0, z0, x1, z1] = sim.mat.zones.black;
    const across = s.z > z0 && s.z < z1, edge = across && Math.min(Math.abs(s.x - x0), Math.abs(s.x - x1)) < 0.7;
    const k = s.color === 0 && v <= 20 && across && s.x > x0 && s.x < x1 ? 'black'
      : s.color === 10 && v >= 80 ? 'white' : edge && v >= 25 && v <= 75 ? 'border' : null;
    if (!k || probe[k] === v) return;
    probe[k] = v;
    RA.store.set('program.probe', probe);
    paintProbe();
    checkProbe();
  };

  /* ---------- Tasks 2–6: each watches one run from its start ---------- */
  const newRound = () => {
    watch = { ran: false };
    say(TASKS[task].ready);
  };
  const end = (text) => { watch.done = true; vm.stop(); warn(text); };
  // Wheels that do not turn: said once, the run goes on (a program may still start them later).
  const idle = (r) => {
    if (watch.idle || !sim.still || r.time < IDLE) return false;
    watch.idle = true;
    warn(TASKS[task].idle || 'Робот стоит на месте. Есть ли в программе «установить моторы для движения C+D» и «начать движение»?');
    return true;
  };
  // A robot that spins or circles at the line, or follows it backwards, never loses it and never gets anywhere either.
  const stuck = (r) => {
    // 3 % of the way in STUCK seconds is about 1.3 cm/s; the slowest follower that works (30 %, ±50) does 9 cm/s.
    if (r.progress > (watch.p || 0) + 0.03) { watch.p = r.progress; watch.pt = r.time; return false; }
    if (r.time - (watch.pt || 0) < STUCK || sim.still) return false;
    end('Робот не продвигается вперёд: он кружит у линии или едет по ней назад. Сбавь скорость или сделай руль мягче.');
    return true;
  };
  const lostText = (r) => `Робот потерял линию на ${Math.round(r.lostAt * 100)} % ${sim.mat.closed ? 'круга' : 'пути'}. `
    + (r.top > 60 ? 'Слишком быстро: сбавь скорость.' : Math.abs(r.spin) > 300 ? 'Он кружит на месте: проверь, куда он поворачивает на чёрном и на белом.'
      : 'На повороте нужен руль круче или скорость меньше.');
  const record = (row) => {
    tries[task] = [row, ...(tries[task] || [])].slice(0, KEEP);
    RA.store.set('program.tries', tries);
    paintTable();
  };
  const paintTable = () => {
    const t = $('#task-table'), smooth = task === 4, list = tries[task] || [];
    t.hidden = task !== 3 && task !== 4;
    if (t.hidden) return;
    const cols = smooth ? 3 : 2;
    const row = (x) => (x.time === undefined ? `<td colspan="${cols - 1}" data-mark="slip">сошёл с линии на ${Math.round(x.lost * 100)} % круга</td>`
      : `<td data-mark="${smooth || x.time <= LAP_LIMIT ? 'ok' : 'slip'}">${comma(x.time)} с</td>`
        + (smooth ? `<td data-mark="${x.wobble <= WOBBLE_MAX ? 'ok' : 'slip'}">${x.wobble}</td>` : ''));
    t.innerHTML = `<tr><th scope="col">Скорость</th><th scope="col">Круг</th>${smooth ? '<th scope="col">Виляние</th>' : ''}</tr>`
      + (list.length ? list.map((x) => `<tr><td>${x.speed} %</td>${row(x)}</tr>`).join('') : `<tr><td colspan="${cols}">Попыток пока нет</td></tr>`);
  };

  const checkStop = (r) => {
    if (r.outside) return end('Робот проехал линию и уехал с поля. После «начать движение» он должен ждать чёрное и остановиться.');
    if (idle(r) || !sim.still || r.dist < 1) return;
    const x = sim.sensor.x, [x0, , x1] = sim.mat.zones.line;
    watch.done = true;
    vm.stop();
    if (x < x0 - 0.5) warn(`Робот остановился раньше линии: до неё ещё ${comma(x0 - x)} см. Он должен ехать, пока датчик не увидит чёрное.`);
    else if (x > x1 + PAST) warn(`Робот остановился в ${Math.round(x - x1)} см за линией. Сбавь скорость: на быстром ходу он не успевает затормозить.`);
    else solved(1, 'Робот остановился на линии: датчик увидел чёрное, и программа выключила моторы.');
  };
  // Tasks 3, 4 and 5: one lap of a closed track.
  const checkLap = (r) => {
    if (r.outside) return end('Робот уехал с поля: он потерял линию.');
    if (idle(r)) return;
    if (!vm.running && sim.still && !r.laps) return end('Программа закончилась, а круг не пройден. Проверка датчика и движение должны повторяться в цикле «повторять всегда».');
    if (r.laps) {
      watch.done = true;
      vm.stop();
      if (task === 2) return solved(2, `Круг пройден за ${comma(r.lapTime)} с. Робот едет по краю линии: на чёрном вправо, на белом влево.`);
      if (task === 3) {
        record({ speed: r.top, time: r.lapTime });
        if (r.lapTime <= LAP_LIMIT) return solved(3, `Круг за ${comma(r.lapTime)} с, быстрее ${LAP_LIMIT} с! Быстрому роботу нужен руль круче.`);
        return warn(`Круг за ${comma(r.lapTime)} с, а нужно быстрее ${LAP_LIMIT} с. Прибавь скорость и поверни руль круче, чтобы робот не вылетел.`);
      }
      record({ speed: r.top, time: r.lapTime, wobble: r.wobble });
      if (r.wobble <= WOBBLE_MAX) return solved(4, `Круг за ${comma(r.lapTime)} с, виляние ${r.wobble}. Руль поворачивает ровно настолько, насколько датчик ушёл от края.`);
      return warn(`Виляние ${r.wobble}, а нужно не больше ${WOBBLE_MAX}. Руль должен считаться из отражённого света. Если он уже так считается, уменьши число в выражении.`);
    }
    if (r.lost) {
      if (task === 3 || task === 4) record({ speed: r.top, lost: r.lostAt });
      end(lostText(r));
    } else stuck(r);
  };
  const checkRed = (r) => {
    if (r.outside) return end(r.seen.finish ? 'Робот проехал красное поле и уехал с поля. Он должен остановиться, когда датчик увидит красный.' : 'Робот уехал с поля: он потерял линию.');
    if (idle(r)) return;
    if (sim.still && r.dist > 1) {
      watch.done = true;
      vm.stop();
      if (sim.zone !== 'finish') return warn('Робот остановился, но не на красном поле. Он должен ехать по линии, пока датчик не увидит красный.');
      if (r.progress < PROGRESS) return warn('Робот на красном поле, но приехал не по линии. Нажми «На старт» и запусти снова.');
      return solved(5, 'Груз доставлен: робот проехал по линии и остановился на красном поле.');
    }
    if (r.lost) end(r.seen.finish ? 'Робот доехал до красного поля и не остановился. Пусть цикл повторяется, пока датчик не увидит красный, а после цикла робот остановится.' : lostText(r));
    else if (!r.seen.finish) stuck(r);
  };
  const CHECKS = [null, checkStop, checkLap, checkLap, checkLap, checkRed];

  /* ---------- Every frame: the readouts and the check ---------- */
  let lastCss = '', lastV = -1;
  const tick = () => {
    ['C', 'D', 'E'].forEach((p) => {
      const m = sim.hw.motors[p];
      show(`#read-${p}-angle`, m.position);
      show(`#read-${p}-speed`, m.speedPct);
      show(`#read-${p}-power`, m.powerPct);
    });
    const s = sim.sensor, v = Math.round(s.reflected), r = sim.run;
    show('#lens-pct', v);
    show('#lens-color', s.name);
    if (s.css !== lastCss) { lastCss = s.css; $('#lens-swatch').style.background = s.css; }
    if (v !== lastV) { lastV = v; root.style.setProperty('--lens', v / 100); }
    show('#run-time', comma(r.time));
    show('#run-dist', Math.round(r.dist));
    show('#run-laps', r.laps ? `${r.laps} · ${comma(r.lapTime)} с` : 0);
    if (task === 0) watchProbe();
    else if (watch.ran && !watch.done) CHECKS[task](r);
  };

  /* ---------- Running ---------- */
  const play = () => {
    sim.hw.sound.unlock();
    // A run starts from the start mark, unless the student has put the robot somewhere by hand since the last one.
    if (!sim.run.moved) sim.reset();
    sim.beginRun();
    vm.start();
  };
  const startStop = () => { if (vm.running) vm.stop(); else play(); };
  const onRun = (running) => {
    root.classList.toggle('is-running', running);
    if (running) watch = { ran: true };
    else sim.endRun();
  };

  const leds = [];
  const onHw = (e) => {
    vm.dispatch(e);
    if (e.type === 'center') startStop();
    if (e.type === 'display') e.px.forEach((v, i) => { leds[i].style.opacity = v / 100; });
    if (e.type === 'light') $('#hub-center').style.setProperty('--light', e.css);
    if (e.type === 'button') $('#hub-' + e.side).classList.toggle('is-pressed', e.state === 'pressed');
  };

  /* ---------- Tasks: each has its own program ---------- */
  const loadProgram = (i) => {
    const starter = program(i, 'starter');
    try { bl.load(RA.store.get(key(i), null) || starter); } catch (e) { bl.load(starter); }
  };
  const select = (i, first) => {
    if (!first) RA.store.set(key(task), bl.save());
    vm.stop();
    task = i;
    RA.store.set('program.task', i);
    const t = TASKS[i];
    $('#task-goal').textContent = t.goal;
    $('#task-hint').textContent = t.hint;
    $('#task-hint').hidden = true;
    $('#task-hint-btn').setAttribute('aria-expanded', 'false');
    $('#probe').hidden = i !== 0;
    paintTabs();
    paintTable();
    sim.setMat(t.mat);
    loadProgram(i);
    newRound();
    if (i === 0) checkProbe();
  };

  // Text fields, menus and dialogs own the keyboard while they are open.
  const typing = () => {
    const a = document.activeElement;
    return (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) || Blockly.WidgetDiv.isVisible()
      || !!Blockly.DropDownDiv.owner_ || !!$('dialog[open]');
  };
  // ← and → turn the robot by hand, 15° a press, as on a real table.
  const onKey = (e) => {
    if ((e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') || typing() || e.ctrlKey || e.metaKey || e.altKey || document.activeElement === split) return;
    e.preventDefault();
    sim.turn(e.code === 'ArrowLeft' ? 1 : -1);
  };

  const setSplit = (pct) => {
    // The left panel keeps room beside the palette for the tools and the run buttons.
    const w = root.clientWidth, min = ((bl.workspace.getMetrics().absoluteLeft + 345) / w) * 100, max = 100 - (320 / w) * 100;
    pct = Math.min(max, Math.max(min, pct));
    root.style.setProperty('--split', pct + '%');
    return pct;
  };

  const build = () => {
    const tabs = $('#task-tabs');
    TASKS.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tasks__tab';
      b.innerHTML = '<span class="tasks__pin" aria-hidden="true"></span><span class="tasks__name"></span>';
      b.lastChild.textContent = t.title;
      b.onclick = () => { if (i !== task) select(i); };
      tabs.append(b);
    });
    const box = $('#hub-leds');
    for (let i = 0; i < 25; i++) leds.push(box.appendChild(document.createElement('i')));
  };

  const wire = () => {
    $('#task-hint-btn').onclick = (e) => {
      const hint = $('#task-hint');
      hint.hidden = !hint.hidden;
      e.currentTarget.setAttribute('aria-expanded', !hint.hidden);
    };
    $('#task-solution').onclick = () => {
      if (task === 0) {
        if (probe.white === null || probe.black === null) return say('Сначала поставь датчик на белое и на чёрное: числа запишутся сами.', 'warn');
        $('#probe-thr').value = Math.round((probe.white + probe.black) / 2);
        RA.store.set('program.thr', $('#probe-thr').value);
        return checkProbe();
      }
      Blockly.confirm('Заменить твою программу готовым решением? Твои блоки пропадут.', (ok) => {
        if (!ok) return;
        vm.stop();
        bl.load(program(task, 'solution'));
        say('Решение загружено. Нажми запуск и проверь.');
      });
    };
    $('#task-restart').onclick = () => {
      Blockly.confirm('Начать заново? Вернутся стартовые программы всех заданий. Отметки, таблицы и результат теста сотрутся.', (ok) => {
        if (!ok) return;
        RA.store.remove(['done', 'program.tasks', 'program.task', 'program.probe', 'program.thr', 'program.tries', 'lessonQuiz', 'examples.seen', ...TASKS.map((t, i) => key(i))]);
        location.reload();
      });
    };
    $('#probe-thr').addEventListener('input', (e) => { RA.store.set('program.thr', e.target.value); checkProbe(); });

    $('#prog-play').onclick = play;
    $('#prog-stop').onclick = () => vm.stop();
    $('#hub-center').onclick = startStop;
    $('#prog-home').onclick = () => { vm.stop(); sim.reset(); newRound(); };
    const viewBtn = $('#view-btn'), paintView = () => { viewBtn.textContent = sim.view === 'mat' ? 'За роботом' : 'Всё поле'; };
    viewBtn.onclick = () => { sim.setView(sim.view === 'mat' ? 'follow' : 'mat'); paintView(); };
    paintView();
    $('#trail-btn').onclick = (e) => { sim.trail = !sim.trail; e.currentTarget.setAttribute('aria-pressed', String(sim.trail)); };
    $('#turn-left').onclick = () => sim.turn(1);
    $('#turn-right').onclick = () => sim.turn(-1);

    $('#prog-tools').onclick = (e) => {
      const b = e.target.closest('[data-tool]'), ws = bl.workspace;
      if (!b) return;
      ({ fit: () => { ws.zoomToFit(); ws.setScale(ws.scale * 0.75); ws.scrollCenter(); }, out: () => ws.zoomCenter(-1), in: () => ws.zoomCenter(1), undo: () => ws.undo(false), redo: () => ws.undo(true) })[b.dataset.tool]();
    };
    ['left', 'right'].forEach((side) => {
      const b = $('#hub-' + side);
      b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); sim.press(side, true); });
      ['pointerup', 'pointercancel'].forEach((n) => b.addEventListener(n, () => sim.press(side, false)));
    });

    split = $('#prog-split');
    split.addEventListener('pointerdown', (e) => {
      split.setPointerCapture(e.pointerId);
      split.classList.add('is-moving');
    });
    split.addEventListener('pointermove', (e) => {
      if (!split.classList.contains('is-moving')) return;
      const r = root.getBoundingClientRect();
      RA.store.set('program.split', setSplit(((e.clientX - r.left) / r.width) * 100));
    });
    ['pointerup', 'pointercancel'].forEach((n) => split.addEventListener(n, () => split.classList.remove('is-moving')));
    split.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const now = parseFloat(root.style.getPropertyValue('--split')) || 58;
      RA.store.set('program.split', setSplit(now + (e.key === 'ArrowLeft' ? -2 : 2)));
    });
  };

  RA.view('program', {
    init(el) {
      root = $('#prog', el);
      sim = RA.createSim($('#prog-stage'));
      build();
      Object.assign(probe, RA.store.get('program.probe', {}));
      paintProbe();
      tries = RA.store.get('program.tries', {});
      $('#probe-thr').value = RA.store.get('program.thr', '');
      const saved = RA.store.get('program.split', 0);
      if (saved) root.style.setProperty('--split', saved + '%');
      const host = $('#prog-blockly');
      bl = RA.createBlocks(host, { onChange: () => RA.store.set(key(task), bl.save()) });
      root.style.setProperty('--palette', bl.workspace.getMetrics().absoluteLeft + 'px');
      new ResizeObserver(() => { if (RA.current === 'program') Blockly.svgResize(bl.workspace); }).observe(host);
      vm = RA.createVM(bl.workspace, sim.hw, { onState: onRun });
      sim.hw.onEvent(onHw);
      sim.onTick = tick;
      if (!sim.stage.renderer) $('#view-btn').hidden = true;      // no WebGL: the map is the whole picture
      wire();
      select(Math.min(RA.store.get('program.task', 0), TASKS.length - 1), true);
      // QA and the console reach the live objects here.
      RA.program = { sim, bl, vm, select, play, TASKS, LAP_LIMIT, WOBBLE_MAX, get task() { return task; }, get watch() { return watch; }, get tries() { return tries; } };
    },
    enter() {
      Blockly.svgResize(bl.workspace);
      sim.start();
      addEventListener('keydown', onKey);
    },
    leave() {
      vm.stop();
      sim.stop();
      removeEventListener('keydown', onKey);
      Blockly.hideChaff();
      Blockly.DropDownDiv.hideWithoutAnimation();
      // Delete on another view must not eat the block that was last selected here.
      if (Blockly.selected) Blockly.selected.unselect();
    },
  });
})();
