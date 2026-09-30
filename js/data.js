/*
 * data.js - all game content in one place: characters, colour variants,
 * hats, trails, worlds and badges.
 *
 * Keeping content as plain data (not code) means adding a new hat or a new
 * world later is a matter of adding one entry here plus, if it has a new
 * look, one drawing function in art.js.
 */
(function () {
  /*
   * Characters. Each one plays slightly differently so unlocking a new one
   * changes how levels feel, not just how the hero looks - a cheap and
   * effective way to fight repetitiveness.
   *
   * ability fields:
   *   speed / jump  - multipliers on run speed and jump strength
   *   doubleJump    - one extra jump in the air
   *   glide         - holding jump while falling slows the fall
   *   hearts        - max hearts (default 3)
   *   magnet        - pulls coins from this radius (in tiles), always on
   *
   * unlock: null = buy in the shop for `price`;
   *         {boss: n} = given for free after beating world n's boss;
   *         {badge: id} = given together with that badge.
   */
  const CHARACTERS = [
    {
      id: 'cat', name: 'Kicia Pixi', desc: 'Zawsze w dobrym humorze. Wszystkiego po trochu.',
      ability: {}, abilityText: 'Zrównoważona', price: 0, unlock: null,
      variants: [
        { name: 'Różowa', pal: { body: '#ffb3d9', belly: '#fff0f7', accent: '#ff6fae', eye: '#3b2140' } },
        { name: 'Biała', pal: { body: '#f7f4ff', belly: '#ffffff', accent: '#c9b8ff', eye: '#3b2140' } },
        { name: 'Ruda', pal: { body: '#ffc27a', belly: '#fff3e0', accent: '#ff9d3c', eye: '#3b2140' } },
      ],
    },
    {
      id: 'hamster', name: 'Chomik Pączek', desc: 'Monety same do niego lecą!',
      ability: { magnet: 3.2 }, abilityText: 'Magnes na monety', price: 180, unlock: null,
      variants: [
        { name: 'Miodowy', pal: { body: '#f6c177', belly: '#fff5dd', accent: '#e39b3f', eye: '#2d1d10' } },
        { name: 'Czekoladowy', pal: { body: '#b98463', belly: '#f3e1d2', accent: '#8b5a3c', eye: '#2d1d10' } },
        { name: 'Śnieżny', pal: { body: '#eeeeee', belly: '#ffffff', accent: '#c7c7d9', eye: '#2d1d10' } },
      ],
    },
    {
      // Guinea pig: bounces much higher off enemies, so stomping becomes a
      // way to reach high coins and stars - a play style no one else has.
      id: 'guinea', name: 'Świnka Kuleczka', desc: 'Skacząc po przeciwnikach, wybija się wysoko jak z trampoliny!',
      ability: { stomp: 1.5 }, abilityText: 'Wysokie odbicie', price: 220, unlock: null,
      variants: [
        { name: 'Trójkolorowa', pal: { body: '#fffaf2', belly: '#ffffff', accent: '#e8913f', patch2: '#6b4a36', eye: '#2d1d10' } },
        { name: 'Ruda', pal: { body: '#f2a65a', belly: '#fff3e0', accent: '#c4702a', patch2: '#fffaf2', eye: '#2d1d10' } },
        { name: 'Czarno-biała', pal: { body: '#ffffff', belly: '#ffffff', accent: '#3a3440', patch2: '#b8b0c0', eye: '#1a1a22' } },
      ],
    },
    {
      id: 'fox', name: 'Lisek Rudek', desc: 'Najszybszy w całej Liczbolandii.',
      ability: { speed: 1.2 }, abilityText: 'Szybki bieg', price: 270, unlock: null,
      variants: [
        { name: 'Rudy', pal: { body: '#ff8a3d', belly: '#fff4ea', accent: '#d9621c', eye: '#2b1a12' } },
        { name: 'Polarny', pal: { body: '#e6f3ff', belly: '#ffffff', accent: '#a9cdee', eye: '#1c2a3a' } },
        { name: 'Fioletowy', pal: { body: '#a98bff', belly: '#f3edff', accent: '#7a5ce6', eye: '#231a3a' } },
      ],
    },
    {
      id: 'frog', name: 'Żabka Skoczka', desc: 'Skacze wyżej niż wszyscy.',
      ability: { jump: 1.16 }, abilityText: 'Wysoki skok', price: 330, unlock: null,
      variants: [
        { name: 'Zielona', pal: { body: '#7ed957', belly: '#e9ffd6', accent: '#4fb52b', eye: '#1b2a12' } },
        { name: 'Niebieska', pal: { body: '#5ccfff', belly: '#e0f7ff', accent: '#2a9fd6', eye: '#10212b' } },
        { name: 'Złota', pal: { body: '#ffd84a', belly: '#fff8d6', accent: '#e0ae12', eye: '#2b230a' } },
      ],
    },
    {
      id: 'panda', name: 'Panda Bambi', desc: 'Wytrzymała - ma dodatkowe serduszko.',
      ability: { hearts: 4 }, abilityText: '4 serduszka', price: 390, unlock: null,
      variants: [
        { name: 'Klasyczna', pal: { body: '#ffffff', belly: '#ffffff', accent: '#2f2f3a', eye: '#1a1a22' } },
        { name: 'Czerwona', pal: { body: '#ffe7d6', belly: '#ffffff', accent: '#c4552a', eye: '#1a1a22' } },
        { name: 'Pastelowa', pal: { body: '#fff3fb', belly: '#ffffff', accent: '#b98cd9', eye: '#1a1a22' } },
      ],
    },
    {
      id: 'penguin', name: 'Pingwinka Fifi', desc: 'Trzymaj skok w powietrzu, a będzie szybować.',
      ability: { glide: true }, abilityText: 'Szybowanie', price: 480, unlock: null,
      variants: [
        { name: 'Granatowa', pal: { body: '#34426b', belly: '#ffffff', accent: '#ffa62b', eye: '#10131f' } },
        { name: 'Różowa', pal: { body: '#d9559c', belly: '#ffffff', accent: '#ffa62b', eye: '#10131f' } },
        { name: 'Miętowa', pal: { body: '#2fae9a', belly: '#ffffff', accent: '#ffa62b', eye: '#10131f' } },
      ],
    },
    {
      // A pricey one on purpose: a long-term coin goal once the cheaper
      // characters are owned. Fast AND bouncy, but no magic.
      id: 'bunny', name: 'Króliczka Hopka', desc: 'Szybka i skoczna - najlepsza biegaczka po wydmach.',
      ability: { speed: 1.12, jump: 1.08 }, abilityText: 'Szybka + wysoki skok', price: 900, unlock: null,
      variants: [
        { name: 'Szara', pal: { body: '#d8d2e0', belly: '#ffffff', accent: '#ffb3c7', eye: '#2a2230' } },
        { name: 'Kremowa', pal: { body: '#fff1d6', belly: '#ffffff', accent: '#ffb3c7', eye: '#2a2230' } },
        { name: 'Czekoladowa', pal: { body: '#9a6a4c', belly: '#f3e1d2', accent: '#ffb3c7', eye: '#1e140e' } },
      ],
    },
    {
      // Reward for the night worlds: only players who go back and earn medals
      // ever see her, so she gets the best mix of abilities after the dragon.
      id: 'owl', name: 'Sówka Nocka', desc: 'Szybuje cicho jak w nocy. Nagroda za 3 nocnych bossów!',
      ability: { glide: true, jump: 1.1, magnet: 2 }, abilityText: 'Szybowanie + skok + magnes', price: 0, unlock: { badge: 'nightBoss3' },
      variants: [
        { name: 'Płomykówka', pal: { body: '#e8c9a0', belly: '#fff8ee', accent: '#b8835a', eye: '#1e140e' } },
        { name: 'Śnieżna', pal: { body: '#f4f4fa', belly: '#ffffff', accent: '#b8b8cc', eye: '#1e140e' } },
        { name: 'Nocna', pal: { body: '#6a5aa8', belly: '#d9d2ff', accent: '#ffd23f', eye: '#120f2a' } },
      ],
    },
    {
      // found in a golden chest deep underground in the open world
      id: 'mole', name: 'Kret Grzebuś', desc: 'Mieszka głęboko pod ziemią. Znaleziony na wyprawie!',
      ability: { hearts: 4, magnet: 2.4 }, abilityText: '4 serduszka + magnes', price: 0, unlock: { badge: 'moleFound' },
      variants: [
        { name: 'Aksamitny', pal: { body: '#6a5a7a', belly: '#b8a8c8', accent: '#ff9ec0', eye: '#1a1022' } },
        { name: 'Złoty', pal: { body: '#d9a84a', belly: '#fff0c0', accent: '#ff9ec0', eye: '#2a1a0a' } },
        { name: 'Śnieżny', pal: { body: '#e8e8f0', belly: '#ffffff', accent: '#ff9ec0', eye: '#1a1022' } },
      ],
    },
    {
      id: 'unicorn', name: 'Jednorożka Tęcza', desc: 'Magiczny podwójny skok! Nagroda za bossa Świata 3.',
      ability: { doubleJump: true }, abilityText: 'Podwójny skok', price: 0, unlock: { boss: 3 },
      variants: [
        { name: 'Tęczowa', pal: { body: '#ffffff', belly: '#ffffff', accent: '#ff7ac8', eye: '#3a2150' } },
        { name: 'Lawendowa', pal: { body: '#e8dcff', belly: '#f7f2ff', accent: '#9d7bff', eye: '#3a2150' } },
        { name: 'Brzoskwiniowa', pal: { body: '#ffe0cc', belly: '#fff5ee', accent: '#ff9a76', eye: '#3a2150' } },
      ],
    },
    {
      id: 'dragon', name: 'Smoczek Iskra', desc: 'Podwójny skok i szybowanie. Nagroda za bossa Świata 6!',
      ability: { doubleJump: true, glide: true, speed: 1.08 }, abilityText: 'Podwójny skok + szybowanie', price: 0, unlock: { boss: 6 },
      variants: [
        { name: 'Morski', pal: { body: '#4fd1c5', belly: '#fff6c9', accent: '#9f7aea', eye: '#1a2330' } },
        { name: 'Rubinowy', pal: { body: '#ff6b6b', belly: '#fff1d6', accent: '#ffb84d', eye: '#2a1414' } },
        { name: 'Nocny', pal: { body: '#5a4fcf', belly: '#e3dcff', accent: '#ffcf4d', eye: '#120f2a' } },
      ],
    },
  ];
  // Price of the 2nd and 3rd colour variant of every character.
  // coins are earned faster on harder levels, so prices are set to last a while
  const VARIANT_PRICES = [0, 90, 140];

  /* Hats and accessories. `badge` means it is a reward for that badge
     rather than something you buy. */
  const HATS = [
    { id: 'none', name: 'Bez dodatków', price: 0 },
    { id: 'bow', name: 'Kokarda', price: 60 },
    { id: 'flowers', name: 'Wianek z kwiatów', price: 100 },
    { id: 'beanie', name: 'Czapka z pomponem', price: 120 },
    { id: 'glasses', name: 'Okulary przeciwsłoneczne', price: 130 },
    { id: 'headphones', name: 'Słuchawki', price: 160 },
    { id: 'party', name: 'Czapeczka urodzinowa', price: 0, badge: 'first_level' },
    { id: 'wizard', name: 'Kapelusz czarodziejki', price: 0, badge: 'math50' },
    { id: 'tophat', name: 'Cylinder', price: 220 },
    { id: 'crown', name: 'Korona', price: 0, badge: 'boss1' },
    { id: 'tiara', name: 'Diadem', price: 0, badge: 'stars30' },
    { id: 'pirate', name: 'Kapelusz pirata', price: 190 },
    { id: 'gearcap', name: 'Czapka mechanika', price: 0, badge: 'boss7' },
    { id: 'astro', name: 'Hełm kosmonautki', price: 0, badge: 'boss8' },
    { id: 'nemes', name: 'Chusta faraona', price: 0, badge: 'boss9' },
    { id: 'laurel', name: 'Wieniec mistrzyni', price: 0, badge: 'medals30' },
    { id: 'nightcap', name: 'Szlafmyca', price: 0, badge: 'night1' },
    { id: 'sunhat', name: 'Słomkowy kapelusz', price: 0, badge: 'streak7' },
    { id: 'hardhat', name: 'Kask budowniczki', price: 0, badge: 'builder' },
    { id: 'explorer', name: 'Kapelusz odkrywczyni', price: 0, badge: 'landmark1' },
    { id: 'miner', name: 'Kask z latarką', price: 0, badge: 'deep40' },
    { id: 'aviator', name: 'Gogle lotniczki', price: 0, badge: 'skyhigh' },
    { id: 'crystal', name: 'Kryształowy diadem', price: 0, badge: 'chests25' },
  ];

  /* Particle trails left while running. */
  const TRAILS = [
    { id: 'none', name: 'Bez śladu', price: 0 },
    { id: 'stars', name: 'Gwiazdki', price: 70 },
    { id: 'hearts', name: 'Serduszka', price: 100 },
    { id: 'bubbles', name: 'Bańki', price: 100 },
    { id: 'notes', name: 'Nutki', price: 130 },
    { id: 'rainbow', name: 'Tęcza', price: 0, badge: 'streak10' },
    { id: 'sparkle', name: 'Iskierki', price: 0, badge: 'coins1000' },
    { id: 'gold', name: 'Złoty pył', price: 0, badge: 'medals100' },
  ];

  /*
   * Worlds. Each one has its own look, music seed, enemies and at least one
   * mechanic the others don't (ice, swimming, bouncy mushrooms, vanishing
   * clouds and wind, lava and falling platforms). New mechanic every world =
   * the game keeps changing under the kids' feet.
   */
  const WORLDS = [
    {
      id: 1, name: 'Cukierkowa Łąka', sub: 'Pierwsze kroki wśród lizaków',
      pal: { skyTop: '#7fd3ff', skyBot: '#d9f4ff', far: '#b5e8c9', mid: '#8fdc8a', grass: '#6fd35b', grassDark: '#4cae3a', dirt: '#c98a5a', dirtDark: '#a86c40', block: '#ff8fc8', blockDark: '#e0629f', plank: '#ffcf70', accent: '#ff6fae' },
      features: ['spring'], enemies: ['slime', 'bee'], music: 11,
      boss: { id: 'slimeking', name: 'Król Glutek', color: '#8fe36b', attack: 'shock' },
    },
    {
      id: 2, name: 'Lodowe Szczyty', sub: 'Uwaga, ślisko!',
      pal: { skyTop: '#9ad0ff', skyBot: '#eef7ff', far: '#cfe4ff', mid: '#e8f2ff', grass: '#ffffff', grassDark: '#cfe3f7', dirt: '#8fb4e0', dirtDark: '#6c92c4', block: '#8fe0ff', blockDark: '#4fb7e6', plank: '#d7ecff', accent: '#4fb7e6' },
      features: ['ice', 'moving'], enemies: ['snowball', 'slime', 'bee'], music: 23,
      boss: { id: 'snowman', name: 'Bałwan Bubu', color: '#ffffff', attack: 'throw' },
    },
    {
      id: 3, name: 'Podwodna Rafa', sub: 'Pływaj jak rybka!',
      pal: { skyTop: '#1f8fd6', skyBot: '#63d3f0', far: '#2a9fd0', mid: '#1e7fb8', grass: '#ffd88a', grassDark: '#e8b85a', dirt: '#e3a86b', dirtDark: '#c4884d', block: '#ff8f7a', blockDark: '#e0664f', plank: '#ffb37a', accent: '#ff7ac8' },
      features: ['water'], enemies: ['fish', 'jelly', 'urchin'], music: 37,
      boss: { id: 'octopus', name: 'Ośmiornica Ola', color: '#c77dff', attack: 'bubbles' },
    },
    {
      id: 4, name: 'Grzybowy Las', sub: 'Nocą świecą świetliki',
      pal: { skyTop: '#2b2361', skyBot: '#6a4fa3', far: '#3d3380', mid: '#2f2a66', grass: '#7be08a', grassDark: '#48b562', dirt: '#6b4e8f', dirtDark: '#523a70', block: '#ff7a7a', blockDark: '#d94f4f', plank: '#c79a6b', accent: '#ffe066' },
      features: ['mushroom'], enemies: ['shroom', 'bat', 'slime'], music: 41,
      boss: { id: 'shroomlord', name: 'Grzybolord', color: '#ff6b8a', attack: 'rain' },
    },
    {
      id: 5, name: 'Chmurkowe Zamki', sub: 'Wysoko w obłokach',
      pal: { skyTop: '#ffb4d6', skyBot: '#fff0c7', far: '#ffd6e8', mid: '#ffffff', grass: '#ffffff', grassDark: '#f1dff5', dirt: '#c9b8ff', dirtDark: '#a996f0', block: '#ffd166', blockDark: '#e8ae2c', plank: '#ffffff', accent: '#9d7bff' },
      features: ['cloud', 'wind', 'moving'], enemies: ['bee', 'cloudy', 'slime'], music: 53,
      boss: { id: 'storm', name: 'Burzynka', color: '#8e9bb8', attack: 'lightning' },
    },
    {
      id: 6, name: 'Czekoladowy Wulkan', sub: 'Gorąco jak w piekarniku!',
      pal: { skyTop: '#ff9a5a', skyBot: '#ffe0a3', far: '#d9774a', mid: '#a8553a', grass: '#ff9ecf', grassDark: '#e072ad', dirt: '#7a4a2e', dirtDark: '#5c3620', block: '#ffcf70', blockDark: '#e0a53c', plank: '#c98a5a', accent: '#ff5e7e' },
      features: ['lava', 'falling'], enemies: ['firejelly', 'hedgehog', 'slime'], music: 67,
      boss: { id: 'chocodragon', name: 'Smok Czekoladowy', color: '#8b5a3c', attack: 'fire' },
    },
    {
      // new mechanic: conveyor belts that carry you (and wind-up robots)
      id: 7, name: 'Zabawkowa Fabryka', sub: 'Ruchome taśmy i nakręcane roboty',
      pal: { skyTop: '#9fd8ff', skyBot: '#fff0d6', far: '#c9b8ff', mid: '#ffc9e0', grass: '#7ad3c8', grassDark: '#4aa89c', dirt: '#b8a0e0', dirtDark: '#9580c8', block: '#ffb84d', blockDark: '#e08a1c', plank: '#ffd6e8', accent: '#ff6fae' },
      features: ['conveyor', 'moving'], enemies: ['robot', 'slime', 'bee'], music: 79,
      boss: { id: 'gearbot', name: 'Robot Zębatek', color: '#9aa3b5', attack: 'throw' },
    },
    {
      // new mechanic: low gravity - floaty, high jumps
      id: 8, name: 'Kosmiczna Galaktyka', sub: 'Skaczesz jak na Księżycu!',
      pal: { skyTop: '#0b0930', skyBot: '#3a2a7a', far: '#2a2060', mid: '#4a3a8a', grass: '#c9b8ff', grassDark: '#9d7bff', dirt: '#6a5aa0', dirtDark: '#524288', block: '#5ccfff', blockDark: '#2a9fd6', plank: '#e0d8ff', accent: '#ffe066' },
      features: ['lowgrav', 'moving', 'falling'], enemies: ['alien', 'ufo'], music: 83,
      boss: { id: 'comet', name: 'Królowa Komet', color: '#8fd3ff', attack: 'rain' },
    },
    {
      // new mechanic: quicksand - wade slowly and sink to your knees, or jump over
      id: 9, name: 'Złota Pustynia', sub: 'Uwaga, ruchome piaski!',
      pal: { skyTop: '#5cc2ff', skyBot: '#fff0c7', far: '#f7c98a', mid: '#eeb46a', grass: '#ffe29a', grassDark: '#e8b85a', dirt: '#e0a45a', dirtDark: '#c4843c', block: '#4fd1c5', blockDark: '#2a9f96', plank: '#d9a066', accent: '#ff6fae' },
      features: ['quicksand', 'wind', 'moving'], enemies: ['scorpion', 'cactus', 'vulture'], music: 89,
      boss: { id: 'sphinx', name: 'Sfinks Mruczek', color: '#f2c46b', attack: 'shock' },
    },
  ];
  // levels 1-7 normal, level 8 is the boss (history: 3+boss, then 5+boss; saves are migrated in save.js)
  const LEVELS_PER_WORLD = 8;
  const BONUS_ID = 99;   // the star-shop bonus level lives outside the world list

  /*
   * Badges (odznaki). Each check() looks at the profile. Some reward a hat
   * or trail, which ties "being good at maths" to "getting cool stuff".
   */
  const BADGES = [
    { id: 'first_level', name: 'Pierwszy krok', desc: 'Ukończ pierwszy poziom', check: p => countCompleted(p) >= 1, reward: 'Czapeczka urodzinowa' },
    { id: 'boss1', name: 'Pogromczyni Glutka', desc: 'Pokonaj pierwszego bossa', check: p => (p.bossWins || []).includes(1), reward: 'Korona' },
    { id: 'math10', name: 'Liczydło', desc: 'Rozwiąż 10 zadań', check: p => p.stats.correct >= 10 },
    { id: 'math50', name: 'Matematyczka', desc: 'Rozwiąż 50 zadań', check: p => p.stats.correct >= 50, reward: 'Kapelusz czarodziejki' },
    { id: 'math200', name: 'Profesorka', desc: 'Rozwiąż 200 zadań', check: p => p.stats.correct >= 200 },
    { id: 'streak10', name: 'Seria!', desc: '10 dobrych odpowiedzi z rzędu', check: p => p.stats.bestStreak >= 10, reward: 'Ślad: Tęcza' },
    { id: 'coins1000', name: 'Skarbonka', desc: 'Zbierz łącznie 1000 monet', check: p => p.stats.totalCoins >= 1000, reward: 'Ślad: Iskierki' },
    { id: 'stars10', name: 'Łowczyni gwiazd', desc: 'Zbierz 10 gwiazdek', check: p => countStars(p) >= 10 },
    { id: 'stars30', name: 'Gwiazda Liczbolandii', desc: 'Zbierz 30 gwiazdek', check: p => countStars(p) >= 30, reward: 'Diadem' },
    { id: 'stomp50', name: 'Hop, hop!', desc: 'Podskocz na 50 przeciwnikach', check: p => p.stats.stomps >= 50 },
    { id: 'shopper', name: 'Zakupy!', desc: 'Kup coś w sklepie', check: p => p.stats.purchases >= 1 },
    { id: 'allbosses', name: 'Bohaterka', desc: 'Pokonaj wszystkich bossów', check: p => (p.bossWins || []).length >= WORLDS.length },
    { id: 'boss7', name: 'Mechaniczka', desc: 'Pokonaj Robota Zębatka', check: p => (p.bossWins || []).includes(7), reward: 'Czapka mechanika' },
    { id: 'boss8', name: 'Kosmonautka', desc: 'Pokonaj Królową Komet', check: p => (p.bossWins || []).includes(8), reward: 'Hełm kosmonautki' },
    { id: 'boss9', name: 'Pani Pustyni', desc: 'Pokonaj Sfinksa Mruczka', check: p => (p.bossWins || []).includes(9), reward: 'Chusta faraona' },
    // medals: three extra goals on every level (time, no hearts lost, 90% of coins)
    { id: 'medal1', name: 'Pierwszy medal', desc: 'Zdobądź pierwszy medal na poziomie', check: p => medalCount(p) >= 1 },
    { id: 'medals30', name: 'Medalistka', desc: 'Zdobądź 30 medali', check: p => medalCount(p) >= 30, reward: 'Wieniec mistrzyni' },
    { id: 'medals100', name: 'Mistrzyni medali', desc: 'Zdobądź 100 medali', check: p => medalCount(p) >= 100, reward: 'Ślad: Złoty pył' },
    // night worlds (hard versions of beaten worlds)
    { id: 'night1', name: 'Nocna wędrowniczka', desc: 'Ukończ pierwszy nocny poziom', check: p => Object.keys((p.hard || {}).done || {}).length >= 1, reward: 'Szlafmyca' },
    { id: 'nightBoss3', name: 'Przyjaciółka sów', desc: 'Pokonaj 3 nocnych bossów', check: p => ((p.hard || {}).boss || []).length >= 3, reward: 'Postać: Sówka Nocka' },
    { id: 'nightAll', name: 'Królowa Nocy', desc: 'Pokonaj wszystkich nocnych bossów', check: p => ((p.hard || {}).boss || []).length >= WORLDS.length },
    // level of the day
    { id: 'daily1', name: 'Poziom dnia', desc: 'Wykonaj pierwsze zadanie dnia', check: p => ((p.daily || {}).total || 0) >= 1 },
    { id: 'streak7', name: 'Cały tydzień!', desc: 'Zadanie dnia 7 dni z rzędu', check: p => ((p.daily || {}).best || 0) >= 7, reward: 'Słomkowy kapelusz' },
    { id: 'streak30', name: 'Cały miesiąc!', desc: 'Zadanie dnia 30 dni z rzędu', check: p => ((p.daily || {}).best || 0) >= 30 },
    // level editor
    { id: 'builder', name: 'Budowniczka', desc: 'Zbuduj poziom i przejdź go sama', check: p => (p.stats.built || 0) >= 1, reward: 'Kask budowniczki' },
    { id: 'guest', name: 'W gościach', desc: 'Przejdź poziom zbudowany przez kogoś innego', check: p => (p.stats.guest || 0) >= 1 },
    // the open world (Wyprawa)
    { id: 'walk100', name: 'Pierwsza wyprawa', desc: 'Odejdź 100 m od domku', check: p => ((p.world || {}).maxDist || 0) >= 100 },
    { id: 'walk1000', name: 'Podróżniczka', desc: 'Odejdź 1 km od domku', check: p => ((p.world || {}).maxDist || 0) >= 1000 },
    { id: 'landmark1', name: 'Odkrywczyni', desc: 'Znajdź pierwszy wielki pomnik', check: p => Object.keys((p.world || {}).landmarks || {}).length >= 1, reward: 'Kapelusz odkrywczyni' },
    { id: 'landmarks7', name: 'Wszystkie pomniki', desc: 'Znajdź 7 różnych pomników', check: p => new Set(Object.values((p.world || {}).landmarks || {})).size >= 7 },
    { id: 'deep40', name: 'Grotołazka', desc: 'Zejdź 40 m pod ziemię', check: p => ((p.world || {}).maxDepth || 0) >= 40, reward: 'Kask z latarką' },
    { id: 'skyhigh', name: 'W chmurach', desc: 'Wespnij się na latające wyspy', check: p => !!(p.world || {}).sky, reward: 'Gogle lotniczki' },
    { id: 'chests10', name: 'Poszukiwaczka skarbów', desc: 'Otwórz 10 skrzyń', check: p => ((p.world || {}).chestCount || 0) >= 10 },
    { id: 'chests25', name: 'Łowczyni skarbów', desc: 'Otwórz 25 skrzyń', check: p => ((p.world || {}).chestCount || 0) >= 25, reward: 'Kryształowy diadem' },
    { id: 'quests3', name: 'Dobra sąsiadka', desc: 'Pomóż 3 sąsiadom', check: p => ((p.world || {}).questCount || 0) >= 3 },
    { id: 'moleFound', name: 'Przyjaciółka kreta', desc: 'Znajdź kreta w złotej skrzyni', check: p => !!(p.world || {}).mole, reward: 'Postać: Kret Grzebuś' },
    { id: 'stickers12', name: 'Pół albumu', desc: 'Zbierz 12 naklejek', check: p => (p.stickers || []).length >= 12 },
    { id: 'stickersAll', name: 'Kolekcjonerka', desc: 'Zbierz wszystkie naklejki', check: p => (p.stickers || []).length >= STICKERS.length },
    { id: 'firstPet', name: 'Mam pupila!', desc: 'Kup pupila za gwiazdki', check: p => (p.starItems || []).some(i => i.startsWith('pet_')) },
    { id: 'starShopAll', name: 'Gwiezdna kolekcja', desc: 'Kup wszystko w sklepie za gwiazdki', check: p => STAR_ITEMS.every(i => (p.starItems || []).includes(i.id)) },
  ];

  /*
   * STAR SHOP. Stars are the rare currency: each level hides 3 and a boss
   * gives 3, so the whole game holds exactly 9 worlds x 8 x 3 = 216. The
   * star items below cost 216 in total - getting everything means finishing
   * every level AND finding every hidden star (one per level waits in the
   * secret room). Each item changes how the game plays or looks.
   */
  const STAR_ITEMS = [
    { id: 'pet_butterfly', type: 'pet', name: 'Motylek', desc: 'Leci za tobą i łapie monety obok.', stars: 5 },
    { id: 'pet_fish', type: 'pet', name: 'Rybka w bańce', desc: 'Pływa w powietrzu i zbiera monety.', stars: 8 },
    { id: 'bonus_level', type: 'level', name: 'Kraina Monet', desc: 'Tajny poziom pełen monet i ?-klocków. Można grać ile razy chcesz!', stars: 8 },
    { id: 'pet_firefly', type: 'pet', name: 'Świetlik', desc: 'Świeci i zbiera monety z daleka.', stars: 12 },
    { id: 'perk_heart', type: 'perk', name: 'Dodatkowe serduszko', desc: 'Na każdym poziomie masz o 1 serduszko więcej.', stars: 12 },
    { id: 'gold', type: 'skin', name: 'Złota postać', desc: 'Każda postać może być złota i błyszcząca!', stars: 24 },
    { id: 'pet_dragon', type: 'pet', name: 'Mini-smoczek', desc: 'Zieje iskierkami i zbiera monety z daleka.', stars: 15 },
    { id: 'pet_robot', type: 'pet', name: 'Robocik', desc: 'Mały latający robot. Zbiera monety.', stars: 14 },
    { id: 'pet_ufo', type: 'pet', name: 'Mini-UFO', desc: 'Wciąga monety promieniem z daleka!', stars: 18 },
    { id: 'perk_shield', type: 'perk', name: 'Tarcza na start', desc: 'Każdy poziom zaczynasz z tarczą.', stars: 20 },
    { id: 'perk_heart2', type: 'perk', name: 'Drugie serduszko', desc: 'Jeszcze jedno serduszko więcej na każdym poziomie.', stars: 20 },
    { id: 'perk_magnet', type: 'perk', name: 'Magnes na start', desc: 'Każdy poziom zaczynasz z magnesem na monety.', stars: 18 },
    { id: 'perk_boots', type: 'perk', name: 'Superskok na start', desc: 'Każdy poziom zaczynasz z butami do superskoku.', stars: 18 },
    { id: 'pet_scarab', type: 'pet', name: 'Złoty Skarabeusz', desc: 'Błyszczący żuczek z pustyni. Zbiera monety z bardzo daleka!', stars: 24 },
  ];
  // how far (in tiles) each pet reaches for coins
  const PETS = { pet_butterfly: { reach: 1.8 }, pet_fish: { reach: 2.3 }, pet_firefly: { reach: 3 }, pet_robot: { reach: 3.2 }, pet_dragon: { reach: 3.8 }, pet_ufo: { reach: 4.4 }, pet_scarab: { reach: 5 } };

  /*
   * STICKER ALBUM - a long-term coin sink. Every pack gives a sticker you
   * don't have yet; each sticker is a creature or item from the game.
   */
  const STICKERS = [
    { id: 'slime', name: 'Glutek', kind: 'enemy' }, { id: 'bee', name: 'Bzyczek', kind: 'enemy' }, { id: 'hedgehog', name: 'Kolczak', kind: 'enemy' },
    { id: 'snowball', name: 'Śnieżynek', kind: 'enemy' }, { id: 'fish', name: 'Rybka', kind: 'enemy' }, { id: 'jelly', name: 'Meduza', kind: 'enemy' },
    { id: 'urchin', name: 'Jeżowiec', kind: 'enemy' }, { id: 'shroom', name: 'Grzybek', kind: 'enemy' }, { id: 'bat', name: 'Nietoperek', kind: 'enemy' },
    { id: 'cloudy', name: 'Chmurek', kind: 'enemy' }, { id: 'firejelly', name: 'Ognik', kind: 'enemy' },
    { id: 'plant', name: 'Kłapacz', kind: 'enemy' }, { id: 'ball', name: 'Kulka z armatki', kind: 'enemy' },
    { id: 'robot', name: 'Nakręcany robot', kind: 'enemy' }, { id: 'alien', name: 'Kosmitek', kind: 'enemy' }, { id: 'ufo', name: 'Latający talerz', kind: 'enemy' },
    { id: 'scorpion', name: 'Skorpionek', kind: 'enemy' }, { id: 'cactus', name: 'Kaktusik', kind: 'enemy' }, { id: 'vulture', name: 'Sępik', kind: 'enemy' },
    { id: 'slimeking', name: 'Król Glutek', kind: 'boss' }, { id: 'snowman', name: 'Bałwan Bubu', kind: 'boss' }, { id: 'octopus', name: 'Ośmiornica Ola', kind: 'boss' },
    { id: 'shroomlord', name: 'Grzybolord', kind: 'boss' }, { id: 'storm', name: 'Burzynka', kind: 'boss' }, { id: 'chocodragon', name: 'Smok Czekoladowy', kind: 'boss' },
    { id: 'gearbot', name: 'Robot Zębatek', kind: 'boss' }, { id: 'comet', name: 'Królowa Komet', kind: 'boss' }, { id: 'sphinx', name: 'Sfinks Mruczek', kind: 'boss' },
    { id: 'heart', name: 'Serduszko', kind: 'power' }, { id: 'magnet', name: 'Magnes', kind: 'power' }, { id: 'shield', name: 'Tarcza', kind: 'power' },
    { id: 'boots', name: 'Superskok', kind: 'power' }, { id: 'rainbow', name: 'Tęczowa gwiazda', kind: 'power' },
    { id: 'coin', name: 'Złota moneta', kind: 'item' }, { id: 'star', name: 'Gwiazdka', kind: 'item' },
  ];
  const STICKER_PACK_PRICE = 80;

  // Bonus world bought with stars: one replayable level full of coins.
  const BONUS_WORLD = {
    id: 99, name: 'Kraina Monet', sub: 'Tajny poziom - same skarby!',
    pal: { skyTop: '#ffcf5a', skyBot: '#fff4c2', far: '#ffe08a', mid: '#ffd166', grass: '#ffe680', grassDark: '#e8b820', dirt: '#c98a3a', dirtDark: '#a86c20', block: '#ffcf3f', blockDark: '#d99a00', plank: '#fff1b0', accent: '#ff9f1c' },
    features: ['spring'], enemies: ['slime'], music: 77, bonus: true,
    boss: { id: 'slimeking', name: 'Król Glutek', color: '#8fe36b', attack: 'shock' },
  };

  // medals are stored per level as [time, noHearts, coins]
  function medalCount(p, w) {
    let n = 0;
    for (const k in p.medals || {}) if (!w || k.startsWith(w + '-')) n += (p.medals[k] || []).filter(Boolean).length;
    return n;
  }
  function countCompleted(p) { return Object.keys(p.done || {}).length; }
  function starBalance(p) { return countStars(p) - (p.starsSpent || 0); }
  function countStars(p) {
    let n = 0;
    for (const k in p.stars || {}) n += (p.stars[k] || []).filter(Boolean).length;
    return n;
  }

  /*
   * Math levels a player can choose when creating a profile.
   * min/max bound the adaptive "skill" value (see mathgen.js): the game
   * nudges difficulty up after correct answers and down after mistakes,
   * but only inside this band, so the 7-year-old never gets equations
   * and the 12-year-old never gets 2+3.
   */
  /*
   * Difficulty levels (chosen per profile, changeable in Ustawienia).
   * Only + - × : within 100, no negative numbers. Harder levels add
   * multiplication and division and pay better: `reward` multiplies the
   * coin bonuses for correct answers, the maths chest, boss hits and the
   * end-of-level bonus - so the harder maths is worth choosing.
   * min/max bound the adaptive skill (see mathgen.js for the tiers).
   */
  const MATH_LEVELS = [
    { id: 1, name: 'Łatwy', icon: '⭐', desc: 'Dodawanie i odejmowanie do 20', note: 'z kropkami do liczenia', min: 1.0, max: 2.99, start: 1.2, reward: 1 },
    { id: 2, name: 'Średni', icon: '⭐⭐', desc: 'Dodawanie i odejmowanie do 100', note: '', min: 2.3, max: 3.99, start: 2.6, reward: 1.5 },
    { id: 3, name: 'Trudny', icon: '⭐⭐⭐', desc: 'Do 100 + mnożenie i dzielenie do 50', note: 'tabliczka przez 2, 3, 4, 5, 10', min: 3.0, max: 4.99, start: 3.3, reward: 2 },
    { id: 4, name: 'Mistrzowski', icon: '👑', desc: 'Cała tabliczka mnożenia i dzielenie do 100', note: '', min: 4.6, max: 5.99, start: 4.8, reward: 3 },
  ];

  LZ.D = { medalCount, CHARACTERS, VARIANT_PRICES, HATS, TRAILS, WORLDS, LEVELS_PER_WORLD, BADGES, MATH_LEVELS, countStars, countCompleted, starBalance, STAR_ITEMS, PETS, STICKERS, STICKER_PACK_PRICE, BONUS_WORLD, BONUS_ID };
})();
