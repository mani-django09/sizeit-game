// Object library shared by every game. All silhouettes are original SVG (filled shapes only).
// dim:  'h' = height, 'l' = length, 'd' = diameter (width)
// size: real size in metres along `dim`
// kg:   typical weight (optional; objects without it are left out of weight games)
// The drawing's bounding box is measured at runtime, so only its proportions matter.
// src:  a public page that backs up the number (shown as a "Source" link after the fact)
// tags: extra categories, such as 'india' or 'usa', so one object can sit in two category lists
// since: 'YYYY-MM-DD' for objects added later. They only join Dailies from that date, so past puzzles don't change.
// proper: keep the capital letter inside sentences. one: a one-of-a-kind thing ("The ... weighs").
// bare: no "the" in front of the name (Mars, Jupiter).
// Keep a reliable source for every number you add.

(() => {
  const NEW = '2026-11-24';   // the day the second batch of objects joins the Dailies
  const CIRCLE = 'M0 50 A50 50 0 1 0 100 50 A50 50 0 1 0 0 50 Z';
  const HUMAN = '<circle cx="20" cy="9" r="8"/><path d="M9 20 Q20 16 31 20 L35 54 L30 55 L27 32 L27 58 L26 100 L21 100 L20 64 L19 100 L14 100 L13 58 L13 32 L10 55 L5 54 Z"/>';

  window.CATEGORIES = [
    { id: 'all', name: 'All' },
    { id: 'animals', name: 'Animals' },
    { id: 'landmarks', name: 'Landmarks' },
    { id: 'vehicles', name: 'Vehicles' },
    { id: 'everyday', name: 'Everyday' },
    { id: 'sports', name: 'Sports' },
    { id: 'famous', name: 'Famous' },
    { id: 'space', name: 'Space' },
    { id: 'dinos', name: 'Dinosaurs' },
    { id: 'tiny', name: 'Bugs & tiny things' },
    { id: 'food', name: 'Food' },
    { id: 'geo', name: 'Geography' },
    { id: 'india', name: 'India' },
    { id: 'usa', name: 'USA' }
  ];

  // ----- Geography drawings -----
  // A river: a long wavy band, drawn straightened out (its length is measured along its course).
  const RIVER = (waves, amp) => {
    const n = 120, len = 1000, top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const x = i / n * len, y = 20 + amp * Math.sin(i / n * Math.PI * 2 * waves) + 4 * Math.sin(i / n * Math.PI * 2 * waves * 3.1);
      const t = 5 + 9 * i / n;                 // narrow at the source, wide at the mouth
      top.push(`${x.toFixed(1)} ${(y - t / 2).toFixed(1)}`); bot.unshift(`${x.toFixed(1)} ${(y + t / 2).toFixed(1)}`);
    }
    return `<path d="M${top.join(' L')} L${bot.join(' L')} Z"/>`;
  };
  // A waterfall seen from the side, height 100 and width w: a cliff on the left, water arcing over the lip
  // and falling to a pool, lines of flow cut into the curtain, and spray where it lands. Filled shapes only.
  const FALLS = (w, streams) => {
    const c = w * .42, f = (k) => (c + (w - c) * k).toFixed(1);   // cliff edge, and points across the fall
    const lines = Math.max(1, Math.min(4, streams.length));
    let holes = '';
    for (let i = 1; i <= lines; i++) {
      const k = i / (lines + 1);
      holes += ` M${f(.12 + .3 * k)} ${18 + 6 * k} L${f(.15 + .3 * k)} ${18 + 6 * k} L${f(.17 + .3 * k)} 78 L${f(.13 + .3 * k)} 78 Z`;
    }
    return `<path d="M0 100 L0 0 L${c} 0 L${c} 6 L${c - 3} 24 L${c + 1} 44 L${c - 4} 66 L${c} 100 Z"/>` +
      `<path fill-rule="evenodd" d="M${c + 1.5} 0 Q${f(.62)} 0 ${f(.58)} 26 L${f(.56)} 90 L${f(.14)} 90 L${f(.1)} 30 Q${f(.08)} 10 ${c + 1.5} 8 Z${holes}"/>` +
      `<path d="M${c} 100 L${c} 95 L${w} 95 L${w} 100 Z"/>` +
      `<circle cx="${f(.2)}" cy="89" r="${(w - c) * .1}"/><circle cx="${f(.36)}" cy="87" r="${(w - c) * .13}"/><circle cx="${f(.52)}" cy="89" r="${(w - c) * .1}"/>`;
  };

  window.OBJECTS = [
    // ----- Everyday -----
    { id: 'human', cat: 'everyday', dim: 'h', size: 1.7, kg: 70, name: 'Adult human',
      fact: 'An average adult is around 1.7 m tall.', svg: HUMAN },
    { id: 'phone', cat: 'everyday', dim: 'h', size: 0.15, kg: 0.19, name: 'Smartphone',
      fact: 'Most smartphones today are about 15 cm tall.',
      svg: '<path fill-rule="evenodd" d="M8 0 H64 Q72 0 72 8 V142 Q72 150 64 150 H8 Q0 150 0 142 V8 Q0 0 8 0 Z M5 12 H67 V138 H5 Z"/>' },
    { id: 'banana', cat: 'everyday', dim: 'l', size: 0.18, kg: 0.12, name: 'Banana',
      fact: 'A medium banana is about 18 cm long.',
      svg: '<path d="M2 10 Q4 4 8 6 Q30 40 80 34 Q96 30 104 22 L108 24 Q100 48 60 52 Q16 52 2 10 Z"/>' },
    { id: 'door', cat: 'everyday', dim: 'h', size: 2.1, name: 'House door',
      fact: 'A standard house door is about 2.1 m tall.',
      svg: '<path fill-rule="evenodd" d="M0 0 H90 V210 H0 Z M8 8 H82 V100 H8 Z M8 110 H82 V202 H8 Z"/><circle cx="76" cy="105" r="4"/>' },
    { id: 'coin', cat: 'everyday', dim: 'd', size: 0.027, kg: 0.0077, name: 'Indian ₹10 coin',
      fact: 'The Indian ₹10 coin is 27 mm across.',
      svg: '<path fill-rule="evenodd" d="' + CIRCLE + ' M14 50 A36 36 0 1 0 86 50 A36 36 0 1 0 14 50 Z"/><circle cx="50" cy="50" r="30"/>' },
    { id: 'a4', cat: 'everyday', dim: 'h', size: 0.297, kg: 0.005, name: 'A4 sheet of paper',
      fact: 'An A4 sheet is 29.7 cm tall and 21 cm wide. At 80 gsm it weighs about 5 g.',
      svg: '<path d="M0 0 H70 L84 14 V118.8 H0 Z"/>' },

    // ----- Animals -----
    { id: 'giraffe', cat: 'animals', dim: 'h', size: 5.5, kg: 1200, name: 'Giraffe',
      fact: 'The tallest animal on Earth. A male\'s neck alone can be about 2 m long.',
      svg: '<path d="M6 60 Q8 50 22 50 L34 50 Q40 50 42 54 L52 16 L48 13 L50 8 Q54 4 60 6 L66 10 L64 14 L58 14 L46 60 Q44 64 40 66 L40 110 L36 110 L35 68 L28 68 L27 110 L23 110 L22 68 L14 68 L13 110 L9 110 L8 66 Q4 66 6 60 Z"/><rect x="53" y="1" width="2" height="6"/><rect x="57" y="1" width="2" height="6"/><path d="M6 58 L1 76 L3 76 L7 60 Z"/>' },
    { id: 'elephant', cat: 'animals', dim: 'h', size: 2.75, kg: 4000, name: 'Asian elephant',
      fact: 'Asian elephants stand about 2.5 to 3 m tall.',
      svg: '<path d="M14 46 Q14 18 52 16 Q80 14 92 22 Q108 18 114 32 Q118 44 112 56 Q110 70 114 86 L108 88 Q102 72 104 58 L100 60 L100 90 L88 90 L88 64 L72 66 L72 90 L60 90 L60 66 L42 66 L42 90 L30 90 L30 64 Q20 60 16 54 Z"/><path d="M15 40 L8 60 L10 61 L17 44 Z"/>' },
    { id: 'whale', cat: 'animals', dim: 'l', size: 25, kg: 150000, name: 'Blue whale',
      fact: 'The largest animal known to have ever lived, longer than two city buses.',
      svg: '<path d="M2 22 Q6 10 30 8 Q70 6 110 12 Q140 16 160 20 L176 8 Q182 4 186 6 L178 20 L188 32 Q182 34 176 30 L160 24 Q130 32 90 32 Q40 34 12 30 Q2 28 2 22 Z"/><path d="M44 30 L58 44 L62 42 L56 30 Z"/>' },
    { id: 'tiger', cat: 'animals', dim: 'l', size: 2.9, kg: 220, name: 'Bengal tiger (with tail)',
      fact: 'Including its tail, a male Bengal tiger can be close to 3 m long.',
      svg: '<path d="M2 14 Q6 4 12 6 Q8 14 14 22 Q20 26 30 24 Q40 18 70 18 Q88 18 96 14 Q104 8 114 10 L118 6 L122 10 Q128 14 128 22 Q128 28 120 30 L112 32 Q106 34 104 40 L104 58 L98 58 L96 42 L88 42 L86 58 L80 58 L80 42 Q60 44 46 42 L44 58 L38 58 L37 42 L32 40 L30 58 L24 58 L24 38 Q22 32 26 28 Q14 28 8 22 Q2 18 2 14 Z"/>' },
    { id: 'cat', cat: 'animals', dim: 'l', size: 0.75, kg: 4.5, name: 'House cat (with tail)',
      fact: 'A house cat is about 75 cm long, and around 30 cm of that is tail.',
      svg: '<path d="M2 6 Q4 2 7 4 Q6 16 14 24 Q20 28 28 26 Q40 22 56 22 Q64 22 68 18 L68 8 L73 13 L79 13 L84 8 L84 20 Q86 28 80 32 L76 34 L76 46 L72 46 L70 36 L64 36 L63 46 L59 46 L58 36 Q44 38 36 36 L35 46 L31 46 L30 36 L27 34 L26 46 L22 46 L22 32 Q10 28 5 18 Q2 12 2 6 Z"/>' },
    { id: 'trex', cat: 'animals', dim: 'l', size: 12.3, name: 'T. rex',
      fact: '"Sue", one of the most complete T. rex fossils, is about 12.3 m long.',
      svg: '<path d="M2 34 Q30 30 50 22 Q66 14 84 14 Q92 14 96 10 L110 4 Q124 2 130 8 L132 18 L118 19 L120 24 L112 26 Q104 30 100 34 L96 38 L102 44 L99 46 L92 40 Q88 46 82 50 L86 72 L96 76 L78 76 L74 54 L68 54 L66 72 L76 76 L58 76 L58 52 Q40 46 2 34 Z"/>' },
    { id: 'ostrich', cat: 'animals', dim: 'h', size: 2.5, kg: 110, name: 'Ostrich',
      fact: 'The tallest living bird, standing about 2.5 m tall.',
      svg: '<path d="M10 70 Q8 54 30 50 Q46 48 56 56 L62 12 Q62 4 68 4 Q76 4 78 10 L70 12 L66 14 L62 62 Q62 74 50 80 L52 126 L58 130 L46 130 L44 82 L38 82 L40 126 L46 130 L34 130 L32 80 Q14 80 10 70 Z"/>' },
    { id: 'cobra', cat: 'animals', dim: 'l', size: 4, kg: 6, name: 'King cobra',
      fact: 'The longest venomous snake. Adults are often 3 to 4 m long.',
      svg: '<path d="M2 20 Q20 8 40 18 Q60 28 80 18 Q100 8 120 18 Q140 28 160 18 Q172 12 180 14 Q190 12 194 18 Q192 24 182 24 Q170 24 160 26 Q140 36 120 26 Q100 16 80 26 Q60 36 40 26 Q20 16 4 24 Q0 23 2 20 Z"/>' },
    { id: 'peacock', cat: 'animals', dim: 'l', size: 2.1, kg: 5, name: 'Peacock (with train)',
      fact: 'With its train, a male peacock can be over 2 m long.',
      svg: '<path d="M2 30 Q40 20 100 30 Q112 26 116 18 L120 4 Q126 0 128 6 L126 8 L122 18 Q122 30 112 38 L110 54 L106 54 L106 40 L100 40 L102 54 L98 54 L96 40 Q60 40 2 34 Z"/>' },

    // ----- Vehicles -----
    { id: 'bus', cat: 'vehicles', dim: 'l', size: 12, kg: 12000, name: 'City bus',
      fact: 'A standard city bus is about 12 m long.',
      svg: '<path fill-rule="evenodd" d="M2 8 Q2 2 8 2 H236 Q242 2 242 10 V56 H2 Z M10 10 H34 V30 H10 Z M42 10 H70 V30 H42 Z M78 10 H106 V30 H78 Z M114 10 H142 V30 H114 Z M150 10 H178 V30 H150 Z M186 10 H210 V30 H186 Z M218 10 H236 V34 H218 Z"/><circle cx="46" cy="56" r="11"/><circle cx="200" cy="56" r="11"/>' },
    { id: 'auto', cat: 'vehicles', dim: 'l', size: 2.64, kg: 375, name: 'Auto rickshaw',
      fact: 'A typical Indian auto rickshaw is just over 2.6 m long.',
      svg: '<path fill-rule="evenodd" d="M4 52 L4 30 Q4 10 22 6 Q40 2 70 2 L92 2 Q100 2 100 10 L100 52 Z M12 30 Q14 14 30 12 L44 12 L44 30 Z M54 12 L80 12 L80 34 L54 34 Z"/><circle cx="18" cy="54" r="9"/><circle cx="84" cy="54" r="9"/>' },
    { id: 'car', cat: 'vehicles', dim: 'l', size: 3.8, kg: 900, name: 'Hatchback car',
      fact: 'A small hatchback is roughly 3.8 m long.',
      svg: '<path fill-rule="evenodd" d="M2 40 L2 30 Q4 24 16 22 L36 20 L52 6 Q58 2 68 2 L104 2 Q114 2 120 16 L124 26 Q128 30 128 40 Z M56 10 L74 9 L74 20 L44 20 Z M80 9 L102 9 Q108 10 112 20 L80 20 Z"/><circle cx="28" cy="40" r="10"/><circle cx="104" cy="40" r="10"/>' },
    { id: 'scooter', cat: 'vehicles', dim: 'l', size: 1.83, kg: 106, name: 'Scooter',
      fact: 'A popular 110cc scooter is about 1.8 m long.',
      svg: '<path d="M14 40 Q14 26 30 24 L70 24 Q76 14 86 16 L92 4 L98 4 L94 18 Q104 24 104 40 Z"/><path d="M28 24 Q30 16 54 16 Q60 18 58 24 Z"/><circle cx="22" cy="44" r="10"/><circle cx="96" cy="44" r="10"/>' },
    { id: 'b747', cat: 'vehicles', dim: 'l', size: 70.6, kg: 180000, name: 'Boeing 747',
      fact: 'The Boeing 747-400 is 70.6 m long.',
      svg: '<path d="M2 36 Q2 26 14 22 Q20 10 36 8 Q52 6 60 14 L190 16 L214 0 L224 0 L216 22 Q222 26 216 30 L190 34 L60 40 Q14 42 2 36 Z"/><path d="M80 30 L120 54 L130 54 L114 30 Z"/><rect x="96" y="40" width="14" height="5" rx="2"/>' },
    { id: 'coach', cat: 'vehicles', dim: 'l', size: 23.5, kg: 40000, name: 'Railway coach',
      fact: 'An Indian Railways LHB coach is about 23.5 m long.',
      svg: '<path fill-rule="evenodd" d="M2 8 Q2 2 8 2 H232 Q238 2 238 8 V50 H2 Z M8 14 H16 V40 H8 Z M24 14 H42 V28 H24 Z M50 14 H68 V28 H50 Z M76 14 H94 V28 H76 Z M102 14 H120 V28 H102 Z M128 14 H146 V28 H128 Z M154 14 H172 V28 H154 Z M180 14 H198 V28 H180 Z M224 14 H232 V40 H224 Z"/><rect x="20" y="50" width="40" height="6"/><rect x="180" y="50" width="40" height="6"/><circle cx="28" cy="58" r="5"/><circle cx="52" cy="58" r="5"/><circle cx="188" cy="58" r="5"/><circle cx="212" cy="58" r="5"/>' },
    { id: 'titanic', cat: 'vehicles', dim: 'l', size: 269, kg: 52310000, name: 'Titanic',
      fact: 'RMS Titanic was 269 m long, more than two and a half football pitches.',
      svg: '<path d="M0 40 L8 70 L240 70 Q250 56 254 40 Z"/><rect x="40" y="30" width="170" height="10"/><path d="M62 30 L66 4 L76 4 L74 30 Z"/><path d="M100 30 L104 4 L114 4 L112 30 Z"/><path d="M138 30 L142 4 L152 4 L150 30 Z"/><path d="M176 30 L180 4 L190 4 L188 30 Z"/>' },

    // ----- Landmarks -----
    { id: 'qutub', cat: 'landmarks', dim: 'h', size: 72.5, name: 'Qutub Minar',
      fact: 'Built of red sandstone and marble, Qutub Minar in Delhi is 72.5 m tall.',
      svg: '<path d="M6 200 L24 200 L21.5 14 L8.5 14 Z"/><rect x="3" y="150" width="24" height="4"/><rect x="4" y="108" width="22" height="4"/><rect x="5" y="68" width="20" height="4"/><rect x="6" y="34" width="18" height="4"/><path d="M10 14 L10 8 Q15 2 20 8 L20 14 Z"/><rect x="14.5" y="0" width="1" height="6"/>' },
    { id: 'indiagate', cat: 'landmarks', dim: 'h', size: 42, name: 'India Gate',
      fact: 'India Gate in New Delhi stands 42 m tall.',
      svg: '<path fill-rule="evenodd" d="M0 100 V26 H52 V100 Z M16 100 V58 Q26 42 36 58 V100 Z"/><path d="M4 26 V14 H48 V26 Z"/><path d="M14 14 Q26 2 38 14 Z"/>' },
    { id: 'unity', cat: 'landmarks', dim: 'h', size: 182, name: 'Statue of Unity',
      fact: 'The world\'s tallest statue at 182 m, about twice the Statue of Liberty with its pedestal.',
      svg: '<circle cx="30" cy="10" r="8"/><path d="M18 20 Q30 15 42 20 L48 60 L46 110 L52 200 L8 200 L14 110 L12 60 Z"/><path d="M14 22 L6 70 L10 72 L18 34 Z"/><path d="M46 22 L54 70 L50 72 L42 34 Z"/>' },
    { id: 'eiffel', cat: 'landmarks', dim: 'h', size: 330, kg: 10100000, name: 'Eiffel Tower',
      fact: 'With its antennas, the Eiffel Tower is 330 m tall.',
      svg: '<path fill-rule="evenodd" d="M2 200 Q22 150 32 112 L36 70 L41 10 L43 0 L45 10 L50 70 L54 112 Q64 150 84 200 L66 200 Q60 168 43 160 Q26 168 20 200 Z"/><rect x="26" y="108" width="34" height="5"/><rect x="33" y="66" width="20" height="4"/>' },
    { id: 'burj', cat: 'landmarks', dim: 'h', size: 828, name: 'Burj Khalifa',
      fact: 'The world\'s tallest building at 828 m.',
      svg: '<path d="M0 200 L3 160 L7 160 L9 120 L13 120 L15 80 L18 80 L19 40 L20.5 0 L22 40 L23 80 L26 80 L28 120 L32 120 L34 160 L38 160 L41 200 Z"/>' },
    { id: 'taj', cat: 'landmarks', dim: 'h', size: 73, name: 'Taj Mahal',
      fact: 'From its base to the tip of the finial, the Taj Mahal is about 73 m tall.',
      svg: '<rect x="0" y="92" width="150" height="8"/><path fill-rule="evenodd" d="M32 92 V52 H118 V92 Z M64 92 V68 Q75 56 86 68 V92 Z"/><path d="M50 52 Q46 26 75 16 Q104 26 100 52 Z"/><rect x="74" y="4" width="2" height="13"/><path d="M34 52 Q34 42 41 40 Q48 42 48 52 Z"/><path d="M102 52 Q102 42 109 40 Q116 42 116 52 Z"/><rect x="6" y="34" width="6" height="58"/><rect x="138" y="34" width="6" height="58"/><path d="M5 34 Q9 26 13 34 Z"/><path d="M137 34 Q141 26 145 34 Z"/>' },
    { id: 'gateway', cat: 'landmarks', dim: 'h', size: 26, name: 'Gateway of India',
      fact: 'The Gateway of India in Mumbai is 26 m tall.',
      svg: '<path fill-rule="evenodd" d="M0 100 V30 H100 V100 Z M34 100 V54 Q50 34 66 54 V100 Z M8 70 H22 V90 H8 Z M78 70 H92 V90 H78 Z"/><rect x="2" y="14" width="14" height="16"/><rect x="84" y="14" width="14" height="16"/><rect x="30" y="18" width="40" height="12"/><path d="M2 14 Q9 2 16 14 Z"/><path d="M84 14 Q91 2 98 14 Z"/>' },
    { id: 'pyramid', cat: 'landmarks', dim: 'h', size: 138.5, kg: 6e9, name: 'Great Pyramid of Giza',
      fact: 'The Great Pyramid is now about 138.5 m tall. It was originally 146.6 m.',
      svg: '<path d="M0 100 L83 0 L166 100 Z"/>' },
    { id: 'liberty', cat: 'landmarks', dim: 'h', size: 46, kg: 204000, name: 'Statue of Liberty (statue only)',
      fact: 'From heel to torch, the statue itself is 46 m tall. With the pedestal it is 93 m.',
      svg: '<circle cx="26" cy="62" r="7"/><path d="M16 58 L12 50 L20 56 L22 48 L26 55 L30 48 L32 56 L40 50 L36 58 Z"/><path d="M16 72 Q26 66 36 72 L40 120 L44 200 L8 200 L12 120 Z"/><path d="M33 72 L40 22 L46 22 L40 76 Z"/><path d="M38 22 L48 22 L46 14 Q43 4 40 14 Z"/><path d="M8 90 L18 84 L20 110 L10 114 Z"/>' },
    { id: 'coconut', cat: 'landmarks', dim: 'h', size: 20, name: 'Coconut palm',
      fact: 'Coconut palms commonly grow to about 20 m, and some reach 30 m.',
      svg: '<path d="M48 200 L56 200 Q52 120 64 40 L60 38 Q44 120 48 200 Z"/><path d="M62 38 Q40 20 14 34 Q38 26 62 40 Z"/><path d="M62 38 Q84 18 110 30 Q86 26 62 40 Z"/><path d="M62 38 Q50 10 30 4 Q54 14 62 40 Z"/><path d="M62 38 Q76 8 96 6 Q76 16 62 40 Z"/><path d="M62 38 Q36 44 22 66 Q40 46 62 40 Z"/><path d="M62 38 Q88 44 100 64 Q84 46 62 40 Z"/><circle cx="58" cy="43" r="3.5"/><circle cx="66" cy="43" r="3.5"/>' },

    // ----- Sports -----
    { id: 'bat', cat: 'sports', dim: 'l', size: 0.965, kg: 1.2, name: 'Cricket bat',
      fact: 'The Laws of Cricket cap bat length at 96.52 cm (38 inches).',
      svg: '<rect x="0" y="9" width="34" height="5" rx="2"/><path d="M32 6 L94 4 Q100 4 100 11.5 Q100 19 94 19 L32 17 Z"/>' },
    { id: 'pitch', cat: 'sports', dim: 'l', size: 20.12, name: 'Cricket pitch',
      fact: 'Stumps to stumps, a cricket pitch is 22 yards, or 20.12 m.',
      svg: '<rect x="0" y="20" width="200" height="5"/><rect x="0" y="2" width="1.6" height="18"/><rect x="2.6" y="2" width="1.6" height="18"/><rect x="5.2" y="2" width="1.6" height="18"/><rect x="193.2" y="2" width="1.6" height="18"/><rect x="195.8" y="2" width="1.6" height="18"/><rect x="198.4" y="2" width="1.6" height="18"/>' },
    { id: 'football', cat: 'sports', dim: 'd', size: 0.22, kg: 0.43, name: 'Football (size 5)',
      fact: 'A size-5 football is about 22 cm across.',
      svg: '<path fill-rule="evenodd" d="' + CIRCLE + ' M50 34 L65 45 L59 63 L41 63 L35 45 Z"/>' },
    { id: 'cball', cat: 'sports', dim: 'd', size: 0.072, kg: 0.16, name: 'Cricket ball',
      fact: 'A cricket ball is only about 7.2 cm across.',
      svg: '<path fill-rule="evenodd" d="' + CIRCLE + ' M30 8 Q50 50 30 92 L34 93 Q54 50 34 7 Z"/>' },

    // ----- Famous -----
    { id: 'monalisa', cat: 'famous', dim: 'h', size: 0.77, name: 'Mona Lisa (painting)',
      fact: 'The Mona Lisa is only 77 cm tall and 53 cm wide.',
      svg: '<path fill-rule="evenodd" d="M0 0 H53 V77 H0 Z M4 4 H49 V73 H4 Z"/><ellipse cx="26.5" cy="28" rx="7" ry="9"/><path d="M10 73 Q12 46 26.5 42 Q41 46 43 73 Z"/>' },
    { id: 'wadlow', cat: 'famous', dim: 'h', size: 2.72, kg: 199, name: 'Robert Wadlow, tallest man on record',
      fact: 'Robert Wadlow measured 2.72 m (8 ft 11 in), the tallest person in recorded history.', svg: HUMAN },
    { id: 'bigben', cat: 'famous', dim: 'h', size: 96, name: 'Big Ben\'s tower (Elizabeth Tower)',
      fact: 'The Elizabeth Tower in London, home of the Big Ben bell, is 96 m tall.',
      svg: '<path d="M10 200 V40 H40 V200 Z"/><path fill-rule="evenodd" d="M6 40 V18 H44 V40 Z M18 29 A7 7 0 1 0 32 29 A7 7 0 1 0 18 29 Z"/><path d="M8 18 L25 0 L42 18 Z"/>' },
    { id: 'pisa', cat: 'famous', dim: 'h', size: 56.7, name: 'Leaning Tower of Pisa',
      fact: 'The Leaning Tower of Pisa is about 56.7 m tall on its high side, and leans by around 4 degrees.',
      svg: '<g transform="rotate(4 20 160)"><rect x="4" y="0" width="32" height="160"/><rect x="0" y="18" width="40" height="3"/><rect x="0" y="40" width="40" height="3"/><rect x="0" y="62" width="40" height="3"/><rect x="0" y="84" width="40" height="3"/><rect x="0" y="106" width="40" height="3"/><rect x="0" y="128" width="40" height="3"/></g>' },
    { id: 'redeemer', cat: 'famous', dim: 'h', size: 30, name: 'Christ the Redeemer (statue)',
      fact: 'The statue in Rio de Janeiro is 30 m tall, with arms spanning 28 m.',
      svg: '<circle cx="46.5" cy="6" r="5"/><path d="M40 12 H53 L57 100 H36 Z"/><path d="M0 15 H93 V23 H0 Z"/>' },

    // ===== Added 24 Nov 2026 (only in Dailies from that date) =====
    // ----- Space -----
    { id: 'earth', cat: 'space', dim: 'd', size: 12742000, name: 'Earth', proper: true, one: true, since: NEW,
      fact: 'Earth is about 12,742 km across at the Equator. You could line up about 3.7 Moons across it.', src: 'https://en.wikipedia.org/wiki/Earth',
      svg: '<path fill-rule="evenodd" d="' + CIRCLE + ' M30 25 Q42 18 50 28 Q46 40 36 42 Q26 38 30 25 Z M58 55 Q70 50 76 62 Q70 78 60 74 Q54 64 58 55 Z M22 60 Q30 58 32 66 Q28 72 22 70 Z"/>' },
    { id: 'moon', cat: 'space', dim: 'd', size: 3474800, name: 'Moon', proper: true, one: true, since: NEW,
      fact: 'The Moon is about 3,475 km across, a little over a quarter of Earth\'s width.', src: 'https://en.wikipedia.org/wiki/Moon',
      svg: '<path fill-rule="evenodd" d="' + CIRCLE + ' M30 30 A8 8 0 1 0 46 30 A8 8 0 1 0 30 30 Z M58 60 A12 12 0 1 0 82 60 A12 12 0 1 0 58 60 Z M36 70 A5 5 0 1 0 46 70 A5 5 0 1 0 36 70 Z"/>' },
    { id: 'mars', cat: 'space', dim: 'd', size: 6779000, name: 'Mars', proper: true, one: true, bare: true, since: NEW,
      fact: 'Mars is about 6,779 km across, roughly half the width of Earth.', src: 'https://en.wikipedia.org/wiki/Mars',
      svg: '<path fill-rule="evenodd" d="' + CIRCLE + ' M38 8 Q50 3 62 8 Q50 14 38 8 Z M40 56 Q52 50 60 58 Q54 66 42 64 Z"/>' },
    { id: 'jupiter', cat: 'space', dim: 'd', size: 139820000, name: 'Jupiter', proper: true, one: true, bare: true, since: NEW,
      fact: 'Jupiter is about 139,820 km across. Eleven Earths would fit side by side across it.', src: 'https://en.wikipedia.org/wiki/Jupiter',
      svg: '<path fill-rule="evenodd" d="' + CIRCLE + ' M6 34 H94 V40 H6 Z M4 56 H96 V61 H4 Z M60 66 A9 5 0 1 0 78 66 A9 5 0 1 0 60 66 Z"/>' },
    { id: 'sun', cat: 'space', dim: 'd', size: 1392700000, name: 'Sun', proper: true, one: true, since: NEW,
      fact: 'The Sun is about 1.39 million km across, roughly 109 times as wide as Earth.', src: 'https://en.wikipedia.org/wiki/Sun',
      svg: '<circle cx="50" cy="50" r="50"/>' },
    { id: 'iss', cat: 'space', dim: 'l', size: 109, kg: 420000, name: 'International Space Station', proper: true, one: true, since: NEW,
      fact: 'The ISS is about 109 m across its solar-panel truss, bigger than a football pitch, and weighs about 420 t.', src: 'https://en.wikipedia.org/wiki/International_Space_Station',
      svg: '<rect x="0" y="22" width="200" height="4"/><rect x="4" y="0" width="34" height="48"/><rect x="42" y="0" width="34" height="48"/><rect x="124" y="0" width="34" height="48"/><rect x="162" y="0" width="34" height="48"/><rect x="86" y="12" width="28" height="24" rx="4"/>' },
    { id: 'saturnv', cat: 'space', dim: 'h', size: 110.6, kg: 2970000, name: 'Saturn V rocket', proper: true, one: true, since: NEW,
      fact: 'The Saturn V that sent astronauts to the Moon stood 110.6 m tall and weighed about 2,970 t fully fuelled.', src: 'https://en.wikipedia.org/wiki/Saturn_V',
      svg: '<rect x="14.5" y="0" width="1" height="12"/><path d="M8 30 L15 10 L22 30 Z"/><rect x="8" y="30" width="14" height="40"/><rect x="6" y="70" width="18" height="130"/><path d="M6 176 L0 200 L6 200 Z"/><path d="M24 176 L30 200 L24 200 Z"/>' },
    { id: 'pslv', cat: 'space', dim: 'h', size: 44, kg: 320000, name: 'ISRO PSLV rocket', proper: true, one: true, tags: ['india'], since: NEW,
      fact: 'ISRO\'s PSLV is 44 m tall and weighs about 320 t at lift-off in its XL version.', src: 'https://en.wikipedia.org/wiki/Polar_Satellite_Launch_Vehicle',
      svg: '<path d="M18 0 L24 14 V160 H12 V14 Z"/><path d="M4 110 L7 100 L10 110 V160 H4 Z"/><path d="M26 110 L29 100 L32 110 V160 H26 Z"/>' },
    { id: 'shuttle', cat: 'space', dim: 'l', size: 37.2, kg: 78000, name: 'Space Shuttle orbiter', proper: true, one: true, tags: ['usa'], since: NEW,
      fact: 'A Space Shuttle orbiter was 37.2 m long and weighed about 78 t empty.', src: 'https://en.wikipedia.org/wiki/Space_Shuttle_orbiter',
      svg: '<path d="M0 30 Q4 18 20 16 L150 14 L170 0 L182 0 L178 18 L186 22 L186 34 L20 38 Q4 38 0 30 Z"/><path d="M70 34 L150 34 L160 46 L110 46 Z"/>' },
    { id: 'hubble', cat: 'space', dim: 'l', size: 13.2, kg: 11110, name: 'Hubble Space Telescope', proper: true, one: true, since: NEW,
      fact: 'Hubble is 13.2 m long, about the length of a city bus, and weighs about 11 t.', src: 'https://en.wikipedia.org/wiki/Hubble_Space_Telescope',
      svg: '<rect x="0" y="10" width="120" height="30" rx="4"/><path d="M120 12 L130 6 V44 L120 38 Z"/><rect x="30" y="0" width="40" height="6"/><rect x="30" y="44" width="40" height="6"/>' },

    // ----- Dinosaurs -----
    { id: 'raptor', cat: 'dinos', dim: 'l', size: 2, kg: 15, name: 'Velociraptor', proper: true, since: NEW,
      fact: 'Movies made it huge, but Velociraptor was only about 2 m long, tail included, and weighed about 15 kg.', src: 'https://en.wikipedia.org/wiki/Velociraptor',
      svg: '<path d="M0 30 Q30 26 50 22 Q60 14 72 14 L80 8 Q88 6 90 10 L92 14 L84 16 L80 20 Q74 26 70 32 L74 52 L80 54 L68 54 L64 36 L58 36 L60 50 L64 54 L54 54 L52 34 Q30 34 0 30 Z"/>' },
    { id: 'trike', cat: 'dinos', dim: 'l', size: 9, kg: 9000, name: 'Triceratops', proper: true, since: NEW,
      fact: 'Triceratops grew to about 8 to 9 m long. Weight estimates range from about 6 to 12 t.', src: 'https://en.wikipedia.org/wiki/Triceratops',
      svg: '<path d="M2 38 Q10 20 40 18 Q70 16 90 22 L104 12 L112 10 L106 20 L114 22 L126 16 L122 26 Q130 30 128 40 L118 46 L110 44 L108 60 L100 60 L98 46 L88 46 L86 60 L78 60 L76 46 L48 48 L46 60 L38 60 L36 48 L30 60 L22 60 L24 44 Q8 44 2 38 Z"/>' },
    { id: 'stego', cat: 'dinos', dim: 'l', size: 9, kg: 5000, name: 'Stegosaurus', proper: true, since: NEW,
      fact: 'The largest Stegosaurus were about 9 m long and weighed around 5 t, yet its brain was about the size of a dog\'s.', src: 'https://en.wikipedia.org/wiki/Stegosaurus',
      svg: '<path d="M0 44 Q30 40 50 36 Q80 34 100 40 Q116 44 124 50 L120 52 Q110 50 104 52 L104 70 L96 70 L94 54 L74 56 L74 70 L66 70 L64 56 L44 52 L42 70 L34 70 L34 50 Q16 50 0 48 Z"/><path d="M44 37 L50 20 L56 35 Z M58 35 L66 12 L74 35 Z M76 36 L84 14 L92 38 Z M94 40 L100 24 L106 43 Z"/>' },
    { id: 'brachio', cat: 'dinos', dim: 'l', size: 20, name: 'Brachiosaurus', proper: true, since: NEW,
      fact: 'Brachiosaurus is estimated to have been about 18 to 22 m long, with a neck that held its head high like a giraffe\'s.', src: 'https://en.wikipedia.org/wiki/Brachiosaurus',
      svg: '<path d="M0 60 Q30 54 50 50 Q66 46 80 44 L96 8 Q100 0 108 2 L114 6 L108 10 L102 12 L92 50 Q90 60 84 64 L84 90 L76 90 L74 66 L62 68 L60 90 L52 90 L50 66 Q30 66 0 62 Z"/>' },
    { id: 'argentino', cat: 'dinos', dim: 'l', size: 35, kg: 70000, name: 'Argentinosaurus', proper: true, since: NEW,
      fact: 'One of the largest land animals ever: up to about 35 m long and around 70 t.', src: 'https://en.wikipedia.org/wiki/Argentinosaurus',
      svg: '<path d="M0 44 Q40 40 70 34 Q90 26 110 28 Q130 30 150 22 L176 10 Q184 6 188 10 L184 16 L172 18 L152 32 Q140 42 130 46 L130 74 L120 74 L118 50 L100 52 L98 74 L88 74 L86 50 Q70 50 60 48 L60 74 L50 74 L48 48 Q20 48 0 46 Z"/>' },
    { id: 'spino', cat: 'dinos', dim: 'l', size: 14, name: 'Spinosaurus', proper: true, since: NEW,
      fact: 'Spinosaurus was about 14 m long, longer than T. rex, with a tall sail on its back.', src: 'https://en.wikipedia.org/wiki/Spinosaurus',
      svg: '<path d="M0 36 Q30 32 50 26 Q66 18 80 18 Q92 16 98 12 L118 8 Q128 8 130 12 L128 18 L114 18 L106 22 Q100 26 96 30 L100 40 L96 42 L90 36 Q86 44 80 48 L84 70 L94 74 L76 74 L72 52 L66 52 L64 70 L74 74 L56 74 L56 50 Q36 44 0 38 Z"/><path d="M46 27 Q60 0 84 19 Z"/>' },
    { id: 'ptera', cat: 'dinos', dim: 'l', size: 6, name: 'Pteranodon (wingspan)', proper: true, since: NEW,
      fact: 'Large male Pteranodon had wings about 6 m from tip to tip. Strictly, it was a flying reptile, not a dinosaur.', src: 'https://en.wikipedia.org/wiki/Pteranodon',
      svg: '<path d="M0 30 L60 18 L90 6 L96 0 L102 6 L132 18 L192 30 L130 26 L104 22 L100 34 L92 34 L88 22 L62 26 Z"/>' },

    // ----- Bugs and tiny things -----
    { id: 'ant', cat: 'tiny', dim: 'l', size: 0.004, name: 'Black garden ant', since: NEW,
      fact: 'A black garden ant worker is only about 3 to 5 mm long.', src: 'https://en.wikipedia.org/wiki/Lasius_niger',
      svg: '<ellipse cx="10" cy="20" rx="9" ry="8"/><ellipse cx="30" cy="20" rx="10" ry="6"/><ellipse cx="56" cy="20" rx="16" ry="11"/><path d="M24 22 L14 36 L16 37 L27 24 Z M30 24 L30 38 L32 38 L32 24 Z M36 22 L46 36 L48 35 L38 22 Z M6 13 L0 2 L2 1 L9 12 Z"/>' },
    { id: 'bee', cat: 'tiny', dim: 'l', size: 0.013, kg: 0.0001, name: 'Honeybee', since: NEW,
      fact: 'A worker honeybee is about 12 to 15 mm long and weighs about a tenth of a gram.', src: 'https://en.wikipedia.org/wiki/Western_honey_bee',
      svg: '<ellipse cx="50" cy="30" rx="34" ry="16"/><circle cx="12" cy="30" r="10"/><path d="M40 15 Q30 -4 50 0 Q60 4 52 16 Z M58 15 Q62 -2 80 2 Q86 10 64 18 Z"/>' },
    { id: 'ladybird', cat: 'tiny', dim: 'l', size: 0.007, name: 'Ladybird (ladybug)', since: NEW,
      fact: 'The seven-spot ladybird is about 5 to 8 mm long.', src: 'https://en.wikipedia.org/wiki/Coccinella_septempunctata',
      svg: '<path fill-rule="evenodd" d="M10 30 A30 26 0 0 1 70 30 A30 26 0 0 1 10 30 Z M30 18 A5 5 0 1 0 40 18 A5 5 0 1 0 30 18 Z M48 30 A5 5 0 1 0 58 30 A5 5 0 1 0 48 30 Z M24 36 A4 4 0 1 0 32 36 A4 4 0 1 0 24 36 Z"/><path d="M0 30 A10 10 0 0 1 12 20 V40 A10 10 0 0 1 0 30 Z"/>' },
    { id: 'monarch', cat: 'tiny', dim: 'l', size: 0.095, kg: 0.0005, name: 'Monarch butterfly (wingspan)', tags: ['usa'], since: NEW,
      fact: 'Monarch wings span about 9 to 10 cm, and the butterfly weighs about half a gram. Many fly thousands of kilometres from North America to Mexico.', src: 'https://en.wikipedia.org/wiki/Monarch_butterfly',
      svg: '<path d="M50 20 Q30 -6 4 4 Q-2 20 20 34 Q6 44 16 58 Q34 62 48 40 Z M50 20 Q70 -6 96 4 Q102 20 80 34 Q94 44 84 58 Q66 62 52 40 Z"/><rect x="48" y="14" width="4" height="40" rx="2"/>' },
    { id: 'atlasmoth', cat: 'tiny', dim: 'l', size: 0.24, name: 'Atlas moth (wingspan)', tags: ['india'], since: NEW,
      fact: 'Found in the forests of South and Southeast Asia, including India, the atlas moth has wings up to about 24 cm across.', src: 'https://en.wikipedia.org/wiki/Attacus_atlas',
      svg: '<path d="M60 24 Q30 -4 2 10 Q0 30 30 40 Q14 60 30 74 Q50 70 58 46 Z M60 24 Q90 -4 118 10 Q120 30 90 40 Q106 60 90 74 Q70 70 62 46 Z"/><rect x="57" y="18" width="6" height="40" rx="3"/>' },
    { id: 'goliath', cat: 'tiny', dim: 'l', size: 0.11, name: 'Goliath beetle', since: NEW,
      fact: 'Male Goliath beetles can reach about 11 cm long, among the biggest insects alive.', src: 'https://en.wikipedia.org/wiki/Goliathus',
      svg: '<path d="M20 30 Q20 8 50 6 Q80 8 80 30 Q80 54 50 56 Q20 54 20 30 Z"/><path d="M4 26 Q8 20 20 24 V36 Q8 40 4 34 Z"/><path d="M28 54 L20 66 L23 67 L32 55 Z M50 56 L50 68 L53 68 L53 56 Z M72 54 L80 66 L77 67 L68 55 Z"/>' },

    // ----- Food -----
    { id: 'egg', cat: 'food', dim: 'h', size: 0.058, kg: 0.057, name: 'Hen\'s egg (large)', since: NEW,
      fact: 'A large hen\'s egg is about 5.5 to 6 cm tall. In the US, a dozen large eggs must weigh at least 24 oz, about 57 g each.', src: 'https://en.wikipedia.org/wiki/Chicken_egg_sizes',
      svg: '<path d="M30 0 Q60 10 60 46 Q60 76 30 76 Q0 76 0 46 Q0 10 30 0 Z"/>' },
    { id: 'pizza', cat: 'food', dim: 'd', size: 0.305, name: '12-inch pizza', tags: ['usa'], since: NEW,
      fact: 'A 12-inch pizza is 30.5 cm across. Doubling the width to 24 inches gives four times as much pizza.', src: 'https://en.wikipedia.org/wiki/Pizza',
      svg: '<path fill-rule="evenodd" d="' + CIRCLE + ' M48 2 H52 V98 H48 Z M2 48 H48 V52 H2 Z M52 48 H98 V52 H52 Z"/>' },
    { id: 'apple', cat: 'food', dim: 'd', size: 0.075, kg: 0.18, name: 'Apple', since: NEW,
      fact: 'A medium apple is about 7.5 cm across and weighs about 180 g.', src: 'https://en.wikipedia.org/wiki/Apple',
      svg: '<path d="M50 20 Q70 4 90 22 Q104 44 90 72 Q78 96 60 92 Q50 88 40 92 Q22 96 10 72 Q-4 44 10 22 Q30 4 50 20 Z"/><path d="M48 20 Q46 8 52 0 L56 2 Q50 10 52 20 Z"/><path d="M54 12 Q66 0 78 6 Q68 16 54 12 Z"/>' },
    { id: 'mango', cat: 'food', dim: 'l', size: 0.1, kg: 0.22, name: 'Alphonso mango', tags: ['india'], since: NEW,
      fact: 'An Alphonso mango is around 10 cm long and usually weighs between 150 and 300 g.', src: 'https://en.wikipedia.org/wiki/Alphonso_mango',
      svg: '<path d="M4 40 Q0 14 30 6 Q70 -2 96 20 Q110 36 100 52 Q86 70 50 66 Q10 62 4 40 Z"/><path d="M8 18 Q2 10 6 4 L9 6 Q6 12 11 17 Z"/>' },
    { id: 'rice', cat: 'food', dim: 'l', size: 0.007, kg: 0.00002, name: 'Grain of basmati rice', tags: ['india'], since: NEW,
      fact: 'An uncooked basmati grain is about 7 mm long and weighs about 0.02 g. It can nearly double in length when cooked.', src: 'https://en.wikipedia.org/wiki/Basmati',
      svg: '<path d="M0 10 Q4 0 30 1 Q70 2 76 10 Q70 18 30 19 Q4 20 0 10 Z"/>' },
    { id: 'roti', cat: 'food', dim: 'd', size: 0.18, kg: 0.04, name: 'Roti (chapati)', tags: ['india'], since: NEW,
      fact: 'A home-made roti is usually about 15 to 20 cm across and weighs around 40 g.', src: 'https://en.wikipedia.org/wiki/Chapati',
      svg: '<path fill-rule="evenodd" d="' + CIRCLE + ' M30 30 A6 5 0 1 0 42 30 A6 5 0 1 0 30 30 Z M60 62 A8 6 0 1 0 76 62 A8 6 0 1 0 60 62 Z M28 66 A4 4 0 1 0 36 66 A4 4 0 1 0 28 66 Z"/>' },

    // ----- USA -----
    { id: 'empire', cat: 'landmarks', dim: 'h', size: 443.2, name: 'Empire State Building', tags: ['usa'], since: NEW,
      fact: 'To the tip of its antenna, New York\'s Empire State Building is 443.2 m (1,454 ft) tall.', src: 'https://en.wikipedia.org/wiki/Empire_State_Building',
      svg: '<path d="M0 200 V120 H6 V100 H12 V60 H16 V44 H19 V30 H20.5 V0 H21.5 V30 H23 V44 H26 V60 H30 V100 H36 V120 H42 V200 Z"/>' },
    { id: 'onewtc', cat: 'landmarks', dim: 'h', size: 541.3, name: 'One World Trade Center', tags: ['usa'], since: NEW,
      fact: 'One World Trade Center is 1,776 ft (541.3 m) tall, a nod to the year of American independence.', src: 'https://en.wikipedia.org/wiki/One_World_Trade_Center',
      svg: '<path d="M2 200 L6 56 L18 46 L30 56 L34 200 Z"/><rect x="17.5" y="0" width="1" height="47"/>' },
    { id: 'goldengate', cat: 'landmarks', dim: 'h', size: 227, name: 'Golden Gate Bridge tower', tags: ['usa'], since: NEW,
      fact: 'Each tower of San Francisco\'s Golden Gate Bridge rises 227 m (746 ft) above the water.', src: 'https://en.wikipedia.org/wiki/Golden_Gate_Bridge',
      svg: '<path fill-rule="evenodd" d="M0 200 V0 H40 V200 H30 V24 H10 V200 Z"/><rect x="10" y="60" width="20" height="8"/><rect x="10" y="110" width="20" height="8"/>' },
    { id: 'washmon', cat: 'landmarks', dim: 'h', size: 169.3, name: 'Washington Monument', tags: ['usa'], since: NEW,
      fact: 'The Washington Monument is 169.3 m (555 ft) tall, the world\'s tallest stone obelisk.', src: 'https://en.wikipedia.org/wiki/Washington_Monument',
      svg: '<path d="M4 200 L8 12 L12 0 L16 12 L20 200 Z"/>' },
    { id: 'arch', cat: 'landmarks', dim: 'h', size: 192, name: 'Gateway Arch', tags: ['usa'], since: NEW,
      fact: 'St. Louis\'s Gateway Arch is 192 m (630 ft) tall and exactly as wide at its base.', src: 'https://en.wikipedia.org/wiki/Gateway_Arch',
      svg: '<path fill-rule="evenodd" d="M0 192 Q4 0 96 0 Q188 0 192 192 H178 Q174 16 96 14 Q18 16 14 192 Z"/>' },
    { id: 'needle', cat: 'landmarks', dim: 'h', size: 184, name: 'Space Needle', tags: ['usa'], since: NEW,
      fact: 'Seattle\'s Space Needle is 184 m (605 ft) tall. It was built for the 1962 World\'s Fair.', src: 'https://en.wikipedia.org/wiki/Space_Needle',
      svg: '<path d="M14 200 L20 110 L18 60 L26 60 L24 110 L30 200 Z"/><path d="M0 58 Q22 40 44 58 L36 62 L8 62 Z"/><path d="M18 42 L22 30 L26 42 Z"/><rect x="21.5" y="0" width="1" height="32"/>' },
    { id: 'rushmore', cat: 'landmarks', dim: 'h', size: 18, name: 'Mount Rushmore (one face)', tags: ['usa'], since: NEW,
      fact: 'Each president\'s face carved into Mount Rushmore is about 18 m (60 ft) tall.', src: 'https://en.wikipedia.org/wiki/Mount_Rushmore',
      svg: '<path d="M10 100 Q0 70 4 40 Q8 8 34 2 Q60 0 66 26 Q68 40 64 52 L72 60 L64 64 Q66 76 58 82 Q54 96 40 100 Z"/>' },
    { id: 'sherman', cat: 'landmarks', dim: 'h', size: 83.8, name: 'General Sherman (giant sequoia)', tags: ['usa'], since: NEW,
      fact: 'General Sherman in California is the largest single-stem tree on Earth by volume, and 83.8 m (275 ft) tall.', src: 'https://en.wikipedia.org/wiki/General_Sherman_(tree)',
      svg: '<path d="M16 200 L18 120 L14 120 Q2 96 10 70 Q0 50 14 30 Q20 6 30 0 Q42 6 46 30 Q58 50 48 70 Q56 96 42 120 L38 120 L40 200 Z"/>' },
    { id: 'schoolbus', cat: 'vehicles', dim: 'l', size: 12.2, name: 'Yellow school bus', tags: ['usa'], since: NEW,
      fact: 'A full-size American school bus is about 12 m (40 ft) long.', src: 'https://en.wikipedia.org/wiki/School_bus',
      svg: '<path fill-rule="evenodd" d="M2 8 Q2 2 8 2 H200 Q206 2 206 10 V24 H228 Q236 24 236 32 V56 H2 Z M12 10 H34 V28 H12 Z M42 10 H64 V28 H42 Z M72 10 H94 V28 H72 Z M102 10 H124 V28 H102 Z M132 10 H154 V28 H132 Z M162 10 H184 V28 H162 Z M190 10 H200 V40 H190 Z"/><circle cx="46" cy="56" r="11"/><circle cx="200" cy="56" r="11"/>' },
    { id: 'pickup', cat: 'vehicles', dim: 'l', size: 5.9, kg: 2200, name: 'Full-size pickup truck', tags: ['usa'], since: NEW,
      fact: 'A full-size crew-cab pickup, such as a Ford F-150, is about 5.9 m (19 ft) long and weighs around 2.2 t.', src: 'https://en.wikipedia.org/wiki/Ford_F-Series',
      svg: '<path fill-rule="evenodd" d="M2 42 V26 Q2 22 8 22 H70 V8 Q70 4 76 4 H104 Q112 4 118 14 L126 24 Q134 26 134 34 V42 Z M78 10 H104 Q108 10 114 22 H78 Z"/><circle cx="26" cy="44" r="10"/><circle cx="112" cy="44" r="10"/>' },
    { id: 'bison', cat: 'animals', dim: 'h', size: 1.8, kg: 900, name: 'American bison', tags: ['usa'], since: NEW,
      fact: 'A bull bison stands up to about 1.8 m (6 ft) at the shoulder and weighs up to about 900 kg (2,000 lb).', src: 'https://www.nps.gov/yell/learn/nature/bison.htm',
      svg: '<path d="M8 40 Q6 16 30 8 Q46 0 58 10 Q70 8 82 14 Q96 22 98 40 L96 70 L90 70 L88 46 L80 48 L78 70 L72 70 L70 48 Q50 50 34 46 L32 70 L26 70 L24 48 Q20 56 12 58 L14 70 L8 70 Q2 56 8 40 Z"/>' },
    { id: 'eagle', cat: 'animals', dim: 'l', size: 2, kg: 4.5, name: 'Bald eagle (wingspan)', tags: ['usa'], since: NEW,
      fact: 'The bald eagle\'s wings span about 1.8 to 2.3 m, yet the bird weighs only about 3 to 6 kg.', src: 'https://en.wikipedia.org/wiki/Bald_eagle',
      svg: '<path d="M0 22 Q30 4 70 14 L92 16 Q96 8 102 8 Q108 10 106 16 L130 14 Q170 4 200 22 Q160 20 130 26 L112 30 L118 46 L100 42 L82 46 L88 30 L70 26 Q40 20 0 22 Z"/>' },
    { id: 'quarter', cat: 'everyday', dim: 'd', size: 0.02426, kg: 0.00567, name: 'US quarter', tags: ['usa'], since: NEW,
      fact: 'A US quarter is 24.26 mm across and weighs 5.67 g.', src: 'https://www.usmint.gov/learn/coins-and-medals/circulating-coins/coin-specifications',
      svg: '<path fill-rule="evenodd" d="' + CIRCLE + ' M10 50 A40 40 0 1 0 90 50 A40 40 0 1 0 10 50 Z"/><path d="M40 28 Q56 22 62 36 Q66 52 58 66 L44 72 Q36 60 40 44 Z"/>' },
    { id: 'dollar', cat: 'everyday', dim: 'l', size: 0.156, kg: 0.001, name: 'US dollar bill', tags: ['usa'], since: NEW,
      fact: 'A US banknote is 15.6 cm long and weighs about 1 g, so 1,000 of them weigh about a kilogram.', src: 'https://en.wikipedia.org/wiki/United_States_one-dollar_bill',
      svg: '<path fill-rule="evenodd" d="M0 0 H156 V66 H0 Z M6 6 H150 V60 H6 Z"/><ellipse cx="78" cy="33" rx="18" ry="22"/>' },
    { id: 'nflball', cat: 'sports', dim: 'l', size: 0.28, kg: 0.41, name: 'American football', tags: ['usa'], since: NEW,
      fact: 'An NFL ball is about 28 cm (11 in) long and weighs 14 to 15 oz, about 410 g.', src: 'https://en.wikipedia.org/wiki/Football_(ball)',
      svg: '<path fill-rule="evenodd" d="M0 30 Q50 -10 100 30 Q50 70 0 30 Z M30 28 H70 V32 H30 Z"/>' },
    { id: 'baseball', cat: 'sports', dim: 'd', size: 0.074, kg: 0.145, name: 'Baseball', tags: ['usa'], since: NEW,
      fact: 'A baseball is about 7.4 cm across and weighs 5 to 5.25 oz, about 145 g, a little less than a cricket ball.', src: 'https://en.wikipedia.org/wiki/Baseball_(ball)',
      svg: '<path fill-rule="evenodd" d="' + CIRCLE + ' M22 12 Q40 50 22 88 L25 90 Q44 50 25 10 Z M78 12 Q60 50 78 88 L75 90 Q56 50 75 10 Z"/>' },
    { id: 'basketball', cat: 'sports', dim: 'd', size: 0.239, kg: 0.62, name: 'Basketball (size 7)', tags: ['usa'], since: NEW,
      fact: 'A size-7 basketball is about 24 cm across and weighs about 620 g (22 oz).', src: 'https://en.wikipedia.org/wiki/Basketball_(ball)',
      svg: '<path fill-rule="evenodd" d="' + CIRCLE + ' M2 48 H98 V52 H2 Z"/>' },
    { id: 'hoop', cat: 'sports', dim: 'h', size: 3.05, name: 'Basketball hoop (to the rim)', tags: ['usa'], since: NEW,
      fact: 'From the NBA to school gyms, the rim is exactly 10 ft (3.05 m) above the floor.', src: 'https://en.wikipedia.org/wiki/Backboard_(basketball)',
      svg: '<rect x="0" y="4" width="6" height="301"/><rect x="0" y="4" width="34" height="4"/><rect x="30" y="0" width="4" height="34"/><rect x="34" y="0" width="30" height="3"/><path d="M36 3 L42 22 L56 22 L62 3 Z"/>' },

    // ----- More India -----
    { id: 'charminar', cat: 'landmarks', dim: 'h', size: 56, name: 'Charminar', tags: ['india'], since: NEW,
      fact: 'Hyderabad\'s Charminar was built in 1591. Each of its four minarets rises to about 56 m.', src: 'https://en.wikipedia.org/wiki/Charminar',
      svg: '<path fill-rule="evenodd" d="M4 200 V40 H16 V200 Z M84 200 V40 H96 V200 Z M16 200 V90 H84 V200 Z M30 200 V140 Q50 110 70 140 V200 Z"/><path d="M4 40 Q10 20 16 40 Z M84 40 Q90 20 96 40 Z"/><rect x="9.5" y="8" width="1" height="20"/><rect x="89.5" y="8" width="1" height="20"/><rect x="16" y="80" width="68" height="10"/>' },
    { id: 'lotus', cat: 'landmarks', dim: 'h', size: 34.3, name: 'Lotus Temple', tags: ['india'], since: NEW,
      fact: 'Delhi\'s Lotus Temple is about 34 m tall, made of 27 marble-clad "petals".', src: 'https://en.wikipedia.org/wiki/Lotus_Temple',
      svg: '<path d="M0 100 Q10 60 40 50 Q30 80 34 100 Z"/><path d="M160 100 Q150 60 120 50 Q130 80 126 100 Z"/><path d="M30 100 Q34 40 60 20 Q62 70 64 100 Z"/><path d="M130 100 Q126 40 100 20 Q98 70 96 100 Z"/><path d="M58 100 Q60 30 80 0 Q100 30 102 100 Z"/>' },
    { id: 'hawamahal', cat: 'landmarks', dim: 'h', size: 15, name: 'Hawa Mahal', tags: ['india'], since: NEW,
      fact: 'Jaipur\'s Hawa Mahal rises five storeys, about 15 m (50 ft), with 953 small windows.', src: 'https://en.wikipedia.org/wiki/Hawa_Mahal',
      svg: '<path d="M0 100 V50 H10 V38 H20 V28 H30 V18 H40 V10 H50 V4 Q55 -2 60 4 V10 H70 V18 H80 V28 H90 V38 H100 V50 H110 V100 Z"/>' },
    { id: 'stumps', cat: 'sports', dim: 'h', size: 0.711, name: 'Cricket stumps', tags: ['india'], since: NEW,
      fact: 'The Laws of Cricket set the stumps at 28 inches (71.1 cm) tall, with the bails resting on top.', src: 'https://en.wikipedia.org/wiki/Wicket',
      svg: '<rect x="0" y="2" width="4" height="70"/><rect x="9" y="2" width="4" height="70"/><rect x="18" y="2" width="4" height="70"/><rect x="0" y="0" width="22" height="2"/>' },
    { id: 'rhino', cat: 'animals', dim: 'h', size: 1.8, kg: 2200, name: 'Indian rhinoceros', tags: ['india'], since: NEW,
      fact: 'The greater one-horned rhino of Assam stands about 1.75 to 2 m at the shoulder. Males weigh around 2.2 t.', src: 'https://en.wikipedia.org/wiki/Indian_rhinoceros',
      svg: '<path d="M6 44 Q4 22 30 16 Q60 10 84 18 Q96 14 104 22 L114 12 L114 26 Q122 34 120 44 L112 48 Q104 50 100 48 L98 70 L90 70 L88 52 L74 54 L72 70 L64 70 L62 54 L38 54 L36 70 L28 70 L26 52 L22 70 L14 70 Q4 58 6 44 Z"/>' },

    // ----- Geography: mountains (height above sea level), waterfalls (total drop), rivers and lakes (length) -----
    { id: 'everest', cat: 'geo', dim: 'h', size: 8849, name: 'Mount Everest', proper: true, one: true, bare: true, since: NEW,
      fact: 'Mount Everest stands 8,849 m above sea level, the highest point on Earth. That figure comes from a joint Nepal-China survey in 2020.', src: 'https://en.wikipedia.org/wiki/Mount_Everest',
      svg: '<path d="M0 100 L40 70 L62 78 L95 30 L110 38 L128 0 L146 24 L160 18 L190 60 L210 55 L240 100 Z"/>' },
    { id: 'k2', cat: 'geo', dim: 'h', size: 8611, name: 'K2', proper: true, one: true, bare: true, since: NEW,
      fact: 'K2, in the Karakoram range, is 8,611 m tall: the second-highest mountain on Earth, and far harder to climb than Everest.', src: 'https://en.wikipedia.org/wiki/K2',
      svg: '<path d="M0 100 L60 60 L90 52 L120 0 L150 48 L185 62 L240 100 Z"/>' },
    { id: 'kangch', cat: 'geo', dim: 'h', size: 8586, name: 'Kangchenjunga', proper: true, one: true, bare: true, tags: ['india'], since: NEW,
      fact: 'Kangchenjunga, on the India-Nepal border in Sikkim, rises to 8,586 m. It is the third-highest mountain in the world and the highest peak in Sikkim.', src: 'https://en.wikipedia.org/wiki/Kangchenjunga',
      svg: '<path d="M0 100 L30 72 L55 40 L70 48 L92 8 L105 20 L118 0 L132 22 L150 14 L170 45 L200 60 L240 100 Z"/>' },
    { id: 'nandadevi', cat: 'geo', dim: 'h', size: 7816, name: 'Nanda Devi', proper: true, one: true, bare: true, tags: ['india'], since: NEW,
      fact: 'Nanda Devi in Uttarakhand is 7,816 m tall, the highest mountain that lies entirely within India.', src: 'https://en.wikipedia.org/wiki/Nanda_Devi',
      svg: '<path d="M0 100 L45 62 L80 20 L95 28 L110 0 L130 35 L150 30 L190 70 L240 100 Z"/>' },
    { id: 'denali', cat: 'geo', dim: 'h', size: 6190, name: 'Denali', proper: true, one: true, bare: true, tags: ['usa'], since: NEW,
      fact: 'Denali in Alaska is 6,190 m tall, the highest mountain in North America.', src: 'https://en.wikipedia.org/wiki/Denali',
      svg: '<path d="M0 100 L35 70 L70 38 L100 20 L125 0 L150 15 L185 40 L215 72 L240 100 Z"/>' },
    { id: 'kilimanjaro', cat: 'geo', dim: 'h', size: 5895, name: 'Mount Kilimanjaro', proper: true, one: true, bare: true, since: NEW,
      fact: 'Mount Kilimanjaro in Tanzania is 5,895 m tall, the highest mountain in Africa and the tallest free-standing mountain on Earth.', src: 'https://en.wikipedia.org/wiki/Mount_Kilimanjaro',
      svg: '<path d="M0 100 L60 45 Q70 36 85 33 L95 30 L150 30 Q170 32 180 40 L240 100 Z"/>' },
    { id: 'montblanc', cat: 'geo', dim: 'h', size: 4806, name: 'Mont Blanc', proper: true, one: true, bare: true, since: NEW,
      fact: 'Mont Blanc, on the border of France and Italy, is about 4,806 m tall. Its icy summit rises and falls by a metre or two from year to year.', src: 'https://en.wikipedia.org/wiki/Mont_Blanc',
      svg: '<path d="M0 100 L50 60 Q90 10 120 0 Q150 8 185 55 L240 100 Z"/>' },
    { id: 'matterhorn', cat: 'geo', dim: 'h', size: 4478, name: 'Matterhorn', proper: true, one: true, since: NEW,
      fact: 'The Matterhorn in the Alps is 4,478 m tall. Its sharp, four-sided peak is one of the most photographed mountains in the world.', src: 'https://en.wikipedia.org/wiki/Matterhorn',
      svg: '<path d="M0 100 L70 70 L100 40 L112 0 L125 5 L135 30 L170 62 L240 100 Z"/>' },
    { id: 'whitney', cat: 'geo', dim: 'h', size: 4421, name: 'Mount Whitney', proper: true, one: true, bare: true, tags: ['usa'], since: NEW,
      fact: 'Mount Whitney in California is 4,421 m tall, the highest point in the lower 48 US states.', src: 'https://en.wikipedia.org/wiki/Mount_Whitney',
      svg: '<path d="M0 100 L40 50 L55 58 L70 30 L85 40 L100 10 L112 18 L125 0 L140 20 L160 12 L180 45 L240 100 Z"/>' },
    { id: 'fuji', cat: 'geo', dim: 'h', size: 3776, name: 'Mount Fuji', proper: true, one: true, bare: true, since: NEW,
      fact: 'Mount Fuji, Japan\'s highest mountain, is a 3,776 m volcano. It last erupted in 1707.', src: 'https://en.wikipedia.org/wiki/Mount_Fuji',
      svg: '<path d="M0 100 Q60 70 95 10 L105 4 L120 8 L135 4 L145 10 Q180 70 240 100 Z"/>' },
    { id: 'angelfalls', cat: 'geo', dim: 'h', size: 979, name: 'Angel Falls', proper: true, one: true, bare: true, since: NEW,
      fact: 'Angel Falls in Venezuela drops 979 m, the highest uninterrupted waterfall in the world: more than the Burj Khalifa is tall.', src: 'https://en.wikipedia.org/wiki/Angel_Falls',
      svg: FALLS(55, [[0, 1]]) },
    { id: 'yosemitefalls', cat: 'geo', dim: 'h', size: 739, name: 'Yosemite Falls', proper: true, one: true, bare: true, tags: ['usa'], since: NEW,
      fact: 'Yosemite Falls in California drops 739 m in three steps, one of the tallest waterfalls in North America.', src: 'https://en.wikipedia.org/wiki/Yosemite_Falls',
      svg: FALLS(65, [[0, 1]]) },
    { id: 'dudhsagar', cat: 'geo', dim: 'h', size: 310, name: 'Dudhsagar Falls', proper: true, one: true, bare: true, tags: ['india'], since: NEW,
      fact: 'Dudhsagar Falls on the Goa-Karnataka border drops about 310 m. Its name means "sea of milk", and a railway bridge crosses right in front of it.', src: 'https://en.wikipedia.org/wiki/Dudhsagar_Falls',
      svg: FALLS(90, [[0, 1], [0, 1], [0, 1]]) },
    { id: 'jogfalls', cat: 'geo', dim: 'h', size: 253, name: 'Jog Falls', proper: true, one: true, bare: true, tags: ['india'], since: NEW,
      fact: 'Jog Falls in Karnataka drops 253 m in four streams, among the highest plunge waterfalls in India.', src: 'https://en.wikipedia.org/wiki/Jog_Falls',
      svg: FALLS(110, [[0, 1], [0, 1], [0, 1], [0, 1]]) },
    { id: 'victoriafalls', cat: 'geo', dim: 'h', size: 108, name: 'Victoria Falls', proper: true, one: true, bare: true, since: NEW,
      fact: 'Victoria Falls, between Zambia and Zimbabwe, is 108 m high but 1.7 km wide, which makes it one of the largest curtains of falling water on Earth.', src: 'https://en.wikipedia.org/wiki/Victoria_Falls',
      svg: FALLS(220, [[0, 1], [0, 1], [0, 1], [0, 1]]) },
    { id: 'niagara', cat: 'geo', dim: 'h', size: 51, name: 'Niagara Falls', proper: true, one: true, bare: true, tags: ['usa'], since: NEW,
      fact: 'Niagara Falls, on the US-Canada border, is about 51 m high. It is famous for how much water goes over it, not for its height.', src: 'https://en.wikipedia.org/wiki/Niagara_Falls',
      svg: FALLS(240, [[0, 1], [0, 1], [0, 1]]) },
    { id: 'nile', cat: 'geo', dim: 'l', size: 6650000, name: 'Nile', proper: true, one: true, since: NEW,
      fact: 'The Nile is about 6,650 km long, usually counted as the longest river in the world. It flows north through eleven countries into the Mediterranean.', src: 'https://en.wikipedia.org/wiki/Nile',
      svg: RIVER(5, 8) },
    { id: 'amazon', cat: 'geo', dim: 'l', size: 6400000, name: 'Amazon', proper: true, one: true, since: NEW,
      fact: 'The Amazon is about 6,400 km long and carries more water than any other river: around a fifth of all the river water reaching the oceans.', src: 'https://en.wikipedia.org/wiki/Amazon_River',
      svg: RIVER(7, 6) },
    { id: 'mississippi', cat: 'geo', dim: 'l', size: 3770000, name: 'Mississippi', proper: true, one: true, tags: ['usa'], since: NEW,
      fact: 'The Mississippi runs about 3,770 km from Minnesota to the Gulf of Mexico.', src: 'https://en.wikipedia.org/wiki/Mississippi_River',
      svg: RIVER(9, 7) },
    { id: 'ganga', cat: 'geo', dim: 'l', size: 2525000, name: 'Ganga', proper: true, one: true, tags: ['india'], since: NEW,
      fact: 'The Ganga flows about 2,525 km from the Gangotri Glacier in the Himalayas to the Bay of Bengal.', src: 'https://en.wikipedia.org/wiki/Ganges',
      svg: RIVER(4, 9) },
    { id: 'colorado', cat: 'geo', dim: 'l', size: 2330000, name: 'Colorado River', proper: true, one: true, tags: ['usa'], since: NEW,
      fact: 'The Colorado River runs about 2,330 km and carved the Grand Canyon on its way to Mexico.', src: 'https://en.wikipedia.org/wiki/Colorado_River',
      svg: RIVER(6, 10) },
    { id: 'godavari', cat: 'geo', dim: 'l', size: 1465000, name: 'Godavari', proper: true, one: true, tags: ['india'], since: NEW,
      fact: 'The Godavari is about 1,465 km long, the longest river that flows only through peninsular India.', src: 'https://en.wikipedia.org/wiki/Godavari_River',
      svg: RIVER(3, 7) },
    { id: 'yamuna', cat: 'geo', dim: 'l', size: 1376000, name: 'Yamuna', proper: true, one: true, tags: ['india'], since: NEW,
      fact: 'The Yamuna flows about 1,376 km past Delhi and Agra before joining the Ganga at Prayagraj.', src: 'https://en.wikipedia.org/wiki/Yamuna',
      svg: RIVER(5, 6) },
    { id: 'thames', cat: 'geo', dim: 'l', size: 346000, name: 'Thames', proper: true, one: true, since: NEW,
      fact: 'The Thames is about 346 km long, short by world standards but the longest river entirely in England.', src: 'https://en.wikipedia.org/wiki/River_Thames',
      svg: RIVER(6, 9) },
    { id: 'baikal', cat: 'geo', dim: 'l', size: 636000, name: 'Lake Baikal', proper: true, one: true, bare: true, since: NEW,
      fact: 'Lake Baikal in Siberia is 636 km long and over 1,600 m deep, the deepest and oldest lake on Earth.', src: 'https://en.wikipedia.org/wiki/Lake_Baikal',
      svg: '<path d="M0 80 Q40 60 80 50 Q160 30 230 20 Q280 10 320 0 Q330 8 300 20 Q240 40 170 55 Q100 75 30 95 Q5 100 0 80 Z"/>' },
    { id: 'superior', cat: 'geo', dim: 'l', size: 563000, name: 'Lake Superior', proper: true, one: true, bare: true, tags: ['usa'], since: NEW,
      fact: 'Lake Superior is 563 km long, the largest of the Great Lakes and the biggest freshwater lake in the world by area.', src: 'https://en.wikipedia.org/wiki/Lake_Superior',
      svg: '<path d="M0 40 Q30 10 90 15 Q150 0 220 10 Q280 5 300 30 Q270 45 230 40 Q200 70 140 60 Q90 80 40 70 Q10 65 0 40 Z"/>' },
    { id: 'lakevictoria', cat: 'geo', dim: 'l', size: 337000, name: 'Lake Victoria', proper: true, one: true, bare: true, since: NEW,
      fact: 'Lake Victoria, shared by Uganda, Kenya and Tanzania, is 337 km long, the largest lake in Africa.', src: 'https://en.wikipedia.org/wiki/Lake_Victoria',
      svg: '<path d="M10 40 Q20 5 70 8 Q120 0 150 20 Q175 45 160 75 Q130 100 80 92 Q30 90 15 70 Q5 55 10 40 Z"/>' },
    { id: 'chilika', cat: 'geo', dim: 'l', size: 64300, name: 'Chilika Lake', proper: true, one: true, bare: true, tags: ['india'], since: NEW,
      fact: 'Chilika Lake in Odisha is a 64 km long lagoon, the largest coastal lagoon in India and winter home to over a million migrating birds.', src: 'https://en.wikipedia.org/wiki/Chilika_Lake',
      svg: '<path d="M0 10 Q40 0 90 20 Q130 40 140 70 Q120 90 80 80 Q30 60 0 10 Z"/>' },
  ];

  // Sources for the first batch of objects (newer ones carry `src` inline)
  const W = 'https://en.wikipedia.org/wiki/';
  const SRC = {
    human: 'Human_height', phone: 'Smartphone', banana: 'Banana', door: 'Door', coin: 'Indian_10-rupee_coin', a4: 'ISO_216',
    giraffe: 'Giraffe', elephant: 'Asian_elephant', whale: 'Blue_whale', tiger: 'Bengal_tiger', cat: 'Cat', trex: 'Sue_(dinosaur)',
    ostrich: 'Common_ostrich', cobra: 'King_cobra', peacock: 'Indian_peafowl', bus: 'Bus', auto: 'Auto_rickshaw', car: 'Hatchback',
    scooter: 'Honda_Activa', b747: 'Boeing_747-400', coach: 'LHB_coach', titanic: 'Titanic', qutub: 'Qutb_Minar', indiagate: 'India_Gate',
    unity: 'Statue_of_Unity', eiffel: 'Eiffel_Tower', burj: 'Burj_Khalifa', taj: 'Taj_Mahal', gateway: 'Gateway_of_India',
    pyramid: 'Great_Pyramid_of_Giza', liberty: 'Statue_of_Liberty', coconut: 'Coconut', bat: 'Cricket_bat', pitch: 'Cricket_pitch',
    football: 'Ball_(association_football)', cball: 'Cricket_ball', monalisa: 'Mona_Lisa', wadlow: 'Robert_Wadlow', bigben: 'Big_Ben',
    pisa: 'Leaning_Tower_of_Pisa', redeemer: 'Christ_the_Redeemer_(statue)'
  };
  // India and USA categories for the first batch
  const TAGS = {
    india: ['coin', 'auto', 'coach', 'qutub', 'indiagate', 'unity', 'taj', 'gateway', 'tiger', 'peacock', 'cobra', 'elephant', 'bat', 'pitch', 'cball', 'scooter'],
    usa: ['liberty', 'wadlow']
  };
  for (const o of window.OBJECTS) {
    if (!o.src && SRC[o.id]) o.src = W + SRC[o.id];
    for (const [t, ids] of Object.entries(TAGS)) if (ids.includes(o.id)) o.tags = [...(o.tags || []), t];
  }
  // Leave out objects that haven't joined yet (see `since`), then drop categories with too few objects to play
  if (window.SG) window.OBJECTS = SG.fresh(window.OBJECTS);
  window.inCategory = (o, cat) => !cat || cat === 'all' || o.cat === cat || (o.tags || []).includes(cat);
  window.CATEGORIES = window.CATEGORIES.filter(c => c.id === 'all' || window.OBJECTS.filter(o => window.inCategory(o, c.id)).length >= 4);
})();
