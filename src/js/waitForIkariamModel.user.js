// ==UserScript==
// @name         Ikariam: waitForIkariamModel (lib)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Simple shared helper that resolves when window.ikariam.model is available
// @author       jacobped
// @match        https://*.ikariam.gameforge.com/*
// @grant        none
// ==/UserScript==

(function (global) {
    'use strict';

    // Simple, cached helper. Call without args: waitForIkariamModel().then(...)
    function waitForIkariamModel() {
        const FAST_PHASE_DURATION = 5000; // ms of fast polling
        const FAST_INTERVAL = 150;        // ms between checks during fast phase
        const SLOW_INTERVAL = 500;        // ms between checks during slow phase
        const TOTAL_TIMEOUT = 60000;      // ms before final rejection

        // immediate quick return if already present
        try {
            if (global.ikariam && global.ikariam.model) {
                const model = global.ikariam.model;
                waitForIkariamModel._cached = Promise.resolve(model);
                waitForIkariamModel._available = true;
                try { whenModelReady._model = model; } catch (e) {}
                return waitForIkariamModel._cached;
            }
        } catch (e) {
            // ignore synchronous access errors and continue to observation/polling
        }

        // return cached promise if a poll is already running
        if (waitForIkariamModel._cached) return waitForIkariamModel._cached;

        const startTime = Date.now();

        const p = new Promise((resolve, reject) => {
            let resolved = false;
            let observer = null;
            const timers = [];

            function cleanup() {
                if (observer) {
                    try { observer.disconnect(); } catch (e) {}
                    observer = null;
                }
                for (const t of timers) clearTimeout(t);
                timers.length = 0;
            }

            function onFound() {
                if (resolved) return;
                try {
                    if (!(global.ikariam && global.ikariam.model)) return false;
                } catch (e) {
                    return false;
                }
                resolved = true;
                cleanup();
                waitForIkariamModel._available = true;
                try { whenModelReady._model = global.ikariam.model; } catch (e) {}
                resolve(global.ikariam.model);
                return true;
            }

            // initial check
            if (onFound()) return;

            // MutationObserver to detect newly added <script> nodes
            try {
                observer = new MutationObserver(mutations => {
                    for (const m of mutations) {
                        for (const node of m.addedNodes) {
                            if (node && node.nodeType === 1 && node.tagName && node.tagName.toLowerCase() === 'script') {
                                // for external scripts, wait for load; for inline scripts, schedule an immediate check
                                try {
                                    node.addEventListener('load', () => { setTimeout(onFound, 0); }, { once: true });
                                    node.addEventListener('error', () => { setTimeout(onFound, 0); }, { once: true });
                                } catch (e) { /* ignore if node doesn't support events */ }
                                // schedule a microtask in case inline script executed immediately
                                setTimeout(onFound, 0);
                            }
                        }
                    }
                });
                observer.observe(document, { childList: true, subtree: true });
            } catch (e) {
                // if observer cannot be created (very old env), fall back to polling only
            }

            // continuous polling with fast then slow intervals until TOTAL_TIMEOUT
            const fastPhaseEnd = startTime + FAST_PHASE_DURATION;
            function scheduleNextPoll(interval) {
                const t = setTimeout(() => {
                    if (resolved) return;
                    if (onFound()) return;
                    const now = Date.now();
                    if (now - startTime >= TOTAL_TIMEOUT) {
                        cleanup();
                        waitForIkariamModel._available = false;
                        reject(new Error('ikariam.model not found within timeout'));
                        return;
                    }
                    // decide next interval based on phase
                    const nextInterval = now < fastPhaseEnd ? FAST_INTERVAL : SLOW_INTERVAL;
                    scheduleNextPoll(nextInterval);
                }, interval);
                timers.push(t);
            }

            // kick off the polling loop
            scheduleNextPoll(FAST_INTERVAL);
        });

        // cache but clear cache on final rejection
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
