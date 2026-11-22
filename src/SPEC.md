# «По линии» — lesson platform, build spec (week 12)

This is the brief written before the build. Where it and the code disagree, the code is right.

The site is for a school robotics lesson for ages ~10-14 with a LEGO SPIKE Prime set. All on-screen text is Russian. The teacher
projects it in class and students use it on school PCs (weak integrated graphics, sometimes no WebGL at all). The teacher's table
says: урок «Движение по чёрной линии (Датчик цвета).», цель «Изучение работы датчика цвета в режиме отражённого света. Написание
алгоритма движения по линии.», 1 час, неделя 12, вид деятельности «Сборка и разборка», модель «есть в приложении SPIKE».

The teacher asked for exactly this: the robot as a 3D model; a programming screen that looks like the SPIKE Prime app, one to one;
and several different tasks where students drag blocks, program the robot, and it drives along the line.

Last week's site («Кисть», week 11, `../Week 11`, live at https://nurizm.github.io/robotics-spike-week-11/) is the base: this
repository started as a copy of it (without its Kazakh copy). Same platform, same look, same four views: start, lesson, examples,
program. Change the content, not the platform. Read `../Week 9/src/SPEC.md` once: its hard constraints (§1), shared runtime (§3),
blocks (§6) and visual identity (§10) still hold. This file wins where it differs.

What is new this week, and the hard part: until now the model stood on a table and moved its fingers. Now the robot drives, and a
sensor steers it. That needs working movement blocks, a driving simulator with a floor mat the colour sensor really reads, and a
clock that makes the same program drive the same way on a fast and a slow computer (§8).

## 0. Paths and process

- The site is the repository root. View fragments: `src/views/{start,lesson,examples,program}.html`. Run `node src/build.js` after
  changing a fragment: it stitches them into `index.html`. Do not edit `index.html` by hand.
- `ref/` (git-ignored, never published) holds LEGO's material, as private references only:
  `ref/bi/NOTES.md` and `ref/bi/*.jpg` — every building step of the model from the SPIKE app (`base-NN.jpg`, `sensor-NN.jpg`,
  port pages, cover); `ref/app/LESSON.md` — LEGO's own lesson for this robot in the app, with its programs; `ref/app/PALETTE.md` and
  `ref/app/palette-*.jpg`, `popup-*.jpg` — the app's Word Blocks palette in Russian and a list of differences from our blocks;
  `ref/FACTS.md` — sourced facts on the colour sensor and line following. Do not copy LEGO's pictures or sentences into the site.
- Do not touch files you do not own (§2). `js/core.js`, `css/style.css`, `src/index.template.html`, `src/build.js` are shared and
  read-only. Never commit, never push, never start a server.
- Headless QA on this machine: see `QA` in the build brief you were given. One browser at a time (the script queues you).

## 1. Facts (true, sourced; do not invent others — when unsure, leave it out)

- The model is LEGO's «Мобильная платформа 3» (English: Driving Base 3), in the SPIKE app under «Модели». 38 steps: the build
  «Мобильная платформа» (34 steps) and the build «датчик цвета» (4 steps). The class built the same platform in weeks 2-3 as
  «Мобильная платформа 1»: steps 1-25 in week 2 (after step 25 it drives), steps 26-34 in week 3 (the third motor for tools).
  New today: the colour sensor module.
- Ports (LEGO's port pages, `ref/bi/base-ports.jpg`, `ref/bi/sensor-ports.jpg`): **C** — left drive motor (medium), **D** —
  right drive motor (medium), **E** — the set's large motor at the front with a small black gear on top (it drives attachments;
  nothing today), **B** — colour sensor. A and F are empty. On the hub A, C, E are on the robot's left side and B, D, F on its
  right, each row from front to rear.
- Layout (`ref/bi/NOTES.md` §4 has every position, counted from the beam holes in the pictures): a magenta 7×11 frame at the
  bottom; on it two medium motors lying along the robot, rotors facing out to the left and right; the two wheels (black spoked
  rims with azure tyres, 56 mm, a white pointer on the axle end) sit straight on the rotors, at the robot's **middle**: the
  axle is under the middle hole of the two black 15-hole beams that run along the sides. The hub lies flat on top, screen up,
  its centre button towards the **rear**; a ball caster (azure cup, white ball) hides under the hub's rear end. The beams stick
  out in front of the hub like two prongs; between them lies the large motor, white end forward, with the black gear (and a red
  axle end in its middle) on top. The colour sensor hangs under the front end of the **right** beam, lens down: about 5 modules
  (40 mm) to the right of the centre line, 6 modules (48 mm) in front of the wheel axle, about 2 modules (16 mm) above the
  floor. Size: 15 modules long (120 mm), about 126 mm wide over the tyres, 72 mm tall; the wheels' middles are about 14 modules
  (112 mm) apart. Front = the end with the sensor.
- SPIKE conventions (as in the app): a motor's positive direction is clockwise seen from the rotor's face. The left wheel's rotor
  looks left and the right one's looks right, so driving forward means C counterclockwise and D clockwise. The movement blocks do
  that by themselves once the program says «установить моторы для движения C+D»: first letter is the left motor, second the right.
  The block's default in the app is «A+B»: with this robot nothing moves until it is set to C+D.
- The movement blocks' steering runs from −100 (the app writes «влево: -100») to 100 («вправо: 100»); 0 is «прямо: 0». The outer wheel keeps the set
  speed, the inner wheel runs at speed × (1 − |steering| / 50): at 50 it stands still, at 100 it runs backwards and the robot spins
  on the spot.
- The wheel is 56 mm across, so one turn rolls 17.6 cm; the app's «установить поворот одного мотора на 17.5 см» is that number.
- The colour sensor in the SPIKE app has two modes we use: «цвет» answers with a colour name (or «нет цвета») and «отражённый
  свет» answers with a number from 0 to 100 %. For reflected light the sensor shines its own light down and measures how much comes
  back: white paper returns nearly all of it, black tape nearly none. From LEGO's technical sheet (`ref/FACTS.md` §1): the sensor
  has three white lights of its own, measures 100 times a second, works best about 16 mm from the surface, and LEGO itself marks
  reflected light as the mode «for line following»; it knows eight colours and «нет цвета». Readings on real mats differ
  (single users report about 10-25 % on black tape and about 95 % on white): any other number only from `ref/FACTS.md`.
- Line following with one sensor (sources in `ref/FACTS.md`): the robot follows the **edge** of the line, not its middle. In the
  middle the sensor sees black whichever way the robot drifts, so it cannot know where to turn; on the edge "too dark" means turn
  towards white and "too light" means turn towards black. The simple rule with two answers makes the robot wiggle («зигзаг», a
  relay controller). The threshold between dark and light is the middle between the black and the white reading. The proportional
  rule steers by how far the reading is from the threshold: steering = (threshold − reading) × a factor (darker than the
  threshold gives a positive number, a turn to the right, the same side as LEGO's zigzag below). It is smoother.
  Readings depend on the room's light and the sensor's height, so the threshold is measured on your own mat («калибровка»).
- LEGO's lesson for this robot in the app is «Учебное соревнование 3: Обнаружение линий» in the unit «К соревнованиям готовы!»
  (menu «Курсы»; `ref/app/LESSON.md` has every page; the programs are in `ref/app/lesson3-03-program-*.jpg`). Its three
  programs: (1) on the hub's left button: «установить моторы для движения C+D», «установить скорость движения 50 %», «начать
  движение ↑», «ждать до ‹B цвет чёрный?›», «остановить движение». (2) on the right button: C+D, 30 %, «повторять всегда»
  { «если ‹B цвет чёрный?›, то начать движение вправо: 50, иначе начать движение влево: -50» }. (3) the hint for going faster:
  the same stack with the condition «‹B отражённый свет < 50 %?›» and the moves «вправо: 30» and «влево: -30», still 30 %.
  So LEGO turns right on dark and left on light: the robot rides the **right edge** of the line (the line is on its left).
  The teacher's plan is about reflected light, so our line follower is LEGO's program 3, word for word, started with «когда
  запускается подпрограмма»; our tasks begin like LEGO's (drive to a line and stop) and go on from there.
- Earlier lessons (the teacher's plan): week 2 «Блоки Моторы, блоки движения. Движение по маршрутам (квадрат, плюс)» on
  «Мобильная платформа 1»; week 3 a grabber on it; week 4 the distance sensor, driving round obstacles; week 5 the colour sensor
  reacting to colours. Weeks 9-11 (this unit, «Манипуляторы и автономия»): «Роборука», «Захваты», «Кисть» — the robot stood still
  and gripped; its sensors decided when. Today the robot drives by itself and a sensor steers it: that is autonomy on wheels.
- Next lessons, do not pre-empt them: week 13 a colour sorter, week 14 a maze with the gyro.

## 2. File ownership (edit only your own files)

| Owner | Files |
|---|---|
| model | `js/robot.js`, `js/hero.js`, `css/start.css`, `src/views/start.html` |
| lesson | `js/lesson.js`, `css/lesson.css`, `src/views/lesson.html` |
| examples | `js/scenes.js`, `js/examples.js`, `css/examples.css`, `src/views/examples.html` |
| blocks | `js/blocks.js`, `css/blocks.css` |
| vm | `js/vm.js`, `js/programs.js` (new), `tests/vm-check.html` |
| sim | `js/sim.js`, `js/program.js`, `css/program.css`, `src/views/program.html` |

Everyone builds on last week's file of the same name: keep what fits, change what this model needs, delete what it does not.
The storage prefix is `liniya.` (set in `js/core.js`). `README.md`, `src/SPEC.md`, `js/core.js` and the template belong to the lead.

## 3. The model (`js/robot.js`, owner: model)

`js/robot.js` starts as a box stub with the full API below, so the other owners can work at once. The model owner replaces it
with the real model and keeps the API exactly. Never leave `js/robot.js` broken: write the new version to a temp file outside the
repository, `node --check` it, test it, then move it over `js/robot.js`.

Build `RA.createRobot()` procedurally from `ref/bi/` (look at every step frame; `NOTES.md` indexes them). Reuse week 11's kit in
the same file (rounded boxes, Technic beams with real holes, the open frame, the hub with its LED matrix and buttons, the medium
and the large motor, the colour sensor, ribbon cables, materials) and add what is new: the wheel (black rim with spokes and
round holes, azure tyre, the white pointer on the axle end), the ball caster, the small black gear on the large motor, the
coloured cable clips.

Units: 1 scene unit = 1 LEGO module = 8 mm. Axes of `r.group`: **+X forward** (the colour-sensor end), **+Y up**, **+Z the
robot's right**. The origin is on the floor under the middle of the wheel axle, so `r.group.position` is the point the robot
turns about and `r.group.rotation.y` is its heading (counterclockwise seen from above). The robot stands on its wheels and caster.

Plastic look and colours as in weeks 9-11: azure `#01adc4` (sample the pictures: the tyres and motor bodies are the set's light
azure), magenta `#c92e85`, yellow `#fed920`, white `#eceded`, black `#16151a`, grey `#a9b0b5`; the hub has a yellow body and a
light grey face. Cables: flat white ribbons from each device to its port. Whole model under ~80k triangles, static meshes merged
per material. Quality bar: at first glance a student recognises `ref/bi/cover.jpg`, `base-34.jpg` and `sensor-04.jpg` (`NOTES.md`
§6 lists what makes it recognisable); the wheels, the hub, the two black prongs, the gear at the front and the sensor under
the right prong are where LEGO has them.

API (other owners depend on it exactly; every constant is also a property of the factory, e.g. `RA.createRobot.PARTS`):

```js
const r = RA.createRobot();   // new instance every call; geometries and materials shared between instances
scene.add(r.group);
r.parts          // {chassis, hub, motors, wheelL, wheelR, caster, tool, sensor, cables}: THREE.Group each
                 //   chassis: the frame, beams and connectors; motors: both drive motors; tool: the large motor with its gear
r.PARTS          // [{id, name, role}] in that order, Russian, e.g. {id:'sensor', name:'Датчик цвета', role:'…'}
r.PORTS          // {left: 'C', right: 'D', tool: 'E', color: 'B'}
r.WHEEL_R        // wheel radius in modules: 3.5 (a 56 mm wheel)
r.TRACK          // distance between the two wheels' middles, modules (from the pictures)
r.SENSOR         // {x, z, h}: the lens centre, x in front of the wheel axle, z to the right of the centre line, h above the floor; modules
r.sensor         // THREE.Object3D at the lens centre (child of r.group): read its world position
r.box            // THREE.Box3 of the model in r.group space: for cameras, layout and "left the mat" checks
r.setWheels(c, d)       // positions of motors C and D in degrees (positive = clockwise seen from that rotor's face): turns each wheel as its motor would
r.setTool(deg)          // position of motor E: turns the black gear
r.setSensorLight(on)    // the sensor's own light: a small bright spot on the floor under the lens and a glow at the lens
r.setMatrix(arr|null)   // as week 11: 25 brightness values 0..100, row by row with the hub read upright (its top edge is at the robot's front)
r.setCenterLight(css|null)
r.hubButtons     // {left, right, center}: meshes for raycasting
r.highlight(id|null)    // fades everything except that part (ids of r.parts); null restores. Animated by update()
r.setExplode(t)         // 0..1: exploded view
r.STAGES         // [{id, title, steps, parts, text}]: the build stages, see below
r.setBuildStage(n, t)   // shows stages up to n (0-based); stage n flies into place as t goes 0..1
r.update(dt)            // call every frame
```

Stages, following LEGO's order (`NOTES.md` §5): 1 «Рамка и два мотора» (шаги 1–5), 2 «Хаб и шаровая опора» (6–13), 3 «Хаб
на моторы, две балки, кабели» (14–24, порты C и D), 4 «Колёса» (25–26: after them the robot drives), 5 «Большой мотор с
шестернёй» (27–34, порт E), 6 «Датчик цвета» (its own 4 steps, порт B; the only new stage for this class). `steps` reads like
«шаги 1–5» or «датчик цвета, шаги 1–4». `text`: one or two plain sentences a student can follow; `parts`: plain descriptions you
can see in the pictures, no counts you cannot verify.

## 4. Start view (`js/hero.js`, `css/start.css`, `src/views/start.html`, owner: model)

As week 11, new model and words. The model dead centre, the largest thing on the screen, on a slow turntable that starts from the
view of LEGO's cover picture. Under it a piece of white floor with a black line it stands on, so the screen says what the lesson
is about at a glance; now and then the wheels turn a little and the sensor's light blinks on. Display title «ПО ЛИНИИ», kicker
«Мобильная платформа 3». Spec strip: Моторы: C, D · Датчик цвета: B · Шагов сборки: 38 · Время: 1 час. Button «Начать урок» →
lesson. `RA.reducedMotion`: still until dragged.

## 5. Lesson view (`js/lesson.js`, `css/lesson.css`, `src/views/lesson.html`, owner: lesson)

One scrolling page, big type for a projector, same visual language as week 11 (reuse its CSS and components; delete last week's
sections). `Далее` → examples. Every statement must come from §1, `ref/FACTS.md` or `ref/app/LESSON.md`, or be plain geometry you
can check yourself. Numbers shown by the page's own widgets must agree with the simulator (§8: white about 95 %, black about 5 %,
threshold 50).
1. Header: kicker «Урок: движение по чёрной линии. Датчик цвета», h1 «Манипуляторы и автономия», цель (the teacher's words
   above), facts: 1 час, сборка и разборка, неделя 12; «Что узнаем».
2. Что мы уже умеем (было — стало): the platform drove by program alone, "blind" (weeks 2-3: so many turns forward, then turn),
   it met the distance and colour sensors (weeks 4-5), and in weeks 9-11 sensors decided for the robot arms. Today the platform
   gets an eye that looks down, and the line leads it.
3. Наш робот: the 3D model (`createRobot`), parts with `highlight` (PARTS), the ports table (C, D, E, B), what is new compared
   with «Мобильная платформа 1» (the colour sensor module), where the sensor sits and where it looks.
4. Как датчик видит линию (режим отражённого света): the sensor shines and measures what comes back. Interactive, plain 2D: a
   strip of surfaces (white paper, grey, black tape, a few colours) and a sensor the student drags along it; a big gauge shows
   «отражённый свет, %» and next to it what the «цвет» mode would answer. On the border between black and white the number is in
   between. Two modes, two kinds of answer: a name or a number.
5. Порог: a number between "black" and "white": (чёрное + белое) / 2. Small interactive with the two readings and the middle.
   Why measure on your own mat («калибровка»): light and sensor height change the readings.
6. Алгоритм: едем по краю линии. Why the edge and not the middle (§1). The rule in two lines. An animated top view (plain 2D,
   play/pause, respects `RA.reducedMotion`) of a robot wiggling along the edge, with the active branch of the «если … иначе»
   lit up next to it.
7. Программа: the line follower as a picture of SPIKE-looking blocks (HTML/CSS as week 11's lesson, SPIKE colours), block by
   block: «когда запускается подпрограмма», «установить моторы для движения C+D», «установить скорость движения 25 %»,
   «повторять всегда», «если ‹B отражённый свет < 50 %?›, то начать движение вправо: 30, иначе начать движение влево: -30»
   with «установить скорость движения 30 %»: LEGO's own reflected-light follower (§1, program 3). One line on each block, and
   one on LEGO's first version in the app, which asks for the colour's name instead. The same program is the solution of
   task 3 (§9), keep them identical.
8. Настройка: what to change when it goes wrong, as a small table: слетает на повороте (меньше скорость или круче поворот),
   сильно виляет (поворот мягче), крутится на месте или едет назад (моторы для движения не C+D, перепутаны стороны поворота),
   не видит линию (порт датчика B, порог, высота датчика). Speed against accuracy.
9. Плавнее (со звёздочкой): the proportional rule, in words and one block picture: «начать движение ((50 − (B отражённый свет))
   × 1.2)». The further from the edge, the sharper the turn; on the edge it drives straight. (Darker than 50 gives a positive
   number, a turn to the right, as in the zigzag.)
10. Сборка и разборка: the 3D model with the stage stepper (`STAGES`, `setBuildStage`) and an explode slider; pairs; the path in
    the app «Модели → Мобильная платформа 3»; the ports to check (C, D, E, B); how to make a test track: black electrical tape
    on a white sheet, smooth curves first (`ref/app/LESSON.md` says what LEGO suggests for the line). Tidy disassembly.
11. Мини-тест: 5 questions with instant explanation, stored with `RA.store` (`lessonQuiz`), `RA.progress.mark('lesson')` at the end.
Footer with the trademark note of week 9.

## 6. Examples view (`js/scenes.js`, `js/examples.js`, `css/examples.css`, `src/views/examples.html`, owner: examples)

Same machinery as week 11 (one shared stage, a phase table per scene, caption timeline, list beside the canvas, the autonomy
level). Six new stories about machines that keep to a line or a marked path, each answering: где, что делает, что служит линией,
чем машина её видит, насколько она самостоятельна, и «Что общего с нашим роботом». Rename the fact labels to fit (e.g. «Линия»
instead of «Пальцы»). Low-poly, clean, same plastic look, readable on a projector. Candidates (verify each, replace if unsure):
1. Завод: a guided cart (AGV) follows a magnetic tape or a painted line on the floor and brings parts to the workers.
2. The first of them: a 1950s tractor that followed a wire in the floor (check the year, the maker and what it carried).
3. Автомобиль: lane keeping, a camera watches the road markings and the car steers back into its lane.
4. Автобус: optically guided buses that follow lines painted on the road (e.g. Rouen, France; check).
5. Соревнования: line-following events for school robots (e.g. RoboCup Junior Rescue Line), what the track looks like.
6. One more of your choice where a line or a wire leads a machine (a robot lawnmower and its boundary wire, a hospital or
   restaurant delivery robot on a floor line, a warehouse).
Every claim, name and number must be checked with WebSearch or left out (search with generic words only: no names of people,
the school or file paths in a query).

## 7. Blocks (`js/blocks.js`, `css/blocks.css`, owner: blocks) and interpreter (`js/vm.js`, `js/programs.js`, `tests/vm-check.html`, owner: vm)

**Blocks: the palette must look and read like the SPIKE app in Russian, one to one.** `ref/app/PALETTE.md` records the app
(layout, every block, the pickers with pictures in `ref/app/popup-*.jpg`, the colours) and ends with a numbered list of
differences from our code. Fix them, most visible first: the steering field (a white pill with «вправо: 30» / «прямо: 0» /
«влево: -30», typing and the dial with − and +), the two-button direction pickers, the 3×3 colour grid with the app's colours,
the hub-picture port picker and the two-motor pair picker, the unit and option lists and their order («с», the three units of
«переместить вправо: 30», «<, =, >», the stop options), the palette's scale, width and grid, the one-line category labels, ten
categories (the extra «Дополнительные моторы» goes), the text outline, the open menus' look, the cap shape of «остановить».
Say in the report what you left and why.

The contract with the VM and the saved programs: **the XML of every block stays exactly as it is today** — the same block
types (opcodes), shadow types (`flipper<category>_<menu>-selector`), field and input names and stored values (steering a whole
number from −100 to 100 as text, `forward`/`backward`, port letters, a pair as two letters like `CD`, colour codes as in
`MENUS.color`, units as today's values). Only how a field looks and is edited changes. Any reporter can still be dropped on
the steering input.

Defaults for this robot, as the app shows them with this robot's hub connected: single-motor blocks start on port C,
colour-sensor blocks and the colour hat on port B. «установить моторы для движения» keeps the app's default A+B (students must
set C+D, as in class). Blocks of sensors this robot does not have (force, distance) stay in the palette as in the app.
`createBlocks()` no longer needs `reset()` or any task program: programs live in `js/programs.js`.

**Interpreter: the movement blocks now work.** The VM keeps the pair (default A+B), the movement speed (default 50 %) and the
distance of one rotation (default 17.5 cm) per run, and drives through `hw.motors` only:

- `flippermove_setMovementPair`: first letter left motor, second right. `flippermove_movementSpeed`. `flippermove_setDistance`
  (cm or inches).
- `flippermove_startMove` (the app offers only ↑ вперёд and ↓ назад): forward = left motor counterclockwise, right clockwise.
  `flippermove_startSteer`: outer wheel at the movement speed, inner at speed × (1 − |s| / 50), s clamped to −100..100 and
  rounded; it may come from any reporter block dropped on the steering field. `flippermove_stopMove`.
- `flippermove_move` (обороты, градусы, с, см, дюймы) and `flippermove_steer` (обороты, градусы, с): the outer wheel turns the
  given amount (cm and inches through the distance of one rotation), the inner one its share; the block waits until both
  motors are done. A negative amount drives the other way. Seconds: both run for that time.
- A pair with a port that has no motor: warn once per run and skip the block, e.g. «В портах A и B нет моторов. Колёса этого
  робота в портах C и D: поставь в начало «установить моторы для движения C+D».» A sensor block on a wrong port warns as in
  week 11 («Датчик цвета подключён к порту B.»). Motor blocks on E turn the gear.

Time comes from the simulator, so a program drives the same on any computer (§8). The VM takes it only from `hw`:
`hw.now()` (simulated seconds), `hw.tick()` (a promise that resolves right after the next physics step, every 0.01 s of simulated
time), `hw.sleep(sec)`. Use them for «ждать … секунд», the timer, every pass of a loop («повторять всегда», «повторить … раз»,
«повторять пока не»: wait one tick per pass), «ждать до» (test once per tick) and the polled hats (on the tick). A loop then
reads the sensor exactly once per physics step, like a hub that samples a hundred times a second, and does not burn the page
between steps. Keep the real-time slice guard only as a safety net for long straight stacks.

`js/programs.js` (new, loaded after `js/blocks.js`; the lead adds it to the template): `RA.PROGRAMS`, an array of six
`{starter, solution}` XML strings, one per task of §9, built with small helpers like last week's in `js/blocks.js` (take them
from `../Week 11/js/blocks.js`; they are removed from this week's `js/blocks.js`). Exact contents in §9. Each starter carries a
pinned note with the task in one or two sentences.

`tests/vm-check.html`: keep it passing with a fake `hw` that has `now`, `tick` and `sleep`; add checks for every movement block
(wheel directions for forward and backward, the steering formula at 0, 30, 50, 100 and −30, cm → degrees with 17.5 and with a
changed distance, the three units of «переместить вправо», the missing-pair warning) and for the tick-paced loop (N passes
take N ticks).

## 8. Simulator (`js/sim.js`, owner: sim)

`RA.createSim(container)` builds the world behind `sim.hw`, which is all the VM ever touches.

**World.** A white mat, 120 × 80 cm, lies on a floor. Mats are drawn with canvas 2D (one canvas per mat, about 20 px per cm) and
that same canvas is both the picture on the floor and what the sensor reads, so the sensor sees exactly what the student sees.
Mat coordinates are centimetres, x to the right, z towards the viewer, origin in the middle; 1 cm = 1.25 modules in the scene.
Lines are black, 2 cm wide (black electrical tape), drawn from straight pieces and arcs. Each mat has a start pose and, where a
task needs them, a path (the line's middle as points every half centimetre, for progress along it) and named zones.

| Mat | What is on it | Task |
|---|---|---|
| «Проба» | wide bands across the way: white, black (6 cm), grey, and patches of red, green, blue, yellow | 1 |
| «Стоп-линия» | start on the left, one black line across the way 70 cm ahead, 20 cm of mat after it | 2 |
| «Трасса 1» | a closed loop of gentle curves (no radius under 25 cm), a start mark | 3 |
| «Трасса 2» | a closed loop with long straights, an S-bend and one tight turn (radius about 10 cm) | 4, 5 |
| «Маршрут» | an open line from a start mark through two curves to a red finish patch (8 × 8 cm) | 6 |

**Robot.** `RA.createRobot()` on the mat. Pose = (x, z, heading). Each step: wheel speeds from the two drive motors
(left wheel forward when C turns counterclockwise, right wheel forward when D turns clockwise; radius `r.WHEEL_R`), then
v = (vL + vR) / 2 and turn rate = (vR − vL) / `r.TRACK`, exact arc. No slipping, no inertia of the body. The lag of a real
robot comes from its motors: a new speed takes effect after a short delay (a few hundredths of a second) and then within a
limited acceleration. Without that lag a zigzag program that flips a hundred times a second glides along the edge like a
perfect one, which no real robot does. Pick both numbers so that the zigzag follower of task 3 visibly wiggles (the lens swings
about a centimetre), the proportional follower of task 5 runs smoothly, and a stop from 30 % takes about 1 cm.
Motors C, D, E are last week's motor objects (run, runPower, stop, runFor, runForSeconds, goTo, position, relative, speedPct,
powerPct, defaultSpeed) without stops or stalls. 100 % speed of a medium motor is 1110 degrees a second (SPIKE's Python
reference, `ref/FACTS.md` §3), the large motor's 1050.

**Sensor.** The lens is at `r.sensor`. `reflected()` = the mean brightness of the mat's canvas inside a spot of about 1.2 cm under
the lens, mapped so white paper reads about 95 and black tape about 5; half on the line reads about 50. `color()` = the SPIKE code
of the nearest of the colours drawn on the mats (0 чёрный, 3 синий, 5 зелёный, 7 жёлтый, 9 красный, 10 белый); a black-and-white
mix is black or white by brightness, never a hue. Off the mat: the floor, a mid grey. Both are cached per physics step.
The numbers are our choice: mark them with a `shortcut:` comment unless `ref/FACTS.md` has measured ones.

**Clock.** Physics runs in fixed steps of 0.01 s of simulated time and never two steps in one browser task: after each step the
simulator resolves the `hw.tick()` waiters and lets the event loop run before the next step (a MessageChannel or a zero timeout,
not requestAnimationFrame), so every VM thread gets its turn exactly once per step. Steps follow real time × `sim.speed`
(1 by default; QA raises it); when the page falls behind by more than 0.1 s it slows down instead of jumping. Drawing happens in
the stage's frame callback and only reads the state. The same program must give the same path at 60 frames a second and at 5.

```js
hw.ports = { B: 'color', C: 'motor', D: 'motor', E: 'motor' }
hw.motors            // {C, D, E}
hw.sensors.color()       // SPIKE code, -1 only when the lens is in the air (never in this simulator)
hw.sensors.reflected()   // 0..100
hw.sensors.angle('yaw')  // the robot's heading as the hub's gyro gives it: degrees, clockwise positive, −180..180, since resetYaw()
hw.sensors.orientationUp(name)   // 'top': the hub lies flat, screen up
hw.now(), hw.tick(), hw.sleep(sec)
// buttons, tilt, display, sound, centerLight, onEvent, reset: as week 11 (their waits on the simulated clock too)
```

**What the program view needs from it** (shape it as you like, this is the content):

- the mats (`sim.MATS`, `sim.setMat(id)`), `sim.reset()` = robot back to the mat's start, motors stopped, trail and run numbers
  cleared; `sim.place(x, z, heading)` to put the robot down by hand; `sim.pose`; `sim.time`; `sim.speed`;
- `sim.sensor` = where the lens is on the mat and what it reads now: reflected %, colour code and its Russian name;
- the run numbers since the program started (`sim.beginRun()`): distance driven, progress along the mat's path (0..1, only
  forwards and only while the lens is within 5 cm of the line), `lost` (the lens has been further than 5 cm from the line for
  2 s), laps and the last lap's time, `wobble` («виляние» over the lap, see the end of §9), `outside` (the robot left the mat),
  whether both wheels stand still, and which named zone the lens is over.

**Picture.** The floor with the mat, the robot, soft shadows, the sensor's light spot while a program runs. Camera: by default it
follows the robot (the target eases after it; the student can orbit and zoom); a button switches to the whole mat from above
at an angle and back. A trail of where the lens has been (a thin magenta line, toggle «След», on by default, cleared by reset).
A top-view map in a corner of the stage (a plain 2D canvas, about 200 px wide): the mat, the trail, the robot as an arrow, the
lens as a dot. The student puts the robot anywhere by dragging it on the map (and in the 3D view if that is cheap) and turns it
with two buttons and two keys, 15° a press: by hand, as on a real table. Without WebGL the map fills the stage and everything
still works. Clicks on the 3D hub's buttons work as last week.

## 9. Program view and tasks (`js/program.js`, `css/program.css`, `src/views/program.html`, owner: sim)

Same layout and controls as week 11: blocks left, 3D right, splitter, round Play/Stop, tools, the task bar, the hub panel (LEDs,
hub buttons, centre button = start/stop). Gone: the force wheel, the cards, the distance slider, the objects, «Поднять кисть».
New beside the hub panel: «Датчик цвета, порт B» — a big gauge 0-100 % with a mark at 50, the number, the colour name and a small
swatch of what the lens sees; the motors' table for C and D (угол, скорость, мощность); время, путь в сантиметрах, круги; the
buttons «На старт» (also the task bar's reset), «Всё поле / За роботом», «След» and the two turn buttons.

Each task has its own program: stored as `program.xml.<n>`, first loaded from `RA.PROGRAMS[n].starter`; switching the tab saves
one and loads the other. «Показать решение» loads `RA.PROGRAMS[n].solution` (from `js/programs.js`) after the in-page confirm. «Начать заново» wipes all
six programs, the ticks and the tables. Selecting a task lays its mat and puts the robot on the start. Starting a program calls
`sim.beginRun()`. A program whose robot leaves the mat is stopped with a plain message. Progress with `RA.store`; solved → tick;
all six → `RA.progress.mark('program')`. Each task: goal, «Подсказка», «Показать решение», «На старт». Expose `RA.program`
(`sim, bl, vm, select, task, …`) for QA as last week.

Programs (the vm owner writes them into `RA.PROGRAMS`; "follow" below is always
«если ‹B отражённый свет < 50 %?›, то начать движение вправо: 30, иначе начать движение влево: -30», LEGO's program 3 (§1), so
the robot rides the right edge of the line and every start pose puts the lens on that edge; "setup" is «когда запускается
подпрограмма», «установить моторы для движения C+D», «установить скорость движения N %»):

1. «Что видит датчик» (mat «Проба»). No program to write: the student moves the robot by hand so the lens is over white, over
   black and on the border, and watches the gauge. A table fills itself: белое … %, чёрное … %, граница … %. Then the student
   types the threshold. Passes when all three cells are filled and the typed number is within 10 of (белое + чёрное) / 2.
   Starter and solution: only the start hat and the note.
2. «Стоп на линии» (mat «Стоп-линия»). Starter: setup (30 %) + «начать движение вперёд»: the robot crosses the line and leaves
   the mat. Solution: setup (30 %), «начать движение вперёд», «ждать до ‹B отражённый свет < 50 %?›», «остановить движение».
   Passes when the robot stands still with the lens over the black line or just past it (a few centimetres: LEGO's own 50 %
   must still pass, 100 % must not), also when the student checks «B цвет чёрный?» as LEGO does. Messages for stopping early
   and for driving over it.
3. «Зигзаг по линии» (mat «Трасса 1»). Starter: setup (30 %) + «повторять всегда» with an «если … то … иначе» inside, the
   condition in place, both branches empty. Solution: setup (30 %) + «повторять всегда» { follow }. Passes after one full lap
   without `lost`. A lap with the solution should take about 20-25 s: size the loop for that.
4. «Быстрее!» (mat «Трасса 2»). Starter: the solution of task 3. The student tunes the speed and the two steering numbers.
   A table collects the last attempts: скорость движения, время круга or where it left the line. Passes when a lap takes less
   than the limit. Pick the limit and the track so that the task 3 numbers (30 %, ±30) lose the line at the tight bend,
   ±50 at 30 % (LEGO's first follower) holds it but is too slow, a much higher speed flies off, and a tuned pair passes with
   a clear margin; the solution carries a tuned pair.
5. «Плавный руль» (mat «Трасса 2», со звёздочкой). Starter: setup + «повторять всегда» { «начать движение прямо: 0» } and,
   lying loose beside it, the assembled expression «((50 − (B отражённый свет)) × 0.5)». Solution: setup + «повторять всегда»
   { «начать движение ((50 − (B отражённый свет)) × k)» } with a tuned k. The table shows «виляние» next to the lap time.
   Passes when a lap is done with `wobble` under a limit that no zigzag program reaches and the solution clears.
6. «Доставка: стоп на красном» (mat «Маршрут»). Starter: the solution of task 3. Solution: setup (30 %) + «повторять пока не
   ‹B цвет красный?›» { follow } + «остановить движение». Passes when the robot stands still with the lens on the red patch
   and it came there along the line (progress at least 0.9).

Every check must be honest both ways: the starter fails, the solution passes on a slow and a fast computer (the clock makes
them the same), and the usual wrong programs get a message that says what to change (pair not set, sides swapped, too fast).

Numbers to start the tuning from (a quick calculation with the robot's measured geometry: wheels 11.2 cm apart, the lens
4.8 cm ahead and 4 cm to the right, wheels that take about a quarter of a second to reach 50 %, riding the right edge; measure
again in the real simulator). The zigzag with ±30 at 30 % holds left bends down to a radius of about 20 cm and right bends
down to about 12 cm, and loses tighter ones. With ±50 at 30-50 % it holds left bends of 10 cm and any right bend. From about
60 % it starts to fly off even gentle bends. The proportional rule with a factor of 1.2 holds bends of 10 cm at 30-50 %; with
0.5 it loses bends of 15-20 cm and less. So «Трасса 1» keeps every radius at 25 cm or more, and «Трасса 2» gets one tight
bend of about 10 cm that weak steering and high speed cannot hold. «Виляние» must tell a zigzag
from a proportional program on the same track: the plain mean of |turn rate| does not (the track's own bends dominate it).
Measure what is left after the bends are taken out, for example the mean distance of the lens from the line's edge or how often
the turn direction flips per metre; choose by experiment and show it as a small whole number.

## 10. Visual identity

As week 9 §10. Title of the page: «По линии». Top bar: «Неделя 12» · «Манипуляторы и автономия».

## 11. Kazakh copy

Not part of this build. `src/kk/GLOSSARY.md`, `src/kk/check.js` and `src/kk/code-check.js` stay for when it is made.
