/* Row expansion and hover-driven Anatomy motion. No runtime dependencies. */
document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('#projects');
  if (!section) return;
  const container = section.querySelector('.projects-container');
  const items = [...container.querySelectorAll('.project-item')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 680px)');
  const touch = matchMedia('(hover: none), (pointer: coarse), (max-width: 680px)');
  const rows = [];
  let frame = 0, last = 0, scrollTimer = 0;

  // Keep each pair in its own row so the neighboring project can slide away
  // without unrelated cards jumping into a different row.
  for (let index = 0; index < items.length;) {
    const row = document.createElement('div');
    row.className = index === 0 ? 'project-row single' : 'project-row';
    const count = index === 0 ? 1 : 2;
    items.slice(index, index + count).forEach(item => row.append(item));
    container.append(row);
    rows.push(row);
    index += count;
  }
  container.classList.add('has-project-rows');

  function syncRows() {
    rows.forEach(row => {
      const active = row.querySelector('.project-item.open');
      row.classList.toggle('has-open', Boolean(active));
      [...row.children].forEach(item => {
        const aside = Boolean(active && active !== item && !narrow.matches);
        item.classList.toggle('row-aside', aside);
        item.inert = aside;
        if (aside) item.setAttribute('aria-hidden','true');
        else item.removeAttribute('aria-hidden');
      });
    });
  }

  function setState(item, expanded) {
    item.classList.toggle('open', expanded);
    item.querySelector('.project-cover').setAttribute('aria-expanded', String(expanded));
    const panel = item.querySelector('.project-content');
    panel.inert = !expanded;
    panel.setAttribute('aria-hidden', String(!expanded));
    item.querySelector('.project-close').hidden = !expanded;
    if (!expanded) item.querySelectorAll('video').forEach(video => video.pause());
  }
  function close(item, restoreFocus = false) {
    clearTimeout(scrollTimer);
    setState(item, false);
    syncRows();
    updateMotion();
    if (restoreFocus) item.querySelector('.project-cover').focus({preventScroll:true});
  }
  function open(item) {
    clearTimeout(scrollTimer);
    items.forEach(other => setState(other, other === item));
    syncRows();
    updateMotion();
    // Let the row finish its horizontal movement before adjusting the viewport.
    scrollTimer = setTimeout(() => {
      const top = item.getBoundingClientRect().top;
      if (top < 70 || top > innerHeight * .7) item.scrollIntoView({block:'start',behavior:reduced.matches?'auto':'smooth'});
    }, reduced.matches ? 0 : 560);
  }
  items.forEach(item => {
    const panel = item.querySelector('.project-content');
    const inner = document.createElement('div');
    inner.className = 'project-content-inner';
    while (panel.firstChild) inner.append(panel.firstChild);
    panel.append(inner);
    const closeButton = panel.querySelector('.project-close');
    item.append(closeButton);
    panel.hidden = false;
    setState(item, false);
    item.querySelector('.project-cover').addEventListener('click', () => {
      item.classList.contains('open') ? close(item) : open(item);
    });
    closeButton.addEventListener('click', () => close(item,true));
    item.addEventListener('keydown', event => {
      if (event.key === 'Escape' && item.classList.contains('open') && !document.fullscreenElement) {
        close(item,true);
        event.stopPropagation();
      }
    });
    item.querySelectorAll('video').forEach(video => video.addEventListener('play', () => {
      if (!item.classList.contains('open')) video.pause();
    }));
  });

  const art = items.map(item => ({
    item, element:item.querySelector('.project-art'), visible:false, hovered:false, keyboard:false, time:.5,
    fluid:item.querySelector('[data-motion="electrolyte"]'),
    meniscus:item.querySelector('[data-motion="meniscus"]'),
    spindle:item.querySelector('[data-motion="spindle"]'),
    pistons:[...item.querySelectorAll('[data-motion="piston"]')],
  }));
  const active = model => !document.hidden && !reduced.matches && model.visible &&
    !model.item.classList.contains('open') && !model.item.inert && (touch.matches || model.hovered || model.keyboard);
  function paint(model, still = false) {
    if (model.fluid) {
      const phase = model.time % 16;
      const progress = still ? .56 : Math.min(1,phase/12);
      const y = 110 - Math.sqrt(progress)*103;
      model.fluid.setAttribute('y',y.toFixed(2));
      model.fluid.setAttribute('height',(170-y).toFixed(2));
      model.meniscus.setAttribute('d','M0 '+y.toFixed(2)+'H130');
      const alpha = phase > 14 ? 1-(phase-14)/2 : Math.min(1,phase*2);
      model.fluid.setAttribute('opacity',still?'.84':(.84*alpha).toFixed(3));
      model.meniscus.setAttribute('opacity',still?'1':alpha.toFixed(3));
    }
    if (model.spindle) model.spindle.setAttribute('transform','rotate('+(still?30:model.time*70)+')');
    model.pistons.forEach(piston => {
      const phase = Number(piston.dataset.phase)*Math.PI;
      const offset = 10*Math.sin((still?.8:model.time*1.4)+phase);
      piston.setAttribute('transform','translate('+(Number(piston.dataset.vx)*offset)+' '+(Number(piston.dataset.vy)*offset)+')');
    });
  }
  function tick(now) {
    const dt = last ? Math.min((now-last)/1000,.05) : 0;
    last = now;
    art.forEach(model => {
      if (!active(model)) return;
      model.time += dt;
      paint(model);
    });
    frame = art.some(active) ? requestAnimationFrame(tick) : 0;
  }
  function updateMotion() {
    art.forEach(model => model.element.dataset.animating = String(active(model)));
    if (!art.some(active) && frame) { cancelAnimationFrame(frame); frame=0; }
    if (art.some(active) && !frame) { last=0; frame=requestAnimationFrame(tick); }
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const model = art.find(value => value.element === entry.target);
      if (model) model.visible = entry.isIntersecting;
    });
    updateMotion();
  },{rootMargin:'60px 0px'});
  art.forEach(model => {
    paint(model);
    observer.observe(model.element);
    model.item.addEventListener('pointerenter', () => { model.hovered=true; updateMotion(); });
    model.item.addEventListener('pointerleave', () => { model.hovered=false; updateMotion(); });
    model.item.addEventListener('focusin', event => { model.keyboard=event.target.matches(':focus-visible'); updateMotion(); });
    model.item.addEventListener('focusout', event => {
      if (!model.item.contains(event.relatedTarget)) { model.keyboard=false; updateMotion(); }
    });
  });
  narrow.addEventListener('change', () => { syncRows(); updateMotion(); });
  touch.addEventListener('change',updateMotion);
  reduced.addEventListener('change',updateMotion);
  document.addEventListener('visibilitychange',updateMotion);
  updateMotion();
});
