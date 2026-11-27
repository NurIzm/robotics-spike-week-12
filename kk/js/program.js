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
    { title: 'Датчик не көреді', mat: 'probe',
      goal: 'Бағдарлама керек емес. Роботты тінтуірмен сүйреп жылжыт: оң жақ жоғарыдағы картада немесе тура алаңның өзінде. Датчикті ақ түске, қара жолаққа және оның шетіне қойып, төмендегі шкаланы бақыла. Сосын шекті жаз.',
      hint: 'Картадағы қызғылт нүкте — датчик. Шек — ақ пен қара арасының ортасы: екеуін қосып, екіге бөл. Мысалы, (90 + 10) : 2 = 50.',
      ready: 'Роботты сүйреп, датчикті ақ түске, қара түске және шекараға қой. ← және → нұсқарлары роботты бұрады.' },
    { title: 'Сызықта тоқта', mat: 'stop',
      goal: 'Робот қара сызыққа дейін жетіп, соның үстінде тоқтауы керек. Қазір ол сызықты байқамай, алаңнан шығып кетеді.',
      hint: '«Управление» категориясынан «ждать до» блогын алып, «начать движение» блогынан кейін қой. Оның ішіне «Датчики» категориясынан «B отражённый свет < 50 %?» блогын сал. Соңғы блок — «остановить движение».',
      ready: 'Іске қосу батырмасын бас та, робот қай жерде тоқтайтынын бақыла.',
      idle: 'Робот орнынан қозғалмады. «установить моторы для движения C+D» блогын және «ждать до» блогындағы шартты тексер: робот шағылған жарық 50-ден аз болғанша күтеді.' },
    { title: 'Сызықпен зигзаг', mat: 'track1',
      goal: 'Роботты сызықтың шетімен жүруге үйрет: ол толық бір айналым жүріп шықсын. Қара түсте оңға, ақ түсте солға бұрылсын.',
      hint: '«если» бөлігіне (датчик қара түсті көреді: 50-ден аз) «начать движение вправо: 30» блогын сал, ал «иначе» бөлігіне — «начать движение влево: -30» блогын. Бұл блок «Движение» категориясында бар. Рульді шеңбермен бұрауға немесе санын жазуға болады.',
      ready: 'Іске қосу батырмасын бас. Роботтың датчигі сызықтың оң жақ шетінде тұр.',
      idle: 'Робот тұр: «если» және «иначе» бөліктерінде әлі «начать движение» блоктары жоқ.' },
    { title: 'Тезірек!', mat: 'track2',
      goal: `Бұл трассада күрт бұрылыс бар. Бір айналымды ${LAP_LIMIT} секундтан аз уақытта жүріп шық: қозғалыс жылдамдығын және рульдің екі санын да өзгерт.`,
      hint: 'Күрт бұрылыста руль 30 болса, жетпейді: «вправо: 50» және «влево: -50» қойып көр. Мұндай рульмен жылдамырақ, 40–50 % жылдамдықпен жүруге болады. Тым жылдам жүрсе, робот трассадан ұшып шығады.',
      ready: 'Іске қосу батырмасын бас. Әр әрекет кестеге жазылады.' },
    { title: 'Жұмсақ руль', mat: 'track2',
      goal: `Рульді жұмсақ ет: датчик сызықтың шетінен неғұрлым алыс болса, бұрылыс соғұрлым күрт болсын. Бір айналым жүріп шық: ирелеңдеу ең көбі ${WOBBLE_MAX} болсын.`,
      hint: '«(50 − B отражённый свет) × 0.5» өрнегін «начать движение» блогына «прямо: 0» мәнінің орнына қой. 0.5 болғанда робот бұрылып үлгермейді: 1 немесе 1.2 қойып көр.',
      ready: 'Іске қосу батырмасын бас. Ирелеңдеу — робот бір метр жолда бұрылысын неше рет ауыстыратыны.' },
    { title: 'Қызылда тоқта', mat: 'route',
      goal: 'Робот жүкті сызық бойымен алып барады. Ол жолдың соңындағы қызыл алаңда тоқтасын. Қазір ол қызыл алаңға жетеді, бірақ тоқтамайды.',
      hint: '«повторять всегда» блогының орнына «Управление» категориясынан «повторять пока не» блогын ал. Шарты — «Датчики» категориясынан «B цвет красный?» блогы. Циклден кейін «остановить движение» блогын қой.',
      ready: 'Іске қосу батырмасын бас та, робот қай жерде тоқтайтынын бақыла.' },
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
    const left = [[white, 'ақ түске'], [black, 'қара түске'], [border, 'шекараға']].filter(([v]) => v === null).map(([, n]) => n);
    if (left.length) return say('Енді датчикті ' + left.join(', ') + ' қой.');
    if (typed === '') return say('Үш сан да бар. Енді шекті жаз: ақ пен қара арасының ортасын.');
    if (Math.abs(+typed - (white + black) / 2) <= SLACK) {
      solved(0, `Дұрыс: шек ${typed} % — ақ пен қара арасының дәл ортасы (ақ — ${white} %, қара — ${black} %). Шектен аз — сызық, көп — қағаз.`);
    } else warn(`Шек ${typed} % ақ пен қара арасының ортасында емес. Екеуін қосып, екіге бөл.`);
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
    warn(TASKS[task].idle || 'Робот орнында тұр. Бағдарламада «установить моторы для движения C+D» және «начать движение» блоктары бар ма?');
    return true;
  };
  // A robot that spins or circles at the line, or follows it backwards, never loses it and never gets anywhere either.
  const stuck = (r) => {
    // 3 % of the way in STUCK seconds is about 1.3 cm/s; the slowest follower that works (30 %, ±50) does 9 cm/s.
    if (r.progress > (watch.p || 0) + 0.03) { watch.p = r.progress; watch.pt = r.time; return false; }
    if (r.time - (watch.pt || 0) < STUCK || sim.still) return false;
    end('Робот алға жылжымайды: ол сызықтың жанында айналып жүр немесе сызық бойымен кері жүріп барады. Жылдамдықты азайт немесе рульді жұмсағырақ ет.');
    return true;
  };
  const lostText = (r) => `Робот ${sim.mat.closed ? 'айналымның' : 'жолдың'} ${Math.round(r.lostAt * 100)} %-ында сызықты жоғалтты. `
    + (r.top > 60 ? 'Тым жылдам: жылдамдықты азайт.' : Math.abs(r.spin) > 300 ? 'Ол орнында айналып жүр: қара түсте және ақ түсте қай жаққа бұрылатынын тексер.'
      : 'Бұрылыста руль күртірек немесе жылдамдық азырақ болуы керек.');
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
    const row = (x) => (x.time === undefined ? `<td colspan="${cols - 1}" data-mark="slip">айналымның ${Math.round(x.lost * 100)} %-ында сызықтан шықты</td>`
      : `<td data-mark="${smooth || x.time <= LAP_LIMIT ? 'ok' : 'slip'}">${comma(x.time)} с</td>`
        + (smooth ? `<td data-mark="${x.wobble <= WOBBLE_MAX ? 'ok' : 'slip'}">${x.wobble}</td>` : ''));
    t.innerHTML = `<tr><th scope="col">Жылдамдық</th><th scope="col">Айналым</th>${smooth ? '<th scope="col">Ирелеңдеу</th>' : ''}</tr>`
      + (list.length ? list.map((x) => `<tr><td>${x.speed} %</td>${row(x)}</tr>`).join('') : `<tr><td colspan="${cols}">Әзірге әрекет жоқ</td></tr>`);
  };

  const checkStop = (r) => {
    if (r.outside) return end('Робот сызықтан өтіп, алаңнан шығып кетті. «начать движение» блогынан кейін ол қара түсті күтіп, тоқтауы керек.');
    if (idle(r) || !sim.still || r.dist < 1) return;
    const x = sim.sensor.x, [x0, , x1] = sim.mat.zones.line;
    watch.done = true;
    vm.stop();
    if (x < x0 - 0.5) warn(`Робот сызыққа жетпей тоқтады: оған дейін әлі ${comma(x0 - x)} см бар. Датчик қара түсті көргенше, ол жүре беруі керек.`);
    else if (x > x1 + PAST) warn(`Робот сызықтан ${Math.round(x - x1)} см өтіп барып тоқтады. Жылдамдықты азайт: жылдам жүргенде ол тежеліп үлгермейді.`);
    else solved(1, 'Робот сызықта тоқтады: датчик қара түсті көрді де, бағдарлама моторларды өшірді.');
  };
  // Tasks 3, 4 and 5: one lap of a closed track.
  const checkLap = (r) => {
    if (r.outside) return end('Робот алаңнан шығып кетті: ол сызықты жоғалтты.');
    if (idle(r)) return;
    if (!vm.running && sim.still && !r.laps) return end('Бағдарлама бітті, бірақ айналым аяқталмады. Датчикті тексеру мен қозғалыс «повторять всегда» циклінде қайталанып тұруы керек.');
    if (r.laps) {
      watch.done = true;
      vm.stop();
      if (task === 2) return solved(2, `Айналым аяқталды: ${comma(r.lapTime)} с. Робот сызықтың шетімен жүреді: қара түсте оңға, ақ түсте солға бұрылады.`);
      if (task === 3) {
        record({ speed: r.top, time: r.lapTime });
        if (r.lapTime <= LAP_LIMIT) return solved(3, `Айналым: ${comma(r.lapTime)} с, бұл ${LAP_LIMIT} секундтан тез! Жылдам роботқа күртірек руль керек.`);
        return warn(`Айналым: ${comma(r.lapTime)} с, ал ${LAP_LIMIT} секундтан тез болуы керек. Жылдамдықты арттыр және робот ұшып шықпауы үшін рульді күртірек бұр.`);
      }
      record({ speed: r.top, time: r.lapTime, wobble: r.wobble });
      if (r.wobble <= WOBBLE_MAX) return solved(4, `Айналым: ${comma(r.lapTime)} с, ирелеңдеу: ${r.wobble}. Датчик шеттен қанша алыстаса, руль дәл соншалықты бұрылады.`);
      return warn(`Ирелеңдеу: ${r.wobble}, ал ең көбі ${WOBBLE_MAX} болуы керек. Руль мәні шағылған жарықтан есептелуі керек. Ол солай есептеліп тұрса, өрнектегі санды азайт.`);
    }
    if (r.lost) {
      if (task === 3 || task === 4) record({ speed: r.top, lost: r.lostAt });
      end(lostText(r));
    } else stuck(r);
  };
  const checkRed = (r) => {
    if (r.outside) return end(r.seen.finish ? 'Робот қызыл алаңнан өтіп, алаңнан шығып кетті. Датчик қызыл түсті көргенде, ол тоқтауы керек.' : 'Робот алаңнан шығып кетті: ол сызықты жоғалтты.');
    if (idle(r)) return;
    if (sim.still && r.dist > 1) {
      watch.done = true;
      vm.stop();
      if (sim.zone !== 'finish') return warn('Робот тоқтады, бірақ қызыл алаңда емес. Датчик қызыл түсті көргенше, ол сызық бойымен жүре беруі керек.');
      if (r.progress < PROGRESS) return warn('Робот қызыл алаңда, бірақ оған сызық бойымен келген жоқ. «Стартқа» батырмасын бас та, қайта іске қос.');
      return solved(5, 'Жүк жеткізілді: робот сызық бойымен жүріп, қызыл алаңда тоқтады.');
    }
    if (r.lost) end(r.seen.finish ? 'Робот қызыл алаңға жетті, бірақ тоқтамады. Датчик қызыл түсті көргенше цикл қайталансын, ал циклден кейін робот тоқтасын.' : lostText(r));
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
        if (probe.white === null || probe.black === null) return say('Алдымен датчикті ақ түске және қара түске қой: сандар өздігінен жазылады.', 'warn');
        $('#probe-thr').value = Math.round((probe.white + probe.black) / 2);
        RA.store.set('program.thr', $('#probe-thr').value);
        return checkProbe();
      }
      Blockly.confirm('Бағдарламаңды дайын шешіммен ауыстырасың ба? Сенің блоктарың жоғалады.', (ok) => {
        if (!ok) return;
        vm.stop();
        bl.load(program(task, 'solution'));
        say('Шешім жүктелді. Іске қосу батырмасын бас та, тексер.');
      });
    };
    $('#task-restart').onclick = () => {
      Blockly.confirm('Қайтадан бастайсың ба? Барлық тапсырманың бастапқы бағдарламасы қайтады. Белгілер, кестелер және тест нәтижесі өшеді.', (ok) => {
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
    const viewBtn = $('#view-btn'), paintView = () => { viewBtn.textContent = sim.view === 'mat' ? 'Робот артынан' : 'Бүкіл алаң'; };
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
