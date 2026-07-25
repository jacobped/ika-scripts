// ==UserScript==
// @name         Ikariam Check island slots
// @namespace    https://tampermonkey.net/
// @version      0.5
// @description  Notify when specific island has slot available while in world view
// @author       Skillz0r & jacobped
// @icon         https://www.google.com/s2/favicons?domain=ikariam.com
// @match        *://*.ikariam.gameforge.com/?view=worldmap_iso*
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

    // Get server ID from current hostname (e.g., s302-en from s302-en.ikariam.gameforge.com)
    function getServerId() {
        const match = window.location.hostname.match(/^(s\d+-[a-z]+)/);
        return match ? match[1] : 'default';
    }

    // Load islands from localStorage for current server
    function loadIslands() {
        const key = 'ika_islands_' + getServerId();
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    // Save islands to localStorage for current server
    function saveIslands(islands) {
        const key = 'ika_islands_' + getServerId();
        localStorage.setItem(key, JSON.stringify(islands));
    }

    function createConfigPanel() {
        const panel = document.createElement('div');
        panel.id = 'ika-config-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #eed6ad;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 15px;
            max-width: 350px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 9999;
            font-family: Arial, sans-serif;
            color: #333;
        `;

        panel.innerHTML = `
            <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-weight: bold; font-size: 14px;">🔧 Island Monitor</div>
                <div style="font-size: 11px; color: #666;">Server: ${getServerId()}</div>
            </div>
            
            <div style="margin-bottom: 10px;">
                <button id="ika-config-add-btn" style="width: 100%; padding: 8px; background: #559d3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">+ Add Island</button>
            </div>
            
            <div style="max-height: 250px; overflow-y: auto;">
                <div id="ika-island-list" style="font-size: 12px;"></div>
            </div>
        `;

        document.body.appendChild(panel);

        // Add event listener for Add button
        document.getElementById('ika-config-add-btn').addEventListener('click', openAddIslandModal);
        
        // Load and display islands
        renderIslandList();
    }

    // Extract form fields from modal
    function getFormFields(modalId) {
        const modal = document.getElementById(modalId);
        const name = modal.querySelector('.ika-form-name').value.trim();
        const x = parseInt(modal.querySelector('.ika-form-x').value);
        const y = parseInt(modal.querySelector('.ika-form-y').value);
        const slots = parseInt(modal.querySelector('.ika-form-slots').value) || 17;
        return { name, x, y, slots };
    }

    // Clear form fields for reuse
    function clearFormFields(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.querySelector('.ika-form-name').value = '';
            modal.querySelector('.ika-form-x').value = '';
            modal.querySelector('.ika-form-y').value = '';
            modal.querySelector('.ika-form-slots').value = '17';
        }
    }

    // Generic modal close with optional field clearing
    function closeModal(modalId, clearFields) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            if (clearFields) clearFormFields(modalId);
        }
    }

    // --- Add Modal ---
    function createAddIslandModal() {
        createFormModal('ika-add-modal', 'Add Island', saveAddIsland, () => closeModal('ika-add-modal', true));
    }

    function openAddIslandModal() {
        createAddIslandModal();
        document.getElementById('ika-add-modal').style.display = 'flex';
    }

    function saveAddIsland() {
        const { name, x, y, slots } = getFormFields('ika-add-modal');

        if (!name || isNaN(x) || isNaN(y)) {
            alert('Please fill in all fields');
            return;
        }

        const islands = loadIslands();
        islands.push({ name, x, y, max_slots: slots });
        saveIslands(islands);

        gm_log('[checkIslandSlots] Island added: ' + name + ' [' + x + ':' + y + ']');
        closeModal('ika-add-modal', true);
        renderIslandList();
        fetchAndUpdateIslandStatus(x, y, slots);
    }

    // Reusable modal factory
    function createFormModal(id, title, onSave, onCancel) {
        if (document.getElementById(id)) {
            return; // Modal already exists
        }

        const modal = document.createElement('div');
        modal.id = id;
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            z-index: 10000;
            align-items: center;
            justify-content: center;
        `;

        const inputStyle = 'width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;';
        const labelStyle = 'display: block; font-size: 12px; font-weight: bold; margin-bottom: 3px;';
        const buttonStyle = 'padding: 10px; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;';

        modal.innerHTML = `
            <div style="background: #eed6ad; border-radius: 8px; padding: 20px; max-width: 400px; width: 90%; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);">
                <div style="font-weight: bold; font-size: 16px; margin-bottom: 15px;">${title}</div>
                
                <div style="margin-bottom: 10px;">
                    <label style="${labelStyle}">Island Name</label>
                    <input class="ika-form-name" type="text" style="${inputStyle}">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <label style="${labelStyle}">X Coordinate</label>
                        <input class="ika-form-x" type="number" style="${inputStyle}">
                    </div>
                    <div>
                        <label style="${labelStyle}">Y Coordinate</label>
                        <input class="ika-form-y" type="number" style="${inputStyle}">
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="${labelStyle}">Max Slots</label>
                    <input class="ika-form-slots" type="number" value="17" style="${inputStyle}">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <button class="ika-form-save" style="${buttonStyle} background: #559d3c;">Save</button>
                    <button class="ika-form-cancel" style="${buttonStyle} background: #999;">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        modal.querySelector('.ika-form-save').addEventListener('click', onSave);
        modal.querySelector('.ika-form-cancel').addEventListener('click', onCancel);
        modal.addEventListener('click', (e) => e.target === modal && onCancel());

        return modal;
    }

    // --- Edit Modal ---
    let editingIslandIndex = null;

    function createEditModal() {
        createFormModal('ika-edit-modal', 'Edit Island', saveEditedIsland, () => {
            closeModal('ika-edit-modal', false);
            editingIslandIndex = null;
        });
    }

    function openEditModal(index) {
        const islands = loadIslands();
        const island = islands[index];
        if (!island) return;

        createEditModal();
        editingIslandIndex = index;

        const modal = document.getElementById('ika-edit-modal');
        modal.querySelector('.ika-form-name').value = island.name;
        modal.querySelector('.ika-form-x').value = island.x;
        modal.querySelector('.ika-form-y').value = island.y;
        modal.querySelector('.ika-form-slots').value = island.max_slots;

        modal.style.display = 'flex';
    }

    function saveEditedIsland() {
        const { name, x, y, slots } = getFormFields('ika-edit-modal');

        if (!name || isNaN(x) || isNaN(y) || isNaN(slots)) {
            alert('Please fill in all fields');
            return;
        }

        const islands = loadIslands();
        islands[editingIslandIndex] = { name, x, y, max_slots: slots };
        saveIslands(islands);

        gm_log('[checkIslandSlots] Island updated: ' + name + ' [' + x + ':' + y + ']');
        closeModal('ika-edit-modal', false);
        editingIslandIndex = null;
        renderIslandList();
        fetchAndUpdateIslandStatus(x, y, slots);
    }

    // Track current slot status for each island
    let islandSlotStatus = {};

    function getAvailableSlots(island) {
        const status = islandSlotStatus[island.x + ':' + island.y];
        return status ? (island.max_slots - status.numCities) : 0;
    }

    function renderIslandList() {
        const islands = loadIslands();
        const list = document.getElementById('ika-island-list');
        
        if (islands.length === 0) {
            list.innerHTML = '<div style="color: #999; font-style: italic;">No islands configured</div>';
            return;
        }

        list.innerHTML = islands.map((island, index) => {
            const key = island.x + ':' + island.y;
            const status = islandSlotStatus[key];
            const numCities = status ? status.numCities : '?';
            const availSlots = getAvailableSlots(island);
            
            // Determine background color based on slot availability
            const hasSlots = availSlots > 0;
            const bgColor = hasSlots ? '#ffeb3b' : '#f5f5f5';
            const alertIcon = hasSlots ? '⚠️ ' : '';

            return `
                <div class="ika-island-entry" data-island-id="${key}" style="padding: 8px; background: ${bgColor}; margin-bottom: 5px; border-radius: 4px; cursor: pointer; transition: background 0.2s; border: 2px solid transparent;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1; title='${numCities} cities / ${island.max_slots} max'">
                            <strong>${alertIcon}${island.name}</strong><br>
                            <span style="font-size: 11px; color: #666;">[${island.x}:${island.y}] (${numCities}/${island.max_slots})</span>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <button class="ika-edit-btn" data-index="${index}" style="padding: 4px 8px; background: #137cc4; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">Edit</button>
                            <button class="ika-remove-btn" data-index="${index}" style="padding: 4px 8px; background: #d14141; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">Remove</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners to island entries
        list.querySelectorAll('.ika-island-entry').forEach(entry => {
            const key = entry.getAttribute('data-island-id');
            
            // Click: navigate to island or open modal
            entry.addEventListener('click', function(e) {
                if (e.target.classList.contains('ika-edit-btn') || e.target.classList.contains('ika-remove-btn')) {
                    return;
                }
                const status = islandSlotStatus[key];
                if (status) {
                    gm_log('[renderIslandList] Navigating to island ' + key);
                    window.location.href = '?view=island&islandId=' + status.islandId;
                }
            });

            // Hover: show darker shade
            entry.addEventListener('mouseenter', function() {
                const availSlots = getAvailableSlots(islands.find(i => i.x + ':' + i.y === key));
                this.style.background = availSlots > 0 ? '#fdd835' : '#e8e8e8';
            });

            entry.addEventListener('mouseleave', function() {
                const availSlots = getAvailableSlots(islands.find(i => i.x + ':' + i.y === key));
                this.style.background = availSlots > 0 ? '#ffeb3b' : '#f5f5f5';
            });
        });

        // Edit button
        list.querySelectorAll('.ika-edit-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                openEditModal(parseInt(this.getAttribute('data-index')));
            });
        });

        // Remove button
        list.querySelectorAll('.ika-remove-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const index = parseInt(this.getAttribute('data-index'));
                const removed = islands.splice(index, 1)[0];
                delete islandSlotStatus[removed.x + ':' + removed.y];
                saveIslands(islands);
                renderIslandList();
                gm_log('[checkIslandSlots] Island removed: ' + removed.name);
            });
        });
    }

    function fetchAndUpdateIslandStatus(x, y, maxSlots) {
        const url = '?action=WorldMap&function=getJSONArea&x_min=' + x + '&x_max=' + x + '&y_min=' + y + '&y_max=' + y;
        
        ajaxHandlerCall(url, function(data) {
            try {
                const response = JSON.parse(data);
                gm_log('[fetchAndUpdateIslandStatus] Parsed JSON response for [' + x + ':' + y + ']:', response);
                
                if (!response.data || !response.data[x] || !response.data[x][y]) {
                    gm_log('[fetchAndUpdateIslandStatus] Island data not found for [' + x + ':' + y + ']');
                    return;
                }
                
                const islandData = response.data[x][y];
                const islandId = islandData[0];
                const numCities = parseInt(islandData[7]);
                
                if (isNaN(numCities)) {
                    gm_log('[fetchAndUpdateIslandStatus] ERROR: Failed to parse number of cities for [' + x + ':' + y + ']');
                    return;
                }
                
                // Update status
                islandSlotStatus[x + ':' + y] = { numCities, maxSlots, islandId };
                
                // Log result
                const diff = maxSlots - numCities;
                if (diff > 0) {
                    gm_log('[fetchAndUpdateIslandStatus] ✓ SLOTS AVAILABLE! ' + diff + ' slot(s) on [' + x + ':' + y + '] (' + numCities + '/' + maxSlots + ')');
                } else {
                    gm_log('[fetchAndUpdateIslandStatus] Status updated for [' + x + ':' + y + ']: ' + numCities + '/' + maxSlots);
                }
                
                renderIslandList();
            } catch (error) {
                gm_log('[fetchAndUpdateIslandStatus] ERROR: ' + error);
            }
        });
    }

    function checkIslandSlots() {
        var islands = loadIslands();
        
        if (islands.length === 0) {
            gm_log('[checkIslandSlots] No islands configured. Open the config panel (bottom right) to add islands.');
            return;
        }

        gm_log('[checkIslandSlots] Checking ' + islands.length + ' island(s)...');
        
        // Check each island by calling the shared fetch function
        for(var i = 0; i < islands.length; i++){
            var island = islands[i];
            fetchAndUpdateIslandStatus(island.x, island.y, island.max_slots);
        }
        
        // Schedule periodic refresh
        var timeOut = setTimeout( function () {
            gm_log('[checkIslandSlots] Auto-reload after 15 minutes');
            location.reload();
            // How often to refresh if left in world view.
            // 900000 = 15 minutes
        }, 900000 );
    }

    function init() {
        // Create config panel first
        createConfigPanel();
        // Then run the check
        checkIslandSlots();
    }

    // wait for ikariam.model before initializing (use shared lib)
    const lib = typeof __IkariamWaitLib !== 'undefined' ? __IkariamWaitLib : window.__IkariamWaitLib;
    if (!lib) console.warn('Ikariam Check Island Slots: wait-for-ikariam-model lib not loaded');
    else lib.waitForIkariamModel().then(() => init());
})();
