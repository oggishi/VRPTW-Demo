export class AlgoSwitcher {
    constructor(store) {
        this.store = store;
        this.container = document.getElementById('algo-switcher');

        // Lắng nghe store, hễ data đổi là vẽ lại nút
        this.store.subscribe((state) => this.render(state));
    }

    render(state) {
        if (!this.container || !state.data) {
            if (this.container) this.container.innerHTML = '';
            return;
        }

        this.container.innerHTML = '';

        // Duyệt qua danh sách thuật toán khai báo trong Store
        this.store.solutionRegistry.forEach(sol => {
            // Chỉ hiện nút nếu trong file JSON có data của thuật toán đó
            if (state.data[sol.key]) {
                const btn = document.createElement('button');
                // Nút nào đang được chọn thì highlight lên (button-primary)
                btn.className = `button ${state.activeKey === sol.key ? 'button-primary' : ''}`;
                btn.textContent = sol.label;
                btn.style.marginLeft = '8px'; // Cách nhau ra một chút cho đẹp

                // Sự kiện click để chuyển đổi thuật toán
                btn.onclick = () => {
                    this.store.state.activeKey = sol.key;
                    this.store.notify(); // Ra lệnh cho toàn bộ View (Map, Chart) vẽ lại!
                };

                this.container.appendChild(btn);
            }
        });
    }
}