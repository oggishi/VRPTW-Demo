export class DataLoader {
    constructor(store) {
        this.store = store;
        this.SAMPLE_DATA_URL = 'data/nexus_demo.json'; // Đã trỏ lại về thư mục data nội bộ

        this.fileInput = document.getElementById('file-input');
        this.loadSampleBtn = document.getElementById('load-sample');
        this.dataStatus = document.getElementById('data-status');

        this.init();
    }

    init() {
        if(this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        }
        if(this.loadSampleBtn) {
            this.loadSampleBtn.addEventListener('click', () => this.loadSampleData());
        }
    }

    handleFileSelection(event) {
        const [file] = event.target.files ?? [];
        if (!file) return;

        this.updateStatus('Loading...', 'status-mini');

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result ?? ''));
                this.store.loadData(parsed, `Loaded from ${file.name}`);
                this.updateStatus(`Ready: ${file.name}`, 'status-mini success');
            } catch (error) {
                this.updateStatus(error.message, 'status-mini error');
            }
        };
        reader.onerror = () => this.updateStatus('Could not read file.', 'status-mini error');
        reader.readAsText(file);

        this.fileInput.value = ''; // Reset input
    }

    async loadSampleData() {
        this.updateStatus('Fetching sample data...', 'status-mini');
        try {
            const response = await fetch(this.SAMPLE_DATA_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const parsed = await response.json();
            this.store.loadData(parsed, 'Loaded Sample Dataset');
            this.updateStatus('Sample data loaded!', 'status-mini success');
        } catch (error) {
            this.updateStatus('Could not fetch sample data.', 'status-mini error');
            console.error(error);
        }
    }

    updateStatus(message, className) {
        if(this.dataStatus) {
            this.dataStatus.textContent = message;
            this.dataStatus.className = className;
        }
    }
}