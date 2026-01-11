import typescript from '@rollup/plugin-typescript';

export default {
    input: 'src/main.ts',
    output: {
        file: 'dist/bnm-filter.user.js',
        format: 'iife',
        banner: `// ==UserScript==
// @name         BNM-Filter
// @namespace    URL
// @version      0.2.0
// @description  filter opened BNs in BN Management list
// @author       Sisyphus
// @license      MIT
// @homepage     https://github.com/SisypheOvO
// @match        https://bn.mappersguild.com/*
// @run-at       document-end
// @grant        none
// @downloadURL https://raw.githubusercontent.com/SisypheOvO/BNM-Filter/main/dist/bnm-filter.user.js
// @updateURL https://raw.githubusercontent.com/SisypheOvO/BNM-Filter/main/dist/bnm-filter.user.js
// ==/UserScript==

`,
    },
    plugins: [
        typescript({
            tsconfig: './tsconfig.json'
        })
    ]
};