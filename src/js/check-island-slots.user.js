// ==UserScript==
// @name         Ikariam Check island slots
// @namespace    https://tampermonkey.net/
// @version      0.3
// @description  Notify when specific island has slot available while in world view
// @author       Skillz0r & jacobped
// @icon         https://www.google.com/s2/favicons?domain=ikariam.com
// @match        *://*.ikariam.gameforge.com/?view=worldmap_iso*
// @grant        GM_notification
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require      https://github.com/jacobped/ika-scripts/raw/refs/heads/master/src/js/waitForIkariamModel.user.js
// ==/UserScript==

(function() {
    'use strict';
    
    function checkIslandSlots() {
        var cities = [];
        // Add more cities.push lines to monitor more island. Needs the fill name from island view.
        cities.push({"name":'Chraestios [87:94]', "max_slots": 17});

        setTimeout( function () {
            for(var i = 0; i < cities.length; i++){
                var diff = cities[i].max_slots - parseInt($(".islandTile[title='" + cities[i].name + "']").find(".cities").html());
                if(diff > 0){
                    var id = $(".islandTile[title='" + cities[i].name + "']").find(".linkurl").attr('id');
                    GM_notification ( {title: 'Slot avaliable',
                                       image: 'https://s304-en.ikariam.gameforge.com/cdn/all/both/world/insel_2.png',
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
