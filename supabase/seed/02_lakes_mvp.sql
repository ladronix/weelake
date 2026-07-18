-- ==============================================================================
-- Weelake · lakes seed · MVP set (CZ + AT + DE + top world)
-- Data sourced from HydroLAKES, Wikipedia, and OpenStreetMap (public domain / CC BY 4.0 / ODbL).
-- Only well-known, high-importance lakes for the first launch.
-- ==============================================================================

insert into public.lakes (slug, name, name_local, country_code, region, lat, lng, area_km2, max_depth_m, mean_depth_m, elevation_m, type, importance, wiki_url) values
  -- ---- Czechia ----
  ('lipno',            'Lipno Reservoir',    'Lipno',              'CZ', 'South Bohemia',    48.6394, 14.1236,  48.7,  22, 6.5,  726, 'reservoir', 9, 'https://en.wikipedia.org/wiki/Lipno_Reservoir'),
  ('orlik',            'Orlík Reservoir',    'Orlík',              'CZ', 'South Bohemia',    49.5106, 14.1697,  27.3,  74, 25,   354, 'reservoir', 9, 'https://en.wikipedia.org/wiki/Orl%C3%ADk_Dam'),
  ('slapy',            'Slapy Reservoir',    'Slapy',              'CZ', 'Central Bohemia',  49.8000, 14.4361,  11.6,  58, 22,   270, 'reservoir', 8, 'https://en.wikipedia.org/wiki/Slapy_Dam'),
  ('mácha',            'Mácha Lake',         'Máchovo jezero',     'CZ', 'Liberec',          50.5906, 14.6425,   2.8,  12, 3.2,  266, 'lake',      9, 'https://en.wikipedia.org/wiki/M%C3%A1cha%27s_Lake'),
  ('nove-mlyny',       'Nové Mlýny',         'Nové Mlýny',         'CZ', 'South Moravia',    48.8869, 16.6425,  32.7,   6, 2.5,  170, 'reservoir', 8, 'https://en.wikipedia.org/wiki/Nov%C3%A9_Ml%C3%BDny'),
  ('brno',             'Brno Reservoir',     'Brněnská přehrada',  'CZ', 'South Moravia',    49.2372, 16.5108,   2.6,  19, 8,    229, 'reservoir', 7, null),
  ('rozkos',           'Rozkoš',             'Rozkoš',             'CZ', 'Hradec Králové',   50.4258, 16.1108,   9.8,  16, 5,    280, 'reservoir', 6, null),
  ('milada',           'Milada',             'Milada',             'CZ', 'Ústí nad Labem',   50.6467, 13.9803,   2.5,  25, 15.5, 145, 'lake',      6, null),
  ('most',             'Most Lake',          'Jezero Most',        'CZ', 'Ústí nad Labem',   50.5347, 13.6114,   3.1,  75, 22,   199, 'lake',      6, null),
  ('sec',              'Seč Reservoir',      'Sečská přehrada',    'CZ', 'Pardubice',        49.8447, 15.6533,   2.2,  36, 15,   464, 'reservoir', 6, null),
  ('vranov',           'Vranov Reservoir',   'Vranovská přehrada', 'CZ', 'South Moravia',    48.9147, 15.8017,   7.6,  46, 15,   351, 'reservoir', 7, null),
  ('dalesice',         'Dalešice Reservoir', 'Dalešická přehrada', 'CZ', 'Vysočina',         49.1250, 16.1103,   4.8, 106, 32,   381, 'reservoir', 6, null),

  -- ---- Austria ----
  ('neusiedler-see',   'Lake Neusiedl',      'Neusiedler See',     'AT', 'Burgenland',       47.8422, 16.7581, 315.0,   1.8, 1.3, 115, 'lake',      9, 'https://en.wikipedia.org/wiki/Lake_Neusiedl'),
  ('wolfgangsee',      'Lake Wolfgang',      'Wolfgangsee',        'AT', 'Salzburg',         47.7361, 13.4478,  13.0, 114, 51,   538, 'lake',      8, null),
  ('wörthersee',       'Lake Wörth',         'Wörthersee',         'AT', 'Carinthia',        46.6208, 14.1400,  19.4,  85, 41,   439, 'lake',      9, 'https://en.wikipedia.org/wiki/W%C3%B6rthersee'),
  ('millstättersee',   'Lake Millstatt',     'Millstätter See',    'AT', 'Carinthia',        46.7900, 13.5750,  13.3, 141, 88,   588, 'lake',      8, null),
  ('mondsee',          'Lake Mond',          'Mondsee',            'AT', 'Upper Austria',    47.8117, 13.3908,  14.2,  68, 36,   481, 'lake',      8, null),
  ('attersee',         'Lake Atter',         'Attersee',           'AT', 'Upper Austria',    47.8869, 13.5439,  46.2, 171, 84,   469, 'lake',      9, 'https://en.wikipedia.org/wiki/Attersee'),
  ('traunsee',         'Lake Traun',         'Traunsee',           'AT', 'Upper Austria',    47.8500, 13.8000,  24.4, 191, 95,   422, 'lake',      8, null),
  ('hallstättersee',   'Lake Hallstatt',     'Hallstätter See',    'AT', 'Upper Austria',    47.5667, 13.6667,   8.6, 125, 65,   508, 'lake',      9, 'https://en.wikipedia.org/wiki/Hallstatt_Lake'),
  ('achensee',         'Lake Achen',         'Achensee',           'AT', 'Tyrol',            47.4436, 11.7178,   6.8, 133, 65,   929, 'lake',      8, null),
  ('faaker-see',       'Lake Faak',          'Faaker See',         'AT', 'Carinthia',        46.5750, 13.9333,   2.2,  30, 16,   554, 'lake',      7, null),

  -- ---- Germany ----
  ('bodensee',         'Lake Constance',     'Bodensee',           'DE', 'Baden-Württemberg', 47.6500,  9.4000, 536.0, 251, 90,   395, 'lake',     10, 'https://en.wikipedia.org/wiki/Lake_Constance'),
  ('chiemsee',         'Lake Chiem',         'Chiemsee',           'DE', 'Bavaria',           47.8667, 12.4500,  79.9,  73, 25,   518, 'lake',      9, 'https://en.wikipedia.org/wiki/Chiemsee'),
  ('starnberger-see',  'Lake Starnberg',     'Starnberger See',    'DE', 'Bavaria',           47.9000, 11.3167,  56.0, 128, 53,   584, 'lake',      9, null),
  ('ammersee',         'Ammersee',           'Ammersee',           'DE', 'Bavaria',           48.0000, 11.1333,  46.6,  81, 38,   533, 'lake',      8, null),
  ('tegernsee',        'Lake Tegern',        'Tegernsee',          'DE', 'Bavaria',           47.7167, 11.7500,   9.0,  72, 36,   726, 'lake',      8, null),
  ('walchensee',       'Walchensee',         'Walchensee',         'DE', 'Bavaria',           47.5833, 11.3333,  16.4, 189, 82,   800, 'lake',      8, null),
  ('koenigsee',        'Königssee',          'Königssee',          'DE', 'Bavaria',           47.5528, 12.9861,   5.2, 190, 98,   603, 'lake',      9, 'https://en.wikipedia.org/wiki/K%C3%B6nigssee'),
  ('mueggelsee',       'Großer Müggelsee',   'Müggelsee',          'DE', 'Berlin',            52.4383, 13.6417,   7.4,   8, 5,     32, 'lake',      7, null),
  ('wannsee',          'Großer Wannsee',     'Wannsee',            'DE', 'Berlin',            52.4181, 13.1747,   2.7,   9, 6,     30, 'lake',      7, null),
  ('mueritz',          'Müritz',             'Müritz',             'DE', 'Mecklenburg',       53.4167, 12.6833, 117.0,  31, 7,     62, 'lake',      9, 'https://en.wikipedia.org/wiki/M%C3%BCritz'),
  ('schweriner-see',   'Lake Schwerin',      'Schweriner See',     'DE', 'Mecklenburg',       53.6667, 11.4500,  62.0,  52, 13,    38, 'lake',      8, null),

  -- ---- Switzerland ----
  ('genfersee',        'Lake Geneva',        'Lac Léman',          'CH', 'Vaud',              46.4500,  6.5000, 580.0, 310, 154,  372, 'lake',     10, 'https://en.wikipedia.org/wiki/Lake_Geneva'),
  ('zurichsee',        'Lake Zurich',        'Zürichsee',          'CH', 'Zurich',            47.2167,  8.7500,  88.0, 143, 49,   406, 'lake',      9, null),
  ('luzern',           'Lake Lucerne',       'Vierwaldstättersee', 'CH', 'Lucerne',           47.0139,  8.4500, 114.0, 214, 104,  434, 'lake',      9, null),
  ('thun',             'Lake Thun',          'Thunersee',          'CH', 'Bern',              46.6833,  7.7167,  47.7, 217, 136,  558, 'lake',      8, null),
  ('brienz',           'Lake Brienz',        'Brienzersee',        'CH', 'Bern',              46.7333,  7.9667,  29.8, 260, 173,  564, 'lake',      8, null),

  -- ---- Italy ----
  ('garda',            'Lake Garda',         'Lago di Garda',      'IT', 'Veneto/Lombardy',   45.6333, 10.6667, 370.0, 346, 133,   65, 'lake',     10, 'https://en.wikipedia.org/wiki/Lake_Garda'),
  ('como',             'Lake Como',          'Lago di Como',       'IT', 'Lombardy',          46.0000,  9.2500, 146.0, 425, 155,  199, 'lake',     10, 'https://en.wikipedia.org/wiki/Lake_Como'),
  ('maggiore',         'Lake Maggiore',      'Lago Maggiore',      'IT', 'Piedmont',          45.9500,  8.6333, 213.0, 372, 177,  193, 'lake',      9, null),
  ('trasimeno',        'Lake Trasimeno',     'Lago Trasimeno',     'IT', 'Umbria',            43.1333, 12.1000, 128.0,   6, 4.7,  257, 'lake',      8, null),
  ('bolsena',          'Lake Bolsena',       'Lago di Bolsena',    'IT', 'Lazio',             42.6000, 11.9333, 113.5, 151, 81,   305, 'lake',      7, null),

  -- ---- Hungary ----
  ('balaton',          'Lake Balaton',       'Balaton',            'HU', 'Central Transdanubia',46.8419, 17.7361, 592.0, 12.5,3.2,  105, 'lake',    10, 'https://en.wikipedia.org/wiki/Lake_Balaton'),
  ('velence',          'Lake Velence',       'Velencei-tó',        'HU', 'Fejér',             47.2000, 18.5667,  26.0,   3, 1.6,  105, 'lake',      7, null),
  ('tisza',            'Lake Tisza',         'Tisza-tó',           'HU', 'Great Plain',       47.6167, 20.7333, 127.0,  17, 1.3,   88, 'reservoir', 7, null),

  -- ---- Slovakia ----
  ('liptovska-mara',   'Liptovská Mara',     'Liptovská Mara',     'SK', 'Žilina',            49.1000, 19.5167,  27.0,  43, 15,   564, 'reservoir', 7, null),
  ('oravska',          'Orava Reservoir',    'Oravská priehrada',  'SK', 'Žilina',            49.4167, 19.5333,  35.2,  38, 12,   602, 'reservoir', 7, null),
  ('zemplinska-sirava','Zemplínska šírava',  'Zemplínska šírava',  'SK', 'Košice',            48.8000, 21.9500,  33.5,  14, 9.5,  114, 'reservoir', 6, null),

  -- ---- Slovenia / Croatia ----
  ('bled',             'Lake Bled',          'Blejsko jezero',     'SI', 'Upper Carniola',    46.3625,  14.0947,  1.5,  30, 18,   475, 'lake',      9, 'https://en.wikipedia.org/wiki/Lake_Bled'),
  ('bohinj',           'Lake Bohinj',        'Bohinjsko jezero',   'SI', 'Upper Carniola',    46.2833,  13.8833,  3.2,  45, 25,   525, 'lake',      8, null),
  ('plitvice',         'Plitvice Lakes',     'Plitvička jezera',   'HR', 'Lika-Senj',         44.8794,  15.6167,  2.0,  46, 12,   535, 'lake',      9, 'https://en.wikipedia.org/wiki/Plitvice_Lakes_National_Park'),

  -- ---- Nordics ----
  ('vänern',           'Lake Vänern',        'Vänern',             'SE', 'Västra Götaland',   58.9000,  13.5000, 5650.0,106, 27,   44, 'lake',     10, 'https://en.wikipedia.org/wiki/V%C3%A4nern'),
  ('vättern',          'Lake Vättern',       'Vättern',            'SE', 'Östergötland',      58.3667,  14.5833, 1912.0,128, 41,   88, 'lake',      9, null),
  ('mjøsa',            'Lake Mjøsa',         'Mjøsa',              'NO', 'Innlandet',         60.7000,  10.9167,  365.0,468, 153, 123, 'lake',      8, null),
  ('saimaa',           'Lake Saimaa',        'Saimaa',             'FI', 'South Savonia',     61.3000,  28.1000, 4400.0, 82, 17,   76, 'lake',     10, 'https://en.wikipedia.org/wiki/Saimaa'),

  -- ---- UK / Ireland / France ----
  ('windermere',       'Windermere',         'Windermere',         'GB', 'Cumbria',           54.3667,  -2.9333,  14.7,  64, 22,   39, 'lake',      8, null),
  ('loch-ness',        'Loch Ness',          'Loch Ness',          'GB', 'Highland',          57.3229,  -4.4244,  56.0, 227, 132,  16, 'lake',     10, 'https://en.wikipedia.org/wiki/Loch_Ness'),
  ('lough-neagh',      'Lough Neagh',        'Lough Neagh',        'GB', 'Northern Ireland',  54.6167,  -6.4167, 388.0,  25, 9,    12, 'lake',      8, null),
  ('lac-annecy',       'Lake Annecy',        'Lac d''Annecy',      'FR', 'Auvergne-Rhône-Alpes',45.8500, 6.1667,  27.6,  82, 41,  446, 'lake',      9, null),
  ('lac-du-bourget',   'Lac du Bourget',     'Lac du Bourget',     'FR', 'Savoie',            45.7333,  5.8500,  44.5, 145, 85,  231, 'lake',      8, null),

  -- ---- Iberia ----
  ('sanabria',         'Lake Sanabria',      'Lago de Sanabria',   'ES', 'Zamora',            42.1333,  -6.7167,   3.7,  51, 22,  1000, 'lake',     6, null),

  -- ---- North America ----
  ('tahoe',            'Lake Tahoe',         'Lake Tahoe',         'US', 'California/Nevada', 39.0968, -120.0324, 496.0, 501, 305, 1897, 'lake',    10, 'https://en.wikipedia.org/wiki/Lake_Tahoe'),
  ('great-salt',       'Great Salt Lake',    'Great Salt Lake',    'US', 'Utah',              41.1500, -112.4833, 4400.0, 10, 5,  1280, 'lake',     9, null),
  ('superior',         'Lake Superior',      'Lake Superior',      'US', 'MI/MN/WI',          47.7000, -87.5000, 82100.0,406, 147, 183, 'lake',    10, 'https://en.wikipedia.org/wiki/Lake_Superior'),
  ('michigan',         'Lake Michigan',      'Lake Michigan',      'US', 'MI/IL/IN/WI',       44.0000, -87.0000, 58000.0,281, 85,  176, 'lake',    10, null),
  ('crater-lake',      'Crater Lake',        'Crater Lake',        'US', 'Oregon',            42.9446, -122.1090,  53.2, 594, 350, 1883, 'lake',    9, null),
  ('okanagan',         'Okanagan Lake',      'Okanagan Lake',      'CA', 'British Columbia',  49.9000, -119.5000, 351.0, 232, 76,  342, 'lake',     8, null),

  -- ---- Oceania ----
  ('lake-taupo',       'Lake Taupō',         'Lake Taupō',         'NZ', 'Waikato',           -38.8000, 175.9167, 616.0, 186, 110, 356, 'lake',    10, 'https://en.wikipedia.org/wiki/Lake_Taup%C5%8D'),
  ('lake-wakatipu',    'Lake Wakatipu',      'Lake Wakatipu',      'NZ', 'Otago',             -45.0500, 168.6500, 291.0, 380, 320, 310, 'lake',     9, null),
  ('lake-eyre',        'Lake Eyre',          'Kati Thanda',        'AU', 'South Australia',   -28.3667, 137.3667, 9500.0,  1.5, 0.5,-15, 'lake',    9, null),
  ('lake-macquarie',   'Lake Macquarie',     'Lake Macquarie',     'AU', 'New South Wales',   -33.0833, 151.5833, 110.0,  11, 8,     0, 'lagoon',   8, null)
on conflict (slug) do nothing;
