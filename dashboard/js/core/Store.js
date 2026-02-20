export class Store {
    constructor() {
        this.state = {
            inventory: [],
            activeId: null,
            data: null,
            sourceLabel: 'No file loaded',
            activeKey: null,
            selectedRouteIndex: 0,
        };
        this.solutionRegistry = [{ key: 'rl_alns', label: 'DDQN-ALNS' }, { key: 'alns', label: 'ALNS' }];
        this.listeners = [];
        this.loadFromCache();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        if (this.state.data || this.state.inventory.length > 0) listener(this.state);
    }

    notify() { this.listeners.forEach(listener => listener(this.state)); }

    loadData(parsedData, label) {
        this.validateData(parsedData);
        const exists = this.state.inventory.find(item => item.label === label);
        if (exists) {
            this.setActiveDataset(exists.id);
            return;
        }
        const newId = Date.now().toString();
        this.state.inventory.push({ id: newId, label: label, data: parsedData });
        this.setActiveDataset(newId);
    }

    setActiveDataset(id) {
        const target = this.state.inventory.find(item => item.id === id);
        if (!target) return;
        this.state.activeId = id;
        this.state.data = target.data;
        this.state.sourceLabel = target.label;
        this.state.activeKey = this.pickDefaultSolution(target.data);
        this.state.selectedRouteIndex = 0;
        this.saveToCache();
        this.notify();
    }

    removeDataset(id) {
        this.state.inventory = this.state.inventory.filter(item => item.id !== id);
        if (this.state.activeId === id) {
            if (this.state.inventory.length > 0) {
                this.setActiveDataset(this.state.inventory[0].id);
            } else {
                this.state.activeId = null;
                this.state.data = null;
                this.state.sourceLabel = 'No file loaded';
                this.saveToCache();
                this.notify();
            }
        } else {
            this.saveToCache();
            this.notify();
        }
    }

    saveToCache() {
        try { localStorage.setItem('nexus_cache', JSON.stringify(this.state)); }
        catch (e) { console.warn('Cache full'); }
    }

    loadFromCache() {
        try {
            const cached = localStorage.getItem('nexus_cache');
            if (cached) {
                const parsedData = JSON.parse(cached);
                this.state = { ...this.state, ...parsedData };
                if (!this.state.inventory) this.state.inventory = [];
            }
        } catch (e) { localStorage.removeItem('nexus_cache'); }
    }

    exportData() {
        if (!this.state.data) return alert('No data to save!');
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state.data, null, 2));
        const a = document.createElement('a');
        a.href = dataStr; a.download = `${this.state.sourceLabel}_export.json`;
        document.body.appendChild(a); a.click(); a.remove();
    }

    validateData(data) {
        if (!data || typeof data !== 'object') throw new Error('Invalid JSON');
        if (!data.alns && !data.rl_alns) throw new Error('Missing alns/rl_alns block');
    }

    pickDefaultSolution(data) {
        const first = this.solutionRegistry.find(item => Boolean(data[item.key]));
        return first ? first.key : null;
    }
}