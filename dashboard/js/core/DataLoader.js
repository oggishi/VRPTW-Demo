export class DataLoader {
    constructor(store) {
        this.store = store;
        this.SAMPLE_DATA_URL = './data/sample.json';

        this.elements = {
            fileInput: document.getElementById('file-input'),
            loadSampleBtn: document.getElementById('load-sample'),
            saveFileBtn: document.getElementById('save-file'),
            dataStatus: document.getElementById('data-status'),
            datasetList: document.getElementById('dataset-list'),
        };

        this.init();
    }

    init() {
        if(this.elements.fileInput) this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        if(this.elements.loadSampleBtn) this.elements.loadSampleBtn.addEventListener('click', () => this.loadSampleData());
        if(this.elements.saveFileBtn) this.elements.saveFileBtn.addEventListener('click', () => this.store.exportData());

        this.store.subscribe((state) => {
            this.renderDatasetList(state);
            if (state.data) {
                this.updateStatus(`Viewing: ${state.sourceLabel}`, 'status-mini success');
            } else {
                this.updateStatus(`No file loaded`, 'status-mini');
            }
        });
    }

    renderDatasetList(state) {
        if (!this.elements.datasetList) return;
        this.elements.datasetList.innerHTML = '';

        state.inventory.forEach(dataset => {
            const li = document.createElement('li');
            li.className = `dataset-item ${dataset.id === state.activeId ? 'active' : ''}`;

            li.innerHTML = `
        <span class="label" title="${dataset.label}">${dataset.label}</span>
        <button class="btn-remove" title="Remove Workspace">✕</button>
      `;

            li.querySelector('.label').addEventListener('click', () => this.store.setActiveDataset(dataset.id));
            li.querySelector('.btn-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this.store.removeDataset(dataset.id);
            });

            this.elements.datasetList.appendChild(li);
        });
    }

    handleFileSelection(event) {
        const [file] = event.target.files ?? [];
        if (!file) return;

        this.updateStatus('Loading...', 'status-mini');
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result ?? ''));
                this.store.loadData(parsed, file.name);
            } catch (error) {
                this.updateStatus(error.message, 'status-mini error');
            }
        };
        reader.onerror = () => this.updateStatus('Could not read file.', 'status-mini error');
        reader.readAsText(file);
        this.elements.fileInput.value = '';
    }

    async loadSampleData() {
        this.updateStatus('Fetching sample data...', 'status-mini');
        try {
            const response = await fetch(this.SAMPLE_DATA_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const parsed = await response.json();
            this.store.loadData(parsed, 'sample.json');
        } catch (error) {
            this.updateStatus('Could not fetch sample data.', 'status-mini error');
        }
    }

    updateStatus(message, className) {
        if(this.elements.dataStatus) {
            this.elements.dataStatus.textContent = message;
            this.elements.dataStatus.className = className;
        }
    }
}