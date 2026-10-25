// A press held on one of the fight stage's tap areas, so its half can light
// up the moment a finger lands rather than only once the tap completes. A
// press that turns into a scroll (pointercancel) or slides off lets go too,
// so the glow never sticks.

import { ref } from 'vue';

export function usePress() {
  const pressed = ref(false);
  const press = () => {
    pressed.value = true;
  };
  const release = () => {
    pressed.value = false;
  };
  return {
    pressed,
    pressHandlers: { pointerdown: press, pointerup: release, pointercancel: release, pointerleave: release },
  };
}
