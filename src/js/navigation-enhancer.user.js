// ==UserScript==
// @name         Ikariam Navigation Enhancer
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  try to take over the world!
// @author       Domi95
// @match        https://*.ikariam.gameforge.com/*
// @icon         https://www.google.com/s2/favicons?domain=ikariam.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function waitForIkariamModel(timeout = 30000, interval = 100) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            let errorCount = 0;
            let lastErrorMessage = null;
            const iv = setInterval(() => {
                try {
                    if (window.ikariam && window.ikariam.model) {
                        clearInterval(iv);
                        resolve();
                    } else if (Date.now() - start > timeout) {
                        clearInterval(iv);
                        reject(new Error('ikariam.model not found within timeout'));
                    }
                } catch (e) {
                    // keep a small, throttled log to aid future debugging without spamming
                    errorCount++;
                    const msg = e && e.message ? e.message : String(e);
                    if (errorCount === 1 || errorCount % 50 === 0 || msg !== lastErrorMessage) {
                        console.debug(`waitForIkariamModel polling error (#${errorCount}):`, e);
                        lastErrorMessage = msg;
                    }
                    // continue polling; do not reject immediately because ikariam may still initialize
                }
            }, interval);
        });
    }

    class IkariamCity {
        constructor(id, name, coords, good) {
            this.id = id;
            this.name = name;
            this.coords = coords;
            this.good = good;
        }

        getGoodName() {
            switch (this.good) {
                case 1:
                    return 'wine';
                case 2:
                    return 'marble';
                case 3:
                    return 'crystal';
                case 4:
                    return 'sulfur';
                default:
                    return '';
            }
        }
    }

    class IkariamNavigationEnhancer {
        constructor() {
            this.cityData = null;
            this.currentCityId = null;
        }

        init() {
            this.updateCityData();
            this.buildNavigation();
            this.bindEventHandler();
            this.addStyles();
        }

        addStyles() {
            const style = $('<style>').text(`
/** Ikariam Navigation Enhancer **/
.dtv-navigation {
    position: fixed;
    display: inline-block;
    bottom: 0;
    z-index: 99999;
    background: wheat;
    margin: auto;
    left: 50%;
    transform: translateX(-50%);
    box-shadow: 0 0 12px #575757;
}

.dtv-navigation div {
    display: inline-block;
    padding: 8px 0px;
}

.dtv-navigation div a {
     padding: 8px 20px;
}

.dtv-navigation div a:hover {
     background-color: #e2ca9b !important;
}

.dtv-navigation div.active {
     background-color: #d8ba80 !important;
}`);

            style.appendTo(document.head);
        }

        bindEventHandler() {
            document.onkeydown = function(e) {
                if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                    return;
                }

                switch (e.key) {
                    case 'ArrowLeft':
                        console.log(e);
                        this.prevCity();
                        break;
                    case 'ArrowRight':
                        this.nextCity();
                        break;
                    default:
                        return;
                }
            }.bind(this);
        }

        clearNavigation() {
            $('.dtv-navigation').remove();
        }

        buildNavigation() {
            const navigation = $('<div class="dtv-navigation">');

            this.cityData.forEach(function(city) {
                const cityItem = $('<div class="dropDownButton tradegood ' + city.getGoodName() + '"><a href="javascript:void(0)">' + city.name + '</a></div>');

                if (city.id === this.currentCityId) {
                    cityItem.addClass('active');
                }

                cityItem.click(function() {
                    this.changeCity(city.id);
                }.bind(this));

                navigation.append(cityItem);
            }.bind(this));

            $('body').append(navigation);
        }

        changeCity(id) {
            this.currentCityId = id;
            $('#js_cityIdOnChange').val(id);
            $('#changeCityForm').trigger('submit');

            this.clearNavigation();
            this.buildNavigation();
        }

        getKeyOfCurrentCity() {
            let currentKey = null;

            this.cityData.forEach(function(city, key) {
                if (city.id === this.currentCityId) {
                    currentKey = key;
                }
            }.bind(this));

            return currentKey;
        }

        getCityByKey(key) {
            return this.cityData[key];
        }

        prevCity() {
            const currentKey = this.getKeyOfCurrentCity();
            let preKey = currentKey - 1;

            if (preKey < 0) {
                preKey = this.cityData.length - 1;
            }

            const city = this.getCityByKey(preKey);
            this.changeCity(city.id);
        }

        nextCity() {
            const currentKey = this.getKeyOfCurrentCity();
            let nextKey = currentKey + 1;

            if (nextKey >= this.cityData.length) {
                nextKey = 0;
            }

            const city = this.getCityByKey(nextKey);
            this.changeCity(city.id);
        }

        updateCityData() {
            let cities = [];
            let city = null;

            for (let key in ikariam.model.relatedCityData) {
                if (!key.startsWith('city_')) {
                    continue;
                }

                city = ikariam.model.relatedCityData[key];

                cities.push(new IkariamCity(
                    city.id,
                    city.name,
                    city.coords,
                    parseInt(city.tradegood),
                ));
            }

            this.cityData = cities;

            try {
                this.currentCityId = ikariam.model.relatedCityData[ikariam.model.relatedCityData.selectedCity].id;
            } catch (e) {
            }
        }
    }

    // wait for ikariam.model before initializing
    waitForIkariamModel(30000, 150).then(() => {
        new IkariamNavigationEnhancer().init();
    }).catch((err) => {
        console.warn('Ikariam Navigation Enhancer: ' + err.message);
        // fallback: try a longer poll in case ikariam boots slowly
        waitForIkariamModel(120000, 250).then(() => {
            new IkariamNavigationEnhancer().init();
        }).catch(() => {
            console.warn('Ikariam Navigation Enhancer: giving up waiting for ikariam.model');
        });
    });

})();
