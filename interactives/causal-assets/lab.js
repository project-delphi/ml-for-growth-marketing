import * as THREE from '../vendor/three.module.js';

const root = document.querySelector('.causal-lab');
const plot = root.querySelector('.causal-plot');
const result = root.querySelector('.causal-result');
const data = await fetch(new URL('./data.json', import.meta.url)).then(r => {
  if (!r.ok) throw new Error(`Data request failed: ${r.status}`);
  return r.json();
});
const $ = id => root.querySelector(`#${id}`);
const fmt = (n, digits = 0) => Number(n).toLocaleString('en-US', {maximumFractionDigits: digits, minimumFractionDigits: digits});
const dollar = n => `$${fmt(n, Math.abs(n) < 100 ? 2 : 0)}`;

class Plot3D {
  constructor() {
    try { this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true}); }
    catch (err) { plot.innerHTML = `<p class="causal-plot-error">3D view unavailable in this browser. The calculations below still work.</p>`; return; }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    plot.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
    this.camera.position.set(16, 12, 19);
    this.camera.lookAt(0, 3, 0);
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.7));
    const light = new THREE.DirectionalLight(0xffffff, 1.4); light.position.set(7, 13, 9); this.scene.add(light);
    const grid = new THREE.GridHelper(20, 10, 0x6684a9, 0x405370); this.scene.add(grid);
    this.yaw = 0; this.pitch = 0;
    let down = null;
    this.renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; this.renderer.domElement.setPointerCapture(e.pointerId); });
    this.renderer.domElement.addEventListener('pointermove', e => { if (!down) return; this.yaw += (e.clientX - down[0]) * .008; this.pitch = Math.max(-.5, Math.min(.5, this.pitch + (e.clientY - down[1]) * .005)); down = [e.clientX, e.clientY]; this.group.rotation.y = this.yaw; this.group.rotation.x = this.pitch; this.render(); });
    this.renderer.domElement.addEventListener('pointerup', () => { down = null; });
    this.renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); this.camera.position.multiplyScalar(e.deltaY > 0 ? 1.07 : .93); this.render(); }, {passive: false});
    new ResizeObserver(() => this.resize()).observe(plot); this.resize();
  }
  resize() { if (!this.renderer) return; const w = plot.clientWidth, h = plot.clientHeight; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); this.render(); }
  clear() { if (!this.renderer) return; for (const object of [...this.group.children]) { this.group.remove(object); object.geometry?.dispose(); object.material?.dispose(); } }
  bars(series, ceiling) {
    if (!this.renderer) return;
    this.clear();
    const colors = [0x4ab9e5, 0xffc66a, 0xa4d97d, 0xd99eff];
    const count = Math.max(...series.map(s => s.length));
    series.forEach((s, j) => s.forEach((v, i) => {
      const height = Math.max(.015, 8 * Math.abs(v) / ceiling);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.07, 17 / count * .68), height, .75), new THREE.MeshLambertMaterial({color: colors[j % colors.length]}));
      bar.position.set(-8.5 + 17 * i / Math.max(1, count - 1), height / 2, (j - (series.length - 1) / 2) * 2.1);
      this.group.add(bar);
    }));
    this.render();
  }
  lines(series, ceiling) {
    if (!this.renderer) return;
    this.clear();
    const colors = [0x4ab9e5, 0xffc66a, 0xa4d97d, 0xd99eff];
    const count = Math.max(...series.map(s => s.length));
    series.forEach((s, j) => {
      const points = s.map((v, i) => new THREE.Vector3(-8.5 + 17 * i / Math.max(1, count - 1), Math.max(0, 8 * v / ceiling), (j - (series.length - 1) / 2) * 2.2));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      this.group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({color: colors[j % colors.length], linewidth: 2})));
      for (let i = 0; i < points.length; i += Math.max(1, Math.floor(count / 25))) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(.11, 8, 8), new THREE.MeshBasicMaterial({color: colors[j % colors.length]}));
        dot.position.copy(points[i]); this.group.add(dot);
      }
    });
    this.render();
  }
  marker(fraction, value, seriesIndex, seriesCount, ceiling) {
    if (!this.renderer) return;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.27, 14, 10), new THREE.MeshBasicMaterial({color: 0xffffff}));
    dot.position.set(-8.5 + 17 * fraction, 8 * value / ceiling, (seriesIndex - (seriesCount - 1) / 2) * 2.2);
    this.group.add(dot); this.render();
  }
  render() { this.renderer?.render(this.scene, this.camera); }
}

const chart = new Plot3D();
const response = (spend, p) => p.saturation_beta_sales_units * Math.tanh(p.saturation_lam * spend / p.channel_scale / 2);
const channels = ['tv', 'search', 'social', 'display'];

function experiments() {
  const {arms, truth} = data.experiment;
  const n = +$('n').value, margin = +$('margin').value / 100, cost = +$('cost').value;
  const effect = arms[1].mean - arms[0].mean;
  const se = Math.hypot(arms[1].sd / Math.sqrt(n), arms[0].sd / Math.sqrt(n));
  const lo = effect - 1.96 * se, hi = effect + 1.96 * se;
  const net = margin * effect - cost, lowNet = margin * lo - cost;
  const costs = Array.from({length: 15}, (_, i) => i * .10);
  chart.bars([costs.map(c => Math.max(0, margin * lo - c)), costs.map(c => Math.max(0, margin * effect - c))], Math.max(1, margin * hi));
  result.innerHTML = `<p><strong>Observed effect:</strong> ${dollar(effect)} spend per person; illustrative 95% confidence interval ${dollar(lo)} to ${dollar(hi)} at ${fmt(n)} people per arm.</p><p><strong>Decision:</strong> ${lowNet > 0 ? 'Roll out' : 'Keep testing'} under the stated rule: the lower bound of incremental margin ${dollar(lowNet)} ${lowNet > 0 ? 'clears' : 'does not clear'} zero. Point estimate of net margin is ${dollar(net)} per email.</p>`;
  $('n-out').textContent = fmt(n); $('margin-out').textContent = `${fmt(margin * 100)}%`; $('cost-out').textContent = dollar(cost);
}

function geo() {
  const state = $('donor').value, cut = +$('cut').value, years = data.prop99.years;
  const ca = data.prop99.series.California, donor = data.prop99.series[state];
  const pre = years.map((y, i) => y < cut ? ca[i] - donor[i] : null).filter(x => x !== null);
  const offset = pre.reduce((a, b) => a + b, 0) / pre.length;
  const counter = donor.map(x => x + offset);
  const gap = ca.at(-1) - counter.at(-1);
  chart.lines([ca, counter], 160);
  result.innerHTML = `<p><strong>Year 2000:</strong> California ${fmt(ca.at(-1), 1)} versus ${state} shifted by its mean pre-${cut} gap, ${fmt(counter.at(-1), 1)} packs per person; gap ${fmt(gap, 1)}.</p><p><strong>Decision:</strong> ${gap < 0 ? 'Investigate the decline with a proper synthetic control and placebo tests.' : 'This donor does not show a negative year-2000 gap; test other controls.'} One arbitrarily selected donor is not a causal estimate.</p>`;
  $('cut-out').textContent = cut;
}

function mmm() {
  const c = $('channel').value, alpha = +$('alpha').value / 100, lam = +$('lambda').value / 10;
  const spend = data.mmm.spend[c], p = data.mmm.channels[c];
  const weights = Array.from({length: 8}, (_, i) => alpha ** i); const norm = weights.reduce((a,b) => a+b, 0);
  const contribution = spend.map((_, t) => {
    const adstock = weights.reduce((s, w, l) => s + w * (spend[t - l] || 0), 0) / norm;
    return p.saturation_beta_sales_units * Math.tanh(lam * adstock / p.channel_scale / 2);
  });
  const roi = contribution.reduce((a,b) => a+b, 0) / spend.reduce((a,b) => a+b, 0);
  chart.lines([spend.filter((_,i) => i % 4 === 0), contribution.filter((_,i) => i % 4 === 0)], Math.max(...spend, ...contribution));
  result.innerHTML = `<p><strong>Scenario:</strong> ${c} decay ${fmt(alpha, 2)}, saturation ${fmt(lam, 1)}. Over the 156 committed synthetic weeks, transformed contribution ÷ spend is ${fmt(roi, 2)} sales dollars per media dollar.</p><p><strong>Decision:</strong> At 30% gross margin, break-even is 3.33. This scenario ${roi >= 1/.3 ? 'clears' : 'falls below'} it. The sliders change assumed model parameters; they do not refit a model or change observed sales.</p>`;
  $('alpha-out').textContent = fmt(alpha, 2); $('lambda-out').textContent = fmt(lam, 1);
}

function calibration() {
  const w = +$('evidence').value / 100, margin = +$('margin').value / 100;
  const uncalibrated = 5.38, calibrated = 3.07, truth = 3.0;
  const roas = uncalibrated * (1 - w) + calibrated * w;
  const breakEven = 1 / margin;
  chart.lines([Array.from({length: 21}, (_, i) => uncalibrated * (1 - i/20) + calibrated * i/20), Array(21).fill(breakEven), Array(21).fill(truth)], 7);
  chart.marker(w, roas, 0, 3, 7);
  result.innerHTML = `<p><strong>Illustrative evidence path:</strong> search ROAS ${fmt(roas, 2)} versus break-even ${fmt(breakEven, 2)} at ${fmt(margin * 100)}% margin. The endpoints are measured workshop fits: 5.38 uncalibrated and 3.07 after two search lift tests; true synthetic ROAS is 3.00.</p><p><strong>Decision:</strong> ${roas > breakEven ? 'The point estimate says search pays back.' : 'The point estimate says search does not pay back.'} Intermediate positions only interpolate the two fits; they are not additional fits or uncertainty estimates.</p>`;
  $('evidence-out').textContent = `${fmt(w * 100)}%`; $('margin-out').textContent = `${fmt(margin * 100)}%`;
}

function allocation() {
  const budget = +$('budget').value * 1000, clvWeight = +$('clv').value / 100;
  const p = data.mmm.channels, bounds = data.mmm.allocation.bounds;
  const future = data.mmm.value.long_run_optimal_allocation.mmm.long_run_value_per_dollar_of_new_customers;
  const plan = Object.fromEntries(channels.map(c => [c, bounds[c][0]]));
  let left = budget - channels.reduce((s,c) => s + plan[c], 0);
  // Greedy $20 transfers approximate the optimum of these concave response curves.
  while (left > .01) {
    let best = null, slope = -Infinity;
    for (const c of channels) {
      if (plan[c] >= bounds[c][1] - .01) continue;
      const step = Math.min(20, left, bounds[c][1] - plan[c]);
      const value = .3 * (response(plan[c] + step, p[c]) - response(plan[c], p[c])) / step + clvWeight * future[c];
      if (value > slope) { slope = value; best = c; }
    }
    if (!best) break;
    const step = Math.min(20, left, bounds[best][1] - plan[best]); plan[best] += step; left -= step;
  }
  const gain = channels.reduce((s,c) => s + response(plan[c], p[c]) - response(data.mmm.allocation.current_allocation[c], p[c]), 0);
  const curves = channels.map(c => Array.from({length: 21}, (_, i) => response(bounds[c][0] + i/20 * (bounds[c][1] - bounds[c][0]), p[c])));
  chart.lines(curves, 160000);
  channels.forEach((c, i) => chart.marker((plan[c] - bounds[c][0]) / (bounds[c][1] - bounds[c][0]), response(plan[c], p[c]), i, 4, 160000));
  result.innerHTML = `<p><strong>Weekly split:</strong> ${channels.map(c => `${c} ${dollar(plan[c])}`).join(' · ')}. Against the committed current plan, modeled short-run sales change ${dollar(gain)} per week.</p><p><strong>Decision:</strong> ${clvWeight ? 'The objective adds a weighted estimate of future customer margin to short-run margin.' : 'The objective uses short-run margin only.'} This optimizer uses the synthetic world's true response curves and fixed bounds; its plan is an illustration, not a new posterior fit.</p>`;
  $('budget-out').textContent = dollar(budget); $('clv-out').textContent = `${fmt(clvWeight * 100)}%`;
}

const handlers = {experiments, geo, mmm, calibration, allocation};
const update = handlers[root.dataset.lab];
root.querySelectorAll('input, select').forEach(el => el.addEventListener('input', update));
update();
