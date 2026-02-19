export class Store {
    constructor() {
        this.state = {
            data: null,
            sourceLabel: 'No file loaded yet.',
            activeKey: null,
            selectedRouteIndex: 0,
        };

        this.solutionRegistry = [
            { key: 'rl_alns', label: 'DDQN-ALNS' },
            { key: 'alns', label: 'ALNS' },
        ];

        // Danh sách các hàm (views) sẽ được gọi mỗi khi data thay đổi
        this.listeners = [];
    }

    // View nào muốn tự động update khi có data mới thì đăng ký qua hàm này
    subscribe(listener) {
        this.listeners.push(listener);
    }

    // Thông báo cho tất cả các View cập nhật lại
    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    loadData(parsedData, label) {
        this.validateData(parsedData);
        this.state.data = parsedData;
        this.state.sourceLabel = label;
        this.state.activeKey = this.pickDefaultSolution(parsedData);
        this.state.selectedRouteIndex = 0;

        console.log('Store: Data loaded successfully!', this.state);
        this.notify(); // Kích hoạt re-render
    }

    validateData(data) {
        if (!data || typeof data !== 'object') throw new Error('The JSON root must be an object.');
        if (!Array.isArray(data.nodes) || data.nodes.length < 2) throw new Error('Expected a nodes array with at least depot + 1 customer.');
        if (!data.alns && !data.rl_alns) throw new Error('Expected at least one solution block: alns or rl_alns.');
    }

    pickDefaultSolution(data) {
        const firstAvailable = this.solutionRegistry.find(item => Boolean(data[item.key]));
        return firstAvailable ? firstAvailable.key : null;
    }

    getActiveSolution() {
        if (!this.state.data || !this.state.activeKey) return null;
        return this.state.data[this.state.activeKey] ?? null;
    }
}