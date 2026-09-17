import { createApp } from 'vue';
import App from './App.vue';
import { initializeStores, pinia } from './store';
import './style.css';
import './assets/scss/main.scss';

const app = createApp(App);

app.use(pinia);
initializeStores();

app.mount('#app');
