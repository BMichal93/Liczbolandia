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
   *         {boss: n} = given for free after beating world n's boss.
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
      ability: { magnet: 3.2 }, abilityText: 'Magnes na monety', price: 120, unlock: null,
      variants: [
        { name: 'Miodowy', pal: { body: '#f6c177', belly: '#fff5dd', accent: '#e39b3f', eye: '#2d1d10' } },
        { name: 'Czekoladowy', pal: { body: '#b98463', belly: '#f3e1d2', accent: '#8b5a3c', eye: '#2d1d10' } },
        { name: 'Śnieżny', pal: { body: '#eeeeee', belly: '#ffffff', accent: '#c7c7d9', eye: '#2d1d10' } },
      ],
    },
    {
      id: 'fox', name: 'Lisek Rudek', desc: 'Najszybszy w całej Liczbolandii.',
      ability: { speed: 1.2 }, abilityText: 'Szybki bieg', price: 180, unlock: null,
      variants: [
        { name: 'Rudy', pal: { body: '#ff8a3d', belly: '#fff4ea', accent: '#d9621c', eye: '#2b1a12' } },
        { name: 'Polarny', pal: { body: '#e6f3ff', belly: '#ffffff', accent: '#a9cdee', eye: '#1c2a3a' } },
        { name: 'Fioletowy', pal: { body: '#a98bff', belly: '#f3edff', accent: '#7a5ce6', eye: '#231a3a' } },
      ],
    },
    {
      id: 'frog', name: 'Żabka Skoczka', desc: 'Skacze wyżej niż wszyscy.',
      ability: { jump: 1.16 }, abilityText: 'Wysoki skok', price: 220, unlock: null,
      variants: [
        { name: 'Zielona', pal: { body: '#7ed957', belly: '#e9ffd6', accent: '#4fb52b', eye: '#1b2a12' } },
        { name: 'Niebieska', pal: { body: '#5ccfff', belly: '#e0f7ff', accent: '#2a9fd6', eye: '#10212b' } },
        { name: 'Złota', pal: { body: '#ffd84a', belly: '#fff8d6', accent: '#e0ae12', eye: '#2b230a' } },
      ],
    },
    {
      id: 'panda', name: 'Panda Bambi', desc: 'Wytrzymała - ma dodatkowe serduszko.',
      ability: { hearts: 4 }, abilityText: '4 serduszka', price: 260, unlock: null,
      variants: [
        { name: 'Klasyczna', pal: { body: '#ffffff', belly: '#ffffff', accent: '#2f2f3a', eye: '#1a1a22' } },
        { name: 'Czerwona', pal: { body: '#ffe7d6', belly: '#ffffff', accent: '#c4552a', eye: '#1a1a22' } },
        { name: 'Pastelowa', pal: { body: '#fff3fb', belly: '#ffffff', accent: '#b98cd9', eye: '#1a1a22' } },
      ],
    },
    {
      id: 'penguin', name: 'Pingwinka Fifi', desc: 'Trzymaj skok w powietrzu, a będzie szybować.',
      ability: { glide: true }, abilityText: 'Szybowanie', price: 320, unlock: null,
      variants: [
        { name: 'Granatowa', pal: { body: '#34426b', belly: '#ffffff', accent: '#ffa62b', eye: '#10131f' } },
        { name: 'Różowa', pal: { body: '#d9559c', belly: '#ffffff', accent: '#ffa62b', eye: '#10131f' } },
        { name: 'Miętowa', pal: { body: '#2fae9a', belly: '#ffffff', accent: '#ffa62b', eye: '#10131f' } },
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
      id: 'dragon', name: 'Smoczek Iskra', desc: 'Podwójny skok i szybowanie. Nagroda za ostatniego bossa!',
      ability: { doubleJump: true, glide: true, speed: 1.08 }, abilityText: 'Podwójny skok + szybowanie', price: 0, unlock: { boss: 6 },
      variants: [
        { name: 'Morski', pal: { body: '#4fd1c5', belly: '#fff6c9', accent: '#9f7aea', eye: '#1a2330' } },
        { name: 'Rubinowy', pal: { body: '#ff6b6b', belly: '#fff1d6', accent: '#ffb84d', eye: '#2a1414' } },
        { name: 'Nocny', pal: { body: '#5a4fcf', belly: '#e3dcff', accent: '#ffcf4d', eye: '#120f2a' } },
      ],
    },
  ];
  // Price of the 2nd and 3rd colour variant of every character.
  const VARIANT_PRICES = [0, 60, 90];

  /* Hats and accessories. `badge` means it is a reward for that badge
     rather than something you buy. */
  const HATS = [
    { id: 'none', name: 'Bez dodatków', price: 0 },
    { id: 'bow', name: 'Kokarda', price: 40 },
    { id: 'flowers', name: 'Wianek z kwiatów', price: 70 },
    { id: 'beanie', name: 'Czapka z pomponem', price: 80 },
    { id: 'glasses', name: 'Okulary przeciwsłoneczne', price: 90 },
    { id: 'headphones', name: 'Słuchawki', price: 110 },
    { id: 'party', name: 'Czapeczka urodzinowa', price: 0, badge: 'first_level' },
    { id: 'wizard', name: 'Kapelusz czarodziejki', price: 0, badge: 'math50' },
    { id: 'tophat', name: 'Cylinder', price: 150 },
    { id: 'crown', name: 'Korona', price: 0, badge: 'boss1' },
    { id: 'tiara', name: 'Diadem', price: 0, badge: 'stars30' },
    { id: 'pirate', name: 'Kapelusz pirata', price: 130 },
  ];

  /* Particle trails left while running. */
  const TRAILS = [
    { id: 'none', name: 'Bez śladu', price: 0 },
    { id: 'stars', name: 'Gwiazdki', price: 50 },
    { id: 'hearts', name: 'Serduszka', price: 70 },
    { id: 'bubbles', name: 'Bańki', price: 70 },
    { id: 'notes', name: 'Nutki', price: 90 },
    { id: 'rainbow', name: 'Tęcza', price: 0, badge: 'streak10' },
    { id: 'sparkle', name: 'Iskierki', price: 0, badge: 'coins1000' },
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
  ];
  const LEVELS_PER_WORLD = 4; // levels 1-3 normal, level 4 is the boss

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
    { id: 'allbosses', name: 'Bohaterka', desc: 'Pokonaj wszystkich bossów', check: p => (p.bossWins || []).length >= 6 },
  ];

  function countCompleted(p) { return Object.keys(p.done || {}).length; }
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
  const MATH_LEVELS = [
    { id: 1, name: 'Poziom 1', age: 'ok. 6-8 lat', desc: 'Liczenie, dodawanie i odejmowanie do 20', min: 1.0, max: 2.99, start: 1.2 },
    { id: 2, name: 'Poziom 2', age: 'ok. 8-10 lat', desc: 'Tabliczka mnożenia, liczby do 100', min: 2.5, max: 3.99, start: 2.8 },
    { id: 3, name: 'Poziom 3', age: 'ok. 11-13 lat', desc: 'Ułamki, procenty, równania, potęgi', min: 4.0, max: 5.99, start: 4.3 },
  ];

  LZ.D = { CHARACTERS, VARIANT_PRICES, HATS, TRAILS, WORLDS, LEVELS_PER_WORLD, BADGES, MATH_LEVELS, countStars, countCompleted };
})();
