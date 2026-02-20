export class TabController {
    constructor() {
        // Cập nhật class mới theo UI Sidebar mỏng
        this.buttons = document.querySelectorAll('.nav-btn');
        this.views = document.querySelectorAll('.workspace-view');

        if (this.buttons.length === 0) {
            console.warn('TabController: No tab buttons found. Check HTML classes.');
            return;
        }

        this.buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = `view-${btn.dataset.target}`;
                this.switchTab(btn, targetId);
            });
        });
    }

    switchTab(activeBtn, targetId) {
        // Tắt highlight tất cả các nút, bật nút được click
        this.buttons.forEach(b => b.classList.remove('active'));
        activeBtn.classList.add('active');

        // Ẩn tất cả các màn hình
        this.views.forEach(v => {
            v.style.display = 'none';
            v.classList.remove('active');
        });

        // Hiện màn hình tương ứng
        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.style.display = 'block';
            targetView.classList.add('active');
        }
    }
}