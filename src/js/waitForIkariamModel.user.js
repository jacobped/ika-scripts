// ==UserScript==
// @name         Ikariam: waitForIkariamModel (lib)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Simple shared helper that resolves when window.ikariam.model is available
// @author       jacobped
// @match        https://*.ikariam.gameforge.com/*
// @grant        none
// ==/UserScript==

(function (global) {
    'use strict';

    // Simple, cached helper. Call without args: waitForIkariamModel().then(...)
    function waitForIkariamModel() {
        const FIRST_TIMEOUT = 5000;
        const FIRST_INTERVAL = 150;
        const FALLBACK_TIMEOUT = 30000;
        const FALLBACK_INTERVAL = 250;

        // If the model is already present, cache and return immediately
        try {
            if (global.ikariam && global.ikariam.model) {
                const model = global.ikariam.model;
                // cache resolved promise so all future callers return immediately
                waitForIkariamModel._cached = Promise.resolve(model);
                // mark availability and propagate to whenModelReady quick getter
                waitForIkariamModel._available = true;
                try { whenModelReady._model = model; } catch (e) { /* whenModelReady may be hoisted; ignore if not */ }
                return waitForIkariamModel._cached;
            }
        } catch (e) {
            // ignore synchronous access errors, continue to polling
        }

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
                            // mark discovered so future calls can short-circuit
                            waitForIkariamModel._available = true;
                            try { whenModelReady._model = global.ikariam.model; } catch (e) {}
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
            waitForIkariamModel._available = false;
            throw err;
        });

        return waitForIkariamModel._cached;
    }

    // --- Added convenience helpers ---
    // whenModelReady(callback) -> runs callback(model) when model is ready (returns promise)
    // whenModelReady() -> returns promise resolving to model
    function whenModelReady(callback) {
        // if model already discovered, return quickly
        const existing = whenModelReady._model || (global.ikariam && global.ikariam.model);
        if (existing) {
            whenModelReady._model = existing;
            if (typeof callback === 'function') {
                try { return Promise.resolve(callback(existing)); } catch (e) { return Promise.reject(e); }
            }
            return Promise.resolve(existing);
        }

        // otherwise wait
        const p = waitForIkariamModel().then(model => {
            whenModelReady._model = model;
            return model;
        });

        if (typeof callback === 'function') {
            return p.then(model => {
                try { return callback(model); } catch (e) { throw e; }
            });
        }
        return p;
    }

    // quick synchronous getter (may be null)
    function getModelSync() {
        return whenModelReady._model || (global.ikariam && global.ikariam.model) || null;
    }
    // --- end additions ---

    // export
    const __IkariamWaitLib = { waitForIkariamModel, whenModelReady, getModelSync };
    try { global.__IkariamWaitLib = __IkariamWaitLib; } catch (e) {}
    global.__IkariamWaitLib = __IkariamWaitLib;

})(window);
