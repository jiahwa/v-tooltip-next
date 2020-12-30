<template>
  <div
    class="v-popover"
    :class="cssClass"
  >
    <div
      ref="trigger"
      class="trigger"
      style="display: inline-block;"
      :aria-describedby="popoverId"
      :tabindex="trigger.indexOf('focus') !== -1 ? 0 : undefined"
    >
      <slot />
    </div>

    <div
      ref="popover"
      :id="popoverId"
      :class="[popoverBaseClass, popoverClass, cssClass]"
      :style="{
        visibility: isOpen ? 'visible' : 'hidden',
      }"
      :aria-hidden="isOpen ? 'false' : 'true'"
      :tabindex="autoHide ? 0 : undefined"
      @keyup.esc="autoHide && hide()"
    >
      <div :class="popoverWrapperClass">
        <div
          ref="inner"
          :class="popoverInnerClass"
          style="position: relative;"
        >
          <div>
            <slot name="popover" />
          </div>

          <ResizeObserver v-if="handleResize" @notify="$_handleResize" />
        </div>
        <div ref="arrow" :class="popoverArrowClass"></div>
      </div>
    </div>
  </div>
</template>

<script>
import {ref, computed, watch, onMounted, onBeforeUnmount, onDeactivated, getCurrentInstance} from 'vue'
import { directive } from '../directives/v-tooltip'
import Popper from 'popper.js'
import { ResizeObserver } from 'vue-resize'
import { supportsPassive } from '../utils'

function getDefault (key) {
  const value = directive.options.popover[key]
  if (typeof value === 'undefined') {
    return directive.options[key]
  }
  return value
}

let isIOS = false
if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
  isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

const openPopovers = []

let Element = function () {}
if (typeof window !== 'undefined') {
  Element = window.Element
}

export default {
  name: 'VPopover',

  components: {
    ResizeObserver,
  },

  props: {
    open: {
      type: Boolean,
      default: false,
    },

    disabled: {
      type: Boolean,
      default: false,
    },

    placement: {
      type: String,
      default: () => getDefault('defaultPlacement'),
    },

    delay: {
      type: [String, Number, Object],
      default: () => getDefault('defaultDelay'),
    },

    offset: {
      type: [String, Number],
      default: () => getDefault('defaultOffset'),
    },

    trigger: {
      type: String,
      default: () => getDefault('defaultTrigger'),
    },

    container: {
      type: [String, Object, Element, Boolean],
      default: () => getDefault('defaultContainer'),
    },

    boundariesElement: {
      type: [String, Element],
      default: () => getDefault('defaultBoundariesElement'),
    },

    popperOptions: {
      type: Object,
      default: () => getDefault('defaultPopperOptions'),
    },

    popoverClass: {
      type: [String, Array],
      default: () => getDefault('defaultClass'),
    },

    popoverBaseClass: {
      type: [String, Array],
      default: () => directive.options.popover.defaultBaseClass,
    },

    popoverInnerClass: {
      type: [String, Array],
      default: () => directive.options.popover.defaultInnerClass,
    },

    popoverWrapperClass: {
      type: [String, Array],
      default: () => directive.options.popover.defaultWrapperClass,
    },

    popoverArrowClass: {
      type: [String, Array],
      default: () => directive.options.popover.defaultArrowClass,
    },

    autoHide: {
      type: Boolean,
      default: () => directive.options.popover.defaultAutoHide,
    },

    handleResize: {
      type: Boolean,
      default: () => directive.options.popover.defaultHandleResize,
    },

    openGroup: {
      type: String,
      default: null,
    },

    openClass: {
      type: [String, Array],
      default: () => directive.options.popover.defaultOpenClass,
    },
  },

  setup(props, {emit}) {
    const isOpen = ref(false)
    const id = ref(Math.random().toString(36).substr(2, 10))
    const popover = ref(null)
    const arrow = ref(null)

    const $_isDisposed = ref(false)
    const $_mounted = ref(false)
    const $_events = ref([])
    const $_preventOpen = ref(false)
    const that = getCurrentInstance

    const cssClass = computed(() => { return {[props.openClass]: isOpen.value}} )
    const popoverId = computed(() => `popover_${id.value}`)

    const $_removeEventListeners = () => {
      const reference = props.trigger
      $_events.value.forEach(({ func, event }) => {
        reference.removeEventListener(event, func)
      })
      $_events.value = []

    }
     const $_setTooltipNodeEvent = (event) => {
      const reference = props.trigger
      const popoverNode = popover.value

      const relatedreference = event.relatedreference || event.toElement || event.relatedTarget

      const callback = event2 => {
        const relatedreference2 = event2.relatedreference || event2.toElement || event2.relatedTarget

        // Remove event listener after call
        popoverNode.removeEventListener(event.type, callback)

        // If the new reference is not the reference element
        if (!reference.contains(relatedreference2)) {
          // Schedule to hide tooltip
          hide({ event: event2 })
        }
      }

      if (popoverNode.contains(relatedreference)) {
        // listen to mouseleave on the tooltip element to be able to hide the tooltip
        popoverNode.addEventListener(event.type, callback)
        return true
      }

      return false
    }

    let $_scheduleTimer;
    const $_scheduleShow = (event = null, skipDelay = false) => {
      clearTimeout($_scheduleTimer)
      if (skipDelay) {
        $_show()
      } else {
        // defaults to 0
        const computedDelay = parseInt((props.delay && props.delay.show) || props.delay || 0)
        $_scheduleTimer = setTimeout($_show.bind(this), computedDelay)
      }
    }
    const $_scheduleHide = (event = null, skipDelay = false) => {
      clearTimeout($_scheduleTimer)
      if (skipDelay) {
        $_hide()
      } else {
        // defaults to 0
        const computedDelay = parseInt((props.delay && props.delay.hide) || props.delay || 0)
        $_scheduleTimer = setTimeout(() => {
          if (!isOpen.value) {
            return
          }

          // if we are hiding because of a mouseleave, we must check that the new
          // reference isn't the tooltip, because in this case we don't want to hide it
          if (event && event.type === 'mouseleave') {
            const isSet = $_setTooltipNodeEvent(event)

            // if we set the new event, don't hide the tooltip yet
            // the new event will take care to hide it if necessary
            if (isSet) {
              return
            }
          }

          $_hide()
        }, computedDelay)
      }
    }

    const $_beingShowed = ref(false)
    const show = ({ event, skipDelay = false, force = false } = {}) => {
      if (force || !props.disabled) {
        $_scheduleShow(event)
        emit('show')
      }
      emit('update:open', true)
      $_beingShowed.value = true
      requestAnimationFrame(() => {
        $_beingShowed.value = false
      })
    }
    const hide = ({ event, skipDelay = false } = {}) => {
      $_scheduleHide(event)

      emit('hide')
      emit('update:open', false)
    }

    const popperInstance = ref(null)
    const dispose = () => {
      $_isDisposed.value = true
      $_removeEventListeners()
      hide({ skipDelay: true })
      if (popperInstance.value) {
        popperInstance.value.destroy()

        // destroy tooltipNode if removeOnDestroy is not set, as popperInstance.destroy() already removes the element
        if (!popperInstance.value.options.removeOnDestroy) {
          const popoverNode = popover.value
          popoverNode.parentNode && popoverNode.parentNode.removeChild(popoverNode)
        }
      }
      $_mounted.value = false
      popperInstance.value = null
      isOpen.value = false

      emit('dispose')
    }

    const $_disposeTimer = ref(null)
    const $_init = () => {
      if (props.trigger.indexOf('manual') === -1) {
        $_addEventListeners()
      }
    }

    const hidden = ref(null)
    const $_show = () => {
      const reference = props.trigger
      const popoverNode = popover.value

      clearTimeout($_disposeTimer.value)

      // Already open
      if (isOpen.value) {
        return
      }

      // Popper is already initialized
      if (popperInstance.value) {
        isOpen.value = true
        popperInstance.value.enableEventListeners()
        popperInstance.value.scheduleUpdate()
      }

      if (!$_mounted.value) {
        const container = $_findContainer(props.container, reference)
        if (!container) {
          console.warn('No container for popover', this)
          return
        }
        container.appendChild(popoverNode)
        $_mounted.value = true
      }

      if (!popperInstance.value) {
        const popperOptions = {
          ...props.popperOptions,
          placement: props.placement,
        }

        popperOptions.modifiers = {
          ...popperOptions.modifiers,
          arrow: {
            ...popperOptions.modifiers && popperOptions.modifiers.arrow,
            element: arrow.value,
          },
        }

        if (props.offset) {
          const offset = $_getOffset()

          popperOptions.modifiers.offset = {
            ...popperOptions.modifiers && popperOptions.modifiers.offset,
            offset,
          }
        }

        if (props.boundariesElement) {
          popperOptions.modifiers.preventOverflow = {
            ...popperOptions.modifiers && popperOptions.modifiers.preventOverflow,
            boundariesElement: props.boundariesElement,
          }
        }

        popperInstance.value = new Popper(reference, popoverNode, popperOptions)

        // Fix position
        requestAnimationFrame(() => {
          if (hidden.value) {
            hidden.value = false
            $_hide()
            return
          }

          if (!$_isDisposed.value && popperInstance.value) {
            popperInstance.value.scheduleUpdate()

            // Show the tooltip
            requestAnimationFrame(() => {
              if (hidden.value) {
                hidden.value = false
                $_hide()
                return
              }

              if (!$_isDisposed.value) {
                isOpen.value = true
              } else {
                dispose()
              }
            })
          } else {
            dispose()
          }
        })
      }

      const openGroup = props.openGroup
      if (openGroup) {
        let popover
        for (let i = 0; i < openPopovers.length; i++) {
          popover = openPopovers[i]
          if (popover.openGroup !== openGroup) {
            popover.hide()
            popover.$emit('close-group')
          }
        }
      }

      openPopovers.push(this)

      emit('apply-show')
    }
    const $_hide = () => {
      // Already hidden
      if (!isOpen.value) {
        return
      }

      const index = openPopovers.indexOf(this)
      if (index !== -1) {
        openPopovers.splice(index, 1)
      }

      isOpen.value = false
      if (popperInstance.value) {
        popperInstance.value.disableEventListeners()
      }

      clearTimeout($_disposeTimer.value)
      const disposeTime = directive.options.popover.disposeTimeout || directive.options.disposeTimeout
      if (disposeTime !== null) {
        $_disposeTimer.value = setTimeout(() => {
          const popoverNode = popover.value
          if (popoverNode) {
            // Don't remove popper instance, just the HTML element
            popoverNode.parentNode && popoverNode.parentNode.removeChild(popoverNode)
            $_mounted.value = false
          }
        }, disposeTime)
      }

      emit('apply-hide')
    }
    const $_findContainer = (container, reference) => {
      // if container is a query, get the relative element
      if (typeof container === 'string') {
        container = window.document.querySelector(container)
      } else if (container === false) {
        // if container is `false`, set it to reference parent
        container = reference.parentNode
      }
      return container
    }
    const $_getOffset = () => {
      const typeofOffset = typeof props.offset
      let offset = props.offset

      // One value -> switch
      if (typeofOffset === 'number' || (typeofOffset === 'string' && offset.indexOf(',') === -1)) {
        offset = `0, ${offset}`
      }

      return offset
    }
    const $_addEventListeners = () => {
      const reference = props.trigger
      const directEvents = []
      const oppositeEvents = []

      const events = typeof props.trigger === 'string'
        ? props.trigger
          .split(' ')
          .filter(
            trigger => ['click', 'hover', 'focus'].indexOf(trigger) !== -1
          )
        : []

      events.forEach(event => {
        switch (event) {
          case 'hover':
            directEvents.push('mouseenter')
            oppositeEvents.push('mouseleave')
            break
          case 'focus':
            directEvents.push('focus')
            oppositeEvents.push('blur')
            break
          case 'click':
            directEvents.push('click')
            oppositeEvents.push('click')
            break
        }
      })

      // schedule show tooltip
      directEvents.forEach(event => {
        const func = event => {
          if (isOpen.value) {
            return
          }
          event.usedByTooltip = true
          !$_preventOpen.value && show({ event: event })
          hidden.value = false
        }
        $_events.value.push({ event, func })
        reference.addEventListener(event, func)
      })

      // schedule hide tooltip
      oppositeEvents.forEach(event => {
        const func = event => {
          if (event.usedByTooltip) {
            return
          }
          hide({ event: event })
          hidden.value = true
        }
        $_events.value.push({ event, func })
        reference.addEventListener(event, func)
      })
    }
    
    const $_updatePopper = (cb) => {
      if (popperInstance.value) {
        cb()
        if (isOpen.value) popperInstance.value.scheduleUpdate()
      }
    }
    const $_restartPopper = () => {
      if (popperInstance.value) {
        const isOpen = isOpen.value
        dispose()
        $_isDisposed.value = false
        $_init()
        if (isOpen) {
          show({ skipDelay: true, force: true })
        }
      }
    }
    const $_handleGlobalClose = (event, touch = false) => {
      if ($_beingShowed.value) return

      hide({ event: event })

      if (event.closePopover) {
        emit('close-directive')
      } else {
        emit('auto-hide')
      }

      if (touch) {
        $_preventOpen.value = true
        setTimeout(() => {
          $_preventOpen.value = false
        }, 300)
      }
    }
    const $_handleResize = () => {
      if (isOpen.value && popperInstance.value) {
        popperInstance.value.scheduleUpdate()
        emit('resize')
      }
    }

    watch(() => props.open,
    (val)=> {
      if (val) {
        show()
      } else {
        hide()
      }
    })
    watch(() => props.disabled,
    (val) => {
      if (val !== oldVal) {
        if (val) {
          hide()
        } else if (props.open) {
          show()
        }
      }
    })
    watch(() => props.container,
    (val) => {
      if (isOpen.value && popperInstance.value) {
        const popoverNode = popover.value
        const reference = props.trigger

        const container = $_findContainer(props.container, reference)
        if (!container) {
          console.warn('No container for popover', this)
          return
        }

        container.appendChild(popoverNode)
        popperInstance.value.scheduleUpdate()
      }
    })
    watch(() => props.trigger,
    (val) => {
      $_removeEventListeners()
      $_addEventListeners()
    })
    watch(() => props.placement,
    (val) => {
      $_updatePopper(() => {
        popperInstance.value.options.placement = val
      })
    })
    watch(() => props.offset,
    (val) => {
      $_restartPopper()
    })
    watch(() => props.boundariesElement,
    (val) => {
      $_restartPopper()
    })
    watch(() => props.popperOptions,
    (val) => {
      $_restartPopper()
    },{deep: true,})

    onMounted(() => {
      const popoverNode = popover.value
      popoverNode.parentNode && popoverNode.parentNode.removeChild(popoverNode)

      $_init()

      if (props.open) {
        show()
      }
    })
    onBeforeUnmount(() => {
      dispose()
    })
    onDeactivated(()=> {
      hide()
    })

    return {
      isOpen,
      id,
      popover,
      arrow,
      $_isDisposed,
      $_mounted,
      $_events,
      $_preventOpen,
      cssClass,
      popoverId,
      $_beingShowed,
      popperInstance,
      $_disposeTimer,
      hidden,
    }
  },

  // data () {
  //   return {
  //     isOpen: false,
  //     id: Math.random().toString(36).substr(2, 10),
  //   }
  // },

  // computed: {
  //   cssClass () {
  //     return {
  //       [this.openClass]: isOpen.value,
  //     }
  //   },

  //   popoverId () {
  //     return `popover_${this.id}`
  //   },
  // },

  // watch: {
    // open (val) {
    //   if (val) {
    //     show()
    //   } else {
    //     hide()
    //   }
    // },

    // disabled (val, oldVal) {
    //   if (val !== oldVal) {
    //     if (val) {
    //       hide()
    //     } else if (this.open) {
    //       show()
    //     }
    //   }
    // },

    // container (val) {
    //   if (isOpen.value && popperInstance.value) {
    //     const popoverNode = popover.value
    //     const reference = props.trigger

    //     const container = $_findContainer(props.container, reference)
    //     if (!container) {
    //       console.warn('No container for popover', this)
    //       return
    //     }

    //     container.appendChild(popoverNode)
    //     popperInstance.value.scheduleUpdate()
    //   }
    // },

    // trigger (val) {
    //   $_removeEventListeners()
    //   $_addEventListeners()
    // },

    // placement (val) {
    //   $_updatePopper(() => {
    //     popperInstance.value.options.placement = val
    //   })
    // },

    // offset: '$_restartPopper',

    // boundariesElement: '$_restartPopper',

    // popperOptions: {
    //   handler: '$_restartPopper',
    //   deep: true,
    // },
  // },

  // created () {
  //   $_isDisposed.value = false
  //   $_mounted.value = false
  //   $_events.value = []
  //   $_preventOpen.value = false
  // },

  // mounted () {
  //   const popoverNode = popover.value
  //   popoverNode.parentNode && popoverNode.parentNode.removeChild(popoverNode)

  //   $_init()

  //   if (this.open) {
  //     show()
  //   }
  // },

  // beforeDestroy () {
  //   dispose()
  // },

  // methods: {
    // show ({ event, skipDelay = false, force = false } = {}) {
    //   if (force || !this.disabled) {
    //     this.$_scheduleShow(event)
    //     emit('show')
    //   }
    //   emit('update:open', true)
    //   $_beingShowed.value = true
    //   requestAnimationFrame(() => {
    //     $_beingShowed.value = false
    //   })
    // },

    // hide ({ event, skipDelay = false } = {}) {
    //   this.$_scheduleHide(event)

    //   emit('hide')
    //   emit('update:open', false)
    // },

    // dispose () {
    //   $_isDisposed.value = true
    //   $_removeEventListeners()
    //   hide({ skipDelay: true })
    //   if (popperInstance.value) {
    //     popperInstance.value.destroy()

    //     // destroy tooltipNode if removeOnDestroy is not set, as popperInstance.destroy() already removes the element
    //     if (!popperInstance.value.options.removeOnDestroy) {
    //       const popoverNode = popover.value
    //       popoverNode.parentNode && popoverNode.parentNode.removeChild(popoverNode)
    //     }
    //   }
    //   $_mounted.value = false
    //   popperInstance.value = null
    //   isOpen.value = false

    //   emit('dispose')
    // },

    // $_init () {
    //   if (props.trigger.indexOf('manual') === -1) {
    //     $_addEventListeners()
    //   }
    // },

    // $_show () {
    //   const reference = props.trigger
    //   const popoverNode = popover.value

    //   clearTimeout($_disposeTimer.value)

    //   // Already open
    //   if (isOpen.value) {
    //     return
    //   }

    //   // Popper is already initialized
    //   if (popperInstance.value) {
    //     isOpen.value = true
    //     popperInstance.value.enableEventListeners()
    //     popperInstance.value.scheduleUpdate()
    //   }

    //   if (!$_mounted.value) {
    //     const container = $_findContainer(props.container, reference)
    //     if (!container) {
    //       console.warn('No container for popover', this)
    //       return
    //     }
    //     container.appendChild(popoverNode)
    //     $_mounted.value = true
    //   }

    //   if (!popperInstance.value) {
    //     const popperOptions = {
    //       ...props.popperOptions,
    //       placement: props.placement,
    //     }

    //     popperOptions.modifiers = {
    //       ...popperOptions.modifiers,
    //       arrow: {
    //         ...popperOptions.modifiers && popperOptions.modifiers.arrow,
    //         element: arrow.value,
    //       },
    //     }

    //     if (props.offset) {
    //       const offset = $_getOffset()

    //       popperOptions.modifiers.offset = {
    //         ...popperOptions.modifiers && popperOptions.modifiers.offset,
    //         offset,
    //       }
    //     }

    //     if (props.boundariesElement) {
    //       popperOptions.modifiers.preventOverflow = {
    //         ...popperOptions.modifiers && popperOptions.modifiers.preventOverflow,
    //         boundariesElement: props.boundariesElement,
    //       }
    //     }

    //     popperInstance.value = new Popper(reference, popoverNode, popperOptions)

    //     // Fix position
    //     requestAnimationFrame(() => {
    //       if (hidden.value) {
    //         hidden.value = false
    //         $_hide()
    //         return
    //       }

    //       if (!$_isDisposed.value && popperInstance.value) {
    //         popperInstance.value.scheduleUpdate()

    //         // Show the tooltip
    //         requestAnimationFrame(() => {
    //           if (hidden.value) {
    //             hidden.value = false
    //             $_hide()
    //             return
    //           }

    //           if (!$_isDisposed.value) {
    //             isOpen.value = true
    //           } else {
    //             dispose()
    //           }
    //         })
    //       } else {
    //         dispose()
    //       }
    //     })
    //   }

    //   const openGroup = this.openGroup
    //   if (openGroup) {
    //     let popover
    //     for (let i = 0; i < openPopovers.length; i++) {
    //       popover = openPopovers[i]
    //       if (popover.openGroup !== openGroup) {
    //         popover.hide()
    //         popover.$emit('close-group')
    //       }
    //     }
    //   }

    //   openPopovers.push(this)

    //   emit('apply-show')
    // },

    // $_hide () {
    //   // Already hidden
    //   if (!isOpen.value) {
    //     return
    //   }

    //   const index = openPopovers.indexOf(this)
    //   if (index !== -1) {
    //     openPopovers.splice(index, 1)
    //   }

    //   isOpen.value = false
    //   if (popperInstance.value) {
    //     popperInstance.value.disableEventListeners()
    //   }

    //   clearTimeout($_disposeTimer.value)
    //   const disposeTime = directive.options.popover.disposeTimeout || directive.options.disposeTimeout
    //   if (disposeTime !== null) {
    //     $_disposeTimer.value = setTimeout(() => {
    //       const popoverNode = popover.value
    //       if (popoverNode) {
    //         // Don't remove popper instance, just the HTML element
    //         popoverNode.parentNode && popoverNode.parentNode.removeChild(popoverNode)
    //         $_mounted.value = false
    //       }
    //     }, disposeTime)
    //   }

    //   emit('apply-hide')
    // },

    // $_findContainer (container, reference) {
    //   // if container is a query, get the relative element
    //   if (typeof container === 'string') {
    //     container = window.document.querySelector(container)
    //   } else if (container === false) {
    //     // if container is `false`, set it to reference parent
    //     container = reference.parentNode
    //   }
    //   return container
    // },

    // $_getOffset () {
    //   const typeofOffset = typeof props.offset
    //   let offset = props.offset

    //   // One value -> switch
    //   if (typeofOffset === 'number' || (typeofOffset === 'string' && offset.indexOf(',') === -1)) {
    //     offset = `0, ${offset}`
    //   }

    //   return offset
    // },

    // $_addEventListeners () {
    //   const reference = props.trigger
    //   const directEvents = []
    //   const oppositeEvents = []

    //   const events = typeof props.trigger === 'string'
    //     ? props.trigger
    //       .split(' ')
    //       .filter(
    //         trigger => ['click', 'hover', 'focus'].indexOf(trigger) !== -1
    //       )
    //     : []

    //   events.forEach(event => {
    //     switch (event) {
    //       case 'hover':
    //         directEvents.push('mouseenter')
    //         oppositeEvents.push('mouseleave')
    //         break
    //       case 'focus':
    //         directEvents.push('focus')
    //         oppositeEvents.push('blur')
    //         break
    //       case 'click':
    //         directEvents.push('click')
    //         oppositeEvents.push('click')
    //         break
    //     }
    //   })

    //   // schedule show tooltip
    //   directEvents.forEach(event => {
    //     const func = event => {
    //       if (isOpen.value) {
    //         return
    //       }
    //       event.usedByTooltip = true
    //       !$_preventOpen.value && show({ event: event })
    //       hidden.value = false
    //     }
    //     $_events.value.push({ event, func })
    //     reference.addEventListener(event, func)
    //   })

    //   // schedule hide tooltip
    //   oppositeEvents.forEach(event => {
    //     const func = event => {
    //       if (event.usedByTooltip) {
    //         return
    //       }
    //       hide({ event: event })
    //       hidden.value = true
    //     }
    //     $_events.value.push({ event, func })
    //     reference.addEventListener(event, func)
    //   })
    // },

    // $_scheduleShow (event = null, skipDelay = false) {
    //   clearTimeout(this.$_scheduleTimer)
    //   if (skipDelay) {
    //     $_show()
    //   } else {
    //     // defaults to 0
    //     const computedDelay = parseInt((props.delay && props.delay.show) || props.delay || 0)
    //     this.$_scheduleTimer = setTimeout($_show.bind(this), computedDelay)
    //   }
    // },

    // $_scheduleHide (event = null, skipDelay = false) {
    //   clearTimeout(this.$_scheduleTimer)
    //   if (skipDelay) {
    //     $_hide()
    //   } else {
    //     // defaults to 0
    //     const computedDelay = parseInt((props.delay && props.delay.hide) || props.delay || 0)
    //     this.$_scheduleTimer = setTimeout(() => {
    //       if (!isOpen.value) {
    //         return
    //       }

    //       // if we are hiding because of a mouseleave, we must check that the new
    //       // reference isn't the tooltip, because in this case we don't want to hide it
    //       if (event && event.type === 'mouseleave') {
    //         const isSet = this.$_setTooltipNodeEvent(event)

    //         // if we set the new event, don't hide the tooltip yet
    //         // the new event will take care to hide it if necessary
    //         if (isSet) {
    //           return
    //         }
    //       }

    //       $_hide()
    //     }, computedDelay)
    //   }
    // },

    // $_setTooltipNodeEvent (event) {
    //   const reference = props.trigger
    //   const popoverNode = popover.value

    //   const relatedreference = event.relatedreference || event.toElement || event.relatedTarget

    //   const callback = event2 => {
    //     const relatedreference2 = event2.relatedreference || event2.toElement || event2.relatedTarget

    //     // Remove event listener after call
    //     popoverNode.removeEventListener(event.type, callback)

    //     // If the new reference is not the reference element
    //     if (!reference.contains(relatedreference2)) {
    //       // Schedule to hide tooltip
    //       hide({ event: event2 })
    //     }
    //   }

    //   if (popoverNode.contains(relatedreference)) {
    //     // listen to mouseleave on the tooltip element to be able to hide the tooltip
    //     popoverNode.addEventListener(event.type, callback)
    //     return true
    //   }

    //   return false
    // },

    // $_removeEventListeners () {
    //   const reference = props.trigger
    //   $_events.value.forEach(({ func, event }) => {
    //     reference.removeEventListener(event, func)
    //   })
    //   $_events.value = []
    // },

    // $_updatePopper (cb) {
    //   if (popperInstance.value) {
    //     cb()
    //     if (isOpen.value) popperInstance.value.scheduleUpdate()
    //   }
    // },

    // $_restartPopper () {
    //   if (popperInstance.value) {
    //     const isOpen = isOpen.value
    //     dispose()
    //     $_isDisposed.value = false
    //     $_init()
    //     if (isOpen) {
    //       show({ skipDelay: true, force: true })
    //     }
    //   }
    // },

    // $_handleGlobalClose (event, touch = false) {
    //   if ($_beingShowed.value) return

    //   hide({ event: event })

    //   if (event.closePopover) {
    //     emit('close-directive')
    //   } else {
    //     emit('auto-hide')
    //   }

    //   if (touch) {
    //     $_preventOpen.value = true
    //     setTimeout(() => {
    //       $_preventOpen.value = false
    //     }, 300)
    //   }
    // },

    // $_handleResize () {
    //   if (isOpen.value && popperInstance.value) {
    //     popperInstance.value.scheduleUpdate()
    //     emit('resize')
    //   }
    // },
  // },
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (isIOS) {
    document.addEventListener('touchend', handleGlobalTouchend, supportsPassive ? {
      passive: true,
      capture: true,
    } : true)
  } else {
    window.addEventListener('click', handleGlobalClick, true)
  }
}

function handleGlobalClick (event) {
  handleGlobalClose(event)
}

function handleGlobalTouchend (event) {
  handleGlobalClose(event, true)
}

function handleGlobalClose (event, touch = false) {
  // Delay so that close directive has time to set values
  for (let i = 0; i < openPopovers.length; i++) {
    let popover = openPopovers[i]
    if (popover.$refs.popover) {
      const contains = popover.$refs.popover.contains(event.target)
      requestAnimationFrame(() => {
        if (event.closeAllPopover || (event.closePopover && contains) || (popover.autoHide && !contains)) {
          popover.$_handleGlobalClose(event, touch)
        }
      })
    }
  }
}
</script>
