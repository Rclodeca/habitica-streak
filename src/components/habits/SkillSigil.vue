<script setup lang="ts">
import { computed } from 'vue';
import { Crown, Sparkle } from 'lucide-vue-next';
import type { Habit } from '../../game-engine';

// The small mark of a Special or Ult skill, in the skill list and its popup;
// renders nothing for any other skill.
const props = withDefaults(defineProps<{ habit: Habit; size?: number }>(), { size: 12 });

const sigil = computed(() =>
  props.habit.isSpecial
    ? { kind: 'special', label: 'Special', icon: Sparkle }
    : props.habit.isUlt
      ? { kind: 'ult', label: 'Ult', icon: Crown }
      : null,
);
</script>

<template>
  <span v-if="sigil" class="sigil" :class="sigil.kind" role="img" :aria-label="sigil.label" :title="sigil.label">
    <component :is="sigil.icon" :size="props.size" fill="currentColor" />
  </span>
</template>

<style scoped>
/* Inline-block, so a done skill's strike-through stops at the name. */
.sigil {
  display: inline-block;
  line-height: 0;
  vertical-align: 0.05em;
}

.sigil.special {
  color: var(--icon-gold);
}

.sigil.ult {
  color: var(--icon-violet);
}
</style>
