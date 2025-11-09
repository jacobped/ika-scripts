// ==UserScript==
// @name         Ikariam Map Enhancer
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  try to take over the world!
// @author       Domi95
// @match        https://*.ikariam.gameforge.com/*?view=worldmap_iso*
// @icon         https://www.google.com/s2/favicons?domain=ikariam.com
// @grant        none
// @require      https://github.com/jacobped/ika-scripts/raw/refs/heads/master/src/js/waitForIkariamModel.user.js
// ==/UserScript==

(function() {
    'use strict';

    function init() {
        bindEventHandler();
        updateMapEmptyIslands();
        updateMapOwnIslands();
    }

    function bindEventHandler() {
        $( "#worldview" ).mouseup(function() {
            updateMapEmptyIslands();
        });
    }

    function updateMapEmptyIslands() {
        $('.cities').each(function() {
            if(this.innerText === "0") {
                $(this).parent().css('opacity', 0.5);
            } else {
                $(this).parent().css('opacity', 1);
            }
        });
    }

    function updateMapOwnIslands() {
        $('.own, .ally').css('filter', 'drop-shadow(0px 10px 4px #000)');
        $('.piracyInRange').css('opacity', 0.75);
    }

    console.log('Ikariam Map Enhancer loaded :)');
    
    // wait for ikariam.model before initializing (use shared lib)
    const lib = typeof __IkariamWaitLib !== 'undefined' ? __IkariamWaitLib : window.__IkariamWaitLib;
    if (!lib) console.warn('Ikariam Map Enhancer: wait-for-ikariam-model lib not loaded');
    else lib.waitForIkariamModel().then(() => init());
})();
