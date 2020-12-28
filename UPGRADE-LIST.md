add
===
1.  upgrade
name: @csii/v-tooltip-next
version: 2.1.3
keywords:  [vue3]
2.  add
@vue/compiler-sfc@3.x
3.  upgrade
rollup-plugin-vue@6.0.0
4.  upgrade
vue-router@4.0.1 vue@3.0.4
*5.  add
core-js@3.x
6.  upgrade
@vue/cli-service@~4.5.0 @vue/cli-plugin-babel@~4.5.0 @vue/cli-plugin-eslint@~4.5.0
7.  upgrade
vue-jest@5.x (vue-jest@5.0.0-alpha.7)
<!-- 8. downgrade
jest@24.0.0 (24.7.1 jest-runtime has no paramater for getCacheKey function) -->

remove
===
1.  vue-template-compiler
2.  @vue/test-utils
3.  @vue-resize
4.  jest-vue
5   

As runs

```sh
npm i 
```

warns:

```log
npm WARN deprecated @babel/polyfill@7.12.1: ???? This package has been deprecated in favor of separate inclusion of a polyfill and regenerator-runtime (when needed). See the @babel/polyfill docs (https://babeljs.io/docs/en/babel-polyfill) for more information.
npm WARN deprecated highlight.js@9.18.5: Support has ended for 9.x series. Upgrade to @latest
npm WARN deprecated rollup-plugin-commonjs@9.3.4: This package has been deprecated and is no longer maintained. Please use @rollup/plugin-commonjs.
npm WARN deprecated popper.js@1.16.1: You can find the new Popper v2 at @popperjs/core, this package is dedicated to the legacy v1
npm WARN deprecated rollup-plugin-replace@2.2.0: This module has moved and is now available at @rollup/plugin-replace. Please update your dependencies. This version is no longer maintained.
npm WARN deprecated core-js@2.6.12: core-js@<3 is no longer maintained and not recommended for usage due to the number of issues. Please, upgrade your dependencies to the actual version of core-js@3.
npm WARN deprecated @hapi/joi@15.1.1: joi is leaving the @hapi organization and moving back to 'joi' (https://github.com/sideway/joi/issues/2411)
npm WARN deprecated request@2.88.2: request has been deprecated, see https://github.com/request/request/issues/3142
npm WARN deprecated chokidar@2.1.8: Chokidar 2 will break on node v14+. Upgrade to chokidar 3 with 15x less dependencies.
npm WARN deprecated har-validator@5.1.5: this library is no longer supported
npm WARN deprecated fsevents@1.2.13: fsevents 1 will break on node v14+ and could be using insecure binaries. Upgrade to fsevents 2.
npm WARN deprecated kleur@2.0.2: Please upgrade to kleur@3 or migrate to 'ansi-colors' if you prefer the old syntax. Visit <https://github.com/lukeed/kleur/releases/tag/v3.0.0\> for migration path(s).
npm WARN deprecated left-pad@1.3.0: use String.prototype.padStart()
npm WARN vue-resize@0.4.5 requires a peer of vue@^2.3.0 but none is installed. You must install peer dependencies yourself.
npm WARN vue-jest@3.0.7 requires a peer of vue@^2.x but none is installed. You must install peer dependencies yourself.
npm WARN vue-jest@3.0.7 requires a peer of vue-template-compiler@^2.x but none is installed. You must install peer dependencies yourself.
npm WARN @vue/cli-service@4.5.9 requires a peer of vue-template-compiler@^2.0.0 but none is installed. You must install peer dependencies yourself.
npm WARN vue-jest@5.0.0-alpha.7 requires a peer of typescript@>= 3.x but none is installed. You must install peer dependencies yourself.
npm WARN @vue/babel-preset-app@4.5.9 requires a peer of core-js@^3 but none is installed. You must install peer dependencies yourself.
```


As runs
```sh
npm run test
```

errs
```log
...
```

add
===
upgrade
@vue/cli-plugin-unit-jest@4.x
add
typescript


