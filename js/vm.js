// Interpreter: walks the live blocks, no code generation. Each hat runs as one async thread.
// All time comes from the simulator: hw.now() in simulated seconds, hw.tick() after each physics step, hw.sleep(sec).
// A loop makes one pass per tick, so a program reads the sensor and steers at the same moments on a fast and on a slow computer.
// Names it hands to hw: motors by port in hw.motors; from hw.sensors colour codes and reflected light in %;
// buttons 'left'|'right' and 'pressed'|'released'; gestures 'shake'|'tap'|'doubletap'|'fall';
// tilt 'forward'|'backward'|'left'|'right'; sides 'front'|'back'|'top'|'bottom'|'leftside'|'rightside';
// orientation 'upright'|'left'|'right'|'upsidedown'; effects 'pitch'|'pan'. Pixel x, y are the block's 1..5.
(function () {
  const RA = window.RA;
  const STOP = {};                  // thrown to unwind a cancelled thread
  // Loops and waits follow the simulator's ticks. Only what never waits, a storm of broadcasts or of my-blocks, could hold the page:
  // after this many blocks in a row everyone rests. Counted in blocks, not in milliseconds, so a slow computer rests at the same block.
  const BURST = 1000, REST_MS = 5;
  const PAINT_MS = 40;              // the glow keeps a calm pace in real time, whatever the simulator's speed
  const MAX_CALL_DEPTH = 200;       // a my-block calling itself would eat the tab's memory within seconds
  const SENSOR = { force: 'силы', color: 'цвета', distance: 'расстояния' };
  const MOTORS = 'Моторы колёс в портах C и D, мотор шестерни в порту E.';
  const WHEELS = 'Колёса этого робота в портах C и D: поставь в начало блок «установить моторы для движения C+D».';
  const SIDE = [-1, 1];             // forward: the left motor turns counterclockwise, the right one clockwise, their rotors face apart

  const num = (v) => Number(v) || 0;
  const clamp = (v) => Math.min(100, Math.max(0, v));
  const signed = (v) => Math.min(100, Math.max(-100, v));
  const compare = (a, b) => {
    const x = Number(a), y = Number(b);
    if (a !== '' && b !== '' && !isNaN(x) && !isNaN(y)) return x - y;
    const s = String(a).toLowerCase(), u = String(b).toLowerCase();
    return s < u ? -1 : s > u ? 1 : 0;
  };
  const DEG = Math.PI / 180;
  // Degrees like everywhere else in the app; rounded so that sin 180 reads 0.
  const trig = (fn) => (x) => Math.round(fn(x * DEG) * 1e10) / 1e10;
  const MATH = { abs: Math.abs, floor: Math.floor, ceiling: Math.ceil, sqrt: Math.sqrt, sin: trig(Math.sin), cos: trig(Math.cos),
    tan: trig(Math.tan), asin: (x) => Math.asin(x) / DEG, acos: (x) => Math.acos(x) / DEG, atan: (x) => Math.atan(x) / DEG,
    ln: Math.log, log: Math.log10, 'e ^': Math.exp, '10 ^': (x) => 10 ** x };

  RA.createVM = (ws, hw, o) => {
    const threads = new Set();
    const glowing = { glowBlock: new Set(), glowStack: new Set() };
    // Motors that a «запустить мотор» or «начать движение» left turning: the program is not over while one of them runs.
    const going = new Set();
    let running = false, vars = {}, lists = {}, warned = {}, edges = {};
    let timerStart = 0, runId = 0, burst = 0, rest = null, painted = 0;
    let pair = [], speed = 50, turnCm = 17.5;      // the movement blocks' settings, set anew by start()

    const setRunning = (on) => {
      if (on === running) return;
      running = on;
      if (o && o.onState) o.onState(on);
    };
    const warn = (text) => {
      if (warned[text]) return;
      warned[text] = true;
      RA.toast(text, 'warn');
    };
    // Whole milliseconds: sums of 0.01 s steps would otherwise read 0.30000000000000004.
    const timer = () => Math.round((hw.now() - timerStart) * 1000) / 1000;

    // Inputs. Shadows carry their value in their one field.
    const field = (b, name) => b.getFieldValue(name);
    const value = (b) => {
      if (VALUES[b.type]) return VALUES[b.type](b);
      const f = b.inputList[0] && b.inputList[0].fieldRow[0];
      return f ? f.getValue() : '';
    };
    const input = (b, name) => {
      const c = b.getInputTargetBlock(name);
      return c ? value(c) : '';
    };
    const n = (b, name) => num(input(b, name));
    const list = (b) => { const id = field(b, 'LIST'); return lists[id] || (lists[id] = []); };
    const index = (b, l) => { const i = Math.floor(n(b, 'INDEX')) - 1; return i >= 0 && i < l.length ? i : -1; };

    // Devices: motors in C, D, E, the colour sensor in B. A wrong port warns once per run and the program goes on.
    const port = (b) => String(input(b, 'PORT')).toUpperCase();
    const motor = (b) => {
      const p = port(b);
      if (hw.ports[p] === 'motor') return hw.motors[p];
      warn(hw.ports[p] ? `В порту ${p} датчик ${SENSOR[hw.ports[p]]}, а не мотор. ${MOTORS}` : `В порту ${p} ничего нет. ${MOTORS}`);
      return null;
    };
    const quiet = () => {
      Object.values(hw.motors).forEach((m) => m.stop());
      going.clear();
      hw.sound.stop();
    };
    // A port without the sensor reads like the sensor seeing nothing.
    const sees = (b) => {
      const p = port(b);
      if (hw.ports[p] === 'color') return true;
      warn(`В порту ${p} нет датчика цвета. Датчик цвета подключён к порту ${Object.keys(hw.ports).find((k) => hw.ports[k] === 'color')}.`);
      return false;
    };
    const color = (b) => (sees(b) ? hw.sensors.color() : -1);
    const reflected = (b) => (sees(b) ? Math.round(hw.sensors.reflected()) : 0);
    // shortcut: this robot has no force and no distance sensor, so their blocks say so once per run and read nothing;
    // take the readings from week 11's js/vm.js when a model has one.
    const absent = (kind, reads) => () => { warn(`У этого робота нет датчика ${SENSOR[kind]}.`); return reads; };
    const image = (b) => Array.from({ length: 25 }, (_, i) => (String(input(b, 'MATRIX'))[i] === '1' ? 100 : 0));

    // Movement. The pair's first letter is the left motor. A pair that is not two motors warns once per run and the block is skipped.
    const wheels = () => {
      const miss = pair.filter((p) => hw.ports[p] !== 'motor');
      if (pair.length === 2 && !miss.length) return pair.map((p) => hw.motors[p]);
      warn((miss.length > 1 ? `В портах ${miss.join(' и ')} нет моторов. ` : miss.length ? `В порту ${miss[0]} нет мотора. ` : '') + WHEELS);
      return null;
    };
    // Signed speeds [left, right] in %: the outer wheel keeps the speed, the inner one runs at speed × (1 − |steering| / 50),
    // so at 50 it stands still and at 100 it runs backwards.
    const split = (steering, v) => {
      const s = Math.round(signed(num(steering))), inner = (v * (50 - Math.abs(s))) / 50;
      return s < 0 ? [inner, v] : [v, inner];
    };
    const way = (b) => (field(b, 'DIRECTION') === 'backward' ? -speed : speed);
    const go = (m, pct, dir) => { m.run(pct, dir); going.add(m); };
    const drive = (steering, v) => {
      const w = wheels();
      if (w) split(steering, v).forEach((pct, i) => go(w[i], Math.abs(pct), pct < 0 ? -SIDE[i] : SIDE[i]));
    };
    // The block's amount in degrees of a wheel: centimetres and inches through the distance of one rotation.
    const degrees = (unit, v) => (unit === 'degrees' ? v : unit === 'rotations' ? v * 360 : ((unit === 'inches' ? v * 2.54 : v) / turnCm) * 360);
    // The outer wheel turns the whole amount, the inner one its share; the block ends when both motors are done.
    // A negative amount drives the other way.
    const travel = async (b, t, steering, v) => {
      const w = wheels();
      if (!w || !v) return;
      const unit = field(b, 'UNIT'), amount = n(b, 'VALUE'), pct = split(steering, v);
      w.forEach((m) => going.delete(m));
      await wait(t, Promise.all(w.map((m, i) => (unit === 'seconds'
        ? m.runForSeconds(Math.abs(amount), Math.abs(pct[i]), pct[i] * amount < 0 ? -SIDE[i] : SIDE[i])
        : pct[i] ? m.runFor((SIDE[i] * degrees(unit, amount) * pct[i]) / Math.abs(v), Math.abs(pct[i])) : m.stop()))));
    };

    // Cancellation points: a killed thread unwinds from here, also out of a long motor move.
    const wait = (t, promise) => new Promise((res, rej) => {
      t.cancel = () => rej(STOP);
      Promise.resolve(promise).then(res, rej);
    });
    const breathe = async (t) => {
      if (++burst > BURST) {
        rest = rest || new Promise((res) => setTimeout(() => {
          rest = null;
          burst = 0;
          res();
        }, REST_MS));
        await rest;
      }
      if (t.dead) throw STOP;
    };

    const runStack = async (b, t) => {
      for (; b; b = b.getNextBlock()) {
        await breathe(t);
        t.current = b.id;
        if (OPS[b.type]) await OPS[b.type](b, t);
      }
    };
    const sub = (b, name) => b.getInputTargetBlock(name || 'SUBSTACK');
    // One pass per tick: the loop reads the sensors once per physics step, as a hub does, and the page rests in between.
    // b.workspace goes null when the student deletes the running loop.
    const loop = async (b, t, more) => {
      while (b.workspace && more()) {
        await runStack(sub(b), t);
        await wait(t, hw.tick());
      }
    };

    const kill = (t) => {
      t.dead = true;
      if (t.cancel) t.cancel();
      threads.delete(t);
    };
    const spawn = (hat) => {
      // A re-triggered hat restarts its stack.
      threads.forEach((t) => { if (t.hat === hat.id) kill(t); });
      const t = { hat: hat.id, current: null, dead: false, cancel: null, depth: 0 };
      threads.add(t);
      t.done = runStack(hat.getNextBlock(), t)
        .catch((e) => { if (e !== STOP) console.error(e); })
        .then(() => { threads.delete(t); if (!threads.size) idle(); });
      return t;
    };
    const hats = (type) => ws.getTopBlocks(false).filter((b) => b.type === type);
    const broadcast = (name) => hats('event_whenbroadcastreceived')
      .filter((h) => h.getField('BROADCAST_OPTION').getText() === name).map(spawn);

    const halt = () => {
      threads.forEach(kill);
      runId++;
      paint();
      quiet();
    };
    // With nothing left that could still wake a stack and no motor left running the program is over. The last picture stays on the hub.
    // shortcut: a real hub may end the program right after a last «начать движение» and stop the motors (not checked on a hub);
    // here the robot drives on until Stop, which is what the block says. Drop `going` to end with the last block.
    const idle = () => {
      const listening = ws.getTopBlocks(false).some((b) => POLLED[b.type] || b.type === 'flipperevents_whenButton');
      if (!running || listening || going.size) return;
      halt();
      setRunning(false);
    };

    const OPS = {
      flippermotor_motorTurnForDirection: async (b, t) => {
        const m = motor(b);
        if (!m) return;
        going.delete(m);
        const dir = field(b, 'DIRECTION') === 'clockwise' ? 1 : -1;
        const v = n(b, 'VALUE');
        if (field(b, 'UNIT') === 'seconds') await wait(t, m.runForSeconds(Math.abs(v), m.defaultSpeed, v < 0 ? -dir : dir));
        else await wait(t, m.runFor(dir * v * (field(b, 'UNIT') === 'rotations' ? 360 : 1), m.defaultSpeed));
      },
      flippermotor_motorGoDirectionToPosition: async (b, t) => {
        const m = motor(b);
        if (!m) return;
        going.delete(m);
        await wait(t, m.goTo(n(b, 'POSITION'), field(b, 'DIRECTION'), m.defaultSpeed));
      },
      flippermotor_motorStartDirection: (b) => {
        const m = motor(b);
        if (m) go(m, m.defaultSpeed, field(b, 'DIRECTION') === 'clockwise' ? 1 : -1);
      },
      flippermotor_motorStop: (b) => { const m = motor(b); if (m) { m.stop(); going.delete(m); } },
      flippermotor_motorSetSpeed: (b) => { const m = motor(b); if (m) m.defaultSpeed = n(b, 'SPEED'); },

      flippermove_setMovementPair: (b) => { pair = String(input(b, 'PAIR')).toUpperCase().match(/[A-F]/g) || []; },
      flippermove_movementSpeed: (b) => { speed = signed(n(b, 'SPEED')); },
      flippermove_setDistance: (b) => { turnCm = Math.abs(n(b, 'DISTANCE') * (field(b, 'UNIT') === 'inches' ? 2.54 : 1)) || 17.5; },
      flippermove_startMove: (b) => drive(0, way(b)),
      flippermove_startSteer: (b) => drive(input(b, 'STEERING'), speed),
      flippermove_stopMove: () => { (wheels() || []).forEach((m) => { m.stop(); going.delete(m); }); },
      flippermove_move: (b, t) => travel(b, t, 0, way(b)),
      flippermove_steer: (b, t) => travel(b, t, input(b, 'STEERING'), speed),

      flipperlight_lightDisplayImageOnForTime: async (b, t) => {
        hw.display.setImage(image(b));
        await wait(t, hw.sleep(n(b, 'VALUE')));
        hw.display.clear();
      },
      flipperlight_lightDisplayImageOn: (b) => hw.display.setImage(image(b)),
      flipperlight_lightDisplayText: (b, t) => wait(t, hw.display.scroll(String(input(b, 'TEXT')))),
      flipperlight_lightDisplayOff: () => hw.display.clear(),
      flipperlight_lightDisplaySetBrightness: (b) => hw.display.setBrightness(n(b, 'BRIGHTNESS')),
      flipperlight_lightDisplaySetPixel: (b) => hw.display.setPixel(n(b, 'X'), n(b, 'Y'), n(b, 'BRIGHTNESS')),
      flipperlight_lightDisplayRotate: (b) => hw.display.rotate(field(b, 'DIRECTION') === 'clockwise' ? 1 : -1),
      flipperlight_lightDisplaySetOrientation: (b) => hw.display.setOrientation(input(b, 'ORIENTATION')),
      flipperlight_centerButtonLight: (b) => hw.centerLight(input(b, 'COLOR')),
      flipperlight_ultrasonicLightUp: absent('distance'),

      flippersound_playSoundUntilDone: (b, t) => wait(t, hw.sound.play(input(b, 'SOUND'), true)),
      flippersound_playSound: (b) => { hw.sound.play(input(b, 'SOUND'), false); },
      flippersound_beepForTime: (b, t) => wait(t, hw.sound.beep(n(b, 'NOTE'), n(b, 'DURATION'))),
      flippersound_beep: (b) => hw.sound.beepStart(n(b, 'NOTE')),
      flippersound_stopSound: () => hw.sound.stop(),
      sound_changeeffectby: (b) => hw.sound.changeEffect(field(b, 'EFFECT').toLowerCase(), n(b, 'VALUE')),
      sound_seteffectto: (b) => hw.sound.setEffect(field(b, 'EFFECT').toLowerCase(), n(b, 'VALUE')),
      sound_cleareffects: () => hw.sound.clearEffects(),
      sound_changevolumeby: (b) => { hw.sound.volume = clamp(hw.sound.volume + n(b, 'VOLUME')); },
      sound_setvolumeto: (b) => { hw.sound.volume = clamp(n(b, 'VOLUME')); },

      event_broadcast: (b) => { broadcast(input(b, 'BROADCAST_INPUT')); },
      event_broadcastandwait: (b, t) => wait(t, Promise.all(broadcast(input(b, 'BROADCAST_INPUT')).map((x) => x.done))),

      control_wait: (b, t) => wait(t, hw.sleep(n(b, 'DURATION'))),
      control_repeat: (b, t) => { let i = Math.round(n(b, 'TIMES')); return loop(b, t, () => i-- > 0); },
      control_forever: (b, t) => loop(b, t, () => true),
      control_repeat_until: (b, t) => loop(b, t, () => !input(b, 'CONDITION')),
      control_if: (b, t) => (input(b, 'CONDITION') ? runStack(sub(b), t) : null),
      control_if_else: (b, t) => runStack(sub(b, input(b, 'CONDITION') ? 'SUBSTACK' : 'SUBSTACK2'), t),
      // Tests once per tick, like the loops.
      control_wait_until: async (b, t) => { while (b.workspace && !input(b, 'CONDITION')) await wait(t, hw.tick()); },
      flippercontrol_stopOtherStacks: (b, t) => { threads.forEach((x) => { if (x !== t) kill(x); }); },
      flippercontrol_stop: (b, t) => {
        const what = field(b, 'STOP_OPTION');
        if (what === 'exit') vm.stop();
        else if (what === 'all') { threads.forEach(kill); quiet(); }
        throw STOP;
      },

      flippersensors_resetYaw: () => hw.sensors.resetYaw(),
      flippersensors_resetTimer: () => { timerStart = hw.now(); },

      data_setvariableto: (b) => { vars[field(b, 'VARIABLE')] = input(b, 'VALUE'); },
      data_changevariableby: (b) => { const id = field(b, 'VARIABLE'); vars[id] = num(vars[id]) + n(b, 'VALUE'); },
      data_addtolist: (b) => { list(b).push(input(b, 'ITEM')); },
      data_deleteoflist: (b) => { const l = list(b), i = index(b, l); if (i >= 0) l.splice(i, 1); },
      data_deletealloflist: (b) => { list(b).length = 0; },
      data_insertatlist: (b) => { const l = list(b); l.splice(Math.max(0, n(b, 'INDEX') - 1), 0, input(b, 'ITEM')); },
      data_replaceitemoflist: (b) => { const l = list(b), i = index(b, l); if (i >= 0) l[i] = input(b, 'ITEM'); },

      procedures_call: async (b, t) => {
        const def = Blockly.Procedures.getDefineBlock(b.getProcCode(), ws);
        if (!def) return;
        if (t.depth >= MAX_CALL_DEPTH) {
          warn('Мой блок вызывает сам себя слишком много раз: подпрограмма остановлена.');
          throw STOP;
        }
        t.depth++;
        await runStack(def.getNextBlock(), t);
        t.depth--;
      },
    };

    const VALUES = {
      operator_add: (b) => n(b, 'NUM1') + n(b, 'NUM2'),
      operator_subtract: (b) => n(b, 'NUM1') - n(b, 'NUM2'),
      operator_multiply: (b) => n(b, 'NUM1') * n(b, 'NUM2'),
      operator_divide: (b) => n(b, 'NUM1') / n(b, 'NUM2'),
      operator_mod: (b) => { const a = n(b, 'NUM1'), m = n(b, 'NUM2'); return ((a % m) + m) % m; },
      operator_round: (b) => Math.round(n(b, 'NUM')),
      operator_mathop: (b) => MATH[field(b, 'OPERATOR')](n(b, 'NUM')),
      operator_random: (b) => {
        const lo = Math.min(n(b, 'FROM'), n(b, 'TO')), hi = Math.max(n(b, 'FROM'), n(b, 'TO'));
        const whole = Number.isInteger(lo) && Number.isInteger(hi);
        return whole ? lo + Math.floor(Math.random() * (hi - lo + 1)) : lo + Math.random() * (hi - lo);
      },
      operator_lt: (b) => compare(input(b, 'OPERAND1'), input(b, 'OPERAND2')) < 0,
      operator_equals: (b) => compare(input(b, 'OPERAND1'), input(b, 'OPERAND2')) === 0,
      operator_gt: (b) => compare(input(b, 'OPERAND1'), input(b, 'OPERAND2')) > 0,
      operator_and: (b) => !!input(b, 'OPERAND1') && !!input(b, 'OPERAND2'),
      operator_or: (b) => !!input(b, 'OPERAND1') || !!input(b, 'OPERAND2'),
      operator_not: (b) => !input(b, 'OPERAND'),
      flipperoperator_isInBetween: (b) => n(b, 'VALUE') >= n(b, 'LOW') && n(b, 'VALUE') <= n(b, 'HIGH'),
      operator_join: (b) => String(input(b, 'STRING1')) + input(b, 'STRING2'),
      operator_letter_of: (b) => String(input(b, 'STRING')).charAt(n(b, 'LETTER') - 1),
      operator_length: (b) => String(input(b, 'STRING')).length,
      operator_contains: (b) => String(input(b, 'STRING1')).toLowerCase().includes(String(input(b, 'STRING2')).toLowerCase()),

      data_variable: (b) => { const v = vars[field(b, 'VARIABLE')]; return v === undefined ? 0 : v; },
      data_listcontents: (b) => list(b).join(' '),
      data_itemoflist: (b) => { const l = list(b), i = index(b, l); return i < 0 ? '' : l[i]; },
      data_itemnumoflist: (b) => list(b).findIndex((x) => compare(x, input(b, 'ITEM')) === 0) + 1,
      data_lengthoflist: (b) => list(b).length,
      data_listcontainsitem: (b) => list(b).some((x) => compare(x, input(b, 'ITEM')) === 0),

      sound_volume: () => hw.sound.volume,
      event_broadcast_menu: (b) => b.getField('BROADCAST_OPTION').getText(),

      flippermotor_absolutePosition: (b) => { const m = motor(b); return m ? m.position : 0; },
      flippermotor_speed: (b) => { const m = motor(b); return m ? m.speedPct : 0; },

      flippersensors_color: color,
      flippersensors_isColor: (b) => color(b) === Number(input(b, 'VALUE')),
      flippersensors_reflectivity: reflected,
      flippersensors_isReflectivity: (b) => {
        const r = reflected(b), v = n(b, 'VALUE'), op = field(b, 'COMPARATOR');
        return op === 'lt' ? r < v : op === 'gt' ? r > v : r === v;
      },
      flippersensors_force: absent('force', 0),
      flippersensors_isPressed: absent('force', false),
      flippersensors_distance: absent('distance', 0),
      flippersensors_isDistance: absent('distance', false),
      flippersensors_isTilted: (b) => !!hw.sensors.tilted(input(b, 'VALUE')),
      flippersensors_isorientation: (b) => !!hw.sensors.orientationUp(field(b, 'VALUE')),
      flippersensors_ismotion: (b) => !!hw.sensors.gesture(field(b, 'EVENT')),
      flippersensors_orientationAxis: (b) => hw.sensors.angle(field(b, 'AXIS')),
      flippersensors_buttonIsPressed: (b) => hw.sensors.button(field(b, 'BUTTON')) === (field(b, 'EVENT') === 'pressed'),
      flippersensors_timer: timer,
    };

    // Hats nothing announces: they fire on the rising edge of these tests.
    const POLLED = {
      flipperevents_whenTimer: (h) => timer() > n(h, 'VALUE'),
      flipperevents_whenCondition: (h) => !!input(h, 'CONDITION'),
      flipperevents_whenTilted: (h) => hw.sensors.tilted(input(h, 'VALUE')),
      flipperevents_whenOrientation: (h) => hw.sensors.orientationUp(field(h, 'VALUE')),
      flipperevents_whenGesture: (h) => hw.sensors.gesture(field(h, 'EVENT')),
      flipperevents_whenColor: (h) => color(h) === Number(input(h, 'OPTION')),
      flipperevents_whenPressed: absent('force', false),
      flipperevents_whenDistance: absent('distance', false),
    };

    // Glow follows the threads at a calm pace; a tight loop would otherwise repaint the blocks all the time.
    const sync = (fn, want) => {
      const now = glowing[fn];
      now.forEach((id) => {
        if (want.has(id)) return;
        now.delete(id);
        if (ws.getBlockById(id)) ws[fn](id, false);
      });
      want.forEach((id) => {
        if (now.has(id) || !ws.getBlockById(id)) return;
        now.add(id);
        ws[fn](id, true);
      });
    };
    const paint = () => {
      painted = performance.now();
      const blocks = new Set(), stacks = new Set();
      threads.forEach((t) => {
        const b = t.current && ws.getBlockById(t.current);
        stacks.add(b ? b.getRootBlock().id : t.hat);
        if (b) blocks.add(b.id);
      });
      sync('glowBlock', blocks);
      sync('glowStack', stacks);
    };
    const poll = () => {
      ws.getTopBlocks(false).forEach((h) => {
        if (!POLLED[h.type]) return;
        const on = !!POLLED[h.type](h);
        if (on && !edges[h.id]) spawn(h);
        edges[h.id] = on;
      });
      if (performance.now() - painted >= PAINT_MS) paint();
    };
    // The polled hats are tested once per tick, before the threads take their turn; this loop ends with its run.
    const watch = async (run) => {
      for (; run === runId; await hw.tick()) {
        burst = 0;
        poll();
      }
    };

    const vm = {
      get running() { return running; },
      start() {
        vm.stop();
        vars = {}; lists = {}; warned = {}; edges = {};
        pair = ['A', 'B']; speed = 50; turnCm = 17.5;      // the app's defaults: nothing drives until the program says C+D
        timerStart = hw.now();
        Object.values(hw.motors).forEach((m) => { m.defaultSpeed = 75; });
        // This hat waits for a change: the colour under the sensor at the start must not fire it.
        hats('flipperevents_whenColor').forEach((h) => { edges[h.id] = !!POLLED[h.type](h); });
        setRunning(true);
        hats('flipperevents_whenProgramStarts').forEach(spawn);
        watch(runId);
        if (!threads.size) idle();
        if (!running) RA.toast('Нет блока «когда запускается подпрограмма»: программе не с чего начать.');
      },
      stop() {
        halt();
        hw.reset();
        setRunning(false);
      },
      dispatch(e) {
        if (!running) return;
        if (e.type === 'button') {
          hats('flipperevents_whenButton').filter((h) => field(h, 'BUTTON') === e.side && field(h, 'EVENT') === e.state).forEach(spawn);
        } else if (e.type === 'gesture') {
          // Remember the edge: the poll may still see this gesture afterwards.
          hats('flipperevents_whenGesture').filter((h) => field(h, 'EVENT') === e.name).forEach((h) => { edges[h.id] = true; spawn(h); });
        }
      },
    };
    return vm;
  };
})();
