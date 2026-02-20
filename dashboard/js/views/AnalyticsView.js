export class AnalyticsView {
    constructor(store) {
        this.store = store;
        this.chartCanvas = document.getElementById('convergence-chart');
        this.chartInstance = null;

        // Lắng nghe dữ liệu
        this.store.subscribe((state) => {
            this.render(state);
        });
    }

    render(state) {
        // Chỉ chạy khi có data và Canvas
        if (!state.data || !this.chartCanvas) return;

        const datasets = [];
        let maxIterations = 0;

        // Lấy mảng lịch sử hội tụ (nếu có)
        const alnsHistory = state.data.alns?.history;
        const rlHistory = state.data.rl_alns?.history;

        // Cấu hình đường vẽ cho Baseline (ALNS) - Xanh nhạt
        if (alnsHistory && Array.isArray(alnsHistory)) {
            maxIterations = Math.max(maxIterations, alnsHistory.length);
            datasets.push({
                label: 'ALNS (Baseline)',
                data: alnsHistory,
                borderColor: '#59A5D8',
                backgroundColor: '#59A5D8',
                borderWidth: 2,
                pointRadius: 0, // Tắt chấm tròn để đường mượt hơn
                tension: 0.1
            });
        }

        // Cấu hình đường vẽ cho DDQN-ALNS - Xanh đen (Nổi bật hơn)
        if (rlHistory && Array.isArray(rlHistory)) {
            maxIterations = Math.max(maxIterations, rlHistory.length);
            datasets.push({
                label: 'DDQN-ALNS (Proposed)',
                data: rlHistory,
                borderColor: '#042940',
                backgroundColor: '#042940',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.1
            });
        }

        // Nếu data không có mảng history, xóa biểu đồ (nếu có) và dừng lại
        if (datasets.length === 0) {
            if (this.chartInstance) this.chartInstance.destroy();
            return;
        }

        // Tạo mảng trục X (Từ 1 đến tổng số vòng lặp)
        const labels = Array.from({ length: maxIterations }, (_, i) => i + 1);

        // Hủy biểu đồ cũ trước khi vẽ cái mới (tránh bị lỗi vẽ đè chuột)
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        // Bắt đầu vẽ
        this.chartInstance = new Chart(this.chartCanvas, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false, // Trỏ chuột vào là hiện tooltip cả 2 đường
                },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        backgroundColor: 'rgba(4, 41, 64, 0.9)',
                        titleFont: { size: 13 },
                        bodyFont: { size: 14, weight: 'bold' }
                    }
                },
                scales: {
                    y: {
                        title: { display: true, text: 'Total Distance (Objective)' },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                        title: { display: true, text: 'Iterations' },
                        ticks: { maxTicksLimit: 15 },
                        grid: { display: false }
                    }
                }
            }
        });
    }
}