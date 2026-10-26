import { createApp } from 'vue';
import App from './App.vue';
import { initializeStores, pinia } from './store';
import { applyTheme, useThemeStore } from './store/themeStore';
// Ashen's typefaces, bundled so the installed PWA doesn't depend on a font CDN.
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import './style.css';
import './assets/scss/main.scss';
import './assets/scss/themes/ashen.scss';

const app = createApp(App);

app.use(pinia);
applyTheme(useThemeStore().theme);
initializeStores();

app.mount('#app');
