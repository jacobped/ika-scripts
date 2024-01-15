// ==UserScript==
// @name         Ikariam Check island slots
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Notify when island has slot available in world view
// @author       Domi95
// @match        https://*.ikariam.gameforge.com/*
// @icon         https://www.google.com/s2/favicons?domain=ikariam.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var cities = [];
    cities.push({"name":'Chraestios [87:94]', "max_slots": 17});

    setTimeout( function () {
        for(var i = 0; i < cities.length; i++){
            var diff = cities[i].max_slots - parseInt($(".islandTile[title='" + cities[i].name + "']").find(".cities").html());
            if(diff > 0){
                var id = $(".islandTile[title='" + cities[i].name + "']").find(".linkurl").attr('id');
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

})();
