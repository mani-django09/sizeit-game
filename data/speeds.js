// Racers for Speed Race.
// kmh:  a typical or well-documented top speed in km/h (cruising speed for aircraft)
// as:   how the racer reads inside a sentence ("a cheetah", "Usain Bolt")
// fact: shown after the race; say what kind of speed it is (burst, dive, cruising...)
// Many speeds vary, so the game never pairs two racers less than 1.3x apart.
// Keep a reliable source for every number you add.

(() => {
  const NEW = '2026-11-24';
  const W = 'https://en.wikipedia.org/wiki/';
  window.RACERS = [
    // ----- Slow movers -----
    { id: 'snail', emoji: '🐌', name: 'Garden snail', as: 'a garden snail', kmh: 0.05,
      fact: 'A garden snail glides at roughly 1 to 1.5 cm per second, about 0.05 km/h.' },
    { id: 'tortoise', emoji: '🐢', name: 'Giant tortoise', as: 'a giant tortoise', kmh: 0.3,
      fact: 'Giant tortoises plod along at about 0.3 km/h, but they can live for more than 100 years.' },
    { id: 'walker', emoji: '🚶', name: 'Person walking', as: 'a person walking', kmh: 5,
      fact: 'A comfortable walking pace is about 5 km/h.' },
    { id: 'cyclist', emoji: '🚲', name: 'Relaxed cyclist', as: 'a relaxed cyclist', kmh: 15,
      fact: 'An easy ride around town is about 15 km/h. Racing cyclists sprint at over 60.' },

    // ----- Animals -----
    { id: 'mamba', emoji: '🐍', name: 'Black mamba', as: 'a black mamba', kmh: 20,
      fact: 'One of the fastest snakes, a black mamba can move at about 20 km/h over short distances.' },
    { id: 'elephant', emoji: '🐘', name: 'Elephant', as: 'an elephant', kmh: 25,
      fact: 'An elephant in a hurry reaches about 25 km/h. It never lifts all four feet at once.' },
    { id: 'cat', emoji: '🐈', name: 'House cat', as: 'a house cat', kmh: 48,
      fact: 'A house cat can sprint at about 48 km/h, faster than the fastest human.' },
    { id: 'giraffe', emoji: '🦒', name: 'Giraffe', as: 'a giraffe', kmh: 60,
      fact: 'Giraffes can gallop at about 60 km/h over short distances.' },
    { id: 'tiger', emoji: '🐅', name: 'Tiger', as: 'a tiger', kmh: 65,
      fact: 'A tiger charges at about 65 km/h, but only in short bursts. It hunts by ambush, not by chasing.' },
    { id: 'horse', emoji: '🐎', name: 'Racehorse', as: 'a racehorse', kmh: 70,
      fact: 'A thoroughbred racehorse gallops at about 70 km/h.' },
    { id: 'cheetah', emoji: '🐆', name: 'Cheetah', as: 'a cheetah', kmh: 110,
      fact: 'The fastest land animal reaches about 100 to 120 km/h, but only for a few hundred metres.' },
    { id: 'falcon', emoji: '🦅', name: 'Peregrine falcon (diving)', as: 'a diving peregrine falcon', kmh: 320,
      fact: 'In a hunting dive, a peregrine falcon passes 300 km/h, faster than any other animal.' },

    // ----- People -----
    { id: 'bolt', emoji: '🏃', name: 'Usain Bolt (top speed)', as: 'Usain Bolt', kmh: 44.7,
      fact: 'During his 9.58-second 100 m world record in 2009, Usain Bolt touched about 44.7 km/h.' },

    // ----- Vehicles -----
    { id: 'auto', emoji: '🛺', name: 'Auto rickshaw', as: 'an auto rickshaw', kmh: 50,
      fact: 'A typical auto rickshaw tops out at around 50 km/h.' },
    { id: 'titanic', emoji: '🚢', name: 'Titanic', as: 'the Titanic', kmh: 44,
      fact: 'The Titanic\'s top speed was about 24 knots, around 44 km/h.' },
    { id: 'scooter', emoji: '🛵', name: 'Scooter (110 cc)', as: 'a 110 cc scooter', kmh: 90,
      fact: 'An everyday 110 cc scooter tops out at roughly 90 km/h.' },
    { id: 'vande', emoji: '🚄', name: 'Vande Bharat Express', as: 'the Vande Bharat Express', kmh: 160,
      fact: 'Vande Bharat trains run at up to 160 km/h on Indian tracks.' },
    { id: 'f1', emoji: '🏎️', name: 'Formula 1 car', as: 'a Formula 1 car', kmh: 350,
      fact: 'On a long straight, a Formula 1 car can pass 350 km/h.' },
    { id: 'b747', emoji: '✈️', name: 'Boeing 747 (cruising)', as: 'a cruising Boeing 747', kmh: 910,
      fact: 'A 747 cruises at about 910 km/h, around 85% of the speed of sound at altitude.' },
    { id: 'concorde', emoji: '🛩️', name: 'Concorde (cruising)', as: 'Concorde', kmh: 2180,
      fact: 'Concorde cruised at about twice the speed of sound, around 2,180 km/h. London to New York took about three and a half hours.' },

    // ----- Nature and space -----
    { id: 'sound', emoji: '🔊', name: 'Sound in air', as: 'sound in air', kmh: 1235,
      fact: 'Sound travels through air at about 343 m/s, or 1,235 km/h, at 20 °C.' },
    { id: 'spin', emoji: '🌍', name: 'Earth\'s spin at the Equator', as: "the Earth's spin at the Equator", kmh: 1670,
      fact: 'Standing on the Equator, the Earth\'s spin carries you along at about 1,670 km/h.' },
    { id: 'iss', emoji: '🛰️', name: 'International Space Station', as: 'the International Space Station', kmh: 27600,
      fact: 'The ISS orbits at about 27,600 km/h and goes round the Earth roughly every 90 minutes.' },
    { id: 'orbit', emoji: '☀️', name: 'Earth around the Sun', as: 'the Earth going around the Sun', kmh: 107000,
      fact: 'The Earth races around the Sun at about 107,000 km/h, nearly 30 km every second.' },
    // ----- Added 24 Nov 2026 -----
    { id: 'greyhound', emoji: '🐕', name: 'Greyhound', as: 'a greyhound', kmh: 72, since: NEW,
      fact: 'Greyhounds can sprint at about 72 km/h (45 mph), the fastest dog breed.', src: W + 'Greyhound' },
    { id: 'pronghorn', emoji: '🦌', name: 'Pronghorn', as: 'a pronghorn', kmh: 88, since: NEW,
      fact: 'The pronghorn of the American West can hit about 88 km/h and keep up high speed far longer than a cheetah.', src: W + 'Pronghorn' },
    { id: 'shoaib', emoji: '🏏', name: 'Fastest cricket delivery', as: 'the fastest cricket ball ever bowled', kmh: 161.3, since: NEW,
      fact: 'Shoaib Akhtar bowled a ball at 161.3 km/h (100.2 mph) in 2003, the fastest on record.', src: W + 'Shoaib_Akhtar' },
    { id: 'fastball', emoji: '⚾', name: 'Fastest baseball pitch', as: 'the fastest baseball pitch on record', kmh: 170, since: NEW,
      fact: 'Aroldis Chapman threw a pitch at 105.8 mph (about 170 km/h) in 2010, the fastest ever recorded in MLB.', src: W + 'Aroldis_Chapman' },
    { id: 'nascar', emoji: '🏁', name: 'NASCAR stock car', as: 'a NASCAR stock car', kmh: 320, since: NEW,
      fact: 'On the biggest oval tracks, NASCAR cars run at around 320 km/h (200 mph).', src: W + 'NASCAR_Cup_Series' },
  ];

  const SPD_SRC = {
    snail: 'Snail', tortoise: 'Galápagos_tortoise', walker: 'Preferred_walking_speed', cyclist: 'Bicycle_performance', mamba: 'Black_mamba',
    elephant: 'Elephant', cat: 'Cat', giraffe: 'Giraffe', tiger: 'Tiger', horse: 'Thoroughbred', cheetah: 'Cheetah', falcon: 'Peregrine_falcon',
    bolt: 'Usain_Bolt', auto: 'Auto_rickshaw', titanic: 'Titanic', scooter: 'Honda_Activa', vande: 'Vande_Bharat_(train)', f1: 'Formula_One_car',
    b747: 'Boeing_747', concorde: 'Concorde', sound: 'Speed_of_sound', spin: "Earth's_rotation", iss: 'International_Space_Station', orbit: "Earth's_orbit"
  };
  for (const r of window.RACERS) if (!r.src && SPD_SRC[r.id]) r.src = W + SPD_SRC[r.id];
  if (window.SG) window.RACERS = SG.fresh(window.RACERS);
})();
