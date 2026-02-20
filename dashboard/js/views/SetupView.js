export class SetupView {
    constructor(store, dispatchView) {
        this.store = store;
        this.dispatchView = dispatchView; // Cần truy cập map của DispatchView
        this.selectedNodes = [];

        this.initSliders();
        this.initToggles();
        this.initMapInteraction();
        this.initFileUpload();
    }

    initSliders() {
        const vInp = document.getElementById('inp-vehicles');
        const cInp = document.getElementById('inp-capacity');
        if (vInp) vInp.addEventListener('input', (e) => document.getElementById('val-vehicles').textContent = e.target.value);
        if (cInp) cInp.addEventListener('input', (e) => document.getElementById('val-capacity').textContent = e.target.value);
    }

    initToggles() {
        // Chuyển đổi giữa Map Pinning và Excel Import
        const tabs = document.querySelectorAll('.import-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const mode = tab.dataset.mode;
                document.getElementById('input-map-panel').style.display = mode === 'map' ? 'block' : 'none';
                document.getElementById('input-excel-panel').style.display = mode === 'excel' ? 'block' : 'none';
            });
        });
    }

    // TÍNH NĂNG THẢ GHIM TRÊN BẢN ĐỒ
    initMapInteraction() {
        // Đợi đến khi bản đồ Leaflet sẵn sàng
        const checkMap = setInterval(() => {
            if (this.dispatchView && this.dispatchView.map) {
                clearInterval(checkMap);
                this.dispatchView.map.on('click', (e) => {
                    // Chỉ cho phép thả ghim nếu đang ở tab Map Pinning
                    const activeTab = document.querySelector('.import-tab.active');
                    if (activeTab && activeTab.dataset.mode === 'map') {
                        this.addNodeAtLatLng(e.latlng.lat, e.latlng.lng);
                    }
                });
            }
        }, 500);
    }

    addNodeAtLatLng(lat, lng) {
        const id = this.selectedNodes.length + 1;
        const newNode = { id, lat, lng, name: `Customer ${id}`, demand: 20 };
        this.selectedNodes.push(newNode);

        // Vẽ ghim tạm thời lên bản đồ
        L.marker([lat, lng], {
            icon: L.divIcon({ html: `<div style="background:#0284c7; width:10px; height:10px; border-radius:50%; border:2px solid white;"></div>`, className: '' })
        }).addTo(this.dispatchView.layerGroup);

        this.updateNodeListUI();
    }

    updateNodeListUI() {
        const listEl = document.getElementById('node-list-preview');
        if (!listEl) return;
        if (this.selectedNodes.length === 0) {
            listEl.innerHTML = 'No points selected yet.';
            return;
        }
        listEl.innerHTML = this.selectedNodes.map(n => `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; padding:4px; border-bottom:1px solid #eee;">
                <span>📍 ${n.name}</span>
                <span style="color:#64748b;">[${n.lat.toFixed(4)}, ${n.lng.toFixed(4)}]</span>
            </div>
        `).join('');
    }

    // TÍNH NĂNG UPLOAD FILE (Giả lập)
    initFileUpload() {
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.onclick = () => document.getElementById('file-input').click();
            document.getElementById('file-input').onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    alert(`Đã nhận file: ${file.name}. Hệ thống đang phân tích dữ liệu...`);
                    // Ở đây sẽ dùng thư viện XLSX để đọc data thực tế
                }
            };
        }
    }
}