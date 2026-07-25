// ==UserScript==
// @name         Ikariam Check island slots
// @namespace    https://tampermonkey.net/
// @version      0.3
// @description  Notify when specific island has slot available while in world view
// @author       Skillz0r & jacobped
// @icon         https://www.google.com/s2/favicons?domain=ikariam.com
// @match        *://*.ikariam.gameforge.com/?view=worldmap_iso*
// @grant        GM_notification
// @grant        GM_log
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require      https://github.com/jacobped/ika-scripts/raw/refs/heads/master/src/js/waitForIkariamModel.user.js
// ==/UserScript==

(function() {
    'use strict';

    // small gm_log wrapper: prefer GM_log, then global.gm_log, then console.log
    function gm_log(/* ...args */) {
        const args = Array.prototype.slice.call(arguments);
        try {
            if (typeof GM_log === 'function') { GM_log.apply(null, args); return; }
        } catch (e) {}
        try {
            if (global && typeof global.gm_log === 'function') { global.gm_log.apply(global, args); return; }
        } catch (e) {}
        try { console.log('[waitForIkariamModel]', ...args); } catch (e) {}
    }

    function createNoticeBox(message, islandName) {
        // Create container
        const noticeBox = document.createElement('div');
        noticeBox.id = 'ika-notice-box';
        noticeBox.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
            border: 2px solid #FF8C00;
            border-radius: 8px;
            padding: 15px 20px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: Arial, sans-serif;
            color: #333;
        `;

        // Create content
        noticeBox.innerHTML = `
            <div style="margin: 0; padding: 0;">
                <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">⚠️ Slot Available!</div>
                <div style="font-size: 13px;">${message}</div>
                <div style="font-size: 12px; margin-top: 8px; color: #666; font-style: italic;">${islandName}</div>
            </div>
        `;

        document.body.appendChild(noticeBox);

        // Auto-remove after 8 seconds
        setTimeout(() => {
            noticeBox.style.opacity = '0';
            noticeBox.style.transition = 'opacity 0.5s ease-out';
            setTimeout(() => noticeBox.remove(), 500);
        }, 8000);

        return noticeBox;
    }

    function checkIslandSlots() {
        gm_log('checkIslandSlots called');
        var cities = [];
        // Add more cities.push lines to monitor more island. Needs the fill name from island view.
        cities.push({"name":'Hateetia [90:70]', "max_slots": 18});

        setTimeout( function () {
            for(var i = 0; i < cities.length; i++){
                var diff = cities[i].max_slots - parseInt($(".islandTile[title='" + cities[i].name + "']").find(".cities").html());
                if(diff > 0){
                    var id = $(".islandTile[title='" + cities[i].name + "']").find(".linkurl").attr('id');

                    // Show visual notice box in bottom left
                    createNoticeBox(diff + " slot(s) available", cities[i].name);
                    gm_log('checkIslandSlots available');

                    // Original notification
                    GM_notification ( {title: 'Slot avaliable',
                                       image: 'https://s302-en.ikariam.gameforge.com/cdn/all/both/world/insel_2.png',
                                       text: diff + " slot(s) available on " + cities[i].name,
                                       onclick: function(event){
                                           document.getElementById(id).click();
                                           location.href = document.getElementById(id).getAttribute("href");
                                       }
                                      } );
                    clearTimeout(timeOut);
                }
            }
        }, 500);

        var timeOut = setTimeout( function () {
            location.reload();
            // How often to refresh if left in world view.
            // 900000 = 15 minutes
        },900000 );
    }

    // wait for ikariam.model before initializing (use shared lib)
    const lib = typeof __IkariamWaitLib !== 'undefined' ? __IkariamWaitLib : window.__IkariamWaitLib;
    if (!lib) console.warn('Ikariam Check Island Slots: wait-for-ikariam-model lib not loaded');
    else lib.waitForIkariamModel().then(() => checkIslandSlots());
})();
