export class TabController {
    constructor() {
        // Tìm tất cả các nút bấm ở thanh Sidebar
        this.tabButtons = document.querySelectorAll('.sidebar-nav .tab-btn');
        // Tìm tất cả các khu vực giao diện chính
        this.viewSections = document.querySelectorAll('.main-workspace .view-section');

        this.init();
    }

    init() {
        if (this.tabButtons.length === 0) {
            console.warn('TabController: No tab buttons found.');
            return;
        }

        // Gắn sự kiện click cho từng nút
        this.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => this.switchTab(e.currentTarget));
        });
    }

    switchTab(clickedButton) {
        // 1. Lấy tên tab từ thuộc tính data-tab (ví dụ: 'dispatch', 'analytics')
        const targetTabId = clickedButton.getAttribute('data-tab');
        if (!targetTabId) return;

        // 2. Xóa trạng thái active của TẤT CẢ các nút, và add vào nút vừa click
        this.tabButtons.forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');

        // 3. Ẩn TẤT CẢ các view và hiện view tương ứng
        this.viewSections.forEach(section => {
            if (section.id === `view-${targetTabId}`) {
                section.classList.remove('hidden');
                // setTimeout nhẹ để CSS Transition opacity mượt mà
                setTimeout(() => section.classList.add('active'), 10);
            } else {
                section.classList.remove('active');
                section.classList.add('hidden');
            }
        });

        console.log(`Switched to workspace: ${targetTabId}`);
    }
}