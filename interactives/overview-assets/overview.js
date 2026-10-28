import * as THREE from '../vendor/three.module.js';

const root = document.querySelector('.overview-demo');
if (root) {
  const current = root.querySelector('#overview-current');
  const prior = root.querySelector('#overview-prior');
  const memory = root.querySelector('#overview-memory');
  const stage = root.querySelector('#overview-stage');
  const plot = root.querySelector('#overview-plot');
  const readout = root.querySelector('#overview-readout');
  const motionButton = root.querySelector('#overview-motion');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const response = (now, before, carry) => 100 * (1 - Math.exp(-(now + carry * before) / 45));
  const state = () => ({now: Number(current.value), before: Number(prior.value), carry: Number(memory.value) / 100});
  const svg = (name, attrs, content = '') => `<${name} ${attrs}>${content}</${name}>`;

  let renderer, scene, camera, surface, marker, slice, frame = 0;
  let paused = reducedMotion.matches;
  let dragging = false;
  let yaw = 0;
  const start = performance.now();

  function drawPlot({now, before, carry}) {
    const x = value => 48 + value * 3.65;
    const y = value => 230 - value * 1.85;
    const curve = Array.from({length: 51}, (_, i) => `${i ? 'L' : 'M'} ${x(i * 2).toFixed(1)} ${y(response(i * 2, before, carry)).toFixed(1)}`).join(' ');
    const at = response(now, before, carry);
    const ticks = [0, 25, 50, 75, 100];
    plot.innerHTML = [
      ...ticks.map(t => svg('line', `x1="48" y1="${y(t)}" x2="413" y2="${y(t)}" stroke="#41606b" stroke-width="1"`)),
      ...ticks.map(t => svg('text', `x="40" y="${y(t) + 4}" text-anchor="end" fill="#c8dce1" font-size="12"`, t)),
      ...ticks.map(t => svg('text', `x="${x(t)}" y="250" text-anchor="middle" fill="#c8dce1" font-size="12"`, t)),
      svg('path', `d="${curve}" fill="none" stroke="#55dcc0" stroke-width="3"`),
      svg('line', `x1="${x(now)}" y1="${y(at)}" x2="${x(now)}" y2="230" stroke="#ffc879" stroke-dasharray="5 5"`),
      svg('circle', `cx="${x(now)}" cy="${y(at)}" r="7" fill="#ffc879" stroke="#102c39" stroke-width="2"`),
      svg('text', 'x="230" y="275" text-anchor="middle" fill="#dcecf0" font-size="13"', 'Current spend index'),
      svg('text', 'transform="translate(14 135) rotate(-90)" text-anchor="middle" fill="#dcecf0" font-size="13"', 'Response index')
    ].join('');
    plot.setAttribute('aria-label', `Illustrative response curve at prior spend ${before} and carryover ${Math.round(carry * 100)} percent. Current spend ${now} gives response index ${at.toFixed(1)}.`);
  }

  function update() {
    const s = state();
    root.querySelector('#overview-current-value').textContent = s.now;
    root.querySelector('#overview-prior-value').textContent = s.before;
    root.querySelector('#overview-memory-value').textContent = `${Math.round(s.carry * 100)}%`;
    const at = response(s.now, s.before, s.carry);
    const next = response(Math.min(s.now + 10, 100), s.before, s.carry);
    readout.textContent = `At current spend ${s.now} and prior spend ${s.before}, the illustrative response index is ${at.toFixed(1)}. ${s.now < 100 ? `Raising current spend to ${Math.min(s.now + 10, 100)} adds ${(next - at).toFixed(1)} index points.` : 'Current spend is at the top of this scale.'}`;
    drawPlot(s);
    if (surface) {
      const positions = surface.geometry.attributes.position;
      for (let j = 0; j <= 20; j++) for (let i = 0; i <= 20; i++) {
        positions.setY(j * 21 + i, response(i * 5, j * 5, s.carry) * .055);
      }
      positions.needsUpdate = true;
      surface.geometry.computeVertexNormals();
      marker.position.set(s.now * .1 - 5, at * .055 + .13, s.before * .1 - 5);
      const points = Array.from({length: 51}, (_, i) => new THREE.Vector3(i * .2 - 5, response(i * 2, s.before, s.carry) * .055 + .08, s.before * .1 - 5));
      slice.geometry.dispose();
      slice.geometry = new THREE.BufferGeometry().setFromPoints(points);
      renderer.render(scene, camera);
    }
  }

  try {
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stage.append(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#102c39');
    camera = new THREE.PerspectiveCamera(44, 1, .1, 100);
    camera.position.set(12, 10, 14);
    camera.lookAt(0, 2, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x285266, 2.2));
    const light = new THREE.DirectionalLight(0xffffff, 1.8);
    light.position.set(4, 10, 8);
    scene.add(light);
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const triangles = [];
    for (let j = 0; j <= 20; j++) for (let i = 0; i <= 20; i++) vertices.push(i * .5 - 5, 0, j * .5 - 5);
    for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) {
      const a = j * 21 + i, b = a + 1, c = a + 21, d = c + 1;
      triangles.push(a, c, b, b, c, d);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(triangles);
    surface = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({color: 0x288e9d, side: THREE.DoubleSide, shininess: 55, transparent: true, opacity: .88}));
    scene.add(surface);
    const grid = new THREE.GridHelper(10, 10, 0x8aaeb7, 0x41606b);
    grid.position.y = -.04;
    scene.add(grid);
    marker = new THREE.Mesh(new THREE.SphereGeometry(.19, 16, 12), new THREE.MeshBasicMaterial({color: 0xffc879}));
    scene.add(marker);
    slice = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color: 0xffc879, linewidth: 2}));
    scene.add(slice);
    const resize = () => {
      const width = stage.clientWidth, height = stage.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    new ResizeObserver(resize).observe(stage);
    renderer.domElement.addEventListener('pointerdown', event => {dragging = true; renderer.domElement.setPointerCapture(event.pointerId);});
    renderer.domElement.addEventListener('pointerup', () => {dragging = false;});
    renderer.domElement.addEventListener('pointercancel', () => {dragging = false;});
    renderer.domElement.addEventListener('pointermove', event => {if (dragging) {yaw += event.movementX * .008; camera.position.set(18 * Math.sin(yaw + .72), 10, 18 * Math.cos(yaw + .72)); camera.lookAt(0, 2, 0); renderer.render(scene, camera);}});
    resize();
    const animate = time => {
      if (!paused && !dragging && !document.hidden) {
        const orbit = yaw + .72 + .11 * Math.sin((time - start) / 4500);
        camera.position.set(18 * Math.sin(orbit), 10, 18 * Math.cos(orbit));
        camera.lookAt(0, 2, 0);
        marker.scale.setScalar(1 + .16 * Math.sin(time / 300));
        renderer.render(scene, camera);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
  } catch (error) {
    stage.textContent = '3D preview unavailable. Use the sliders and line plot to inspect the response.';
    motionButton.hidden = true;
  }

  motionButton.textContent = paused ? 'Resume motion' : 'Pause motion';
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.addEventListener('click', () => {
    paused = !paused;
    motionButton.textContent = paused ? 'Resume motion' : 'Pause motion';
    motionButton.setAttribute('aria-pressed', String(paused));
    if (paused) marker?.scale.setScalar(1);
    if (renderer) renderer.render(scene, camera);
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) {paused = true; motionButton.textContent = 'Resume motion'; motionButton.setAttribute('aria-pressed', 'true');}
  });
  for (const input of [current, prior, memory]) input.addEventListener('input', update);
  update();
}
