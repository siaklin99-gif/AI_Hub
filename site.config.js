/* ============================================================
   AI Hub — the ONE file you edit to add, remove or reorder a page.
   Nav, footers, pagers, track cards and every cross-link are
   generated from this. Nothing else needs touching.
   ============================================================ */
'use strict';

module.exports = {
  site: {
    name: 'AI Hub',
    /* Every page is stamped with this and the static harness fails if a page
       loses it — the site tells readers to distrust undated claims, so it
       holds itself to the same rule. Change it when you revise content. */
    written: '5 August 2026',
    /* Outbound links are allow-listed. Anything else fails verify.js: this
       site should not ship links it cannot verify. */
    allowedExternalHosts: ['hlur.ai'],
    baselineUrl: 'https://hlur.ai/baseline',
  },

  /* ---- the pages, in reading order -------------------------------
     file        output filename, also the nav href
     nav         short label in the top bar
     track       null for the front door, otherwise "Track N · Name"
     cardTitle   heading on the front-door track card
     cardBlurb   body of that card
     pagerTitle  how OTHER pages refer to this one in prev/next
     title       <title> and browser tab
     description meta description (60-260 chars, enforced)
     eyebrow/h1/sub   the hero
  ------------------------------------------------------------------ */
  pages: [
    {
      file: 'index.html',
      nav: 'Start',
      track: null,
      pagerTitle: 'Start — the six tracks',
      title: 'AI Hub — start here, whoever you are',
      description: 'A calm, jargon-free starting point for AI. Learn the foundations, find out what you didn\'t know to ask, and learn to check the answers instead of trusting them.',
      eyebrow: 'AI Hub',
      h1: 'Everyone is confused. That is the honest starting line.',
      sub: 'AI is on the billboards, in the all-hands, and in nobody\'s training budget. This is a calm place to build the basics — and then learn the part almost no one teaches: how to <strong>check</strong> what the AI gives you, instead of trusting it.',
      heroButtons: [
        { href: '#tracks', label: 'Show me where to start', style: 'primary' },
        { href: 'trust.html', label: 'I already use AI — teach me to verify it', style: 'ghost' },
      ],
      heroFoot: 'Free. No sign-up, no account, nothing to install. Works on a phone.',
      rule: true,
    },
    {
      file: 'map.html',
      nav: 'The Map',
      track: 'Track 1 · The Map',
      cardTitle: 'What you don\'t know you don\'t know',
      cardBlurb: 'You cannot ask for help you can\'t imagine. A map of what AI is genuinely good at, genuinely bad at, and unpredictable at — plus five habits for finding the gaps yourself.',
      pagerTitle: 'The Map — what you don\'t know you don\'t know',
      title: 'The Map — what you don\'t know you don\'t know about AI',
      description: 'You can\'t ask for help you can\'t imagine. A map of what AI is good at, bad at, and unpredictable at — plus five habits for finding your own blind spots.',
      eyebrow: 'Track 1 · The Map',
      h1: 'You cannot ask for help you can\'t imagine.',
      sub: 'The biggest thing holding people back isn\'t bad prompting. It\'s not knowing what is even on the menu. This page is the menu — what AI is genuinely good at, genuinely bad at, and unreliable at — and five habits for finding the rest yourself.',
      footNote: 'The term "jagged technological frontier" is from Dell\'Acqua et al., Harvard Business School working paper 24-013 (2023), a field experiment run with BCG consultants — the idea is theirs, the words on this page are ours.',
    },
    {
      file: 'trust.html',
      nav: 'Trust',
      track: 'Track 2 · Trust',
      cardTitle: 'How to check the AI\'s work',
      cardBlurb: 'The core of the hub. Six verification moves, a triage rule for how hard to check, the failure modes to recognise on sight, and a one-page checklist you can keep.',
      pagerTitle: 'Trust — how to check the AI\'s work',
      title: 'Trust — how to validate and check AI work',
      description: 'Trust is not a property of the AI. It is a property of your process. Six verification moves, a triage rule, the failure modes to recognise, and a checklist you can keep.',
      eyebrow: 'Track 2 · Trust',
      h1: 'Trust is not something the AI has. It\'s something your process produces.',
      sub: '"Can I trust AI?" is the wrong question — it has no answer, and waiting for one leaves you either paralysed or reckless. The right question is smaller and always answerable: <strong>how do I check this particular answer, given what it costs me to be wrong?</strong>',
      footNote: 'Nothing on this page is medical, legal or financial advice.',
    },
    {
      file: 'leverage.html',
      nav: 'Leverage',
      track: 'Track 3 · Leverage',
      cardTitle: 'How to actually get help from it',
      cardBlurb: 'The mental model that works, the five parts of a good request, ten patterns worth stealing, the beginner mistakes that waste the most time, and the three levels of tool most people never move past.',
      pagerTitle: 'Leverage — how to actually get help',
      title: 'Leverage — how to actually get help from AI',
      description: 'The mental model that works, the five parts of a good request, ten patterns worth stealing, and the beginner mistakes that waste the most time.',
      eyebrow: 'Track 3 · Leverage',
      h1: 'Treat it as a fast, well-read, over-confident new colleague.',
      sub: 'Not an oracle, not a search box, not a friend. Someone brilliant who started this morning, has read almost everything, has no idea what your job involves, and will never admit to being lost. Once that picture is right, most of the technique follows on its own.',
      footNote: 'Every prompt on this page is ours to copy freely.',
    },
    {
      file: 'tools.html',
      nav: 'Tools',
      track: 'Track 4 · Tools',
      cardTitle: 'Which model, and what "free" means',
      cardBlurb: 'Stop trying to memorise the leaderboard. Learn the six categories of tool, a decision flow for picking one, why free tiers end, and how to run your own five-prompt test.',
      pagerTitle: 'Tools — which model, and what "free" means',
      title: 'Tools — which AI model, and what "free" actually means',
      description: 'Stop memorising the leaderboard. Learn the six categories of AI tool, a decision flow for picking one, why free tiers end, and how to run your own five-prompt test.',
      eyebrow: 'Track 4 · Tools',
      h1: 'Don\'t learn the leaderboard. Learn the categories.',
      sub: 'New model names arrive every few weeks, each announced as the best. Memorising them is a treadmill. The categories underneath barely move — and once you know which category your task belongs to, picking a product takes about a minute.',
      footNote: 'No product is named, ranked or recommended here, and nothing on this site is sponsored.',
    },
    {
      file: 'further.html',
      nav: 'Go Further',
      track: 'Track 5 · Go Further',
      cardTitle: 'Study, work, and building something',
      cardBlurb: 'A four-week plan at 20 minutes a day. How to find AI-shaped work in your job. What this does to careers, honestly. And what it really takes to start an AI company.',
      pagerTitle: 'Go Further — study, work, and building something',
      title: 'Go Further — study, work, careers, and starting something',
      description: 'A four-week plan at 20 minutes a day, how to find AI-shaped work in your job, what this honestly does to careers, and what it really takes to start an AI company.',
      eyebrow: 'Track 5 · Go Further',
      h1: 'From "I\'ve tried it" to it being part of how you work.',
      sub: 'Three roads lead out of here: use it well in daily life, use it well at work, or build something with it. They share a first mile. This page is that mile, and then the fork.',
      footNote: 'The career and startup sections are judgement, not prediction — treat them the way this site tells you to treat everything else.',
    },
  ],

  /* Track 0 is not a page in this repo — it is the existing Baseline site.
     One source of truth per concern: a second foundations page would drift. */
  externalTracks: [
    {
      href: 'https://hlur.ai/baseline',
      track: 'Track 0 · Foundations',
      cardTitle: 'What AI actually is',
      cardBlurb: 'Start here if the words themselves are the problem. A companion one-page guide by the same author, on a separate site, that peels AI apart in ten layers with a quiz at the end. Unlike this hub it does name specific products.',
      footLabel: 'Foundations',
      /* where it sits in the front-door track grid (0 = first) */
      order: 0,
    },
  ],

  footerNote: 'AI Hub — a starting point for anyone, technical or not. No tracking, no cookies, no account. Everything on this page is our own words; where an idea came from someone else, it is named.',
};
