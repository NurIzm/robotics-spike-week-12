// Start screen: «Мобильная платформа 3» as a product reveal, on a sheet of paper with a black line. The page behind it is plain CSS.
(function () {
  const RA = window.RA;
  const Q = Math.PI / 2;
  // The turn starts where LEGO's cover photo looks from: the front right, from above. The robot's +X is its front, +Z its right.
  const AZIMUTH = 0.67, ELEVATION = 0.5;
  const INTRO = 1.8, SWEEP = 0.8, TURN = 0.1, BEAT = 9;   // seconds, radians, rad/s, seconds
  const FILL_W = 0.9, FILL_H = 0.84;                       // share of the screen the model may take
  // Now and then the robot rolls a little along the line with the sensor's light on, and back. Modules; seconds within the beat.
  const DRIVE = 4, GO = [1, 2.4], BACK = [4.4, 5.8], LIGHT = [0.6, 6.4];
  const PAPER = [64, 40], LINE_W = 2.5;                    // modules: about 51 × 32 cm and a 2 cm strip of tape
  const ease = (t) => 1 - (1 - t) ** 3;
  const ramp = (p, [a, b]) => { const t = Math.min(1, Math.max(0, (p - a) / (b - a))); return t * t * (3 - 2 * t); };

  // White paper with black tape: it comes from behind, passes under the sensor with the lens on its right edge, and bends left ahead.
  function paper(lineZ) {
    const S = 16, [W, H] = PAPER, c = document.createElement('canvas');
    c.width = W * S;
    c.height = H * S;
    const g = c.getContext('2d');
    g.fillStyle = '#fbfbf8';
    g.fillRect(0, 0, c.width, c.height);
    const px = (x) => (x + W / 2) * S, pz = (z) => (z + H / 2) * S;   // the canvas's x is the world's x, its y the world's z
    g.strokeStyle = '#17171b';
    g.lineWidth = LINE_W * S;
    g.beginPath();
    g.moveTo(px(-W / 2), pz(lineZ));
    g.lineTo(px(12), pz(lineZ));
    g.quadraticCurveTo(px(24), pz(lineZ), px(W / 2), pz(lineZ - 12));
    g.stroke();
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Q), new THREE.MeshStandardMaterial({ map, roughness: 0.85 }));
    m.receiveShadow = true;
    return m;
  }

  let stage;

  RA.view('start', {
    init(root) {
      const r = RA.createRobot();
      // The corners of each part's box, at rest and rolled forward: the camera keeps all of them in view from any side.
      const outline = [];
      Object.values(r.parts).forEach((p) => {
        const b = new THREE.Box3().setFromObject(p, true);
        if (!b.isEmpty()) for (let i = 0; i < 16; i++) outline.push([(i & 1 ? b.max.x : b.min.x) + (i & 8 ? DRIVE : 0), i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z]);
      });
      const aim = r.box.getCenter(new THREE.Vector3());
      aim.x += DRIVE / 2;
      const AIM = aim.toArray();

      const az = AZIMUTH - (RA.reducedMotion ? 0 : SWEEP);
      const dir = [Math.sin(az) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(az) * Math.cos(ELEVATION)];
      stage = RA.stage(RA.$('.hero__stage', root), { fov: 18, target: AIM, camera: dir.map((v, i) => AIM[i] + v * 120) });
      stage.scene.add(r.group);
      if (!stage.renderer) return;

      // The stage's key light leaves the far side dim, and the turntable shows it.
      const fill = new THREE.DirectionalLight(0xffffff, 1.1);
      fill.position.set(10, 20, -60);
      stage.scene.add(paper(r.SENSOR.z - LINE_W / 2), fill);

      const c = stage.controls, foot = RA.$('.hero__foot', root);
      c.enableZoom = false;
      c.autoRotate = !RA.reducedMotion;
      const tan = Math.tan((stage.camera.fov * Math.PI) / 360);
      let intro = RA.reducedMotion ? 0 : 1;
      // The distance at which the model just fills the screen from the side it shows now, so it stays the biggest thing as it turns.
      const distance = () => {
        const a = c.getAzimuthalAngle(), el = Q - c.getPolarAngle();
        let u = 0, v = 0;
        outline.forEach(([x, y, z]) => {
          x -= AIM[0]; y -= AIM[1]; z -= AIM[2];
          u = Math.max(u, Math.abs(x * Math.cos(a) - z * Math.sin(a)));
          v = Math.max(v, Math.abs(y * Math.cos(el) - (x * Math.sin(a) + z * Math.cos(a)) * Math.sin(el)));
        });
        // On a phone the foot runs edge to edge, so the model must stay clear of it; on wider screens it passes between the corners.
        const fillH = stage.size.w > 640 ? FILL_H : 1 - (2 * (foot.offsetHeight + 44)) / stage.size.h;
        return Math.max(v / fillH, u / (FILL_W * stage.camera.aspect)) / tan;
      };
      stage.frame((dt, t) => {
        r.update(dt);
        const push = 1 + 0.3 * (1 - ease(1 - intro));
        stage.camera.position.sub(c.target).setLength(distance() * push).add(c.target);
        if (RA.reducedMotion) return;
        // OrbitControls turns per frame; this keeps the speed the same on any screen. Negative: the azimuth grows, as the sweep needs.
        c.autoRotateSpeed = -((TURN + (3 * SWEEP / INTRO) * intro * intro) * dt * 3600) / (2 * Math.PI);
        if (intro > 0) {
          intro = Math.max(0, intro - dt / INTRO);
          return;
        }
        // Forward rolls the left wheel counterclockwise (C) and the right one clockwise (D), each as far as the robot goes.
        const p = (t - INTRO) % BEAT, x = DRIVE * (ramp(p, GO) - ramp(p, BACK)), deg = (x / r.WHEEL_R) * (180 / Math.PI);
        r.group.position.x = x;
        r.setWheels(-deg, deg);
        r.setSensorLight(p > LIGHT[0] && p < LIGHT[1]);
      });
    },
    enter() { stage.start(); },
    leave() { stage.stop(); },
  });
})();
