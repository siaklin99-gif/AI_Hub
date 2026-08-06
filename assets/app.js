/* ============================================================
   AI Hub — shared behaviour. Vanilla JS, no dependencies.
   Everything here is an enhancement: the pages work with JS off.
   ============================================================ */
(function () {
  'use strict';

  /* ---- mark the current page in the nav ---------------------- */
  function markCurrent() {
    var here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href === here) a.setAttribute('aria-current', 'page');
    });
  }

  /* ---- expand / collapse all inside a section ----------------- */
  function wireAccTools() {
    document.querySelectorAll('.acc-tools').forEach(function (tools) {
      var scope = tools.closest('section') || document;
      tools.querySelectorAll('button[data-acc]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var open = btn.getAttribute('data-acc') === 'open';
          scope.querySelectorAll('details.acc').forEach(function (d) { d.open = open; });
        });
      });
    });
  }

  /* ---- checklists that remember what you ticked --------------- */
  function storeKey(id) { return 'aihub:check:' + id; }

  function wireChecklists() {
    document.querySelectorAll('.checklist').forEach(function (list) {
      var boxes = Array.prototype.slice.call(list.querySelectorAll('input[type=checkbox]'));
      if (!boxes.length) return;

      var wrapEl = list.parentElement;
      var progress = wrapEl ? wrapEl.querySelector('.progress') : null;
      var barFill = progress ? progress.querySelector('.bar > i') : null;
      var count = progress ? progress.querySelector('[data-count]') : null;

      function paint() {
        var done = boxes.filter(function (b) { return b.checked; }).length;
        if (count) count.textContent = done + ' of ' + boxes.length;
        if (barFill) barFill.style.width = (boxes.length ? (done / boxes.length) * 100 : 0) + '%';
      }

      boxes.forEach(function (box) {
        if (!box.id) return;
        try {
          if (localStorage.getItem(storeKey(box.id)) === '1') box.checked = true;
        } catch (e) { /* private mode — ticking still works, just isn't saved */ }
        box.addEventListener('change', function () {
          try {
            if (box.checked) localStorage.setItem(storeKey(box.id), '1');
            else localStorage.removeItem(storeKey(box.id));
          } catch (e) { /* ignore */ }
          paint();
        });
      });

      var reset = progress ? progress.querySelector('.reset-btn') : null;
      if (reset) {
        reset.addEventListener('click', function () {
          boxes.forEach(function (b) {
            b.checked = false;
            try { localStorage.removeItem(storeKey(b.id)); } catch (e) { /* ignore */ }
          });
          paint();
        });
      }

      paint();
    });
  }

  /* ---- copy buttons on prompt templates ----------------------- */
  function wireCopy() {
    document.querySelectorAll('.prompt-wrap').forEach(function (w) {
      var pre = w.querySelector('.prompt');
      var btn = w.querySelector('.copy-btn');
      if (!pre || !btn) return;
      btn.addEventListener('click', function () {
        var text = pre.textContent;
        var done = function () {
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { btn.textContent = 'Select it'; });
        } else {
          var r = document.createRange();
          r.selectNodeContents(pre);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
          btn.textContent = 'Selected';
        }
      });
    });
  }

  function init() {
    markCurrent();
    wireAccTools();
    wireChecklists();
    wireCopy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
