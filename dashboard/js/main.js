import { TabController } from './components/TabController.js';
import { Store } from './core/Store.js';
import { DataLoader } from './core/DataLoader.js';
import { InspectorView } from './views/InspectorView.js';
import { DispatchView } from './views/DispatchView.js';
import { AnalyticsView } from './views/AnalyticsView.js';
// 1. THÊM DÒNG NÀY:
import { AlgoSwitcher } from './components/AlgoSwitcher.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('Nexus Dashboard: Initializing...');
  const tabController = new TabController();
  const store = new Store();
  const dataLoader = new DataLoader(store);

  const algoSwitcher = new AlgoSwitcher(store);

  const inspectorView = new InspectorView(store);
  const dispatchView = new DispatchView(store);
  const analyticsView = new AnalyticsView(store);
});