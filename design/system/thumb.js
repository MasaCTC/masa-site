/* Sliding thumb — reference behaviour for Tabs and the dock NavBar. */
function mnThumb(container, getTarget) {
  var thumb = container.querySelector(':scope > .mn-thumb');
  if (!thumb) { thumb = document.createElement('span'); thumb.className = 'mn-thumb'; thumb.setAttribute('aria-hidden', 'true'); container.prepend(thumb); }
  function place() {
    var el = getTarget(); if (!el) return;
    var c = container.getBoundingClientRect(), r = el.getBoundingClientRect();
    thumb.style.setProperty('--thumb-x', (r.left - c.left - container.clientLeft) + 'px');
    thumb.style.setProperty('--thumb-y', (r.top - c.top - container.clientTop) + 'px');
    thumb.style.setProperty('--thumb-w', r.width + 'px');
    thumb.style.setProperty('--thumb-h', r.height + 'px');
  }
  container.classList.add('has-thumb');
  place();
  requestAnimationFrame(function () { container.classList.add('is-thumb-ready'); });
  new ResizeObserver(place).observe(container);
  if (document.fonts) document.fonts.ready.then(place);
  return place;
}
