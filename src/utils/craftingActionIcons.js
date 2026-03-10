const ACTION_ICON_PATHS = {
  basic_synthesis: '/i/001000/001501.png',
  basic_touch: '/i/001000/001502.png',
  masters_mend: '/i/001000/001952.png',
  hasty_touch: '/i/001000/001989.png',
  rapid_synthesis: '/i/001000/001988.png',
  observe: '/i/001000/001954.png',
  tricks_of_the_trade: '/i/001000/001990.png',
  waste_not: '/i/001000/001992.png',
  veneration: '/i/001000/001995.png',
  standard_touch: '/i/001000/001516.png',
  great_strides: '/i/001000/001955.png',
  innovation: '/i/001000/001987.png',
  final_appraisal: '/i/001000/001983.png',
  waste_not_ii: '/i/001000/001993.png',
  byregot_s_blessing: '/i/001000/001975.png',
  byregots_blessing: '/i/001000/001975.png',
  precise_touch: '/i/001000/001524.png',
  muscle_memory: '/i/001000/001994.png',
  careful_synthesis: '/i/001000/001986.png',
  manipulation: '/i/001000/001985.png',
  prudent_touch: '/i/001000/001535.png',
  reflect: '/i/001000/001982.png',
  preparatory_touch: '/i/001000/001507.png',
  groundwork: '/i/001000/001518.png',
  delicate_synthesis: '/i/001000/001503.png',
  intensive_synthesis: '/i/001000/001514.png',
  trained_eye: '/i/001000/001981.png',
  advanced_touch: '/i/001000/001519.png',
  prudent_synthesis: '/i/001000/001520.png',
  trained_finesse: '/i/001000/001997.png',
  careful_observation: '/i/001000/001984.png',
  heart_and_soul: '/i/001000/001996.png',
  refined_touch: '/i/001000/001522.png',
  daring_touch: '/i/001000/001998.png',
  immaculate_mend: '/i/001000/001950.png',
  quick_innovation: '/i/001000/001999.png',
  trained_perfection: '/i/001000/001926.png',
  rapid_synthesis_fail: '/i/001000/001988.png',
  hasty_touch_fail: '/i/001000/001989.png',
  daring_touch_fail: '/i/001000/001998.png',
};

export function normalizeCraftingActionKey(action) {
  if (!action) return '';
  if (action === 'byregots_blessing') return 'byregot_s_blessing';
  return action;
}

export function getCraftingActionIconUrl(action) {
  const normalizedAction = normalizeCraftingActionKey(action);
  const iconPath = ACTION_ICON_PATHS[normalizedAction] || ACTION_ICON_PATHS[action];

  if (!iconPath) {
    return 'https://xivapi.com/i/000000/000120.png';
  }

  return `https://xivapi.com${iconPath}`;
}