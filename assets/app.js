/* ============================================================
   AI Hub — shared behaviour. Vanilla JS, no dependencies.
   Everything here is an enhancement: the pages work with JS off.
   ============================================================ */
(function () {
  'use strict';

  /* ---- mark the current page in the nav ---------------------- */
  /* Reduce BOTH the current URL and each link to the same slug, then compare.
     Reducing only one side was the bug: a host that serves pretty URLs rewrites
     href="map.html" into href="/hub/map", so the link side became a path while
     the location side was already a bare slug, and nothing ever matched — the
     nav highlight was dead on every deployed page while working from the
     filesystem. "/hub/", "/hub/map", "map.html", "/trust/" and "/" all reduce
     correctly now. */
  function slugOf(u) {
    var s = String(u || '').split(/[?#]/)[0].replace(/\/+$/, '');
    var last = s.split('/').pop();
    return (last || 'index').replace(/\.html$/, '');
  }

  function markCurrent() {
    var here = slugOf(location.pathname);
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      if (slugOf(a.getAttribute('href')) === here) a.setAttribute('aria-current', 'page');
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
  /* ---- aggregate usage counting ------------------------------
     WHY: the site had no feedback loop at all, so there was no way to tell
     "good page nobody found" from "found it, stopped at screen three" — the
     single biggest unknown after a five-persona reading panel.

     WHAT IS SENT: one of the names below, and nothing else. No cookie, no
     identifier, no IP, no referrer, no timestamp finer than the server's day
     bucket, no per-visitor record of any kind. The server increments an
     integer. Every number is public at
     /.netlify/functions/tally?site=hub — a page about verification should
     show its own workings.

     GATED: only on hlur.ai. Opened from a file, a fork, or a mirror it stays
     silent. Fails soft, always: a counter must never break the page. */
  var TALLY = ['load', 'deep', 'copy', 'check'];

  function tally(name) {
    try {
      if (location.hostname !== 'hlur.ai') return;
      if (TALLY.indexOf(String(name).split(':').pop()) === -1) return;
      var body = JSON.stringify({ e: name, s: 'hub' });
      var url = '/.netlify/functions/tally';
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(url, { method: 'POST', body: body, keepalive: true }).catch(function () {});
      }
    } catch (e) { /* never let counting break anything */ }
  }

  /* page slug from the URL, reduced the same way the nav highlight is, so a
     host serving pretty URLs does not produce a second set of event names */
  function pageSlug() { return slugOf(location.pathname); }

  function wireTally() {
    tally(pageSlug() + ':load');

    /* "deep" = the reader got past 75% of the page. This is the number that
       answers the question the panel could only guess at: do people reach the
       later sections? Fires at most once. */
    var deepSent = false;
    var onScroll = function () {
      if (deepSent) return;
      var doc = document.documentElement;
      var seen = window.scrollY + window.innerHeight;
      if (doc.scrollHeight > 0 && seen / doc.scrollHeight >= 0.75) {
        deepSent = true;
        tally(pageSlug() + ':deep');
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    document.querySelectorAll('.copy-btn').forEach(function (b) {
      b.addEventListener('click', function () { tally('copy'); });
    });
    var ticked = false;
    document.querySelectorAll('.checklist input[type=checkbox]').forEach(function (box) {
      box.addEventListener('change', function () {
        if (ticked || !box.checked) return;
        ticked = true;                 // one per page load, not one per box
        tally('check');
      });
    });
  }

  /* ---- swipe-deck progress dots ---------------------------------------------
     On a phone the card grids and numbered steps become horizontal scroll-snap
     decks (see the mobile block in style.css). A row that scrolls sideways gives
     no hint of how much is left, so each deck gets a dot per card with the
     current one widened.

     Dots are added ONLY when the deck actually overflows. On a desktop the same
     markup is a normal grid that does not scroll, and a dot row there would be
     furniture that lies about the interface. Re-checked on resize and on
     orientation change for the same reason.

     The scroll listener is rAF-throttled: a snap scroll fires this continuously,
     and recomputing on every event janks exactly the phones this site is for. */
  function wireDecks() {
    var decks = document.querySelectorAll('.grid-2, .grid-3, .steps, .wk-deck, .acc-deck');

    function sync(deck, dots) {
      var kids = deck.children, x = deck.scrollLeft, best = 0, bestD = Infinity;
      for (var i = 0; i < kids.length; i++) {
        var d = Math.abs(kids[i].offsetLeft - deck.offsetLeft - x);
        if (d < bestD) { bestD = d; best = i; }
      }
      for (var j = 0; j < dots.children.length; j++) {
        dots.children[j].className = (j === best) ? 'on' : '';
      }
    }

    for (var i = 0; i < decks.length; i++) {
      (function (deck) {
        var dots = null, ticking = false;

        function build() {
          var scrolls = deck.scrollWidth > deck.clientWidth + 4;
          if (scrolls && !dots) {
            dots = document.createElement('div');
            dots.className = 'deck-dots';
            dots.setAttribute('aria-hidden', 'true');   // the cards themselves are the content
            for (var k = 0; k < deck.children.length; k++) dots.appendChild(document.createElement('span'));
            deck.parentNode.insertBefore(dots, deck.nextSibling);
            sync(deck, dots);
          } else if (!scrolls && dots) {
            dots.parentNode.removeChild(dots); dots = null;
          } else if (scrolls && dots) {
            sync(deck, dots);
          }
        }

        deck.addEventListener('scroll', function () {
          if (ticking || !dots) return;
          ticking = true;
          requestAnimationFrame(function () { sync(deck, dots); ticking = false; });
        }, { passive: true });

        window.addEventListener('resize', build);
        window.addEventListener('orientationchange', build);
        build();
      })(decks[i]);
    }
  }

  function init() {
    var steps = [markCurrent, wireAccTools, wireChecklists, wireCopy, wireTally, wireDecks];
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
