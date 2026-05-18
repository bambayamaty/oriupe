/* ═══════════════════════════════════════════════════════
   scroll-reveal.js — Animations d'entrée au scroll
   Éléments ciblés : .r  (fade+slide standard)
                     .r-fast (délai réduit)
   Usage: <script type="module" src="/src/shared/scroll-reveal.js"></script>
═══════════════════════════════════════════════════════ */

const BASE_CSS = `
.r{opacity:0;transform:translateY(28px);transition:opacity .55s cubic-bezier(.25,.46,.45,.94),transform .55s cubic-bezier(.25,.46,.45,.94)}
.r.vis{opacity:1;transform:none}
.r-fast{transition-duration:.35s}
.r[data-delay="1"]{transition-delay:.08s}
.r[data-delay="2"]{transition-delay:.16s}
.r[data-delay="3"]{transition-delay:.24s}
.r[data-delay="4"]{transition-delay:.32s}
.r[data-delay="5"]{transition-delay:.40s}
.r[data-delay="6"]{transition-delay:.48s}
`

function injectCSS () {
  if (document.getElementById('sr-styles')) return
  const s = document.createElement('style')
  s.id = 'sr-styles'
  s.textContent = BASE_CSS
  document.head.appendChild(s)
}

function init () {
  injectCSS()
  const els = document.querySelectorAll('.r')
  if (!els.length) return

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('vis')
        io.unobserve(e.target)
      }
    })
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })

  els.forEach(el => io.observe(el))
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

export { init as initScrollReveal }
