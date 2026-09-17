import { CategorySlug } from '../types/enums';

/**
 * Merchant → category rules. Evaluated in order; first match wins.
 *
 * Two kinds of signal:
 *  - `merchants`: normalised merchant keys (see `normalizeMerchant`) matched
 *    as whole tokens / prefixes. These give HIGH confidence.
 *  - `keywords`: substrings looked for anywhere in the merchant string or
 *    itemised line names. These give MEDIUM confidence.
 *
 * Deliberately India-centric: the long tail here is what makes auto-
 * categorisation feel "right" to a user in Bengaluru or Pune. Extend freely;
 * the unit tests in `categorizer.spec.ts` guard against regressions.
 */
export interface MerchantRule {
  category: CategorySlug;
  merchants?: string[];
  keywords?: string[];
}

export const MERCHANT_RULES: readonly MerchantRule[] = [
  {
    category: CategorySlug.GROCERIES,
    merchants: [
      'bigbasket', 'blinkit', 'grofers', 'zepto', 'dmart', 'reliancefresh', 'reliancesmart',
      'morestore', 'spencers', 'naturesbasket', 'jiomart', 'dunzo', 'swiggyinstamart', 'instamart',
      'starbazaar', 'ratnadeep', 'licious', 'freshtohome', 'countrydelight',
    ],
    keywords: ['supermarket', 'grocery', 'groceries', 'kirana', 'provision', 'fresh mart', 'hypermarket'],
  },
  {
    category: CategorySlug.RESTAURANTS,
    merchants: [
      'swiggy', 'zomato', 'dominos', 'pizzahut', 'mcdonalds', 'kfc', 'burgerking', 'subway',
      'starbucks', 'ccd', 'cafecoffeeday', 'chaayos', 'barbequenation', 'haldirams', 'bikanervala',
      'wowmomo', 'faasos', 'behrouz', 'eatsure', 'box8', 'truffles', 'thirdwave', 'bluetokai',
      'chaipoint', 'chaayos', 'meghanafoods', 'empire', 'mtr', 'vidyarthibhavan', 'rameshwaram',
    ],
    keywords: [
      'restaurant', 'cafe', 'café', 'coffee', 'chai', 'tea house', 'dhaba', 'bistro', 'kitchen', 'biryani', 'pizza',
      'burger', 'bakery', 'grill', 'eatery', 'food court', 'darshini', 'udupi', 'bhavan', 'foods',
    ],
  },
  {
    category: CategorySlug.ELECTRONICS,
    merchants: ['croma', 'reliancedigital', 'vijaysales', 'apple', 'samsung', 'boat', 'oneplus', 'mistore', 'xiaomi'],
    keywords: ['electronics', 'mobile', 'laptop', 'headphone', 'earbuds', 'charger', 'smartwatch', 'television', 'digital'],
  },
  {
    category: CategorySlug.SHOPPING,
    merchants: [
      'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tatacliq', 'snapdeal', 'shoppersstop',
      'lifestyle', 'pantaloons', 'westside', 'zara', 'hm', 'uniqlo', 'decathlon', 'maxfashion',
      'reliancetrends', 'trends', 'zudio', 'fabindia', 'bata', 'nike', 'adidas', 'puma', 'lenskart', 'ikea',
    ],
    keywords: ['apparel', 'fashion', 'clothing', 'garments', 'boutique', 'footwear', 'shoes', 'mall', 'store'],
  },
  {
    category: CategorySlug.FUEL,
    merchants: ['iocl', 'indianoil', 'hpcl', 'hindustanpetroleum', 'bpcl', 'bharatpetroleum', 'shell', 'nayara', 'essar', 'reliancepetro'],
    keywords: ['petrol', 'diesel', 'fuel', 'filling station', 'petroleum', 'cng'],
  },
  {
    category: CategorySlug.TRANSPORT,
    merchants: ['uber', 'ola', 'rapido', 'redbus', 'irctc', 'bmtc', 'nammametro', 'dmrc', 'delhimetro', 'blusmart', 'yulu', 'bounce', 'fastag', 'paytmfastag'],
    keywords: ['cab', 'taxi', 'auto', 'metro', 'bus', 'railway', 'parking', 'toll', 'fastag', 'ride'],
  },
  {
    category: CategorySlug.TRAVEL,
    merchants: ['makemytrip', 'goibibo', 'cleartrip', 'yatra', 'ixigo', 'easemytrip', 'indigo', 'airindia', 'vistara', 'spicejet', 'akasa', 'oyo', 'airbnb', 'booking', 'agoda', 'treebo', 'fabhotels'],
    keywords: ['airlines', 'flight', 'hotel', 'resort', 'holiday', 'trip', 'travel', 'homestay'],
  },
  {
    category: CategorySlug.BILLS_UTILITIES,
    merchants: ['bescom', 'msedcl', 'tneb', 'bses', 'tatapower', 'adanielectricity', 'airtel', 'jio', 'vodafone', 'bsnl', 'actfibernet', 'hathway', 'tatasky', 'tataplay', 'dishtv', 'mahanagargas', 'indraprasthagas', 'bwssb'],
    keywords: ['electricity', 'water bill', 'gas bill', 'broadband', 'postpaid', 'prepaid', 'recharge', 'dth', 'wifi', 'fibernet', 'utility', 'municipal'],
  },
  {
    category: CategorySlug.HEALTH,
    merchants: ['apollo', 'apollopharmacy', 'medplus', 'pharmeasy', '1mg', 'tata1mg', 'netmeds', 'practo', 'cult', 'cultfit', 'healthifyme', 'fortis', 'manipal', 'narayana', 'maxhealthcare', 'thyrocare', 'drlalpathlabs', 'metropolis'],
    keywords: ['pharmacy', 'medical', 'hospital', 'clinic', 'diagnostic', 'lab', 'doctor', 'dental', 'gym', 'fitness', 'chemist', 'medicals', 'wellness'],
  },
  {
    category: CategorySlug.ENTERTAINMENT,
    merchants: ['bookmyshow', 'pvr', 'inox', 'cinepolis', 'netflix', 'hotstar', 'disneyhotstar', 'primevideo', 'spotify', 'youtube', 'sonyliv', 'zee5', 'jiocinema', 'steam', 'playstation', 'xbox', 'gaana', 'wynk', 'timezone', 'smaaash'],
    keywords: ['cinema', 'movie', 'theatre', 'concert', 'gaming', 'streaming', 'subscription', 'arcade', 'bowling'],
  },
  {
    category: CategorySlug.EDUCATION,
    merchants: ['byjus', 'unacademy', 'vedantu', 'coursera', 'udemy', 'upgrad', 'physicswallah', 'whitehatjr', 'crossword', 'sapnabookhouse', 'kindle'],
    keywords: ['school', 'college', 'university', 'tuition', 'course', 'books', 'book house', 'stationery', 'academy', 'institute', 'coaching'],
  },
  {
    category: CategorySlug.PERSONAL_CARE,
    merchants: ['urbancompany', 'urbanclap', 'naturals', 'lakme', 'lakmesalon', 'jawedhabib', 'toniandguy', 'enrich', 'bodycraft', 'purplle', 'sugarcosmetics', 'mamaearth'],
    keywords: ['salon', 'saloon', 'spa', 'parlour', 'parlor', 'barber', 'grooming', 'cosmetics', 'beauty'],
  },
  {
    category: CategorySlug.HOME,
    merchants: ['pepperfry', 'urbanladder', 'homecentre', 'wakefit', 'sleepycat', 'nilkamal', 'asianpaints', 'godrejinterio', 'hometown'],
    keywords: ['furniture', 'furnishing', 'decor', 'hardware', 'plumbing', 'electrician', 'appliance', 'kitchenware', 'mattress'],
  },
  {
    category: CategorySlug.GIFTS_DONATIONS,
    merchants: ['fernsnpetals', 'fnp', 'igp', 'archies', 'giveindia', 'ketto', 'milaap', 'akshayapatra', 'goonj'],
    keywords: ['gift', 'donation', 'charity', 'temple', 'foundation', 'flowers'],
  },
  {
    category: CategorySlug.FEES_CHARGES,
    keywords: ['annual fee', 'convenience fee', 'late fee', 'service charge', 'interest charged', 'penalty', 'processing fee', 'emi'],
  },
];

/** Known transactional senders/domains used by the Gmail + SMS backfill scan. */
export const KNOWN_SENDER_DOMAINS: readonly string[] = [
  'amazon.in', 'amazon.com', 'flipkart.com', 'myntra.com', 'ajio.com', 'meesho.com', 'nykaa.com',
  'tatacliq.com', 'bigbasket.com', 'blinkit.com', 'zepto.com', 'zeptonow.com', 'swiggy.in', 'swiggy.com',
  'zomato.com', 'bookmyshow.com', 'makemytrip.com', 'goibibo.com', 'cleartrip.com', 'ixigo.com',
  'irctc.co.in', 'uber.com', 'olacabs.com', 'croma.com', 'reliancedigital.in', 'pharmeasy.in', '1mg.com',
  'apollopharmacy.in', 'dominos.co.in', 'pepperfry.com', 'urbancompany.com', 'lenskart.com', 'decathlon.in',
];

/** Subject-line phrases that mark a purchase email. Case-insensitive. */
export const PURCHASE_SUBJECT_KEYWORDS: readonly string[] = [
  'order confirmed', 'order confirmation', 'your order', 'order placed', 'thank you for your order',
  'your invoice', 'tax invoice', 'payment received', 'payment successful', 'booking confirmed',
  'your ticket', 'e-ticket', 'receipt for', 'your receipt', 'has been shipped', 'shipped',
  'order delivered', 'delivered', 'purchase confirmation', 'order summary',
];
