import { TabController } from './components/TabController.js';
import { Store } from './core/Store.js';
import { DataLoader } from './core/DataLoader.js';
import { InspectorView } from './views/InspectorView.js';
import { DispatchView } from './views/DispatchView.js';
import { AnalyticsView } from './views/AnalyticsView.js';
import { AlgoSwitcher } from './components/AlgoSwitcher.js';
import { SetupView } from './views/SetupView.js'; // <-- THÊM DÒNG NÀY

document.addEventListener('DOMContentLoaded', () => {
  console.log('Nexus Dashboard: Initializing...');

  const tabController = new TabController();
  const store = new Store();
  const dataLoader = new DataLoader(store);
  const algoSwitcher = new AlgoSwitcher(store);

  const setupView = new SetupView(); // <-- THÊM DÒNG NÀY
  const inspectorView = new InspectorView(store);
  const dispatchView = new DispatchView(store);
  const analyticsView = new AnalyticsView(store);
});