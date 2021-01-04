import {createApp} from 'vue'
import {createRouter, createWebHashHistory} from 'vue-router'
import VTooltip, { createTooltip, destroyTooltip } from '../'
import App from './App.vue'
import PageHome from './PageHome.vue'
import PageInstall from './PageInstall.vue'
const PageTable = () => import('./PageTable.vue')
const app = createApp(App)

app.use(VTooltip, {
  disposeTimeout: 5000,
  popover: {
    defaultPopperOptions: {
      modifiers: {
        preventOverflow: {
          padding: 12,
        },
      },
    },
  },
})

VTooltip.options.defaultDelay = {
  show: 300,
  hide: 0,
}

const router = createRouter(
  {
    history: createWebHashHistory(),
    routes: [
      { path: '/', name: 'home', component: PageHome },
      { path: '/install', name: 'install', component: PageInstall },
      { path: '/table', name: 'table', component: PageTable },
      { path: '/*', redirect: '/' },
    ],
})

app.use(router)

/* eslint-disable no-new */
app.mount('#app')

// Create tooltips without the directive
window.manualTooltip = () => {
  const el = document.querySelector('button')
  const tooltip = createTooltip(el, {
    content: 'This is a manual tooltip',
    placement: 'bottom',
    trigger: 'manual',
  })
  tooltip.show()
  setTimeout(() => {
    destroyTooltip(el)
  }, 2000)
}
