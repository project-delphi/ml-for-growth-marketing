import * as THREE from '../vendor/three.module.js';

const lab = document.querySelector('.customer-lab');
if (lab) init().catch(error => {
  lab.querySelector('.readout').textContent = `Could not load this interactive: ${error.message}`;
});

async function init() {
  const data = await fetch(new URL('./customer-data.json', import.meta.url)).then(response => {
    if (!response.ok) throw new Error(`data request ${response.status}`);
    return response.json();
  });
  const page = lab.dataset.page;
  const viz = lab.querySelector('.viz');
  const output = lab.querySelector('.readout');
  const inputs = [...lab.querySelectorAll('input, select')];
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  viz.append(renderer.domElement);
  scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(4, 9, 7);
  scene.add(light);
  const group = new THREE.Group();
  scene.add(group);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshBasicMaterial({ color: 0x8997a5, transparent: true, opacity: .12, side: THREE.DoubleSide }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.04;
  scene.add(ground);
  let yaw = .7, pitch = .68, dragging = false, lastX = 0, lastY = 0;
  function aim() {
    camera.position.set(12 * Math.sin(yaw) * Math.cos(pitch), 12 * Math.sin(pitch), 12 * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(0, 1.25, 0);
  }
  aim();
  viz.addEventListener('pointerdown', event => { dragging = true; lastX = event.clientX; lastY = event.clientY; viz.setPointerCapture(event.pointerId); });
  viz.addEventListener('pointermove', event => {
    if (!dragging) return;
    yaw += (event.clientX - lastX) * .008;
    pitch = Math.max(.15, Math.min(1.35, pitch + (event.clientY - lastY) * .008));
    lastX = event.clientX; lastY = event.clientY; aim(); render();
  });
  viz.addEventListener('pointerup', () => { dragging = false; });
  viz.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') yaw -= .15;
    if (event.key === 'ArrowRight') yaw += .15;
    if (event.key === 'ArrowUp') pitch = Math.min(1.35, pitch + .12);
    if (event.key === 'ArrowDown') pitch = Math.max(.15, pitch - .12);
    aim(); render();
  });
  const resize = new ResizeObserver(() => {
    const width = Math.max(200, viz.clientWidth), height = Math.max(200, viz.clientHeight);
    renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); render();
  });
  resize.observe(viz);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .65 });
  function clear() {
    for (const child of [...group.children]) { group.remove(child); child.geometry.dispose(); child.material.dispose(); }
  }
  function bar(x, z, height, color, width = .7, depth = .7) {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(width, Math.max(.025, height), depth), material(color));
    cube.position.set(x, Math.max(.025, height) / 2, z); group.add(cube);
  }
  function render() { renderer.render(scene, camera); }
  function text(html) { output.innerHTML = html; }
  function val(id) { return Number(lab.querySelector(`#${id}`).value); }
  function currency(x) { return `$${x.toFixed(2)}`; }
  function update() {
    clear();
    if (page === '01') {
      const cutoff = val('cutoff');
      let flagged = 0, holdout = 0;
      for (const cell of data.cdnow.cells) {
        const silence = [2, 8, 18, 32, 44][cell.s];
        const selected = silence >= cutoff;
        if (selected) { flagged += cell.n; holdout += cell.holdout; }
        bar((cell.f - 2) * 1.15, (cell.s - 2) * 1.15, Math.sqrt(cell.n) / 3, selected ? 0xe08a49 : 0x398eaa);
      }
      text(`<p><strong>${flagged.toLocaleString()} of ${data.cdnow.customers.toLocaleString()}</strong> CDNOW customers fall in cells flagged by the ${cutoff}-week silence rule. Those cells went on to make ${holdout.toLocaleString()} purchases in the 39-week holdout.</p><p>This is a coarse grouped view: the cutoff acts on each cell's representative silence, so counts are approximate. A later purchase proves the rule can flag a returning buyer; it does not reveal who had truly churned.</p>`);
    } else if (page === '02') {
      const threshold = val('probability') / 100;
      const model = lab.querySelector('#model').value;
      let target = 0, purchases = 0;
      for (const cell of data.cdnow.cells) {
        const x = cell.x, T = cell.T, tx = cell.tx;
        let probability;
        if (model === 'bgnbd') {
          probability = x === 0 ? 1 : 1 / (1 + .793 / (2.4262 + x - 1) * ((4.4136 + T) / (4.4136 + tx)) ** (.2426 + x));
        } else {
          const rate = .05 + .05;
          probability = 1 / (1 + .05 / rate * Math.expm1(rate * (T - tx)));
        }
        const selected = probability < threshold;
        if (selected) { target += cell.n; purchases += cell.holdout; }
        bar((cell.f - 2) * 1.15, (cell.s - 2) * 1.15, Math.sqrt(cell.n) / 3, selected ? 0xe08a49 : 0x398eaa);
      }
      text(`<p><strong>${target.toLocaleString()}</strong> CDNOW customers fall in cells below P(alive) ${threshold.toFixed(2)} and would enter a win-back audience. Those cells made ${purchases.toLocaleString()} purchases in the later 39-week holdout.</p><p>${model === 'bgnbd' ? 'BG/NBD uses the published CDNOW point estimates r = 0.243, α = 4.414, a = 0.793, b = 2.426.' : 'Pareto/NBD uses illustrative fixed rates λ = μ = 0.05 per week, not a fitted CDNOW model.'} Probabilities are evaluated on cell averages, so audience counts are illustrative rather than exact individual predictions.</p>`);
    } else if (page === '03') {
      const factor = val('dropout') / 100;
      const useChannel = lab.querySelector('#channel-effect').checked;
      const groups = ['search', 'social', 'referral'];
      const pooledLambda = groups.reduce((a, c) => a + data.retailer[c].lambda * data.retailer[c].n, 0) / 5000;
      const pooledMu = groups.reduce((a, c) => a + data.retailer[c].mu * data.retailer[c].n, 0) / 5000;
      const pooledAlive = groups.reduce((a, c) => a + data.retailer[c].alive, 0) / 5000;
      const summary = groups.map((name, i) => {
        const row = data.retailer[name];
        const lambda = useChannel ? row.lambda : pooledLambda;
        const mu = (useChannel ? row.mu : pooledMu) * (name === 'social' ? factor : 1);
        const aliveShare = useChannel ? row.alive / row.n : pooledAlive;
        const predicted = aliveShare * lambda / mu * (1 - Math.exp(-mu * 13));
        bar((i - 1) * 2.3 - .42, 0, predicted * 3, 0x398eaa, .75, .9);
        bar((i - 1) * 2.3 + .42, 0, row.holdout13 * 3, 0xe08a49, .75, .9);
        return `${name}: forecast ${predicted.toFixed(2)}, observed ${row.holdout13.toFixed(2)}`;
      });
      text(`<p><strong>13-week purchases per acquired customer</strong> — ${summary.join('; ')}.</p><p>The blue forecast uses the synthetic generator's known purchase and dropout rates and known alive share; orange is the observed holdout. The ${useChannel ? 'channel-specific' : 'pooled'} scenario and ${factor.toFixed(2)}× social dropout multiplier are teaching counterfactuals, not new model fits. Referral has the highest forecast and would be the first channel to investigate for acquisition value.</p>`);
    } else if (page === '04') {
      const horizon = val('horizon'), discount = val('discount') / 1000, margin = val('margin') / 100;
      const groups = ['search', 'social', 'referral'];
      const result = groups.map((name, i) => {
        const row = data.retailer[name];
        let value = 0;
        for (let m = 1; m <= horizon; m++) {
          const weeks = m * 365.25 / 12 / 7;
          value += row.alive / row.n * row.lambda * 365.25 / 12 / 7 * Math.exp(-row.mu * weeks) * row.spend * margin / (1 + discount) ** m;
        }
        bar((i - 1) * 2.25, 0, value / 12, [0x398eaa, 0xe08a49, 0x7b69a8][i], 1.05, 1.05);
        return { name, value };
      });
      const best = result.reduce((a, b) => a.value > b.value ? a : b);
      text(`<p><strong>Discounted ${horizon}-month margin per acquired customer:</strong> ${result.map(x => `${x.name} ${currency(x.value)}`).join('; ')}. ${best.name} is highest under these assumptions.</p><p>The bars use known synthetic purchase and dropout rates and mean spend, then discount each month's expected margin. This is an illustrative expectation from the generator, not a Gamma-Gamma posterior or a confidence interval. Changing the horizon, monthly discount rate, or margin changes the implied retention value.</p>`);
    } else if (page === '05') {
      const channel = lab.querySelector('#cac-channel').value, cac = val('cac');
      const risk = lab.querySelector('#risk-rule').value;
      const caps = { search: [51.12, 49.69], social: [32.65, 31.79], referral: [69.30, 66.40] };
      const current = { search: 45, social: 32, referral: 55 };
      const cap = caps[channel][risk === 'mean' ? 0 : 1];
      bar(-1.25, 0, cap / 15, 0x398eaa, 1.3, 1.2);
      bar(1.25, 0, cac / 15, 0xe08a49, 1.3, 1.2);
      text(`<p><strong>${channel}:</strong> ${risk === 'mean' ? 'mean' : '20th percentile'} CAC cap ${currency(cap)}; proposed CAC ${currency(cac)}. <strong>${cac <= cap ? 'Acquire at this average cost' : 'Do not acquire at this average cost'}</strong> under this rule. Room to the cap: ${currency(cap - cac)} per acquired customer.</p><p>The cap is from the Module 5 FULL lab run on the synthetic retailer; ${currency(current[channel])} was that lab's assumed current CAC. Moving the proposed CAC is a business scenario, not a model refit. The cap concerns the average acquired customer; the next customer's marginal cost may differ.</p>`);
    }
    for (const input of inputs) {
      const target = lab.querySelector(`[data-value-for="${input.id}"]`);
      if (target) target.textContent = input.type === 'range' ? input.value : '';
    }
    render();
  }
  inputs.forEach(input => input.addEventListener('input', update));
  if (page === '05') lab.querySelector('#cac-channel').addEventListener('change', () => {
    lab.querySelector('#cac').value = { search: 45, social: 32, referral: 55 }[lab.querySelector('#cac-channel').value];
    update();
  });
  update();
}
