/**
 * Maps common English ingredient names to their Hinglish equivalents
 * used in recipe embeddings.
 */
export const INGREDIENT_EN_TO_HI: Record<string, string> = {
  // Vegetables
  potato: 'aloo', potatoes: 'aloo',
  tomato: 'tamatar', tomatoes: 'tamatar',
  onion: 'pyaz', onions: 'pyaz',
  garlic: 'lehsun', ginger: 'adrak',
  cauliflower: 'gobhi', 'green peas': 'matar', peas: 'matar',
  spinach: 'palak', eggplant: 'baingan', brinjal: 'baingan',
  okra: 'bhindi', 'lady finger': 'bhindi',
  carrot: 'gajar', carrots: 'gajar', radish: 'mooli',
  'bottle gourd': 'lauki', 'bitter gourd': 'karela', 'ridge gourd': 'tori',
  pumpkin: 'kaddu', 'taro root': 'arbi',
  'green onion': 'hara pyaz', 'spring onion': 'hara pyaz',
  'green chili': 'hari mirch', 'green chilli': 'hari mirch',
  chili: 'mirch', pepper: 'mirch',
  'bell pepper': 'shimla mirch', capsicum: 'shimla mirch',
  corn: 'bhutta', mushroom: 'khumb',
  // Grains & lentils
  rice: 'chawal', flour: 'atta', 'wheat flour': 'gehu ka atta',
  lentils: 'dal', 'yellow lentils': 'moong dal', 'red lentils': 'masoor dal',
  chickpeas: 'chana', 'kidney beans': 'rajma',
  // Dairy
  milk: 'doodh', yogurt: 'dahi', curd: 'dahi',
  butter: 'makhan', ghee: 'ghee', paneer: 'paneer', cream: 'malai',
  // Proteins
  egg: 'anda', eggs: 'anda', chicken: 'murgh', mutton: 'gosht', fish: 'machli',
  // Spices
  'cumin seeds': 'jeera', cumin: 'jeera', turmeric: 'haldi',
  'red chili powder': 'lal mirch', 'chili powder': 'lal mirch',
  coriander: 'dhaniya', 'coriander powder': 'dhaniya powder',
  'garam masala': 'garam masala', salt: 'namak', oil: 'tel',
  mustard: 'sarson', 'mustard seeds': 'rai',
  // Others
  sugar: 'cheeni', water: 'paani', lemon: 'nimbu', lime: 'nimbu',
  'bay leaf': 'tej patta',
  // Search terms — English words users type in search bar
  lentil: 'dal', dal: 'dal',
  chickpea: 'chana', 'chick pea': 'chana',
  bread: 'roti', 'flat bread': 'roti',
  'clarified butter': 'ghee',
  'mustard greens': 'sarson',
  fenugreek: 'methi',
  colocasia: 'arbi',
  'sweet potato': 'shakarkand',
  semolina: 'suji',
  vermicelli: 'seviyan',
  'broken wheat': 'daliya',
  poha: 'poha',
  puffed: 'murmura',
  halwa: 'halwa',
  kheer: 'kheer', payasam: 'kheer',
  biryani: 'biryani',
  pulao: 'pulao',
  raita: 'raita',
  chutney: 'chutney',
  pickle: 'achaar',
  papad: 'papad',
  ladoo: 'ladoo',
  barfi: 'barfi',
  haleem: 'haleem',
  korma: 'korma',
  curry: 'curry',
  gravy: 'tariwala',
  sabzi: 'sabzi',
  dosa: 'dosa',
  idli: 'idli',
  upma: 'upma',
  poori: 'poori', puri: 'poori',
  paratha: 'paratha',
  roti: 'roti',
  naan: 'naan',
};

export function translateIngredientToHinglish(name: string): string {
  const lower = name.toLowerCase().trim();
  return INGREDIENT_EN_TO_HI[lower] ?? name;
}

/**
 * Builds a bilingual query string: includes both original and Hinglish translation.
 * This improves cosine similarity with recipe embeddings that use Hinglish terms.
 */
export function buildHinglishQuery(ingredients: string[]): string {
  const terms = ingredients.map((name) => {
    const hi = translateIngredientToHinglish(name);
    return hi !== name ? `${name} ${hi}` : name;
  });
  return terms.join(', ');
}
