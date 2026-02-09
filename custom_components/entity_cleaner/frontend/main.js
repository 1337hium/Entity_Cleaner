class EntityCleanerPanel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.candidates = [];
        this.selected = new Set();
        this.daysThreshold = 0;
        
        // Sorting and Filtering state
        this.sortField = 'days_unavailable'; // default sort by time
        this.sortDirection = 'desc'; // default longest time first
        this.statusFilter = 'all'; 
        this.lastBackupAuto = null;
        this.lastBackupManual = null;
    }

    set hass(hass) {
        this._hass = hass;
        if (!this.initialized) {
            this.initialized = true;
            this.fetchCandidates();
            this.fetchInfo();
            this.render();
        }
    }

    async fetchInfo() {
        if (!this._hass) return;
        try {
            const result = await this._hass.callWS({ type: 'entity_cleaner/get_info' });
            this.lastBackupAuto = result.last_backup_auto;
            this.lastBackupManual = result.last_backup_manual;
            this.render();
        } catch (err) {
            console.error("Backup Info Error:", err);
        }
    }

    async fetchCandidates() {
        if (!this._hass) return;
        try {
            const result = await this._hass.callWS({
                type: 'entity_cleaner/get_candidates',
                days: this.daysThreshold
            });
            this.candidates = result.candidates;
            this.render();
        } catch (err) {
            console.error(err);
            alert("Fehler beim Laden: " + err.message);
        }
    }

    getFilteredAndSortedCandidates() {
        // 1. Filter
        let data = this.candidates;
        if (this.statusFilter !== 'all') {
            data = data.filter(c => c.status === this.statusFilter);
        }

        // 2. Sort
        return data.sort((a, b) => {
            let valA = a[this.sortField];
            let valB = b[this.sortField];

            // Case insensitive string sort
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    handleSort(field) {
        if (this.sortField === field) {
            // Toggle direction
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'desc'; // Default desc for new field usually feels better for numbers, changed later if needed
            if(field === 'name' || field === 'entity_id' || field === 'platform' || field === 'status') {
                this.sortDirection = 'asc'; // A-Z for text
            }
        }
        this.render();
    }

    async createBackup() {
        const btn = this.shadowRoot.getElementById('btn-backup');
        try {
            if(btn) {
                btn.disabled = true;
                btn.innerText = "Erstelle...";
            }
            await this._hass.callWS({ type: 'entity_cleaner/backup' });
            alert("Backup erfolgreich gestartet!");
            // Wait a bit and refresh info
            setTimeout(() => this.fetchInfo(), 5000);
        } catch (e) {
            alert("Backup Fehler: " + e.message);
        } finally {
            if(btn) {
                btn.disabled = false;
                btn.innerText = "Backup erstellen";
            }
        }
    }

    async deleteSelected() {
        const ids = Array.from(this.selected);
        if (ids.length === 0) return;

        if (!confirm(`Bist du sicher? ${ids.length} Entities werden UNWIDERRUFLICH gelöscht.`)) {
            return;
        }

        try {
            const btn = this.shadowRoot.getElementById('btn-delete');
            if(btn) btn.innerText = "Lösche...";

            await this._hass.callWS({
                type: 'entity_cleaner/delete',
                entity_ids: ids
            });
            
            alert("Gelöscht!");
            
            // Optimistic update
            this.candidates = this.candidates.filter(c => !this.selected.has(c.entity_id));
            this.selected.clear();
            
            this.render();
            this.fetchCandidates();
        } catch (err) {
            alert("Fehler beim Löschen: " + err.message);
            this.render();
        }
    }

    render() {
        const style = `
            <style>
                :host {
                    font-family: var(--paper-font-body1_-_font-family);
                    background-color: var(--primary-background-color);
                    color: var(--primary-text-color);
                    display: block;
                    padding: 20px;
                    height: 100vh;
                    box-sizing: border-box;
                    overflow-y: auto;
                }
                ha-card {
                    background-color: var(--card-background-color);
                    border-radius: 4px;
                    box-shadow: var(--ha-card-box-shadow, 0 2px 2px 0 rgba(0, 0, 0, 0.14), 0 1px 5px 0 rgba(0, 0, 0, 0.12), 0 3px 1px -2px rgba(0, 0, 0, 0.2));
                    padding: 16px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                h1 { margin-top: 0; }
                
                /* Controls Header */
                .controls {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 20px;
                    justify-content: space-between;
                    align-items: end;
                    margin-bottom: 20px;
                    background: var(--secondary-background-color);
                    padding: 15px;
                    border-radius: 8px;
                }
                .control-group {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                .control-group label {
                    font-size: 12px;
                    font-weight: 500;
                    opacity: 0.8;
                }
                
                /* Inputs & Buttons */
                input[type="number"], select {
                    padding: 8px;
                    border-radius: 4px;
                    border: 1px solid var(--divider-color);
                    background: var(--card-background-color);
                    color: var(--primary-text-color);
                }
                button {
                    background-color: var(--primary-color);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                }
                button:hover { background-color: var(--primary-color-light, #4477aa); }
                button:disabled {
                    background-color: var(--disabled-text-color);
                    cursor: not-allowed;
                }
                button.danger { background-color: var(--error-color); }
                button.secondary { background-color: var(--secondary-text-color); }
                
                /* Table */
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th {
                    text-align: left;
                    border-bottom: 2px solid var(--divider-color);
                    padding: 12px;
                    cursor: pointer;
                    user-select: none;
                }
                th:hover { color: var(--primary-color); }
                td {
                    padding: 12px;
                    border-bottom: 1px solid var(--divider-color);
                }
                tr:hover { background-color: var(--secondary-background-color); }
                
                /* Status Badges */
                .status-badge {
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    text-transform: uppercase;
                    font-weight: bold;
                }
                .status-orphaned { background-color: rgba(244, 67, 54, 0.2); color: var(--error-color); }
                .status-unavailable { background-color: rgba(255, 152, 0, 0.2); color: var(--warning-color); }
                .status-unknown { background-color: rgba(158, 158, 158, 0.2); color: var(--secondary-text-color); }
                
                .sort-icon { display: inline-block; width: 12px; text-align: center; }
                
                .backup-info {
                    font-size: 12px;
                    margin-left: 10px;
                    opacity: 0.8;
                }
            </style>
        `;

        const visibleCandidates = this.getFilteredAndSortedCandidates();

        // Helper to render sort arrow
        const sortArrow = (field) => {
            if (this.sortField !== field) return '<span class="sort-icon"></span>';
            return this.sortDirection === 'asc' ? '<span class="sort-icon">▲</span>' : '<span class="sort-icon">▼</span>';
        };

        const rows = visibleCandidates.map(c => `
            <tr>
                <td><input type="checkbox" class="select-box" data-id="${c.entity_id}" ${this.selected.has(c.entity_id) ? 'checked' : ''}></td>
                <td>
                    <span style="font-weight: 500">${c.name}</span><br>
                    <small style="opacity:0.6; font-family: monospace;">${c.entity_id}</small>
                </td>
                <td>${c.platform}</td>
                <td><span class="status-badge status-${c.status}">${c.status}</span></td>
                <td>${c.days_unavailable > 9000 ? 'Unbekannt (Leiche?)' : c.days_unavailable + ' Tage'}</td>
            </tr>
        `).join('');

        // Unique Statuses for Filter Dropdown
        const statuses = ['all', ...new Set(this.candidates.map(c => c.status))];
        const statusOptions = statuses.map(s => 
            `<option value="${s}" ${this.statusFilter === s ? 'selected' : ''}>${s === 'all' ? 'Alle Status' : s}</option>`
        ).join('');

        const autoDate = this.lastBackupAuto ? new Date(this.lastBackupAuto).toLocaleString() : 'Nie';
        const manualDate = this.lastBackupManual ? new Date(this.lastBackupManual).toLocaleString() : 'Nie';

        this.shadowRoot.innerHTML = `
            ${style}
            <ha-card>
                <div style="padding: 0 10px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h1>Entity Cleaner 🧹</h1>
                        <p style="opacity: 0.8; margin-bottom: 25px;">
                            Verwalte defekte oder verwaiste Entities.
                        </p>
                    </div>
                    <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                        <span class="backup-info">Auto Backup: <b>${autoDate}</b></span>
                        <span class="backup-info">Manuelles Backup: <b>${manualDate}</b></span>
                        <button id="btn-backup" style="margin-top: 5px;">Backup erstellen</button>
                    </div>
                </div>
                
                <div class="controls">
                    <div style="display:flex; gap: 15px;">
                        <div class="control-group">
                            <label>Inaktiv seit (Tagen)</label>
                            <div style="display:flex; gap: 5px;">
                                <input type="number" id="days-input" value="${this.daysThreshold}" min="0" style="width: 60px;">
                                <button id="btn-refresh" title="Liste neu laden">↻</button>
                            </div>
                        </div>
                        
                        <div class="control-group">
                            <label>Status Filter</label>
                            <select id="status-filter">
                                ${statusOptions}
                            </select>
                        </div>
                    </div>

                    <div class="control-group">
                        <label>&nbsp;</label>
                        <button id="btn-delete" class="danger" ${this.selected.size === 0 ? 'disabled' : ''}>
                            🗑️ ${this.selected.size} Löschen
                        </button>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th width="30"><input type="checkbox" id="select-all"></th>
                            <th data-sort="name">Name / ID ${sortArrow('name')}</th>
                            <th data-sort="platform">Integration ${sortArrow('platform')}</th>
                            <th data-sort="status">Status ${sortArrow('status')}</th>
                            <th data-sort="days_unavailable">Inaktiv seit ${sortArrow('days_unavailable')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length > 0 ? rows : '<tr><td colspan="5" style="text-align:center; padding: 40px; opacity: 0.6;">Keine Entities gefunden (mit aktuellen Filtern) 🎉</td></tr>'}
                    </tbody>
                </table>
                <div style="margin-top: 10px; font-size: 12px; opacity: 0.6; text-align: right;">
                    Gesamt: ${this.candidates.length} | Angezeigt: ${visibleCandidates.length}
                </div>
            </ha-card>
        `;

        this.addEventListeners();
    }

    addEventListeners() {
        // Backup Button
        this.shadowRoot.getElementById('btn-backup').addEventListener('click', () => this.createBackup());

        // Refresh Button
        this.shadowRoot.getElementById('btn-refresh').addEventListener('click', () => {
            const inp = this.shadowRoot.getElementById('days-input');
            this.daysThreshold = parseInt(inp.value);
            this.fetchCandidates();
        });

        // Status Filter
        this.shadowRoot.getElementById('status-filter').addEventListener('change', (e) => {
            this.statusFilter = e.target.value;
            this.render();
        });

        // Delete Button
        this.shadowRoot.getElementById('btn-delete').addEventListener('click', () => this.deleteSelected());

        // Sort Headers
        this.shadowRoot.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                this.handleSort(th.getAttribute('data-sort'));
            });
        });

        // Select All
        const selectAll = this.shadowRoot.getElementById('select-all');
        if (selectAll) {
            // Check select-all box if all currently visible items are selected
            const visible = this.getFilteredAndSortedCandidates();
            const allVisibleSelected = visible.length > 0 && visible.every(c => this.selected.has(c.entity_id));
            selectAll.checked = allVisibleSelected;

            selectAll.addEventListener('change', (e) => {
                const visible = this.getFilteredAndSortedCandidates();
                if (e.target.checked) {
                    visible.forEach(c => this.selected.add(c.entity_id));
                } else {
                    visible.forEach(c => this.selected.delete(c.entity_id));
                }
                this.render();
            });
        }

        // Individual Checkboxes
        this.shadowRoot.querySelectorAll('.select-box').forEach(box => {
            box.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                if (e.target.checked) this.selected.add(id);
                else this.selected.delete(id);
                
                const btn = this.shadowRoot.getElementById('btn-delete');
                btn.innerText = `🗑️ ${this.selected.size} Löschen`;
                btn.disabled = this.selected.size === 0;

                const selectAllBox = this.shadowRoot.getElementById('select-all');
                const visible = this.getFilteredAndSortedCandidates();
                selectAllBox.checked = visible.length > 0 && visible.every(c => this.selected.has(c.entity_id));
            });
        });
    }
}

customElements.define('entity-cleaner-panel', EntityCleanerPanel);
