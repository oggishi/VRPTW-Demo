export class DispatchView {
    constructor(store) {
        this.store = store;
        this.mapContainer = document.getElementById('map-container');
        this.speedInput = document.getElementById('sim-speed');
        this.speedLabel = document.getElementById('speed-val');

        this.map = null;
        this.layerGroup = null;
        this.REAL_DEPOT = { lat: 10.731931, lng: 106.699341 };
        this.SCALE_FACTOR = 0.0005;
        this.simulationSpeed = 5;

        // Bộ nhớ đệm để không phải vẽ lại bản đồ khi click
        this.currentAlgoKey = null;
        this.mapElements = { polylines: [], nodes: [], cards: [], trucks: [] };

        this.initMap();
        this.initSpeedController();

        this.store.subscribe((state) => this.render(state));
    }

    initSpeedController() {
        if (this.speedInput) {
            this.speedInput.addEventListener('input', (e) => {
                this.simulationSpeed = parseInt(e.target.value);
                if (this.speedLabel) this.speedLabel.textContent = this.simulationSpeed;
            });
        }
    }

    initMap() {
        if (!this.mapContainer) return;
        this.mapContainer.innerHTML = '';
        this.map = L.map('map-container', { zoomControl: false }).setView([this.REAL_DEPOT.lat, this.REAL_DEPOT.lng], 15);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(this.map);
        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
        this.layerGroup = L.layerGroup().addTo(this.map);
    }

    getProjectedLatLng(node, depot) {
        if (depot.x > 100 || depot.y > 100 || (depot.x < 180 && depot.x > -180 && node.x % 1 !== 0 && node.x < 100)) {
            return [node.y, node.x];
        }
        return [
            this.REAL_DEPOT.lat + ((node.y - depot.y) * this.SCALE_FACTOR),
            this.REAL_DEPOT.lng + ((node.x - depot.x) * this.SCALE_FACTOR)
        ];
    }

    async getRealRoadRoute(routePoints) {
        const coordsString = routePoints.map(p => `${p[1]},${p[0]}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.routes && data.routes.length > 0) return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        } catch (e) { console.warn("OSRM routing failed."); }
        return routePoints;
    }

    // === HÀM XỬ LÝ CLICK KHÔNG RELOAD ===
    applyFocus(activeIndex, state) {
        const activeSolution = state.data[state.activeKey];
        let activeNodesSet = new Set();
        if (activeIndex !== null && activeSolution && activeSolution.routes[activeIndex]) {
            activeNodesSet = new Set(activeSolution.routes[activeIndex].nodes);
        }

        // 1. Cập nhật độ mờ của nét vẽ
        this.mapElements.polylines.forEach(item => {
            const isHovered = activeIndex === item.index;
            const isDimmed = activeIndex !== null && !isHovered;
            item.line.setStyle({
                weight: isHovered ? 8 : 4,
                opacity: isDimmed ? 0.05 : 0.85
            });
            if (isHovered) this.map.fitBounds(item.line.getBounds(), { padding: [80, 80], animate: true, duration: 0.5 });
        });

        // 2. Cập nhật độ mờ của Khách hàng
        this.mapElements.nodes.forEach(item => {
            const isFocused = activeIndex === null || activeNodesSet.has(item.id) || item.isDepot;
            item.marker.setStyle({ opacity: isFocused ? 1 : 0.15, fillOpacity: isFocused ? 1 : 0.15 });
            if (isFocused) item.marker.bringToFront();
        });

        // 3. Cập nhật giao diện Thẻ trạng thái
        this.mapElements.cards.forEach(item => {
            const isHovered = activeIndex === item.index;
            const isDimmed = activeIndex !== null && !isHovered;
            const cardEl = document.getElementById(`route-card-${item.index}`);
            if (cardEl) {
                cardEl.style.opacity = isDimmed ? '0.4' : '1';
                cardEl.style.border = isHovered ? '1px solid #0284c7' : '1px solid transparent';
                cardEl.style.borderLeft = `4px solid ${item.color}`;
                cardEl.style.background = isHovered ? '#f0f9ff' : 'white';
            }
        });

        // 4. Ẩn/Hiện xe tải
        this.mapElements.trucks.forEach(item => {
            const isVisible = activeIndex === null || activeIndex === item.index;
            item.marker.setOpacity(isVisible ? 1 : 0);
        });

        if (activeIndex === null && this.mapElements.polylines.length > 0) {
            const allBounds = L.featureGroup(this.mapElements.polylines.map(p => p.line)).getBounds();
            this.map.fitBounds(allBounds, { padding: [50, 50], animate: true, duration: 0.5 });
        }
    }

    async render(state) {
        if (!state.data) return;

        // NẾU CHỈ LÀ CLICK CHỌN TUYẾN -> KHÔNG RENDER LẠI, CHỈ ĐỔI MÀU FOCUS
        if (this.currentAlgoKey === state.activeKey) {
            this.applyFocus(state.activeHoverRoute, state);
            return;
        }

        // --- BẮT ĐẦU VẼ MỚI (Chỉ chạy 1 lần khi đổi data) ---
        this.currentAlgoKey = state.activeKey;
        this.layerGroup.clearLayers();
        this.mapElements = { polylines: [], nodes: [], cards: [], trucks: [] };

        const nodes = state.data.nodes || [];
        if (nodes.length === 0) return;

        const depot = nodes.find(n => n.id === 0) || nodes[0];
        const allLatLngs = [];

        nodes.forEach(node => {
            const latLng = this.getProjectedLatLng(node, depot);
            allLatLngs.push(latLng);
            const isDepot = node.id === depot.id;

            const marker = L.circleMarker(latLng, {
                radius: isDepot ? 10 : 4,
                fillColor: isDepot ? '#e11d48' : '#3b82f6',
                color: '#ffffff', weight: 2, fillOpacity: 1, opacity: 1
            }).bindPopup(`<strong>${isDepot ? 'DEPOT' : 'NODE ' + node.id}</strong><br>Demand: ${node.demand}`).addTo(this.layerGroup);

            this.mapElements.nodes.push({ id: node.id, marker: marker, isDepot });
        });

        const activeSolution = state.data[state.activeKey];
        const fleetRoutes = [];
        const statusList = document.getElementById('fleet-status-list');
        if (statusList) statusList.innerHTML = '';

        if (activeSolution && activeSolution.routes) {
            const colors = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#06b6d4', '#8b5cf6'];

            const routePromises = activeSolution.routes.map(async (route, index) => {
                const routePoints = (route.nodes || []).map(nodeId => nodes.find(n => n.id === nodeId) ? this.getProjectedLatLng(nodes.find(n => n.id === nodeId), depot) : null).filter(c => c !== null);

                if (routePoints.length > 1) {
                    const fullPath = await this.getRealRoadRoute(routePoints);
                    const color = colors[index % colors.length];

                    const polyline = L.polyline(fullPath, { color: color, weight: 4, opacity: 0.85, lineJoin: 'round', interactive: true }).addTo(this.layerGroup);
                    polyline.on('click', () => this.store.setHoverRoute(index));

                    this.mapElements.polylines.push({ index, line: polyline });

                    let totalLoad = (route.nodes || []).reduce((sum, nId) => sum + (nodes.find(x => x.id === nId)?.demand || 0), 0);
                    let distance = (route.dist || (Math.random() * 10 + 5)).toFixed(1); // Demo Distance

                    fleetRoutes.push({ path: fullPath, color, index, totalLoad });

                    if (statusList) {
                        statusList.innerHTML += `
                            <div id="route-card-${index}" class="status-card" data-index="${index}" style="cursor: pointer; padding: 12px; border-radius: 8px; border: 1px solid transparent; border-left: 4px solid ${color}; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.02); transition: all 0.2s;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-weight: 700; font-size: 14px; color: #0f172a;">Route ${index + 1}</span>
                                    <span id="timestatus-${index}" style="font-size: 11px; background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 12px; font-weight: bold;">On Time</span>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: #64748b; margin-bottom: 8px;">
                                    <div>Payload: <strong id="payload-${index}" style="color: #0f172a;">${totalLoad} kg</strong></div>
                                    <div>Distance: <strong style="color: #0f172a;">${distance} km</strong></div>
                                </div>

                                <div style="display: flex; gap: 6px; margin-bottom: 10px;">
                                    <span style="font-size: 10px; color: #475569; background: #f1f5f9; padding: 3px 6px; border-radius: 4px; display: flex; align-items: center; gap: 3px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> TW: 08:00-11:30
                                    </span>
                                    <span style="font-size: 10px; color: #475569; background: #f1f5f9; padding: 3px 6px; border-radius: 4px; display: flex; align-items: center; gap: 3px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Eff: 94%
                                    </span>
                                </div>

                                <div style="width: 100%; height: 5px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                                    <div id="progress-${index}" style="width: 0%; height: 100%; background: ${color};"></div>
                                </div>
                            </div>
                        `;
                        this.mapElements.cards.push({ index, color });
                    }
                }
            });

            await Promise.all(routePromises);

            if (statusList) {
                statusList.querySelectorAll('.status-card').forEach(card => {
                    card.addEventListener('click', () => this.store.setHoverRoute(parseInt(card.dataset.index)));
                });
            }
        }

        if (allLatLngs.length > 0) this.map.fitBounds(allLatLngs, { padding: [50, 50] });

        // Gọi xe xuất bến 1 lần duy nhất
        this.animateFleet(fleetRoutes);

        // Cập nhật lại UI nếu lỡ click trước khi render xong
        this.applyFocus(state.activeHoverRoute, state);
    }

    animateFleet(fleetData) {
        const icon = L.divIcon({
            html: `<div style="width:12px;height:12px;background:#0f172a;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
            className: '', iconSize: [12, 12], iconAnchor: [6, 6]
        });

        fleetData.forEach(routeData => {
            const { path, index, totalLoad } = routeData;
            if (!path || path.length === 0) return;

            const marker = L.marker(path[0], { icon }).addTo(this.layerGroup);
            this.mapElements.trucks.push({ index, marker });
            let step = 0;

            // Biến chống Jitter DOM
            let lastPayload = -1;
            let lastProgress = -1;

            const move = () => {
                if (step >= path.length - 1) {
                    const st = document.getElementById(`timestatus-${index}`);
                    if (st) {
                        st.textContent = 'Completed';
                        st.style.color = '#1e40af';
                        st.style.background = '#dbeafe';
                    }
                    return;
                }

                const start = path[step];
                const end = path[step + 1];
                let progress = 0;

                const lerp = () => {
                    progress += (0.01 * this.simulationSpeed);

                    if (progress >= 1) {
                        step++;
                        const percentDone = step / path.length;
                        const currentLoad = Math.max(0, Math.round(totalLoad * (1 - percentDone)));
                        const progressInt = Math.floor(percentDone * 100);

                        const loadEl = document.getElementById(`payload-${index}`);
                        const progEl = document.getElementById(`progress-${index}`);
                        const timeEl = document.getElementById(`timestatus-${index}`);

                        // CHỐNG JITTER: Chỉ cập nhật DOM khi số thay đổi
                        if (currentLoad !== lastPayload) {
                            if (loadEl) loadEl.textContent = `${currentLoad} kg`;
                            lastPayload = currentLoad;
                        }

                        if (progressInt !== lastProgress) {
                            if (progEl) progEl.style.width = `${progressInt}%`;
                            lastProgress = progressInt;
                        }

                        if (timeEl && percentDone > 0.6 && Math.random() > 0.998) {
                            timeEl.textContent = 'Delayed';
                            timeEl.style.color = '#991b1b';
                            timeEl.style.background = '#fee2e2';
                        }

                        move();
                        return;
                    }

                    marker.setLatLng([
                        start[0] + (end[0] - start[0]) * progress,
                        start[1] + (end[1] - start[1]) * progress
                    ]);
                    requestAnimationFrame(lerp);
                };
                lerp();
            };
            setTimeout(move, Math.random() * 800);
        });
    }
}