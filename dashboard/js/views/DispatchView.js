export class DispatchView {
    constructor(store) {
        this.store = store;
        this.mapContainer = document.getElementById('map-container');
        this.map = null;
        this.layerGroup = null;
        this.REAL_DEPOT = { lat: 10.731931, lng: 106.699341 };

        this.store.subscribe((state) => this.render(state));
    }

    initMap() {
        this.map = L.map('map-container', {
            zoomControl: false // Đưa nút zoom đi chỗ khác cho đẹp
        }).setView([this.REAL_DEPOT.lat, this.REAL_DEPOT.lng], 15);

        // VERSION DỄ NHÌN: CartoDB Positron (Light & Clean)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);

        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
        this.layerGroup = L.layerGroup().addTo(this.map);
    }


    getProjectedLatLng(node, depot) {
        if (depot.x > 100 || depot.y > 100 || (depot.x < 180 && depot.x > -180 && node.x % 1 !== 0 && node.x < 100)) {
            return [node.y, node.x];
        }
        const deltaX = node.x - depot.x;
        const deltaY = node.y - depot.y;
        return [
            this.REAL_DEPOT.lat + (deltaY * this.SCALE_FACTOR),
            this.REAL_DEPOT.lng + (deltaX * this.SCALE_FACTOR)
        ];
    }

    async getRealRoadRoute(startLatLng, endLatLng) {
        const url = `https://router.project-osrm.org/route/v1/driving/${startLatLng[1]},${startLatLng[0]};${endLatLng[1]},${endLatLng[0]}?overview=full&geometries=geojson`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
                return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
            }
        } catch (e) {
            console.warn("OSRM routing failed, using fallback.");
        }
        return [startLatLng, endLatLng];
    }

    async render(state) {
        if (!state.data) return;
        if (!this.map) this.initMap();

        this.layerGroup.clearLayers();
        const nodes = state.data.nodes || [];
        if (nodes.length === 0) return;

        const depot = nodes.find(n => n.id === 0) || nodes[0];
        const allLatLngs = [];

        // 1. Render Nodes (Depot & Customers)
        nodes.forEach(node => {
            const latLng = this.getProjectedLatLng(node, depot);
            allLatLngs.push(latLng);

            const isDepot = node.id === depot.id;
            const circle = L.circleMarker(latLng, {
                radius: isDepot ? 10 : 6,
                fillColor: isDepot ? '#e11d48' : '#2563eb', // Depot (Red) vs Customer (Blue)
                color: '#ffffff',
                weight: 2,
                fillOpacity: 1
            });

            circle.bindPopup(`
        <div style="font-family: sans-serif;">
          <strong style="color: #1e293b;">${isDepot ? 'DEPOT (TDTU)' : 'CUSTOMER NODE ' + node.id}</strong><br/>
          <span style="font-size: 12px; color: #64748b;">
            Demand: ${node.demand} units<br/>
            Coord: [${node.x.toFixed(2)}, ${node.y.toFixed(2)}]
          </span>
        </div>
      `);
            circle.addTo(this.layerGroup);
        });

        const activeSolution = state.data[state.activeKey];
        const fleetRoutes = [];

        // 2. Render Real-road Polylines
        if (activeSolution && activeSolution.routes) {
            const colors = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#06b6d4', '#8b5cf6'];

            const routePromises = activeSolution.routes.map(async (route, index) => {
                const routePoints = (route.nodes || []).map(nodeId => {
                    const node = nodes.find(n => n.id === nodeId);
                    return node ? this.getProjectedLatLng(node, depot) : null;
                }).filter(coord => coord !== null);

                let fullPath = [];
                for (let i = 0; i < routePoints.length - 1; i++) {
                    const segment = await this.getRealRoadRoute(routePoints[i], routePoints[i+1]);
                    fullPath = fullPath.concat(segment);
                }

                if (fullPath.length > 1) {
                    L.polyline(fullPath, {
                        color: colors[index % colors.length],
                        weight: 4,
                        opacity: 0.7,
                        lineJoin: 'round'
                    }).addTo(this.layerGroup);

                    fleetRoutes.push(fullPath);
                }
            });

            await Promise.all(routePromises);
        }

        if (allLatLngs.length > 0) {
            this.map.fitBounds(allLatLngs, { padding: [50, 50] });
        }

        this.animateFleet(fleetRoutes);
    }

    // 3. Professional SVG Fleet Animation

    animateFleet(routes) {
        const vehicleSvg = `<svg width="24" height="24" viewBox="0 0 24 24"><path d="M1 14H18V18H1V14Z" fill="#1e293b"/><path d="M14 6H1V14H14V6Z" fill="#334155"/><circle cx="4" cy="18" r="2" fill="#000"/></svg>`;
        const icon = L.divIcon({ html: vehicleSvg, className: '', iconSize: [24, 24] });

        routes.forEach(path => {
            const marker = L.marker(path[0], { icon }).addTo(this.layerGroup);
            let step = 0;

            const move = () => {
                if (step >= path.length - 1) return;

                const start = path[step];
                const end = path[step + 1];
                let progress = 0;

                const lerp = () => {
                    progress += 0.05; // Tốc độ di chuyển giữa 2 node (chỉnh nhỏ lại để mượt hơn)
                    if (progress >= 1) {
                        step++;
                        move();
                        return;
                    }

                    const lat = start[0] + (end[0] - start[0]) * progress;
                    const lng = start[1] + (end[1] - start[1]) * progress;
                    marker.setLatLng([lat, lng]);
                    requestAnimationFrame(lerp); // Chạy 60 khung hình/giây
                };
                lerp();
            };
            setTimeout(move, Math.random() * 2000);
        });
    }

}