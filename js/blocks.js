// Block language: the SPIKE Prime palette on top of scratch-blocks. One table row per block, see CATS.
(function () {
  const RA = window.RA;
  // Blockly's icons sit next to this script, so the Kazakh copy in kk/ finds them too.
  const MEDIA = new URL('../vendor/media/', document.currentScript.src).href;

  // Russian strings first, SPIKE's exact wording on top. Built-in blocks read these in their init().
  Object.assign(Blockly.Msg, Blockly.ScratchMsgsRu, {
    CONTROL_WAIT: 'ждать %1 секунд', CONTROL_REPEAT: 'повторить %1 раз', CONTROL_FOREVER: 'повторять всегда',
    CONTROL_IF: 'если %1 , то', CONTROL_ELSE: 'иначе', CONTROL_WAITUNTIL: 'ждать до %1',
    CONTROL_REPEATUNTIL: 'повторять пока не %1', OPERATORS_RANDOM: 'выдать случайное от %1 до %2',
    OPERATORS_JOIN: 'объединить %1 %2', OPERATORS_LETTEROF: 'буква %1 в %2', OPERATORS_LENGTH: 'длина %1',
    OPERATORS_CONTAINS: '%1 содержит %2 ?', OPERATORS_ROUND: 'округлить %1', OPERATORS_AND: '%1 и %2',
    OPERATORS_OR: '%1 или %2', OPERATORS_NOT: 'не %1', NEW_VARIABLE: 'Создать переменную',
    NEW_LIST: 'Создать список', NEW_PROCEDURE: 'Создать блок', SOUND_EFFECTS_PAN: 'звучание слева/справа',
    SOUND_SETVOLUMETO: 'установить громкость %1 %', DELETE_X_BLOCKS: 'Удалить блоки: %1', DELETE_ALL_BLOCKS: 'Удалить все блоки (%1)?', CLEAN_UP: 'Упорядочить блоки',
  });

  // fill, secondary, stroke per category.
  const COL = {
    motor: ['#0090F5', '#0078CC', '#0062A6'], move: ['#FF4CCD', '#C80090', '#B2248A'],
    light: ['#9B6AF6', '#691FF0', '#571CC1'], sounds: ['#C061F1', '#8A40AF', '#642E7F'],
    events: ['#F5C402', '#C8A300', '#B09400'], control: ['#FFB515', '#ECA100', '#C98A01'],
    sensing: ['#34CCF1', '#00A8C9', '#368FA9'], operators: ['#00B94D', '#00963E', '#006A2A'],
    data: ['#FF8F24', '#FF7D00', '#C76000'], more: ['#FF5D64', '#FF000C', '#C7222A'],
  };

  const svg = (w, h, body) => 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);
  const dots = (c, r, list) => list.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');
  const HUB_GRID = [0, 1, 2, 3].flatMap((i) => [0, 1, 2, 3].map((j) => [16.2 + j * 5.2, 8.4 + i * 5.2]));

  // Block icons, white shapes in a 48x48 box, outlined with the block's secondary colour.
  const ICONS = {
    motor: (c) => `<circle cx="24" cy="24" r="21" fill="#fff" stroke="${c}" stroke-width="1.5"/>`
      + dots(c, 5.7, [[24, 12], [24, 36], [12, 24], [36, 24]])
      + `<path d="M24 20v8M20 24h8" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,
    // Two wheels, the second one looks out from behind the first.
    move: (c) => `<circle cx="27.5" cy="27.5" r="17.5" fill="#fff" stroke="${c}" stroke-width="1.5"/>`
      + `<circle cx="21" cy="21" r="17.5" fill="#fff" stroke="${c}" stroke-width="1.5"/>`
      + dots(c, 4.5, [[21, 11.2], [21, 30.8], [11.2, 21], [30.8, 21]])
      + `<path d="M21 18v6M18 21h6" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`,
    hub: (c) => `<rect x="10" y="2" width="28" height="44" rx="4" fill="#fff" stroke="${c}" stroke-width="1.5"/>`
      + dots(c, 1.9, HUB_GRID) + `<circle cx="24" cy="38.5" r="3" fill="none" stroke="${c}" stroke-width="1.8"/>`,
    colour: (c) => `<rect x="6" y="6" width="36" height="36" rx="5" fill="#fff" stroke="${c}" stroke-width="1.5"/>`
      + `<circle cx="24" cy="24" r="13.5" fill="none" stroke="${c}" stroke-width="2"/>` + dots(c, 9.5, [[24, 24]]),
    force: (c) => `<path d="M9 18H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4M39 18h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4" fill="#fff" stroke="${c}" stroke-width="1.5"/>`
      + `<rect x="9" y="10" width="30" height="28" rx="5" fill="#fff" stroke="${c}" stroke-width="1.5"/>` + dots(c, 9, [[24, 24]])
      + '<path d="M24 19.5v9M19.5 24h9" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
    distance: (c) => `<rect x="2" y="11" width="44" height="26" rx="6" fill="#fff" stroke="${c}" stroke-width="1.5"/>`
      + `<circle cx="14" cy="24" r="7" fill="none" stroke="${c}" stroke-width="3"/><circle cx="34" cy="24" r="7" fill="none" stroke="${c}" stroke-width="3"/>`
      + `<path d="M21 24h6" stroke="${c}" stroke-width="3"/>`,
    play: () => '<path d="M17 13 35 24 17 35z" fill="#fff" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/>',
  };

  // Pictures for the direction pickers, 24x24: white lines with the thin dark edge the app draws around them.
  const pic = (body, alt, value) => [{ alt, src: svg(24, 24, body) }, value];
  const line = (d, turn) => [['#000', 4.6, 0.4], ['#fff', 2.6, 1]].map(([c, w, a]) =>
    `<path d="${d}" transform="${turn}" fill="none" stroke="${c}" stroke-opacity="${a}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const drive = (deg, alt, value) => pic(line('M12 20.5V4M5.5 10.5 12 4l6.5 6.5', `rotate(${deg} 12 12)`), alt, value);
  const ROT = 'M7.3 19.7A8 8 0 0 1 17 7.1M13 4.4h6.6V11';
  const CW = pic(line(ROT, ''), 'по часовой', 'clockwise'), CCW = pic(line(ROT, 'matrix(-1 0 0 1 24 0)'), 'против часовой', 'counterclockwise');
  // The hub's tilt keeps the app's solid arrow.
  const tilt = (deg, alt, value) => pic(`<path d="M12 3.5 19.5 12H15v8.5H9V12H4.5z" transform="rotate(${deg} 12 12)" fill="#fff" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>`, alt, value);

  // A colour for the round pill and the grid of circles. The centre light stores CSS colours, the VM hands them to hw.centerLight
  // as they are. The colour sensor stores SPIKE's codes.
  const swatch = (alt, fill, value = fill, slash = false) => [{ alt, fill, slash }, value];
  const SLASH = '<path d="M5 19 19 5" stroke="#C20012" stroke-width="2.5" stroke-linecap="round"/>';
  // On these pills the white arrow would be lost.
  const PALE = ['#FFFFFF', '#FFE360', '#FFE100'];

  const list = (s) => s.split('|').map((o) => { const i = o.lastIndexOf('='); return [o.slice(0, i), o.slice(i + 1)]; });
  // The first letter is the left motor, the second the right one.
  const pairs = [];
  [...'ABCDEF'].forEach((a) => [...'ABCDEF'].forEach((b) => { if (a !== b) pairs.push([a + '+' + b, a + b]); }));

  // Options in the app's order. A block's default is not always the first one: the row says it with «=value».
  const MENUS = {
    'multiple-port': [...'ABCDEF'].map((p) => [p, p]),
    rotation: [CCW, CW],
    turn: list('обороты=rotations|градусы=degrees|с=seconds'),
    path: list('самым коротким путём=shortest|по часовой стрелке=clockwise|против часовой стрелки=counterclockwise'),
    drive: [drive(0, 'вперёд', 'forward'), drive(180, 'назад', 'backward')],
    travel: list('обороты=rotations|градусы=degrees|с=seconds|см=cm|дюймы=inches'),
    length: list('см=cm|дюймы=inches'),
    pair: pairs,
    orientation: list('вертикально=upright|влево=left|вправо=right|«вверх ногами»=upsidedown'),
    colour: [swatch('красный', '#FF0000'), swatch('оранжевый', '#FF8A00'), swatch('жёлтый', '#FFE100'), swatch('зелёный', '#00C040'),
      swatch('голубой', '#25C7F7'), swatch('синий', '#0050FF'), swatch('фиолетовый', '#A030FF'), swatch('белый', '#FFFFFF'), swatch('чёрный', '#000000')],
    color: [swatch('фиолетовый', '#E700A7', '1'), swatch('синий', '#0090F5', '3'), swatch('голубой', '#77E8FF', '4'),
      swatch('зелёный', '#00A845', '5'), swatch('жёлтый', '#FFE360', '7'), swatch('красный', '#FF000C', '9'),
      swatch('белый', '#FFFFFF', '10'), swatch('чёрный', '#000000', '0'), swatch('нет цвета', '#FFFFFF', '-1', true)],
    // The four lights as [upper left, upper right, lower left, lower right] seen from the front: «● ○» lights the left eye.
    eyes: list('○ ○=0 0 0 0|● ○=100 0 100 0|○ ●=0 100 0 100|● ●=100 100 100 100'),
    sound: list('Cat Meow 1=Cat Meow 1|Dog Bark 1=Dog Bark 1|Laser=Laser|Hello=Hello|Applause=Applause'),
    force: list('нажата=pressed|нажата с усилием=hardpressed|отпущена=released|давление изменилось=changed'),
    pressed: list('нажата=pressed|нажата с усилием=hardpressed|отпущена=released'),
    near: list('ближе=closer|дальше=farther|точно в=exactly'),
    distance: list('%=percent|см=cm|дюймы=inches'),
    tilt: [tilt(0, 'вперёд', 'forward'), tilt(180, 'назад', 'backward'), tilt(270, 'влево', 'left'), tilt(90, 'вправо', 'right')],
    side: list('передняя часть=front|задняя часть=back|верхняя часть=top|нижняя часть=bottom|правая сторона=rightside|левая сторона=leftside'),
    gesture: list('встряхивание=shake|касание=tap|падение=fall'),
    button: list('влево=left|вправо=right'),
    press: list('нажата=pressed|отпущена=released'),
    stop: list('все=all|эту подпрограмму=this|и выйти из программы=exit'),
    compare: list('<=lt|==eq|>=gt'),
    newton: list('newton=newton|%=percent'),
    axis: list('тангаж=pitch|крен=roll|рысканье=yaw'),
  };

  const SMILE = '0101001010000001000101110';
  const FIELD_OF = { math_number: 'NUM', math_positive_number: 'NUM', math_whole_number: 'NUM', text: 'TEXT', note: 'NOTE', matrix: 'MATRIX' };

  // Which field edits a menu: the hub picture for ports, the dial for steering, buttons for pictures and colours, a list for words.
  const PICKER = { 'multiple-port': 'field_port', pair: 'field_pair', steering: 'field_steering' };
  const fieldType = (key) => PICKER[key] || (typeof MENUS[key][0][0] === 'object' ? 'field_icons' : 'field_list');

  // Round "menu" shadows: same options, one type per category because the pill takes the category's colour.
  // The steering pill is white like a number: it is typed into.
  const menuType = (cat, key) => {
    const type = `flipper${cat}_${key}-selector`;
    const c = key === 'steering' ? ['', '#FFFFFF', '#FFFFFF'] : COL[cat];
    Blockly.Blocks[type] = Blockly.Blocks[type] || {
      init() {
        this.jsonInit({ message0: '%1', args0: [{ type: fieldType(key), name: 'field_' + type, options: MENUS[key] }], category: cat,
          colour: c[1], colourSecondary: c[1], colourTertiary: c[2], colourQuaternary: c[2], extensions: ['output_string'] });
      },
    };
    return type;
  };

  // Template to Blockly JSON plus the shadows for the toolbox: (NAME:1) number, (NAME:'a') text, (NAME@type:v) any shadow,
  // [NAME:menu=default] round menu, {NAME:menu=default} rectangular dropdown, <NAME> boolean slot.
  function parse(tpl, cat, first) {
    const args = [];
    let xml = '';
    const message = tpl.split(/(\([^)]*\)|\{[^}]*\}|\[[^\]]*\]|<[^<>]+>)/).map((part, i) => {
      if (i % 2 === 0) return part.replace(/%/g, '%%');
      const body = part.slice(1, -1);
      if (part[0] === '{') {
        const [name, key, value] = body.split(/[:=]/);
        args.push({ type: fieldType(key), name, options: MENUS[key], value });
      } else if (part[0] === '<') {
        args.push({ type: 'input_value', name: body, check: 'Boolean' });
      } else if (part[0] === '[') {
        const [, name, key, value] = /^(\w+):([\w-]+)(?:=(.*))?$/.exec(body);
        const type = menuType(cat, key);
        args.push({ type: 'input_value', name });
        xml += `<value name="${name}"><shadow type="${type}">${value ? `<field name="field_${type}">${value}</field>` : ''}</shadow></value>`;
      } else {
        const [, name, kind, raw = ''] = /^(\w+)(?:@(\w+))?(?::(.*))?$/.exec(body);
        const quoted = raw[0] === "'";
        const type = kind || (quoted ? 'text' : 'math_number');
        const field = FIELD_OF[type] ? `<field name="${FIELD_OF[type]}">${quoted ? raw.slice(1, -1) : raw}</field>` : '';
        args.push({ type: 'input_value', name });
        xml += `<value name="${name}"><shadow type="${type}">${field}</shadow></value>`;
      }
      return '%' + (first + args.length);
    }).join('');
    return { message, args, xml };
  }

  const SHAPE = { stack: 'shape_statement', hat: 'shape_hat', cap: 'shape_end', round: 'output_number', bool: 'output_boolean' };

  // Registers a block unless scratch-blocks already has it, and returns its toolbox XML.
  function block([type, tpl, shape = 'stack', icon], cat) {
    const c = COL[cat];
    const head = icon ? [{ type: 'field_image', src: svg(48, 48, ICONS[icon](c[1])), width: 40, height: 40, alt: '' }, { type: 'field_vertical_separator' }] : [];
    const { message, args, xml } = parse(tpl, cat, head.length);
    Blockly.Blocks[type] = Blockly.Blocks[type] || {
      init() {
        this.jsonInit({ message0: (icon ? '%1 %2 ' : '') + message, args0: head.concat(args), category: cat,
          colour: c[0], colourSecondary: c[1], colourTertiary: c[2], colourQuaternary: c[2],
          extensions: [SHAPE[shape]].concat(icon ? ['scratch_extension'] : []) });
      },
    };
    return `<block type="${type}">${xml}</block>`;
  }

  // Rows: [type, template, shape, icon]. A number is the gap to the next row. Toolbox order is the SPIKE order.
  // Ports as the app shows them with this robot's hub plugged in: motors start on C, the colour sensor is on B. The sensors
  // this robot does not have stay on A, and so does the pair: «A+B» until the program sets «C+D».
  const m = (type, tpl, shape) => [type, '[PORT:multiple-port=C] ' + tpl, shape, 'motor'];
  const h = (type, tpl, shape) => [type, tpl, shape, 'hub'];
  const eye = (type, tpl, shape) => [type, '[PORT:multiple-port=B] ' + tpl, shape, 'colour'];
  const CATS = [
    ['motor', 'Моторы', 'motor', [
      m('flippermotor_motorTurnForDirection', 'запустить {DIRECTION:rotation=clockwise} на (VALUE:1) {UNIT:turn}'),
      m('flippermotor_motorGoDirectionToPosition', 'перейти {DIRECTION:path} в положение (POSITION:0)'),
      m('flippermotor_motorStartDirection', 'запустить мотор {DIRECTION:rotation=clockwise}'),
      m('flippermotor_motorStop', 'остановить мотор'), 36,
      m('flippermotor_motorSetSpeed', 'задать скорость (SPEED:75) %'), 36,
      m('flippermotor_absolutePosition', 'положение', 'round'),
      m('flippermotor_speed', 'скорость', 'round'),
    ]],
    ['move', 'Движение', 'move', [
      ['flippermove_move', 'переместить {DIRECTION:drive} на (VALUE:10) {UNIT:travel}', 'stack', 'move'],
      ['flippermove_startMove', 'начать движение {DIRECTION:drive}', 'stack', 'move'],
      ['flippermove_steer', 'переместить [STEERING:steering=30] на (VALUE:10) {UNIT:turn}', 'stack', 'move'],
      ['flippermove_startSteer', 'начать движение [STEERING:steering=30]', 'stack', 'move'],
      ['flippermove_stopMove', 'остановить движение', 'stack', 'move'], 36,
      ['flippermove_movementSpeed', 'установить скорость движения (SPEED:50) %', 'stack', 'move'],
      ['flippermove_setMovementPair', 'установить моторы для движения [PAIR:pair]', 'stack', 'move'],
      ['flippermove_setDistance', 'установить поворот одного мотора на (DISTANCE:17.5) {UNIT:length}', 'stack', 'move'],
    ]],
    ['light', 'Подсветка', 'light', [
      h('flipperlight_lightDisplayImageOnForTime', `включить (MATRIX@matrix:${SMILE}) на (VALUE:2) с`),
      h('flipperlight_lightDisplayImageOn', `включить (MATRIX@matrix:${SMILE})`),
      h('flipperlight_lightDisplayText', "записать (TEXT:'Hello')"),
      h('flipperlight_lightDisplayOff', 'отключить пиксели'),
      h('flipperlight_lightDisplaySetBrightness', 'яркость пикселей на уровне (BRIGHTNESS:75) %'),
      h('flipperlight_lightDisplaySetPixel', 'задать пиксели для (X:1) , (Y:1) до (BRIGHTNESS:100) %'),
      h('flipperlight_lightDisplayRotate', 'вращать {DIRECTION:rotation=clockwise}'),
      h('flipperlight_lightDisplaySetOrientation', 'настроить ориентацию [ORIENTATION:orientation]'), 36,
      h('flipperlight_centerButtonLight', 'установить [COLOR:colour] для подсветки центральной кнопки'),
      ['flipperlight_ultrasonicLightUp', '[PORT:multiple-port] подсветка включена [VALUE:eyes=100 100 100 100]', 'stack', 'distance'],
    ]],
    ['sounds', 'Звук', 'sounds', [
      ['flippersound_playSoundUntilDone', 'воспроизводить звук [SOUND:sound] до завершения'],
      ['flippersound_playSound', 'включить звук [SOUND:sound]'],
      h('flippersound_beepForTime', 'включить звуковой сигнал (NOTE@note:60) на (DURATION:0.2) с'),
      h('flippersound_beep', 'включить звуковой сигнал (NOTE@note:60)'),
      ['flippersound_stopSound', 'остановить воспроизведение всех звуков'], 36,
      ['sound_changeeffectby', '(VALUE:10)'], ['sound_seteffectto', '(VALUE:100)'], ['sound_cleareffects', ''], 36,
      ['sound_changevolumeby', '(VOLUME:-10)'], ['sound_setvolumeto', '(VOLUME:100)'], ['sound_volume', ''],
    ]],
    ['events', 'События', 'events', [
      ['flipperevents_whenProgramStarts', 'когда запускается подпрограмма', 'hat', 'play'], 36,
      eye('flipperevents_whenColor', 'когда цвет [OPTION:color=9]', 'hat'),
      ['flipperevents_whenPressed', '[PORT:multiple-port] когда {OPTION:force}', 'hat', 'force'],
      ['flipperevents_whenDistance', '[PORT:multiple-port] когда {COMPARATOR:near} (VALUE:8) {UNIT:distance}', 'hat', 'distance'], 36,
      h('flipperevents_whenTilted', 'при наклоне [VALUE:tilt]', 'hat'),
      h('flipperevents_whenOrientation', 'когда {VALUE:side} выше', 'hat'),
      h('flipperevents_whenGesture', 'когда {EVENT:gesture}', 'hat'),
      h('flipperevents_whenButton', 'когда кнопка {BUTTON:button} нажата, {EVENT:press}', 'hat'), 36,
      ['flipperevents_whenTimer', 'когда таймер > (VALUE:10)', 'hat'], 36,
      ['flipperevents_whenCondition', 'когда <CONDITION>', 'hat'], 36,
      ['event_whenbroadcastreceived', ''],
      ['event_broadcast', '(BROADCAST_INPUT@event_broadcast_menu)'],
      ['event_broadcastandwait', '(BROADCAST_INPUT@event_broadcast_menu)'],
    ]],
    ['control', 'Управление', 'control', [
      ['control_wait', '(DURATION@math_positive_number:1)'],
      ['control_repeat', '(TIMES@math_whole_number:10)'], ['control_forever', ''], 36,
      ['control_if', ''], ['control_if_else', ''], ['control_wait_until', ''], ['control_repeat_until', ''], 36,
      ['flippercontrol_stopOtherStacks', 'остановить другие подпрограммы'],
      ['flippercontrol_stop', 'остановить {STOP_OPTION:stop}', 'cap'],
    ]],
    ['sensing', 'Датчики', 'sensing', [
      eye('flippersensors_isColor', 'цвет [VALUE:color=9] ?', 'bool'),
      eye('flippersensors_color', 'цвет', 'round'),
      eye('flippersensors_isReflectivity', 'отражённый свет {COMPARATOR:compare} (VALUE:50) %?', 'bool'),
      eye('flippersensors_reflectivity', 'отражённый свет', 'round'), 36,
      ['flippersensors_isPressed', '[PORT:multiple-port] — {OPTION:pressed} ?', 'bool', 'force'],
      ['flippersensors_force', '[PORT:multiple-port] давление в {UNIT:newton=percent}', 'round', 'force'], 36,
      ['flippersensors_isDistance', '[PORT:multiple-port] — {COMPARATOR:near} (VALUE:15) {UNIT:distance} ?', 'bool', 'distance'],
      ['flippersensors_distance', '[PORT:multiple-port] расстояние в {UNIT:distance}', 'round', 'distance'], 36,
      h('flippersensors_isTilted', 'Хаб наклонен [VALUE:tilt] ?', 'bool'),
      h('flippersensors_isorientation', '{VALUE:side} вверх?', 'bool'),
      h('flippersensors_ismotion', '{EVENT:gesture} ?', 'bool'),
      h('flippersensors_orientationAxis', '{AXIS:axis} угол', 'round'),
      h('flippersensors_resetYaw', 'установить угол рыскания Хаба на 0'), 36,
      h('flippersensors_buttonIsPressed', 'кнопка {BUTTON:button} {EVENT:press} ?', 'bool'), 36,
      ['flippersensors_timer', 'таймер', 'round'], ['flippersensors_resetTimer', 'сбросить таймер'],
    ]],
    ['operators', 'Операторы', 'operators', [
      ['operator_random', '(FROM:1)(TO:10)'], 36,
      ['operator_add', '(NUM1:)(NUM2:)'], ['operator_subtract', '(NUM1:)(NUM2:)'],
      ['operator_multiply', '(NUM1:)(NUM2:)'], ['operator_divide', '(NUM1:)(NUM2:)'], 36,
      ['operator_lt', "(OPERAND1:'')(OPERAND2:'100')"], ['operator_equals', "(OPERAND1:'')(OPERAND2:'100')"],
      ['operator_gt', "(OPERAND1:'')(OPERAND2:'100')"], 36,
      ['operator_and', ''], ['operator_or', ''], ['operator_not', ''],
      ['flipperoperator_isInBetween', 'значение (VALUE:0) в диапазоне от (LOW:-10) до (HIGH:10) ?', 'bool'], 36,
      ['operator_join', "(STRING1:'apple')(STRING2:'banana')"], ['operator_letter_of', "(LETTER@math_whole_number:1)(STRING:'apple')"],
      ['operator_length', "(STRING:'apple')"], ['operator_contains', "(STRING1:'apple')(STRING2:'a')"], 36,
      ['operator_mod', '(NUM1:)(NUM2:)'], ['operator_round', '(NUM:)'], 36, ['operator_mathop', '(NUM:)'],
    ]],
    ['data', 'Переменные', 'data', 'VARIABLE'],
    ['myblocks', 'Мои блоки', 'more', 'PROCEDURE'],
  ];

  const TOOLBOX = '<xml>' + CATS.map(([id, name, colour, rows]) => {
    const c = COL[colour];
    const open = `<category name="${name}" id="${id}" colour="${c[0]}" secondaryColour="${c[1]}"`;
    if (typeof rows === 'string') return `${open} custom="${rows}"></category>`;
    // The app keeps a group's gap above and below every heading too.
    return `${open}>${[36, ...rows, 36].map((r) => (typeof r === 'number' ? `<sep gap="${r}"></sep>` : block(r, colour))).join('')}</category>`;
  }).join('') + '</xml>';

  // Stage-monitor blocks make no sense on a robot; DataCategory skips the blocks that do not exist.
  ['data_showvariable', 'data_hidevariable', 'data_showlist', 'data_hidelist'].forEach((t) => delete Blockly.Blocks[t]);
  // Same for the flyout's monitor checkboxes.
  Blockly.Block.prototype.hasCheckboxInFlyout = () => false;

  Blockly.Blocks.matrix = {
    init() {
      const c = COL.light;
      this.jsonInit({ message0: '%1', args0: [{ type: 'field_matrix', name: 'MATRIX' }], output: 'Number', outputShape: Blockly.OUTPUT_SHAPE_ROUND,
        colour: c[0], colourSecondary: c[1], colourTertiary: c[2], colourQuaternary: c[2] });
    },
  };

  // SPIKE's open menus take the block's dark stroke colour (Подсветка: the secondary one), not the block colour.
  const menuColour = (block) => (block.getColourTertiary() === COL.light[2] ? COL.light[1] : block.getColourTertiary());
  const setColour = Blockly.DropDownDiv.setColour;
  // The piano passes a white stroke, keep its fill there.
  Blockly.DropDownDiv.setColour = (fill, stroke) => {
    const c = /^#f{6}$/i.test(stroke) ? fill : stroke === COL.light[2] ? COL.light[1] : stroke;
    setColour(c, c);
  };

  // The pickers below put their own page elements into scratch-blocks' dropdown, as its matrix and piano do.
  const el = (tag, cls, parent) => {
    const e = parent.appendChild(document.createElement(tag));
    e.className = cls;
    if (tag === 'button') e.type = 'button';
    return e;
  };
  const panel = (cls) => {
    Blockly.DropDownDiv.hideWithoutAnimation();
    Blockly.DropDownDiv.clearContent();
    return el('div', cls, Blockly.DropDownDiv.getContentDiv());
  };
  // Hangs the filled panel under the field. `fill` is the panel's colour, by default the colour of the menus.
  const show = (field, fill, onHide) => {
    const b = field.sourceBlock_, parent = b.isShadow() ? b.getParent() : b;
    setColour(fill || menuColour(parent), fill ? parent.getColourTertiary() : menuColour(parent));
    Blockly.DropDownDiv.setCategory(parent.getCategory());
    const r = (b.isShadow() ? b.getSvgRoot() : field.fieldGroup_).getBoundingClientRect(), x = r.left + r.width / 2;
    Blockly.DropDownDiv.setBoundsElement(b.workspace.getParentSvg().parentNode);
    Blockly.DropDownDiv.show(field, x, r.bottom, x, r.top, onHide);
  };
  // The same for a dropdown field: it darkens while its picker is open, as with scratch-blocks' own menu.
  const showMenu = (field, fill) => {
    show(field, fill, field.onHide.bind(field));
    const b = field.sourceBlock_;
    if (field.disableColourChange_) return;
    if (b.isShadow()) b.setShadowColour(b.getColourQuaternary());
    else if (field.box_) field.box_.setAttribute('fill', b.getColourQuaternary());
  };
  const pick = (field, value) => {
    field.setValue(value);
    Blockly.DropDownDiv.hide();
  };

  // scratch-blocks draws a dropdown's picture only inside the open menu. This one puts it on the block too, and opens as the
  // app does: a row of square buttons. An option with `fill` paints the whole round shadow instead, that is the colour pill;
  // `slash` crosses it out («нет цвета»); such options open as a grid of circles.
  class IconField extends Blockly.FieldDropdown {
    init() {
      if (this.fieldGroup_) return;
      super.init();
      this.textElement_.style.display = 'none';
      this.image_ = Blockly.utils.createSvgElement('image', { y: 4, width: 24, height: 24 }, this.fieldGroup_);
    }
    updateWidth() {
      const width = 24 + Blockly.BlockSvg.EDITABLE_FIELD_PADDING;
      this.arrowWidth_ = this.positionArrow(width);
      this.size_.width = width + this.arrowWidth_ + (this.box_ ? 2 * Blockly.BlockSvg.BOX_FIELD_PADDING : 0);
    }
    render_() {
      super.render_();
      const o = this.imageJson_;
      if (!this.image_ || !o) return;
      const href = (e, url) => e.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
      this.image_.setAttribute('x', (this.size_.width - this.arrowWidth_) / 2 - 12);
      if (o.fill) {
        this.disableColourChange_ = true;
        this.sourceBlock_.setShadowColour(o.fill);
        Blockly.utils.addClass(this.sourceBlock_.getSvgRoot(), 'raSwatch');
        href(this.arrow_, Blockly.mainWorkspace.options.pathToMedia + (PALE.includes(o.fill) ? 'dropdown-arrow-dark.svg' : 'dropdown-arrow.svg'));
        this.image_.style.display = o.slash ? '' : 'none';
        if (o.slash) href(this.image_, svg(24, 24, SLASH));
      } else {
        href(this.image_, o.src);
      }
    }
    showEditor_() {
      const options = this.getOptions(), grid = !!options[0][0].fill;
      const box = panel(grid ? 'raPick raPick--grid' : 'raPick');
      options.forEach(([o, value]) => {
        const b = el('button', 'raPick__btn', box);
        b.title = o.alt;
        b.setAttribute('aria-label', o.alt);
        b.setAttribute('aria-pressed', value === this.value_);
        if (!grid) el('img', '', b).src = o.src;
        else if (o.slash) el('i', 'raPick__none', b);
        else el('i', '', b).style.background = o.fill;
        b.onclick = () => pick(this, value);
      });
      showMenu(this);
    }
  }

  // The port pickers show the hub from above as the app does: ports A, C, E on its left side, B, D, F on its right.
  // A phone's workspace is narrower than the picture, there the whole picture shrinks to fit.
  const hub = (field, pair, onPick) => {
    const frame = panel('raHub'), art = el('div', 'raHub__art', frame), body = el('div', 'raHub__body', art);
    const w = pair ? 472 : 290, k = Math.min(1, (field.sourceBlock_.workspace.getParentSvg().parentNode.clientWidth - 12) / w);
    art.style.width = w + 'px';
    art.style.transform = `scale(${k})`;
    frame.style.width = w * k + 'px';
    frame.style.height = 300 * k + 'px';
    const ports = [...'ABCDEF'].map((p) => {
      const b = el('button', 'raHub__port', body);
      b.textContent = p;
      b.setAttribute('aria-label', 'Порт ' + p);
      b.onclick = () => onPick(p);
      return b;
    });
    el('i', 'raHub__button', body);
    return { art, mark: () => ports.forEach((b) => b.setAttribute('aria-pressed', field.value_.includes(b.textContent))) };
  };

  class PortField extends Blockly.FieldDropdown {
    showEditor_() {
      hub(this, false, (p) => pick(this, p)).mark();
      showMenu(this, this.sourceBlock_.getParent().getColour());
    }
  }

  // Two clicks as in the app: the left motor's port, then the right one's.
  class PairField extends Blockly.FieldDropdown {
    showEditor_() {
      let turn = 0;
      const { art, mark } = hub(this, true, (p) => {
        const v = [...this.value_];
        // The other motor's port: as the first click it swaps the two, as the second it waits for a free port.
        if (p === v[1 - turn]) { if (turn) return; v[1] = v[0]; }
        v[turn] = p;
        this.setValue(v.join(''));
        if (turn++) Blockly.DropDownDiv.hide();
        else paint();
      });
      const motors = ['l', 'r'].map((side) => el('b', 'raHub__motor raHub__motor--' + side, art));
      const paint = () => {
        mark();
        motors.forEach((mo, i) => { mo.textContent = this.value_[i]; mo.classList.toggle('is-next', i === turn); });
      };
      paint();
      showMenu(this, this.sourceBlock_.getParent().getColour());
    }
  }

  // The steering pill reads «влево: -30», «прямо: 0», «вправо: 30» and keeps the bare number, a whole one from -100 to 100.
  const steerText = (v) => (v < 0 ? 'влево: ' : v > 0 ? 'вправо: ' : 'прямо: ') + v;
  const TICKS = Array.from({ length: 21 }, (_, i) => `<line y1="-37" y2="-42" transform="rotate(${i * 15 - 150})"/>`).join('');
  class SteerField extends Blockly.FieldTextInput {
    constructor() { super('0', null, /[\d-]/); }
    // Whatever comes in (typing, the dial, a saved program): the number in it, or null when there is none.
    classValidator(text) {
      const found = /-?\d+/.exec(String(text));
      return found ? String(Math.max(-100, Math.min(100, +found[0]))) : null;
    }
    setText(text) {
      const v = this.classValidator(text);
      if (v !== null) super.setText(v);
    }
    getDisplayText_() { return steerText(+this.text_).replace(' ', Blockly.Field.NBSP); }
    // Click: the text is selected for typing and the dial opens under it. The dial turns 1.5° per unit, so 30 points 45° to the right.
    showEditor_() {
      super.showEditor_(this.useTouchInteraction_);
      const input = Blockly.FieldTextInput.htmlInput_, c = this.sourceBlock_.getParent().getColourSecondary();
      input.value = input.defaultValue = steerText(+this.text_);
      if (!this.useTouchInteraction_) input.select();
      input.addEventListener('input', () => Blockly.DropDownDiv.hideIfOwner(this));     // typing puts the dial away, as in the app
      const box = panel('raDial');
      box.innerHTML = `<svg viewBox="-64 -60 128 118" width="128" height="118" fill="none" stroke="#fff" stroke-linecap="round"><circle r="47" fill="${c}" stroke="none"/>`
        + `<g stroke-opacity=".5">${TICKS}</g><path fill="#fff" fill-opacity=".2" stroke="none"/><line y2="-47" stroke-width="1.5"/><line stroke-width="1.5"/>`
        + `<g><circle r="16.5" stroke-width="5"/><path d="M-15 0H15M0 0V15" stroke-width="5" stroke-linecap="butt"/><circle r="6" fill="#fff"/><circle r="2.5" fill="${c}" stroke="none"/></g>`
        + `<g><circle r="10" fill="#fff" stroke-opacity=".35" stroke-width="5"/><path d="M0 4.5V-4M-3.5 -.5 0 -4l3.5 3.5" stroke="${c}" stroke-width="2" stroke-linejoin="round"/></g></svg>`
        + '<div class="raDial__row"><button type="button" aria-label="Меньше">−</button><output></output><button type="button" aria-label="Больше">+</button></div>';
      const dial = box.firstChild, [, , sector, , hand, wheel, handle] = dial.children, [less, label, more] = box.lastChild.children;
      const paint = () => {
        const v = +this.text_, a = v * 1.5 * Math.PI / 180, x = 47 * Math.sin(a), y = -47 * Math.cos(a);
        sector.setAttribute('d', `M0 0V-47A47 47 0 0 ${v > 0 ? 1 : 0} ${x} ${y}z`);
        hand.setAttribute('x2', x);
        hand.setAttribute('y2', y);
        wheel.setAttribute('transform', `rotate(${v * 1.5})`);
        handle.setAttribute('transform', `translate(${x} ${y})`);
        label.textContent = steerText(v);
      };
      const set = (v) => {
        v = Math.max(-100, Math.min(100, v));
        input.value = steerText(v);
        this.setValue(String(v));
        this.resizeEditor_();
        paint();
      };
      const drag = (e) => {
        const r = dial.getBoundingClientRect();
        const a = Math.atan2(e.clientX - r.left - 64, r.top + 60 - e.clientY) * 180 / Math.PI;       // 0 is up, clockwise is positive
        set(Math.round(Math.max(-150, Math.min(150, a)) / 1.5));
      };
      dial.onpointerdown = (e) => { dial.setPointerCapture(e.pointerId); drag(e); };
      dial.onpointermove = (e) => { if (dial.hasPointerCapture(e.pointerId)) drag(e); };
      less.onclick = () => set(+this.text_ - 1);
      more.onclick = () => set(+this.text_ + 1);
      paint();
      show(this);
    }
  }

  // A list's default is the option the row names, else the first one.
  const fromJson = (Field) => ({ fromJson: (o) => { const f = new Field(o.options); if (o.value) f.setValue(o.value); return f; } });
  Blockly.Field.register('field_list', fromJson(Blockly.FieldDropdown));
  Blockly.Field.register('field_icons', fromJson(IconField));
  Blockly.Field.register('field_port', fromJson(PortField));
  Blockly.Field.register('field_pair', fromJson(PairField));
  Blockly.Field.register('field_steering', { fromJson: () => new SteerField() });

  // Native dialogs are refused on the published page, so everything goes through one <dialog>.
  function dialog({ title, text, value, cancel }, done) {
    const d = document.createElement('dialog');
    d.className = 'raDialog';
    d.innerHTML = `<form method="dialog"><h3></h3><label><span></span>${value === undefined ? '' : '<input maxlength="40" autocomplete="off">'}</label>`
      + `<div class="raDialog__row">${cancel ? '<button class="btn" type="button">' + (document.documentElement.lang === 'kk' ? 'Болдырмау' : 'Отмена') + '</button>' : ''}<button class="btn btn--primary" value="ok">ОК</button></div></form>`;
    d.querySelector('h3').textContent = title;
    d.querySelector('span').textContent = text;
    const input = d.querySelector('input');
    if (input) input.value = value;
    // Decide in the click itself: the close event comes later as its own task, and a busy page can run a click on Play first.
    let over = false;
    const finish = (ok) => {
      if (over) return;
      over = true;
      d.close();
      d.remove();
      document.activeElement.blur();
      done(ok, input && input.value);
    };
    // Only ОК is a submit button, so Enter in the name field confirms.
    d.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); finish(true); });
    if (cancel) d.querySelector('[type=button]').onclick = () => finish(false);
    d.addEventListener('cancel', (e) => { e.preventDefault(); finish(false); });
    d.addEventListener('close', () => finish(false));
    document.body.append(d);
    d.showModal();
    if (input) input.select();
  }
  Blockly.alert = (text, cb) => dialog({ title: document.title, text }, () => { if (cb) cb(); });
  Blockly.confirm = (text, cb) => dialog({ title: document.title, text, cancel: true }, (ok) => cb(ok));
  Blockly.prompt = (text, value, cb, title) => dialog({ title: title || document.title, text, value, cancel: true }, (ok, v) => cb(ok ? v : null));
  // scratch-blocks also calls a bare alert() in two places, e.g. on deleting a used custom block.
  window.alert = (text) => Blockly.alert(text);

  Blockly.Procedures.externalProcedureDefCallback = (mutation, cb) => {
    const ws = Blockly.getMainWorkspace();
    const old = mutation.getAttribute('proccode');
    const isNew = !Blockly.Procedures.getDefineBlock(old, ws);
    const box = ws.getBlocksBoundingBox();
    dialog({ title: 'Мой блок', text: 'Как назовём блок?', value: old, cancel: true }, (ok, name) => {
      // % starts an argument in a proccode, and blocks here take no arguments.
      name = ok ? name.replace(/%/g, '').trim() : '';
      if (name) mutation.setAttribute('proccode', name);
      cb(name ? mutation : null);
      if (!name || !isNew) return;
      // Blockly drops a new definition in the top-left corner, right under the starter's notes.
      const def = Blockly.Procedures.getDefineBlock(name, ws);
      const at = def.getRelativeToSurfaceXY();
      def.moveBy(box.x - at.x, box.y + box.height + 60 - at.y);
      ws.centerOnBlock(def.id);
    });
  };

  // A slimmer sticky note, the left panel has no height to spare.
  Object.assign(Blockly.ScratchBubble, { TOP_BAR_HEIGHT: 20, MINIMIZE_ICON_SIZE: 20, DELETE_ICON_SIZE: 20 });
  Blockly.ScratchBlockComment.TEXTAREA_OFFSET = 8;

  const four = (c) => ({ primary: c[0], secondary: c[1], tertiary: c[2], quaternary: c[2] });

  // Scale, palette width and grid are the app's own numbers. Returns { workspace, load(xml), save() }.
  RA.createBlocks = (container, o) => {
    o = o || {};
    // A phone keeps some workspace next to the palette.
    Blockly.VerticalFlyout.prototype.DEFAULT_WIDTH = container.clientWidth < 600 ? 170 : 250;
    Blockly.Toolbox.prototype.width = 62 + Blockly.VerticalFlyout.prototype.DEFAULT_WIDTH;
    const workspace = Blockly.inject(container, {
      media: o.media || MEDIA, toolbox: TOOLBOX, sounds: false, comments: false, trashcan: false, collapse: false, scrollbars: true,
      zoom: { controls: false, wheel: true, startScale: 0.675 },
      grid: { spacing: 30, length: 2, colour: '#D9D9D9' },
      colours: {
        workspace: '#FBFBFB', flyout: '#FFFFFF', toolbox: '#FFFFFF', toolboxSelected: '#F5F5F5', scrollbar: '#D9D9D9', scrollbarHover: '#D9D9D9',
        insertionMarker: '#000000', insertionMarkerOpacity: 0.2, fieldShadow: 'rgba(255,255,255,.3)', dragShadowOpacity: 0.6,
        sounds: four(COL.sounds), event: four(COL.events), control: four(COL.control), sensing: four(COL.sensing),
        operators: four(COL.operators), data: four(COL.data), data_lists: four(COL.data), more: four(COL.more),
      },
    });
    // One column, from where the task programs put their start hat, so the pinned note above it stays in view.
    workspace.cleanUp = function () { let y = 116; this.getTopBlocks(true).forEach((b) => { const at = b.getRelativeToSurfaceXY(); b.moveBy(48 - at.x, y - at.y); y += b.getHeightWidth().height + 140; }); };
    workspace.toolbox_.categoryMenu_.categories_.forEach((c) => {
      c.item_.tabIndex = 0;
      c.item_.setAttribute('role', 'button');
      // The app's narrow column cuts the two ten-letter names to «УПРАВЛЕН…» and «ПЕРЕМЕНН…»; a CSS ellipsis would cut where our font says.
      if (c.name_.length > 9) {
        c.item_.title = c.name_;
        c.item_.setAttribute('aria-label', c.name_);
        c.label_.textContent = c.name_.slice(0, 8) + '…';
      }
      c.item_.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); workspace.toolbox_.setSelectedItem(c); }
      });
    });
    // scratch-gui refreshes the palette after custom-block changes, here it is on us.
    let procs = '';
    const syncPalette = () => {
      const now = Blockly.Procedures.allProcedureMutations(workspace).map((m) => m.getAttribute('proccode')).join('\n');
      if (now === procs) return;
      procs = now;
      workspace.toolbox_.refreshSelection();
    };
    workspace.addChangeListener((e) => {
      if (e.type === Blockly.Events.UI) return;
      syncPalette();
      if (o.onChange) o.onChange(e);
    });

    const load = (xml) => {
      const dom = Blockly.Xml.textToDom(xml);
      Blockly.Events.disable();
      try {
        workspace.clear();
        Blockly.Xml.domToWorkspace(dom, workspace);
      } finally { Blockly.Events.enable(); }
      workspace.clearUndo();
      const m = workspace.getMetrics();
      workspace.scrollbar.set(-m.contentLeft, -m.contentTop);
      syncPalette();
      // After the XML loader's 1 ms timer that opens the notes: a save before it would store them closed.
      if (o.onChange) setTimeout(o.onChange, 10);
    };
    return { workspace, load, save: () => Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace)) };
  };
})();
