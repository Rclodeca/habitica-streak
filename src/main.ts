import { createApp } from 'vue';
import App from './App.vue';
import { useItemDropQueue } from './composables/useItemDropQueue';
import { initializeStores, pinia } from './store';
import './style.css';
import './assets/scss/main.scss';

const app = createApp(App);

app.use(pinia);
const { backfilledDrops } = initializeStores();
if (backfilledDrops.length > 0) useItemDropQueue().enqueueDrops(backfilledDrops);

app.mount('#app');
