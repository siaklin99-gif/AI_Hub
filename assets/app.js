/* ============================================================
   AI Hub — shared behaviour. Vanilla JS, no dependencies.
   Everything here is an enhancement: the pages work with JS off.
   ============================================================ */
(function () {
  'use strict';

  /* ---- mark the current page in the nav ---------------------- */
  /* Matches on the SLUG, not the filename, so the highlight survives a host
     that serves pretty URLs. "/trust.html", "/trust", "/trust/" and "/" all
     resolve correctly; previously only the ".html" forms did, and "/hub/trust/"
     wrongly lit up "Start". */
  function markCurrent() {
    var path = location.pathname.replace(/\/+$/, '');
    var last = path.split('/').pop();
    var here = (last || 'index').replace(/\.html$/, '');
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      var slug = (a.getAttribute('href') || '').replace(/\.html$/, '');
      if (slug === here) a.setAttribute('aria-current', 'page');
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

      /* The list's OWN progress block: walk forward from the list rather than
         querying the parent, which would hand two checklists in one card the
         same counter. */
      var progress = null;
      for (var sib = list.nextElementSibling; sib; sib = sib.nextElementSibling) {
        if (sib.classList && sib.classList.contains('progress')) { progress = sib; break; }
      }
      if (!progress && list.parentElement) progress = list.parentElement.querySelector('.progress');
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

  /* Each step is isolated. Previously a throw anywhere in wireChecklists()
     — the localStorage access is the realistic candidate, e.g. Safari private
     browsing — escaped init() and silently killed every copy button on the
     page. One broken feature must not take the others down. */
  function init() {
    var steps = [markCurrent, wireAccTools, wireChecklists, wireCopy];
    for (var i = 0; i < steps.length; i++) {
      try { steps[i](); } catch (e) { if (window.console) console.error('AI Hub: ' + steps[i].name + ' failed', e); }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
