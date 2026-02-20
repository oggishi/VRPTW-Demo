export class InspectorView {
    constructor(store) {
        this.store = store;

        // Tìm đúng 2 cái ID sinh tử mà chúng ta đã để sẵn trong index.html
        this.metaContainer = document.getElementById('meta-info');
        this.routeContainer = document.getElementById('route-details');

        // Lắng nghe dữ liệu
        this.store.subscribe((state) => {
            this.render(state);
        });
    }

    render(state) {
        // Nếu chưa có data thì dọn dẹp sạch sẽ
        if (!state.data) {
            if (this.metaContainer) {
                this.metaContainer.innerHTML = 'Vui lòng load file JSON để xem thông tin meta...';
            }
            if (this.routeContainer) {
                this.routeContainer.innerHTML = '';
            }
            return;
        }

        // Nếu có data thì vẽ bảng
        this.renderMeta(state.data);
        this.renderRoutes(state);
    }

    renderMeta(data) {
        // LỚP PHÒNG THỦ: Không có thẻ HTML thì cút luôn, không báo lỗi
        if (!this.metaContainer) return;

        const meta = data.meta || {};
        const totalNodes = data.nodes ? data.nodes.length : 0;

        // Giao diện Meta Data dạng lưới (Grid) hiện đại
        this.metaContainer.innerHTML = `
            <h3 style="margin-bottom: 12px; color: #0284c7; font-size: 16px;">Dataset: ${meta.dataset || 'Unknown'}</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; font-size: 14px; color: #334155;">
                <div style="background: white; padding: 10px; border-radius: 6px;"><strong>Instance:</strong> <br/>${meta.instance || 'N/A'}</div>
                <div style="background: white; padding: 10px; border-radius: 6px;"><strong>Customers:</strong> <br/>${meta.n_customers || totalNodes}</div>
                <div style="background: white; padding: 10px; border-radius: 6px;"><strong>Capacity:</strong> <br/>${meta.capacity || 'N/A'}</div>
                <div style="background: white; padding: 10px; border-radius: 6px;"><strong>Horizon:</strong> <br/>${meta.horizon || 'N/A'}</div>
            </div>
        `;
    }

    renderRoutes(state) {
        // LỚP PHÒNG THỦ
        if (!this.routeContainer) return;

        const activeSolution = state.data[state.activeKey];

        if (!activeSolution || !activeSolution.routes) {
            this.routeContainer.innerHTML = '<div style="color: #64748b; padding: 20px 0;">Không có dữ liệu tuyến đường cho thuật toán này.</div>';
            return;
        }

        // 1. Khởi tạo chuỗi HTML với phần Tiêu đề
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="color: #0f172a; font-size: 16px;">Routes Distribution</h3>
                <span style="background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                    Algo: ${activeSolution.algo || state.activeKey}
                </span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
        `;

        // 2. Vòng lặp Javascript (Nằm ĐỘC LẬP bên ngoài chuỗi HTML)
        activeSolution.routes.forEach((route, index) => {
            const distance = route.dist ? route.dist.toFixed(2) : 'N/A';
            const nodesStr = route.nodes ? route.nodes.join(' <span style="color:#cbd5e1;">➔</span> ') : 'Empty';

            // Kiểm tra xem Route này có đang được click không để đổi màu nổi bật
            const isActive = state.activeHoverRoute === index;
            const borderStyle = isActive ? 'border: 2px solid #0284c7; background: #f0f9ff;' : 'border: 1px solid #e2e8f0; background: #f8fafc;';

            // CỘNG DỒN chuỗi HTML cho từng thẻ Card
            html += `
                <div class="route-card" data-index="${index}" style="padding: 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s; ${borderStyle}">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; color: #0f172a; margin-bottom: 8px;">
                        <span>🚚 Route ${index + 1}</span>
                        <span style="font-weight: normal; color: #64748b; font-size: 13px;">Distance: <strong>${distance}</strong></span>
                    </div>
                    <div style="font-family: monospace; color: #475569; font-size: 14px; word-wrap: break-word;">
                        ${nodesStr}
                    </div>
                </div>
            `;
        });

        // 3. Đóng thẻ Div bọc ngoài
        html += '</div>';

        // 4. In toàn bộ HTML ra giao diện
        this.routeContainer.innerHTML = html;

        // 5. Gắn sự kiện CLICK cho từng thẻ Card (Để làm tính năng Cross-filtering)
        this.routeContainer.querySelectorAll('.route-card').forEach(card => {
            card.addEventListener('click', () => {
                this.store.setHoverRoute(parseInt(card.dataset.index));
            });
        });
    }
}