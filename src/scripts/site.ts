import { createClock, gsap, ScrollTrigger } from '@pagx/motion'
import { SplitText } from 'gsap/SplitText'
import { wake } from './wake'

gsap.registerPlugin(SplitText)

type Tier = 'high' | 'medium' | 'static'
type Lenis = ReturnType<typeof createClock>['lenis']
const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)]
const portrait = () => innerHeight > innerWidth

type Clock = NonNullable<ReturnType<typeof createClock>>
const eur = (n: number) => '€' + Math.round(n).toLocaleString('en-GB')

export function init() {
  const tier = (document.documentElement.dataset.tier || 'high') as Tier
  const clock = tier === 'static' ? null : createClock({ smooth: tier === 'high', lerp: 0.1 })
  const lenis = clock?.lenis ?? null

  header()
  anchors(lenis)
  menu(lenis)
  plan()
  heroVideo(tier, clock)
  fleet()
  yacht(tier)
  week(tier)
  rates()
  if (tier === 'static') return
  voyage(clock!)
  motion()
}

function header() {
  const hdr = $('#hdr'), hero = $('.hero')
  let last = 0
  const on = () => {
    const y = scrollY
    hdr.classList.toggle('solid', y > hero.offsetHeight - 90)
    hdr.classList.toggle('hide', y > last && y > innerHeight * 1.2)
    last = y
  }
  addEventListener('scroll', on, { passive: true })
  on()
}

function anchors(lenis: Lenis) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  $$<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const el = document.querySelector<HTMLElement>(a.getAttribute('href')!)
      if (!el) return
      e.preventDefault()
      if (lenis) lenis.scrollTo(el, { duration: 1.6 })
      else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
    }),
  )
}

function menu(lenis: Lenis) {
  const nav = $('#mnav'), btn = $('#menuBtn')
  const set = (open: boolean) => {
    nav.hidden = !open
    btn.setAttribute('aria-expanded', String(open))
    open ? lenis?.stop() : lenis?.start()
    ;(open ? $('#menuClose') : btn).focus()
  }
  btn.addEventListener('click', () => set(true))
  $('#menuClose').addEventListener('click', () => set(false))
  nav.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') set(false)
    if (e.key !== 'Tab') return
    const f = $$('a,button', nav), first = f[0], lastEl = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus() }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus() }
  })
  $$('a', nav).forEach((a) => a.addEventListener('click', () => { nav.hidden = true; btn.setAttribute('aria-expanded', 'false'); lenis?.start() }))
}

// The booking bar writes the visitor's choices into the WhatsApp message; fleet cards preselect the yacht type
function plan() {
  const f = $<HTMLFormElement>('#plan'), go = $<HTMLAnchorElement>('#planGo')
  const base = new URL(f.dataset.wa!)
  const sync = () => {
    const v = (k: string) => $<HTMLSelectElement>(`#f-${k}`).value
    const text = `${base.searchParams.get('text')}\n\n(Demo booking: ${v('type')}, ${v('where')}, ${v('when')}, ${v('guests')} guests)`
    const u = new URL(base); u.searchParams.set('text', text); go.href = u.href
  }
  f.addEventListener('change', sync)
  sync()
  $$<HTMLAnchorElement>('[data-type]').forEach((a) => a.addEventListener('click', () => { $<HTMLSelectElement>('#f-type').value = a.dataset.type!; sync() }))
}

// Fleet: the name you hover, or the one crossing the middle of the screen, owns the sticky photo (desktop only)
function fleet() {
  const items = $$('.f-item'), pics = $$('.f-pic')
  const set = (i: number) => {
    items.forEach((el, k) => el.classList.toggle('on', k === i))
    pics.forEach((el, k) => el.classList.toggle('on', k === i))
  }
  items.forEach((el, i) => {
    el.addEventListener('pointerenter', () => set(i))
    ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', onToggle: (st) => st.isActive && set(i) })
  })
}

// Hero: a drone loop (#74) that runs on its own, drawn through the water shader (#82). Portrait screens get the
// vertical render; static keeps the poster.
function heroVideo(tier: Tier, clock: ReturnType<typeof createClock> | null) {
  const v = $<HTMLVideoElement>('#heroVid'), d = v.dataset
  const m = portrait()
  v.poster = m ? d.pm! : d.pd!
  if (tier === 'static') return
  v.src = m ? d.m! : d.d!
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()))
  io.observe(v)
  wake(v, m, clock!, tier === 'high' ? 1 : 0)
}

// The voyage (#83): the Kling film plays in a wide frame while it is on screen. The ship's clock runs from 11:20 to 19:40
// with it, the chapter and the logbook follow the playhead, a click on the logbook jumps there. It dips to black to loop.
function voyage(clock: Clock) {
  const v = $<HTMLVideoElement>('#vVid'), frame = $('#vFrame'), clk = $('#vClock'), head = $('#vHead')
  const chapters = $$('.chapter'), marks = $$<HTMLButtonElement>('.v-mark'), toggle = $<HTMLButtonElement>('#vToggle'), cur = $('#vCursor')
  const m = portrait()
  let held = false, chap = 0
  v.src = m ? v.dataset.m! : v.dataset.d!
  const play = () => v.play().catch(() => {})
  const label = () => { const l = v.paused ? toggle.dataset.play! : toggle.dataset.pause!; toggle.textContent = l; cur.textContent = l }
  v.addEventListener('play', label)
  v.addEventListener('pause', label)
  new IntersectionObserver(([e]) => (e.isIntersecting && !held ? play() : v.pause()), { threshold: 0.4 }).observe(frame)
  v.addEventListener('ended', () => {
    frame.classList.add('dip')
    setTimeout(() => { v.currentTime = 0; play(); frame.classList.remove('dip') }, 650)
  })
  const flip = () => { held = !v.paused; held ? v.pause() : play() }
  toggle.addEventListener('click', (e) => { e.stopPropagation(); flip() })
  frame.addEventListener('click', flip)
  marks.forEach((b, i) => b.addEventListener('click', () => { if (v.duration) v.currentTime = (i / 3) * v.duration + 0.05; held = false; play() }))

  // a round label follows the pointer over the film
  const cx = gsap.quickTo(cur, 'x', { duration: 0.5, ease: 'expo.out' }), cy = gsap.quickTo(cur, 'y', { duration: 0.5, ease: 'expo.out' })
  frame.addEventListener('pointermove', (e) => { const r = frame.getBoundingClientRect(); cx(e.clientX - r.left); cy(e.clientY - r.top) })
  frame.addEventListener('pointerenter', () => cur.classList.add('on'))
  frame.addEventListener('pointerleave', () => cur.classList.remove('on'))

  clock.add(() => {
    if (!v.duration) return
    const p = v.currentTime / v.duration, min = 680 + p * 500
    clk.textContent = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`
    head.style.transform = `scaleX(${p})`
    if (m) v.style.objectPosition = `${66 - 14 * p}% 50%`  // the phone crop follows the yacht
    const c = Math.min(2, Math.floor(p * 3))
    if (c === chap) return
    chap = c
    chapters.forEach((el, k) => el.classList.toggle('on', k === c))
    marks.forEach((el, k) => el.classList.toggle('on', k === c))
  })
}

// The yacht: hover or tap a part of the deck and the rest of the plate steps back
function yacht(tier: Tier) {
  const plate = $('#plateImg'), parts = $$('.spot, .callout, .spot-list li')
  const set = (i: number) => {
    plate.classList.toggle('focus', i >= 0)
    parts.forEach((el) => el.classList.toggle('on', +el.dataset.i! === i))
  }
  parts.forEach((el) => {
    const i = +el.dataset.i!
    el.addEventListener('pointerenter', () => set(i))
    el.addEventListener('focusin', () => set(i))
    el.addEventListener('click', () => set(i))
  })
  plate.addEventListener('pointerleave', () => set(-1))
  if (tier === 'static') plate.classList.add('in')
  else ScrollTrigger.create({ trigger: plate, start: 'top 72%', once: true, onEnter: () => plate.classList.add('in') })
}

// A week: the route draws leg by leg and the boat sails it. It plays through once on arrival; a click takes over.
function week(tier: Tier) {
  const legs = $$<SVGPathElement & HTMLElement>('.c-leg'), stops = $$('.c-stop'), days = $$<HTMLButtonElement>('.day')
  const boat = document.getElementById('boat')!, list = $('.days')
  const len = legs.map((l) => l.getTotalLength())
  legs.forEach((l, k) => { l.style.strokeDasharray = `${len[k]}`; l.style.strokeDashoffset = `${len[k]}` })
  let at = -1, timer = 0
  const put = (pt: DOMPoint) => { boat.setAttribute('cx', `${pt.x}`); boat.setAttribute('cy', `${pt.y}`) }
  const go = (i: number, still = false) => {
    const d = days[i].dataset
    days.forEach((b, k) => b.classList.toggle('on', k === i))
    stops.forEach((g, k) => g.classList.toggle('on', k <= i + 1 || (i === 6 && k === 0)))
    $('#dNum').textContent = `${list.dataset.day} ${i + 1}`
    $('#dNm').textContent = `${d.miles} ${list.dataset.nm}`
    $('#dPlace').textContent = d.place!
    $('#dBody').textContent = d.body!
    legs.forEach((l, k) => {
      gsap.killTweensOf(l)
      const to = k <= i ? 0 : len[k]
      if (still || k !== i) l.style.strokeDashoffset = `${to}`
      else gsap.fromTo(l, { strokeDashoffset: len[k] }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' })
    })
    const leg = legs[i], o = { p: 0 }
    gsap.killTweensOf(o)
    if (still || i < at) put(leg.getPointAtLength(len[i]))
    else gsap.to(o, { p: 1, duration: 1.6, ease: 'power2.inOut', onUpdate: () => put(leg.getPointAtLength(o.p * len[i])) })
    at = i
    gsap.fromTo('.day-card > *', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.05 })
  }
  const stop = () => clearInterval(timer)
  days.forEach((b, i) => b.addEventListener('click', () => { stop(); go(i) }))
  if (tier === 'static') { go(6, true); return }
  ScrollTrigger.create({
    trigger: '#chart', start: 'top 65%', once: true,
    onEnter: () => { go(0); timer = window.setInterval(() => (at < 6 ? go(at + 1) : stop()), 3400) },
  })
}

// Rates: a month sets the sea temperature, the note and every line of the bill; the button carries it into the enquiry
function rates() {
  const months = $$<HTMLButtonElement>('.month'), go = $<HTMLAnchorElement>('#rGo'), val = { v: +months[1].dataset.rate! }
  const paint = () => {
    $('#rFee').textContent = eur(val.v)
    $('#rApa').textContent = eur(val.v * 0.3)
    $('#rVat').textContent = eur(val.v * 0.21)
    $('#rTotal').textContent = eur(val.v * 1.51)
  }
  const set = (b: HTMLButtonElement) => {
    months.forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1 })
    $('#rNote').textContent = b.dataset.note!
    $('span', go).textContent = `${go.dataset.cta} ${b.dataset.m}`
    go.dataset.m = b.dataset.m
    gsap.to(val, { v: +b.dataset.rate!, duration: 0.9, ease: 'expo.out', onUpdate: paint })
  }
  months.forEach((b, i) => {
    b.tabIndex = i === 1 ? 0 : -1
    b.addEventListener('click', () => set(b))
    b.addEventListener('keydown', (e) => {
      const k = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
      if (!k) return
      e.preventDefault()
      const n = months[(i + k + months.length) % months.length]
      set(n); n.focus()
    })
  })
  go.dataset.m = months[1].dataset.m
  go.addEventListener('click', () => {
    const sel = $<HTMLSelectElement>('#f-when')
    sel.value = go.dataset.m!
    sel.closest('form')!.dispatchEvent(new Event('change'))
  })
}

function motion() {
  // Hero: the lines rise once over the running loop
  gsap.from('#h1 .line > span', { yPercent: 110, duration: 1.4, ease: 'expo.out', stagger: 0.12, delay: 0.2 })
  gsap.from(['.hero-body', '.hero-cta'], { opacity: 0, y: 16, duration: 1.2, ease: 'expo.out', stagger: 0.08, delay: 0.6 })

  // Section titles: lines rise from a mask, once each
  $$('.split').forEach((h) => {
    const sp = SplitText.create(h, { type: 'lines', mask: 'lines' })
    gsap.from(sp.lines, { yPercent: 105, duration: 1.2, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: h, start: 'top 85%' } })
  })

  // Photographs are uncovered from below, once
  $$('.reveal').forEach((f) => {
    gsap.fromTo(f, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', scrollTrigger: { trigger: f, start: 'top 88%' } })
    gsap.from($('img', f), { scale: 1.2, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: f, start: 'top 88%' } })
  })

  // Onboard: the aft deck opens from a framed photo to full bleed, then the quote rises over it
  gsap.fromTo('.ob-img', { clipPath: 'inset(9% 7% 9% 7%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: '.ob-hero', start: 'top 95%', end: 'top 10%', scrub: true } })
  gsap.fromTo('.ob-img img', { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.ob-hero', start: 'top bottom', end: 'bottom top', scrub: true } })
  gsap.from('.ob-hero .quote span', { yPercent: 60, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.ob-hero', start: 'top 30%' } })

  // The voyage: the frame opens like a shutter, once, the film settling as it does
  gsap.fromTo('#vFrame', { clipPath: 'inset(44% 0% 44% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'expo.inOut', scrollTrigger: { trigger: '#vFrame', start: 'top 80%' } })
  gsap.from('#vVid', { scale: 1.25, duration: 2.4, ease: 'expo.out', scrollTrigger: { trigger: '#vFrame', start: 'top 80%' } })

  // Footer: the word rises, and the sea inside the letters drifts with the scroll
  gsap.from('.ftr-word', { yPercent: 35, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: '.ftr-word', start: 'top 95%' } })
  gsap.fromTo('.ftr-word', { backgroundPosition: '50% 0%' }, { backgroundPosition: '50% 80%', ease: 'none', scrollTrigger: { trigger: '.ftr', start: 'top bottom', end: 'bottom bottom', scrub: true } })

  addEventListener('load', () => ScrollTrigger.refresh())
}
