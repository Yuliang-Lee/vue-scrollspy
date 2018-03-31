export default function install (Vue, options) {
  const bodyScrollEl = {}
  let scrollFun

  // For ff, ie
  Object.defineProperty(bodyScrollEl, 'scrollTop', {
    get () {
      return document.body.scrollTop || document.documentElement.scrollTop
    },
    set (val) {
      document.body.scrollTop = val
      document.documentElement.scrollTop = val
    }
  })

  Object.defineProperty(bodyScrollEl, 'scrollHeight', {
    get () {
      return document.body.scrollHeight || document.documentElement.scrollHeight
    }
  })

  Object.defineProperty(bodyScrollEl, 'offsetHeight', {
    get () {
      return window.innerHeight
    }
  })

  const scrollSpyContext = '@@scrollSpyContext'
  const scrollSpyElements = {}
  const scrollSpySections = {}
  const activeElement = {}
  const activableElements = {}
  const currentIndex = {}

  options = Object.assign({
    allowNoActive: false,
    data: null,
    offset: 0,
    time: 200,
    steps: 30,
    active: {
      selector: null,
      class: 'active'
    },
    link: {
      selector: 'a'
    }
  }, options || {})

  function findElements (container, selector) {
    if (!selector) {
      return container.children
    }

    const id = scrollSpyId(container)

    const elements = []

    for (const el of container.querySelectorAll(selector)) {
      // Filter out elements that are owned by another directive
      if (scrollSpyIdFromAncestors(el) === id) {
        elements.push(el)
      }
    }

    return elements
  }

  function scrollSpyId (el) {
    return el.getAttribute('data-scroll-spy-id') || el.getAttribute('scroll-spy-id') || 'default'
  }

  function scrollSpyIdDefined (el) {
    return !!el.getAttribute('data-scroll-spy-id') || !!el.getAttribute('scroll-spy-id')
  }

  function scrollSpyIdFromAncestors (el) {
    do {
      if (scrollSpyIdDefined(el)) {
        return scrollSpyId(el)
      }
      el = el.parentElement
    } while (el)
    return 'default'
  }

  function initScrollSections (el, selector) {
    const id = scrollSpyId(el)
    const idScrollSections = findElements(el)
    scrollSpySections[id] = idScrollSections

    if (selector) {
      const dom = document.querySelector(selector)
      el[scrollSpyContext].eventEl = dom
      el[scrollSpyContext].scrollEl = dom
    }

    if (idScrollSections[0] && idScrollSections[0].offsetParent !== el) {
      el[scrollSpyContext].eventEl = window
      el[scrollSpyContext].scrollEl = bodyScrollEl
    }
  }

  function getOffsetTop (elem, untilParent) {
    let offsetTop = 0
    do {
      if (!isNaN(elem.offsetTop)) {
        offsetTop += elem.offsetTop
      }
      elem = elem.offsetParent
    } while (elem && elem !== untilParent)
    return offsetTop
  }

  function scrollTo (el, index) {
    const id = scrollSpyId(el)
    const idScrollSections = scrollSpySections[id]

    const { scrollEl, options } = el[scrollSpyContext]
    const current = scrollEl.scrollTop

    if (idScrollSections[index]) {
      const target = getOffsetTop(idScrollSections[index]) - options.offset
      const time = options.time
      const steps = options.steps
      const timems = parseInt(time / steps)
      const gap = target - current
      for (let i = 0; i <= steps; i++) {
        const pos = current + (gap / steps) * i
        setTimeout(() => {
          scrollEl.scrollTop = pos
        }, timems * i)
      }
    }
  }

  Vue.directive('scroll-spy', {
    bind (el, binding, vnode) {
      function onScroll () {
        const id = scrollSpyId(el)
        const idScrollSections = scrollSpySections[id]

        const { scrollEl, options } = el[scrollSpyContext]

        let index

        if ((scrollEl.offsetHeight + scrollEl.scrollTop) >= scrollEl.scrollHeight - 10) {
          index = idScrollSections.length
        } else {
          for (index = 0; index < idScrollSections.length; index++) {
            if (getOffsetTop(idScrollSections[index], scrollEl) - options.offset > scrollEl.scrollTop) {
              break
            }
          }
        }

        index = index - 1

        if (index < 0) {
          index = options.allowNoActive ? null : 0
        } else if (options.allowNoActive && index >= idScrollSections.length - 1 &&
          getOffsetTop(idScrollSections[index]) + idScrollSections[index].offsetHeight < scrollEl.scrollTop) {
          index = null
        }

        if (index !== currentIndex[id] || !activeElement[id]) {
          let idActiveElement = activeElement[id]
          if (idActiveElement) {
            idActiveElement.classList.remove('active')
            activeElement[id] = null
          }

          currentIndex[id] = index
          if (typeof currentIndex !== 'undefined') {
            idActiveElement = activableElements[id][currentIndex[id]]
            activeElement[id] = idActiveElement

            if (idActiveElement) {
              idActiveElement.classList.add('active')
            }
          }

          if (options.data) {
            Vue.set(vnode.context, options.data, index)
          }
        }
      }
      scrollFun = onScroll
      vnode.context.$scrollTo = scrollTo.bind(null, el)

      const id = scrollSpyId(el)

      el[scrollSpyContext] = {
        onScroll,
        options: Object.assign({}, options, binding.value),
        id: scrollSpyId(el),
        eventEl: el,
        scrollEl: el
      }

      scrollSpyElements[id] = el
    },
    inserted (el, { value }) {
      initScrollSections(el, value.container)

      const { eventEl, onScroll } = el[scrollSpyContext]
      eventEl.addEventListener('scroll', onScroll)

      onScroll()
    },
    componentUpdated (el, { value }) {
      initScrollSections(el, value.container)

      const { onScroll } = el[scrollSpyContext]

      onScroll()
    },
    unbind (el) {
      const { eventEl, onScroll } = el[scrollSpyContext]
      const id = scrollSpyId(el)
      eventEl.removeEventListener('scroll', onScroll)
      scrollSpyElements[id] = null
      scrollSpySections[id] = null
      activeElement[id] = null
      el[scrollSpyContext].eventEl = null
      el[scrollSpyContext].scrollEl = null
      scrollFun = null
    }
  })

  Vue.directive('scroll-spy-active', {
    inserted (el, binding) {
      const activeOptions = Object.assign({}, options.active, binding.value)
      initScrollActive(el, activeOptions.selector)
    },
    componentUpdated (el, binding) {
      const activeOptions = Object.assign({}, options.active, binding.value)
      initScrollActive(el, activeOptions.selector)
      scrollFun()
    },
    unbind (el) {
      const id = scrollSpyId(el)
      activableElements[id] = null
    }
  })

  function initScrollActive (el, selector) {
    const id = scrollSpyId(el)
    activableElements[id] = findElements(el, selector)
  }

  function scrollLinkClickHandler (index, scrollSpyId, event) {
    scrollTo(scrollSpyElements[scrollSpyId], index)
  }

  function initScrollLink (el, selector) {
    const id = scrollSpyId(el)

    const linkElements = findElements(el, selector)

    for (let i = 0; i < linkElements.length; i++) {
      const linkElement = linkElements[i]

      const listener = scrollLinkClickHandler.bind(null, i, id)
      if (!linkElement[scrollSpyContext]) {
        linkElement[scrollSpyContext] = {}
      }

      if (!linkElement[scrollSpyContext].click) {
        linkElement.addEventListener('click', listener)
        linkElement[scrollSpyContext].click = listener
      }
    }
  }

  Vue.directive('scroll-spy-link', {
    inserted (el, binding) {
      const linkOptions = Object.assign({}, options.link, binding.value)
      initScrollLink(el, linkOptions.selector)
    },
    componentUpdated (el, binding) {
      const linkOptions = Object.assign({}, options.link, binding.value)
      initScrollLink(el, linkOptions.selector)
    },
    unbind (el) {
      const linkElements = findElements(el)

      for (let i = 0; i < linkElements.length; i++) {
        const linkElement = linkElements[i]
        const id = scrollSpyId(el)
        const listener = scrollLinkClickHandler.bind(null, i, id)
        if (!linkElement[scrollSpyContext]) {
          linkElement[scrollSpyContext] = {}
        }

        if (linkElement[scrollSpyContext].click) {
          linkElement.removeEventListener('click', listener)
          delete linkElement[scrollSpyContext].click
        }
      }
    }
  })
}
