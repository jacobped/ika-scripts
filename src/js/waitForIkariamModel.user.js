// ==UserScript==
// @name         Ikariam: waitForIkariamModel (lib)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Simple shared helper that resolves when window.ikariam.model is available
// @author       jacobped
// @match        https://*.ikariam.gameforge.com/*
// @grant        GM_log
// ==/UserScript==

(function (global) {
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

    // Enhanced synchronous model getter with unsafeWindow fallback
    function getModelSync() {
        try {
            // Try unsafeWindow first (more direct in userscript context)
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow && unsafeWindow.ikariam && unsafeWindow.ikariam.model) {
                return unsafeWindow.ikariam.model;
            }
        } catch (e) { /* ignore */ }
        
        try {
            // Fallback to cached model or global window
            if (whenModelReady._model) return whenModelReady._model;
            if (global.ikariam && global.ikariam.model) return global.ikariam.model;
        } catch (e) { /* ignore */ }
        
        return null;
    }

    // Simple, cached helper. Call without args: waitForIkariamModel().then(...)
    function waitForIkariamModel() {
        const FAST_PHASE_DURATION = 5000; // ms of fast polling
        const FAST_INTERVAL = 150;        // ms between checks during fast phase
        const SLOW_INTERVAL = 500;        // ms between checks during slow phase
        const TOTAL_TIMEOUT = 60000;      // ms before final rejection

        gm_log('waitForIkariamModel called');

        // immediate quick return if already present - enhanced check
        const existingModel = getModelSync();
        if (existingModel) {
            waitForIkariamModel._cached = Promise.resolve(existingModel);
            waitForIkariamModel._available = true;
            try { whenModelReady._model = existingModel; } catch (e) {}
            gm_log('Model already present — returning resolved promise');
            return waitForIkariamModel._cached;
        }

        // return cached promise if a poll is already running
        if (waitForIkariamModel._cached) {
            gm_log('Returning existing cached promise');
            return waitForIkariamModel._cached;
        }

        const startTime = Date.now();

        const p = new Promise((resolve, reject) => {
            let resolved = false;
            let observer = null;
            const timers = [];
            let lastPhase = 'fast';

            function cleanup() {
                if (observer) {
                    try { observer.disconnect(); } catch (e) { /* ignore */ }
                    observer = null;
                    gm_log('MutationObserver disconnected');
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
                gm_log('Model found — resolving');
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
                                gm_log('Detected new <script> node; scheduling immediate check');
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
                gm_log('MutationObserver attached to document');
            } catch (e) {
                gm_log('MutationObserver unavailable, falling back to polling only', e && e.message ? e.message : e);
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
                        gm_log('Timeout reached; rejecting promise after', TOTAL_TIMEOUT, 'ms');
                        reject(new Error('ikariam.model not found within timeout'));
                        return;
                    }
                    // decide next interval based on phase
                    const nextInterval = now < fastPhaseEnd ? FAST_INTERVAL : SLOW_INTERVAL;
                    const nextPhase = now < fastPhaseEnd ? 'fast' : 'slow';
                    if (nextPhase !== lastPhase) {
                        gm_log('Switching polling phase to', nextPhase, 'interval', nextInterval);
                        lastPhase = nextPhase;
                    }
                    scheduleNextPoll(nextInterval);
                }, interval);
                timers.push(t);
            }

            // kick off the polling loop
            gm_log('Starting polling loop (fast interval', FAST_INTERVAL, 'ms)');
            scheduleNextPoll(FAST_INTERVAL);
        });

        // cache but clear cache on final rejection
        waitForIkariamModel._cached = p.catch(err => {
            gm_log('Cached poll rejected; clearing cache', err && err.message ? err.message : err);
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
        // Enhanced immediate check - try to get model synchronously first
        const existing = getModelSync();
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

    // export
    const __IkariamWaitLib = { waitForIkariamModel, whenModelReady, getModelSync };
    try { global.__IkariamWaitLib = __IkariamWaitLib; } catch (e) {}
    global.__IkariamWaitLib = __IkariamWaitLib;

})(window);
