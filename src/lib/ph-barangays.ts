// Barangays per Metro Manila LGU. Numbered cities (Manila, Caloocan, Pasay)
// use generated "Barangay N" labels matching the official PSGC numbering.
// Named-barangay cities use the official PSGC list.

const range = (n: number, prefix = "Barangay ") =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

export const METRO_MANILA_BARANGAYS: Record<string, string[]> = {
  Caloocan: range(188),
  Manila: range(897),
  Pasay: range(201),

  "Las Piñas": [
    "Almanza Uno", "Almanza Dos", "BF International Village", "Daniel Fajardo",
    "Elias Aldana", "Ilaya", "Manuyo Uno", "Manuyo Dos", "Pamplona Uno",
    "Pamplona Dos", "Pamplona Tres", "Pilar", "Pulang Lupa Uno",
    "Pulang Lupa Dos", "Talon Uno", "Talon Dos", "Talon Tres", "Talon Kuatro",
    "Talon Singko", "Zapote",
  ],

  Makati: [
    "Bangkal", "Bel-Air", "Carmona", "Cembo", "Comembo", "Dasmariñas",
    "East Rembo", "Forbes Park", "Guadalupe Nuevo", "Guadalupe Viejo",
    "Kasilawan", "La Paz", "Magallanes", "Olympia", "Palanan", "Pembo",
    "Pinagkaisahan", "Pio del Pilar", "Pitogo", "Poblacion", "Post Proper Northside",
    "Post Proper Southside", "Rizal", "San Antonio", "San Isidro", "San Lorenzo",
    "Santa Cruz", "Singkamas", "South Cembo", "Tejeros", "Urdaneta", "Valenzuela",
    "West Rembo",
  ],

  Malabon: [
    "Acacia", "Baritan", "Bayan-Bayanan", "Catmon", "Concepcion", "Dampalit",
    "Flores", "Hulong Duhat", "Ibaba", "Longos", "Maysilo", "Muzon",
    "Niugan", "Panghulo", "Potrero", "San Agustin", "Santolan", "Tañong",
    "Tinajeros", "Tonsuya", "Tugatog",
  ],

  Mandaluyong: [
    "Addition Hills", "Bagong Silang", "Barangka Drive", "Barangka Ibaba",
    "Barangka Ilaya", "Barangka Itaas", "Buayang Bato", "Burol", "Daang Bakal",
    "Hagdang Bato Itaas", "Hagdang Bato Libis", "Harapin ang Bukas", "Highway Hills",
    "Hulo", "Mabini-J. Rizal", "Malamig", "Mauway", "Namayan", "New Zaniga",
    "Old Zaniga", "Pag-Asa", "Plainview", "Pleasant Hills", "Poblacion",
    "San Jose", "Vergara", "Wack-Wack Greenhills",
  ],

  Marikina: [
    "Barangka", "Calumpang", "Concepcion Uno", "Concepcion Dos", "Fortune",
    "Industrial Valley Complex", "Jesus de la Peña", "Malanday", "Marikina Heights",
    "Nangka", "Parang", "San Roque", "Santa Elena", "Santo Niño", "Tañong", "Tumana",
  ],

  Muntinlupa: [
    "Alabang", "Ayala Alabang", "Bayanan", "Buli", "Cupang", "Poblacion",
    "Putatan", "Sucat", "Tunasan",
  ],

  Navotas: [
    "Bagumbayan North", "Bagumbayan South", "Bangculasi", "Daanghari", "Navotas East",
    "Navotas West", "North Bay Boulevard North", "North Bay Boulevard South",
    "San Jose", "San Rafael Village", "San Roque", "Sipac-Almacen", "Tangos North",
    "Tangos South", "Tanza 1", "Tanza 2", "Bagumbayan", "Daanghari",
  ],

  Parañaque: [
    "Baclaran", "BF Homes", "Don Bosco", "Don Galo", "La Huerta", "Marcelo Green Village",
    "Merville", "Moonwalk", "San Antonio", "San Dionisio", "San Isidro", "San Martin de Porres",
    "Santo Niño", "Sun Valley", "Tambo", "Vitalez",
  ],

  Pasig: [
    "Bagong Ilog", "Bagong Katipunan", "Bambang", "Buting", "Caniogan", "Dela Paz",
    "Kalawaan", "Kapasigan", "Kapitolyo", "Malinao", "Manggahan", "Maybunga",
    "Oranbo", "Palatiw", "Pinagbuhatan", "Pineda", "Rosario", "Sagad",
    "San Antonio", "San Joaquin", "San Jose", "San Miguel", "San Nicolas",
    "Santa Cruz", "Santa Lucia", "Santa Rosa", "Santo Tomas", "Santolan",
    "Sumilang", "Ugong",
  ],

  Pateros: [
    "Aguho", "Magtanggol", "Martires del 96", "Poblacion", "San Pedro", "San Roque",
    "Santa Ana", "Santo Rosario-Kanluran", "Santo Rosario-Silangan", "Tabacalera",
  ],

  "Quezon City": [
    "Alicia", "Amihan", "Apolonio Samson", "Aurora", "Baesa", "Bagbag", "Bagong Lipunan ng Crame",
    "Bagong Pag-asa", "Bagong Silangan", "Bagumbayan", "Bagumbuhay", "Bahay Toro", "Balingasa",
    "Balong Bato", "Batasan Hills", "Bayanihan", "Blue Ridge A", "Blue Ridge B", "Botocan",
    "Bungad", "Camp Aguinaldo", "Capri", "Central", "Claro", "Commonwealth", "Culiat",
    "Damar", "Damayan", "Damayang Lagi", "Del Monte", "Dioquino Zobel", "Don Manuel",
    "Doña Aurora", "Doña Imelda", "Doña Josefa", "Duyan-Duyan", "E. Rodriguez",
    "East Kamias", "Escopa I", "Escopa II", "Escopa III", "Escopa IV", "Fairview",
    "Greater Lagro", "Gulod", "Holy Spirit", "Horseshoe", "Immaculate Concepcion",
    "Kaligayahan", "Kalusugan", "Kamuning", "Katipunan", "Kaunlaran", "Kristong Hari",
    "Krus na Ligas", "Laging Handa", "Libis", "Lourdes", "Loyola Heights", "Maharlika",
    "Malaya", "Manresa", "Mariana", "Mariblo", "Marilag", "Masagana", "Masambong",
    "Matandang Balara", "Milagrosa", "N.S. Amoranto", "Nagkaisang Nayon", "Nayong Kanluran",
    "New Era", "North Fairview", "Novaliches Proper", "Obrero", "Old Capitol Site",
    "Paang Bundok", "Pag-ibig sa Nayon", "Paligsahan", "Paltok", "Pansol", "Paraiso",
    "Pasong Putik Proper", "Pasong Tamo", "Payatas", "Phil-Am", "Pinagkaisahan",
    "Pinyahan", "Project 6", "Quirino 2-A", "Quirino 2-B", "Quirino 2-C", "Quirino 3-A",
    "Ramon Magsaysay", "Roxas", "Sacred Heart", "Saint Ignatius", "Saint Peter",
    "Salvacion", "San Agustin", "San Antonio", "San Bartolome", "San Isidro",
    "San Isidro Labrador", "San Jose", "San Martin de Porres", "San Roque",
    "San Vicente", "Sangandaan", "Santa Cruz", "Santa Lucia", "Santa Monica",
    "Santa Teresita", "Santo Cristo", "Santo Domingo", "Santo Niño", "Santol",
    "Sauyo", "Sienna", "Sikatuna Village", "Silangan", "Socorro", "South Triangle",
    "Tagumpay", "Talayan", "Talipapa", "Tandang Sora", "Tatalon", "Teachers Village East",
    "Teachers Village West", "U.P. Campus", "U.P. Village", "Unang Sigaw", "Valencia",
    "Vasra", "Veterans Village", "Villa Maria Clara", "West Kamias", "West Triangle",
    "White Plains",
  ],

  "San Juan": [
    "Addition Hills", "Balong-Bato", "Batis", "Corazon de Jesus", "Ermitaño", "Greenhills",
    "Halo-Halo", "Isabelita", "Kabayanan", "Little Baguio", "Maytunas", "Onse",
    "Pasadeña", "Pedro Cruz", "Progreso", "Rivera", "Salapan", "San Perfecto",
    "Santa Lucia", "Tibagan", "West Crame",
  ],

  Taguig: [
    "Bagumbayan", "Bambang", "Calzada", "Central Bicutan", "Central Signal Village",
    "Fort Bonifacio", "Hagonoy", "Ibayo-Tipas", "Katuparan", "Ligid-Tipas", "Lower Bicutan",
    "Maharlika Village", "Napindan", "New Lower Bicutan", "North Daang Hari", "North Signal Village",
    "Palingon", "Pinagsama", "San Miguel", "Santa Ana", "South Daang Hari", "South Signal Village",
    "Tanyag", "Tuktukan", "Upper Bicutan", "Ususan", "Wawa", "Western Bicutan",
    "Pembo", "Comembo", "East Rembo", "West Rembo", "South Cembo", "Pitogo",
    "Cembo", "Rizal", "Post Proper Northside", "Post Proper Southside",
  ],

  Valenzuela: [
    "Arkong Bato", "Bagbaguin", "Balangkas", "Bignay", "Bisig", "Canumay East",
    "Canumay West", "Coloong", "Dalandanan", "Gen. T. de Leon", "Hen. T. de Leon",
    "Isla", "Karuhatan", "Lawang Bato", "Lingunan", "Mabolo", "Malanday", "Malinta",
    "Mapulang Lupa", "Marulas", "Maysan", "Palasan", "Parada", "Pariancillo Villa",
    "Paso de Blas", "Pasolo", "Poblacion", "Polo", "Punturin", "Rincon", "Tagalag",
    "Ugong", "Veinte Reales", "Wawang Pulo",
  ],
};
