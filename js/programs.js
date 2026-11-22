// The task programs of the program view: RA.PROGRAMS[n] = {starter, solution}, Blockly XML, in the order of the six tasks.
(function () {
  // Placeholders: the tasks agent tunes these in the real simulator, on «Трасса 2».
  // Measured on «Трасса 2» (js/program.js has the numbers): with ±50 the lap takes 18.4 s at 50 %, the limit is 24 s, from 60 % it flies off.
  const FAST = { speed: 50, right: 50, left: -50 };     // task 4's solution: movement speed in %, steering on dark and on light
  // At 30 %: 0.5 leaves the track at the tight bend, 0.8–2 lap smoothly (k 1.2: 18.1 s, «виляние» 1), 3 hunts like a zigzag.
  const SMOOTH = { speed: 30, start: 0.5, k: 1.2 };     // task 5: its speed, the factor of the loose expression and of the solution

  const NOTES = [
    'Программа здесь не нужна: передвигай робота рукой. Поставь датчик на белое, на чёрное и на границу и смотри, сколько процентов он показывает.',
    'Сейчас робот едет вперёд и не замечает линию. Добавь блоки, чтобы он остановился на чёрной линии.',
    'Цикл и условие уже на месте. Положи в «если» и в «иначе» по блоку «начать движение», чтобы робот ехал по краю линии и прошёл круг.',
    'Эта программа проходит плавные повороты, а на крутом теряет линию. Меняй скорость и оба числа поворота, чтобы робот прошёл круг быстро.',
    'Сейчас робот едет прямо и теряет линию. Рядом лежит готовое выражение: вставь его в блок «начать движение» на место «прямо: 0» и подбери число вместо 0.5.',
    'Робот едет по линии и не останавливается. Сделай так, чтобы он остановился на красном поле.',
  ];

  const block = (type, inside = '') => `<block type="${type}">${inside}</block>`;
  // An input with its shadow; `over` is a reporter lying on top of the shadow.
  const shadow = (name, type, field, v, over = '') => `<value name="${name}"><shadow type="${type}"><field name="${field}">${v}</field></shadow>${over}</value>`;
  const num = (name, v, over) => shadow(name, 'math_number', 'NUM', v, over);
  // A round menu of js/blocks.js: its type and its field are named after the block's category and the menu.
  const menu = (name, key, v, over) => shadow(name, `flipper${key}-selector`, `field_flipper${key}-selector`, v, over);
  // Each piece is one block; chain() nests every next one into the <next> of the one before.
  const chain = (...xs) => xs.reduceRight((next, x) => (next ? x.replace(/<\/block>$/, `<next>${next}</next></block>`) : x), '');
  const mouth = (name, xs) => (xs.length ? `<statement name="${name}">${chain(...xs)}</statement>` : '');
  const cond = (c) => `<value name="CONDITION">${c}</value>`;
  const at = (x, y, xml) => xml.replace('<block', `<block x="${x}" y="${y}"`);
  const xml = (...tops) => `<xml>${tops.join('')}</xml>`;

  // A stack under the start hat. A starter carries its task as a pinned note above the hat, as wide as the workspace shows
  // at the palette's scale (0.675) when it is 500 px wide; the hat then sits where blocks.js's clean-up puts it.
  const stack = (text, ...blocks) => at(48, text ? 116 : 48, chain(block('flipperevents_whenProgramStarts',
    text && `<comment pinned="true" w="680" h="96" x="48" y="10" minimized="false">${text}</comment>`), ...blocks));
  const setup = (v) => [block('flippermove_setMovementPair', menu('PAIR', 'move_pair', 'CD')), block('flippermove_movementSpeed', num('SPEED', v))];
  const forward = block('flippermove_startMove', '<field name="DIRECTION">forward</field>');
  const steer = (v, over) => block('flippermove_startSteer', menu('STEERING', 'move_steering', v, over));
  const stop = block('flippermove_stopMove');
  const B = menu('PORT', 'sensing_multiple-port', 'B');
  const dark = block('flippersensors_isReflectivity', `${B}<field name="COMPARATOR">lt</field>${num('VALUE', 50)}`);
  const red = block('flippersensors_isColor', B + menu('VALUE', 'sensing_color', 9));
  // ((50 − (B отражённый свет)) × k): darker than 50 gives a positive number, a turn to the right.
  const error = (k) => block('operator_multiply', num('NUM1', '', block('operator_subtract',
    num('NUM1', 50) + num('NUM2', '', block('flippersensors_reflectivity', B)))) + num('NUM2', k));
  const fork = (yes, no) => block('control_if_else', cond(dark) + mouth('SUBSTACK', yes) + mouth('SUBSTACK2', no));
  const forever = (...xs) => block('control_forever', mouth('SUBSTACK', xs));
  // LEGO's reflected-light follower: right on dark, left on light, so the robot rides the right edge of the line.
  const follow = (right = 30, left = -30) => fork([steer(right)], [steer(left)]);
  const zigzag = (text, v = 30, right, left) => xml(stack(text, ...setup(v), forever(follow(right, left))));

  window.RA.PROGRAMS = [
    { starter: xml(stack(NOTES[0])), solution: xml(stack(NOTES[0])) },
    { starter: xml(stack(NOTES[1], ...setup(30), forward)),
      solution: xml(stack('', ...setup(30), forward, block('control_wait_until', cond(dark)), stop)) },
    { starter: xml(stack(NOTES[2], ...setup(30), forever(fork([], [])))), solution: zigzag('') },
    { starter: zigzag(NOTES[3]), solution: zigzag('', FAST.speed, FAST.right, FAST.left) },
    // The loose expression lies to the right of the loop, under the two wider setting blocks.
    { starter: xml(stack(NOTES[4], ...setup(SMOOTH.speed), forever(steer(0))), at(400, 330, error(SMOOTH.start))),
      solution: xml(stack('', ...setup(SMOOTH.speed), forever(steer(0, error(SMOOTH.k))))) },
    { starter: zigzag(NOTES[5]),
      solution: xml(stack('', ...setup(30), block('control_repeat_until', cond(red) + mouth('SUBSTACK', [follow()])), stop)) },
  ];
})();
