// ==UserScript==
// @name         Ikariam: waitForIkariamModel (lib)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Simple shared helper that resolves when window.ikariam.model is available
// @author       jacobped
// @match        https://*.ikariam.gameforge.com/*
// @grant        none
// ==/UserScript==

(function (global) {
    'use strict';

    // Simple, cached helper. Call without args: waitForIkariamModel().then(...)
    function waitForIkariamModel() {
        const FIRST_TIMEOUT = 30000;
        const FIRST_INTERVAL = 150;
        const FALLBACK_TIMEOUT = 120000;
        const FALLBACK_INTERVAL = 250;

        // cached promise so multiple consumers don't duplicate polling
        if (waitForIkariamModel._cached) return waitForIkariamModel._cached;

        function poll(timeout, interval) {
            return new Promise((resolve, reject) => {
                const start = Date.now();
                let errorCount = 0;
                let lastErrorMessage = null;
                const iv = setInterval(() => {
                    try {
                        if (global.ikariam && global.ikariam.model) {
                            clearInterval(iv);
                            resolve(global.ikariam.model);
                        } else if (Date.now() - start > timeout) {
                            clearInterval(iv);
                            reject(new Error('ikariam.model not found within timeout'));
                        }
                    } catch (e) {
                        errorCount++;
                        const msg = e && e.message ? e.message : String(e);
                        if (errorCount === 1 || errorCount % 50 === 0 || msg !== lastErrorMessage) {
                            console.debug(`waitForIkariamModel polling error (#${errorCount}):`, e);
                            lastErrorMessage = msg;
                        }
                        // keep polling
                    }
                }, interval);
            });
        }

        // first attempt, then fallback attempt if needed
        const p = poll(FIRST_TIMEOUT, FIRST_INTERVAL).catch(() => {
            console.info('waitForIkariamModel: first attempt failed, trying fallback');
            return poll(FALLBACK_TIMEOUT, FALLBACK_INTERVAL);
        });

        // cache but drop cache if final rejection happens so future callers can try again
        waitForIkariamModel._cached = p.catch(err => {
            waitForIkariamModel._cached = null;
            throw err;
        });

        return waitForIkariamModel._cached;
    }

    // export
    const __IkariamWaitLib = { waitForIkariamModel };
    try { global.__IkariamWaitLib = __IkariamWaitLib; } catch (e) {}
    global.__IkariamWaitLib = __IkariamWaitLib;

})(window);
