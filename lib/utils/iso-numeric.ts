// lib/utils/iso-numeric.ts
// ──────────────────────────────────────────────────────────────────────────────
// Maps ISO 3166-1 numeric country codes (as used in world-atlas TopoJSON) to
// ISO 3166-1 alpha-2 codes (as used in the Hibou `countries` table).
//
// Source: ISO 3166-1 standard.
// Used by: WorldMap component to match geographic features to ESG summary data.
//
// Usage: numericToIso2[Number(geo.id)]
// ──────────────────────────────────────────────────────────────────────────────

export const numericToIso2: Record<number, string> = {
  4:   'AF', // Afghanistan
  8:   'AL', // Albania
  12:  'DZ', // Algeria
  20:  'AD', // Andorra
  24:  'AO', // Angola
  28:  'AG', // Antigua and Barbuda
  31:  'AZ', // Azerbaijan
  32:  'AR', // Argentina
  36:  'AU', // Australia
  40:  'AT', // Austria
  44:  'BS', // Bahamas
  48:  'BH', // Bahrain
  50:  'BD', // Bangladesh
  52:  'BB', // Barbados
  56:  'BE', // Belgium
  64:  'BT', // Bhutan
  68:  'BO', // Bolivia
  70:  'BA', // Bosnia and Herzegovina
  72:  'BW', // Botswana
  76:  'BR', // Brazil
  84:  'BZ', // Belize
  90:  'SB', // Solomon Islands
  96:  'BN', // Brunei Darussalam
  100: 'BG', // Bulgaria
  104: 'MM', // Myanmar
  108: 'BI', // Burundi
  112: 'BY', // Belarus
  116: 'KH', // Cambodia
  120: 'CM', // Cameroon
  124: 'CA', // Canada
  132: 'CV', // Cabo Verde
  140: 'CF', // Central African Republic
  144: 'LK', // Sri Lanka
  148: 'TD', // Chad
  152: 'CL', // Chile
  156: 'CN', // China
  170: 'CO', // Colombia
  174: 'KM', // Comoros
  178: 'CG', // Congo (Republic)
  180: 'CD', // Congo (DR)
  188: 'CR', // Costa Rica
  191: 'HR', // Croatia
  192: 'CU', // Cuba
  196: 'CY', // Cyprus
  203: 'CZ', // Czechia
  204: 'BJ', // Benin
  208: 'DK', // Denmark
  212: 'DM', // Dominica
  214: 'DO', // Dominican Republic
  218: 'EC', // Ecuador
  818: 'EG', // Egypt
  222: 'SV', // El Salvador
  226: 'GQ', // Equatorial Guinea
  231: 'ET', // Ethiopia
  232: 'ER', // Eritrea
  233: 'EE', // Estonia
  242: 'FJ', // Fiji
  246: 'FI', // Finland
  250: 'FR', // France
  266: 'GA', // Gabon
  270: 'GM', // Gambia
  268: 'GE', // Georgia
  276: 'DE', // Germany
  288: 'GH', // Ghana
  300: 'GR', // Greece
  308: 'GD', // Grenada
  320: 'GT', // Guatemala
  324: 'GN', // Guinea
  328: 'GY', // Guyana
  332: 'HT', // Haiti
  340: 'HN', // Honduras
  348: 'HU', // Hungary
  352: 'IS', // Iceland
  356: 'IN', // India
  360: 'ID', // Indonesia
  364: 'IR', // Iran
  368: 'IQ', // Iraq
  372: 'IE', // Ireland
  376: 'IL', // Israel
  380: 'IT', // Italy
  384: 'CI', // Côte d'Ivoire
  388: 'JM', // Jamaica
  392: 'JP', // Japan
  398: 'KZ', // Kazakhstan
  400: 'JO', // Jordan
  404: 'KE', // Kenya
  408: 'KP', // North Korea
  410: 'KR', // South Korea
  414: 'KW', // Kuwait
  417: 'KG', // Kyrgyzstan
  418: 'LA', // Laos
  422: 'LB', // Lebanon
  426: 'LS', // Lesotho
  428: 'LV', // Latvia
  430: 'LR', // Liberia
  434: 'LY', // Libya
  438: 'LI', // Liechtenstein
  440: 'LT', // Lithuania
  442: 'LU', // Luxembourg
  450: 'MG', // Madagascar
  454: 'MW', // Malawi
  458: 'MY', // Malaysia
  462: 'MV', // Maldives
  466: 'ML', // Mali
  470: 'MT', // Malta
  478: 'MR', // Mauritania
  480: 'MU', // Mauritius
  484: 'MX', // Mexico
  496: 'MN', // Mongolia
  498: 'MD', // Moldova
  504: 'MA', // Morocco
  508: 'MZ', // Mozambique
  512: 'OM', // Oman
  516: 'NA', // Namibia
  520: 'NR', // Nauru
  524: 'NP', // Nepal
  528: 'NL', // Netherlands
  554: 'NZ', // New Zealand
  558: 'NI', // Nicaragua
  562: 'NE', // Niger
  566: 'NG', // Nigeria
  578: 'NO', // Norway
  583: 'FM', // Micronesia
  585: 'PW', // Palau
  586: 'PK', // Pakistan
  591: 'PA', // Panama
  598: 'PG', // Papua New Guinea
  600: 'PY', // Paraguay
  604: 'PE', // Peru
  608: 'PH', // Philippines
  616: 'PL', // Poland
  620: 'PT', // Portugal
  634: 'QA', // Qatar
  642: 'RO', // Romania
  643: 'RU', // Russia
  646: 'RW', // Rwanda
  659: 'KN', // Saint Kitts and Nevis
  662: 'LC', // Saint Lucia
  670: 'VC', // Saint Vincent and the Grenadines
  674: 'SM', // San Marino
  678: 'ST', // São Tomé and Príncipe
  682: 'SA', // Saudi Arabia
  686: 'SN', // Senegal
  694: 'SL', // Sierra Leone
  703: 'SK', // Slovakia
  704: 'VN', // Vietnam
  705: 'SI', // Slovenia
  706: 'SO', // Somalia
  710: 'ZA', // South Africa
  716: 'ZW', // Zimbabwe
  724: 'ES', // Spain
  729: 'SD', // Sudan
  728: 'SS', // South Sudan
  740: 'SR', // Suriname
  748: 'SZ', // Eswatini
  752: 'SE', // Sweden
  756: 'CH', // Switzerland
  760: 'SY', // Syria
  762: 'TJ', // Tajikistan
  764: 'TH', // Thailand
  768: 'TG', // Togo
  776: 'TO', // Tonga
  780: 'TT', // Trinidad and Tobago
  788: 'TN', // Tunisia
  792: 'TR', // Turkey (Türkiye)
  795: 'TM', // Turkmenistan
  798: 'TV', // Tuvalu
  800: 'UG', // Uganda
  804: 'UA', // Ukraine
  784: 'AE', // United Arab Emirates
  826: 'GB', // United Kingdom
  834: 'TZ', // Tanzania
  840: 'US', // United States
  854: 'BF', // Burkina Faso
  858: 'UY', // Uruguay
  860: 'UZ', // Uzbekistan
  862: 'VE', // Venezuela
  882: 'WS', // Samoa
  887: 'YE', // Yemen
  894: 'ZM', // Zambia
  // ── Additional sovereign nations not in the original list ─────────────────
  // Kosovo : ISO 3166-1 numeric 926 (assigned 2017); World Bank uses XK
  926: 'XK', // Kosovo
  // Taiwan : ISO 3166-1 numeric 158; World Bank uses TW
  158: 'TW', // Taiwan
  // Palestinian territories : ISO 3166-1 numeric 275; World Bank uses PS
  275: 'PS', // Palestine
  // Western Sahara : ISO 3166-1 numeric 732; World Bank uses EH
  732: 'EH', // Western Sahara
  // Cuba already listed (192); adding remaining small-nation gaps:
  // Timor-Leste
  626: 'TL', // Timor-Leste
  // Montenegro
  499: 'ME', // Montenegro
  // Serbia
  688: 'RS', // Serbia
  // North Macedonia
  807: 'MK', // North Macedonia
  // South Sudan already listed (728); Kosovo already added above
  // Djibouti
  262: 'DJ', // Djibouti
  // Equatorial Guinea already listed (226)
  // Cabo Verde already listed (132)
  // Comoros already listed (174)
  // Seychelles
  690: 'SC', // Seychelles
  // Vanuatu
  548: 'VU', // Vanuatu
  // Kiribati
  296: 'KI', // Kiribati
  // Marshall Islands
  584: 'MH', // Marshall Islands
  // Cook Islands (World Bank includes them)
  // ISO 3166-1 numeric: 184
  184: 'CK', // Cook Islands
  // Niue : ISO numeric 570
  570: 'NU', // Niue
  // Andorra already listed (20)
  // San Marino already listed (674)
  // Monaco
  492: 'MC', // Monaco
  // Liechtenstein already listed (438)
  // Holy See (Vatican)
  336: 'VA', // Holy See
}

/** Look up iso2 from a TopoJSON feature id (numeric string or number). */
export function geoIdToIso2(geoId: string | number): string | undefined {
  return numericToIso2[Number(geoId)]
}
