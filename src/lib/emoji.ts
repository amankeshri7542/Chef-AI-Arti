/**
 * Ingredient name → emoji mapper (Hinglish + English substring match).
 * Order matters: longer / more-specific matches come first.
 */

const EMOJI_MAP: Array<[string[], string]> = [
  // Specific vegetables / produce (before generic grains etc.)
  [['gobhi', 'cauliflower', 'broccoli'], '🥦'],
  [['gajar', 'carrot'], '🥕'],
  [['kaddu', 'pumpkin', 'petha'], '🎃'],
  [['baingan', 'brinjal', 'eggplant'], '🍆'],
  [['bhindi', 'okra', 'lady finger', 'ladyfinger'], '🥒'],
  [['lauki', 'ghiya', 'tori', 'turai', 'cucumber', 'kheera', 'zucchini'], '🥒'],
  [['shimla', 'capsicum', 'bell pepper'], '🫑'],
  [['matar', 'peas', 'choliya'], '🫛'],
  [['makka', 'makkai', 'bhutta', 'corn'], '🌽'],
  [['aloo', 'potato'], '🥔'],
  [['tamatar', 'tomato'], '🍅'],
  [['pyaz', 'pyaaz', 'onion'], '🧅'],
  [['lahsun', 'lehsun', 'garlic'], '🧄'],
  [['adrak', 'ginger'], '🫚'],
  [['palak', 'spinach', 'methi', 'saag', 'bathua', 'sarson'], '🥬'],
  [['nimbu', 'lemon', 'lime'], '🍋'],
  [['aam', 'mango'], '🥭'],
  [['kela', 'banana'], '🍌'],
  [['seb', 'apple'], '🍎'],
  [['mushroom', 'khumb'], '🍄'],
  [['nariyal', 'coconut'], '🥥'],
  [['moongfali', 'mungfali', 'peanut', 'kaju', 'cashew', 'badam', 'almond'], '🥜'],

  // Dairy / protein
  [['paneer', 'cheese'], '🧀'],
  [['anda', 'ande', 'egg'], '🥚'],
  [['dahi', 'curd', 'yogurt', 'yoghurt', 'chaas', 'lassi'], '🥛'],
  [['doodh', 'dudh', 'milk', 'malai', 'cream', 'khoya', 'mawa'], '🥛'],
  [['ghee', 'makkhan', 'butter'], '🧈'],
  [['chicken', 'murgh', 'murgi'], '🍗'],
  [['machli', 'machhli', 'fish'], '🐟'],

  // Pulses / grains — 'dalchini' must match before 'dal'
  [['dalchini', 'cinnamon'], '✨'],
  [['dal', 'daal', 'lentil', 'rajma', 'chana', 'chhole', 'chole', 'lobia', 'moong', 'masoor', 'urad'], '🫘'],
  [['chawal', 'rice', 'poha', 'murmura'], '🍚'],
  [['atta', 'flour', 'maida', 'besan', 'sooji', 'suji', 'rava', 'sattu', 'kuttu', 'singhara', 'bajra', 'jowar'], '🌾'],

  // Masale / pantry
  [['tel', 'oil'], '🫙'],
  [['namak', 'salt', 'sendha'], '🧂'],
  [['haldi', 'turmeric'], '⭐'],
  [['dhaniya', 'dhania', 'coriander', 'cilantro', 'pudina', 'mint', 'kadhi patta', 'curry leaf', 'curry leaves', 'tulsi'], '🌿'],
  [['jeera', 'cumin', 'rai', 'sarso', 'mustard seed', 'hing', 'asafoetida', 'ajwain', 'saunf', 'fennel', 'methi dana', 'kalonji'], '✨'],
  [['mirch', 'mirchi', 'chilli', 'chili', 'pepper', 'lal mirch', 'kali mirch'], '🌶️'],
  [['garam masala', 'masala', 'elaichi', 'cardamom', 'laung', 'clove', 'dalchini', 'cinnamon', 'tej patta', 'bay leaf', 'kesar', 'saffron'], '✨'],

  // Sweet / misc
  [['cheeni', 'chini', 'sugar', 'gud', 'gur', 'jaggery', 'shahad', 'honey'], '🍯'],
  [['pani', 'paani', 'water'], '💧'],
  [['imli', 'tamarind'], '🟤'],
  [['bread', 'pav', 'pao'], '🍞'],
];

export function getIngredientEmoji(name: string): string {
  const n = name.toLowerCase();
  for (const [keys, emoji] of EMOJI_MAP) {
    if (keys.some((k) => n.includes(k))) return emoji;
  }
  return '🥘';
}
