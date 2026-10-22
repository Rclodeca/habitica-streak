<script setup lang="ts">
import { useCombatActions } from '../../composables/useCombatActions';
import { useDeathScreen } from '../../composables/useDeathScreen';
import { useBossStore } from '../../store/bossStore';
import { useCharacterStore } from '../../store/characterStore';
import Modal from './Modal.vue';

const { isDead } = useDeathScreen();
const { restart } = useCombatActions();
const bossStore = useBossStore();
const characterStore = useCharacterStore();
</script>

<template>
  <Modal :model-value="isDead" :dismissible="false" max-width="360px">
    <div class="death">
      <p class="title">You died</p>
      <div class="stone">
        <span class="rip">R · I · P</span>
        <span class="cross" />
      </div>

      <h2>Level {{ characterStore.character.level }} hero</h2>
      <p class="meta">Fell to Boss {{ bossStore.boss.index }}</p>

      <ul class="lines">
        <li class="keep">Skills &amp; streaks are kept</li>
        <li class="fresh">A new hero will be rolled</li>
      </ul>

      <button type="button" class="restart-button" @click="restart">Start new run</button>
    </div>
  </Modal>
</template>

<style scoped>
.death {
  text-align: center;
}

.title {
  margin: 0 0 1rem;
  color: var(--damage-color);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
  text-transform: uppercase;
}

.stone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 130px;
  margin: 0 auto 1rem;
  padding: 1.5rem 0.5rem 1.1rem;
  background: linear-gradient(#4b4f5c, #363945);
  border-radius: 70px 70px 6px 6px;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.07);
}

.rip {
  color: #b9bdc9;
  font-size: 0.6rem;
  letter-spacing: 0.35em;
  text-indent: 0.35em;
}

.cross {
  position: relative;
  width: 22px;
  height: 30px;
}

.cross::before,
.cross::after {
  content: '';
  position: absolute;
  background: #d4d7e0;
  border-radius: 1px;
}

.cross::before {
  left: 50%;
  top: 0;
  width: 4px;
  height: 100%;
  transform: translateX(-50%);
}

.cross::after {
  left: 0;
  top: 8px;
  width: 100%;
  height: 4px;
}

h2 {
  margin: 0;
  color: var(--text-h);
  font-size: 1.25rem;
}

.meta {
  margin: 0.15rem 0 1.1rem;
  font-size: 0.8rem;
}

.lines {
  display: grid;
  gap: 0.45rem;
  margin: 0 0 1.3rem;
  padding: 0;
  list-style: none;
  color: var(--text-h);
  font-size: 0.86rem;
}

.lines li::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 0.5rem;
  vertical-align: middle;
  border-radius: 50%;
  background: var(--c);
}

.keep {
  --c: var(--heal-color);
}

.fresh {
  --c: var(--accent);
}

.restart-button {
  display: block;
  width: 100%;
  background: var(--text-h);
  border: 0;
  color: #1b1d26;
  font-weight: 700;
}
</style>
