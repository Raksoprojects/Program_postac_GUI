// Uzupelnia public/data/profession_titles.json (kopia z Generatora BN) o formy
// [meska, zenska] profesji, ktorych generator nie ma (kaplani, krasnoludy,
// Warriors of Chaos...). Uruchom: node tools/titles_overlay.mjs
// Kolejnosc: nazwa profesji, potem tytuly poziomow 1-4. Kazda pozycja [m, z].
import fs from "node:fs";

const P = new URL("../public/data/profession_titles.json", import.meta.url);

const T = {
  "Kapłan Zagłady": [["Kapłan Zagłady", "Kapłanka Zagłady"], ["Sławiciel", "Sławicielka"], ["Kapłan Zagłady", "Kapłanka Zagłady"], ["Kapłan Berserker", "Kapłanka Berserkerka"], ["Pieczętnik Wrót", "Pieczętniczka Wrót"]],
  "Kapłan Kuźni": [["Kapłan Kuźni", "Kapłanka Kuźni"], ["Nowicjusz Kuźni", "Nowicjuszka Kuźni"], ["Kapłan Kuźni", "Kapłanka Kuźni"], ["Mistrz Kuźni", "Mistrzyni Kuźni"], ["Władca Kuźni", "Władczyni Kuźni"]],
  "Kapłan Ogniska": [["Kapłan Ogniska", "Kapłanka Ogniska"], ["Nowicjusz Ogniska", "Nowicjuszka Ogniska"], ["Kapłan Ogniska", "Kapłanka Ogniska"], ["Mistrz Ogniska", "Mistrzyni Ogniska"], ["Wieszcz Ogniska", "Wieszczka Ogniska"]],
  "Młotodzierżca": [["Młotodzierżca", "Młotodzierżczyni"], ["Zaprzysiężony", "Zaprzysiężona"], ["Młotodzierżca", "Młotodzierżczyni"], ["Strażnik Wrót", "Strażniczka Wrót"], ["Tarczonosiciel", "Tarczonosicielka"]],
  "Żelazołamacz": [["Żelazołamacz", "Żelazołamaczka"], ["Tarczołamacz", "Tarczołamaczka"], ["Żelazołamacz", "Żelazołamaczka"], ["Smok Żelaza", "Smoczyca Żelaza"], ["Żelaznobrody", "Żelaznobroda"]],
  "Zwiadowca Karaku": [["Zwiadowca Karaku", "Zwiadowczyni Karaku"], ["Górołaz", "Górołazka"], ["Zwiadowca Karaku", "Zwiadowczyni Karaku"], ["Sokole Oko", "Sokole Oko"], ["Kapitan Zwiadowców", "Kapitan Zwiadowców"]],
  "Runopisarz": [["Runopisarz", "Runopisarka"], ["Czeladnik Runopisarski", "Czeladniczka Runopisarska"], ["Runopisarz", "Runopisarka"], ["Strażnik Wiedzy", "Strażniczka Wiedzy"], ["Mistrz Wiedzy", "Mistrzyni Wiedzy"]],
  "Than": [["Than", "Thanka"], ["Dziedzic", "Dziedziczka"], ["Than", "Thanka"], ["Wódz Zastępu", "Wodzini Zastępu"], ["Pan Karaku", "Pani Karaku"]],
  "Kapłan-Złodziej": [["Kapłan-Złodziej", "Kapłanka-Złodziejka"], ["Inicjowany", "Inicjowana"], ["Kapłan-Złodziej", "Kapłanka-Złodziejka"], ["Arcykapłan", "Arcykapłanka"], ["Cienisty Łazik", "Cienista Łaziczka"]],
  "Fałszerz": [["Fałszerz", "Fałszerka"], ["Oszust", "Oszustka"], ["Fałszerz", "Fałszerka"], ["Fałszerz Monet", "Fałszerka Monet"], ["Mistrz Fałszerzy Monet", "Mistrzyni Fałszerzy Monet"]],
  "Strażnik-Kapłan Taala": [["Strażnik-Kapłan Taala", "Strażniczka-Kapłanka Taala"], ["Inicjowany", "Inicjowana"], ["Strażnik-Kapłan", "Strażniczka-Kapłanka"], ["Arcykapłan", "Arcykapłanka"], ["Wicehierarcha", "Wicehierarchini"]],
  "Gajowy": [["Gajowy", "Gajowa"], ["Podgajowy", "Podgajowa"], ["Gajowy", "Gajowa"], ["Główny Gajowy", "Główna Gajowa"], ["Mistrz Gajowych", "Mistrzyni Gajowych"]],
  "Kłusownik": [["Kłusownik", "Kłusowniczka"], ["Sadowy Złodziejaszek", "Sadowa Złodziejka"], ["Kłusownik", "Kłusowniczka"], ["Mistrz Kłusownictwa", "Mistrzyni Kłusownictwa"], ["Czempion Kłusowników", "Czempionka Kłusowników"]],
  "Nekromanta": [["Nekromanta", "Nekromantka"], ["Przeklęty Aspirant", "Przeklęta Aspirantka"], ["Nekromanta", "Nekromantka"], ["Mistrz Śmierci", "Mistrzyni Śmierci"], ["Mistrz Nekromancji", "Mistrzyni Nekromancji"]],
  "Kapłan Manana": [["Kapłan Manana", "Kapłanka Manana"], ["Adept Manana", "Adeptka Manana"], ["Szafarz", "Szafarka"], ["Starszy Szafarz", "Starsza Szafarka"], ["Wielki Szafarz", "Wielka Szafarka"]],
  "Kapłan Morra": [["Kapłan Morra", "Kapłanka Morra"], ["Pisklę", "Pisklę"], ["Akolita Morra", "Akolitka Morra"], ["Wysoki Strażnik", "Wysoka Strażniczka"], ["Opat Strażników", "Ksieni Strażników"]],
  "Kapłan Myrmidii": [["Kapłan Myrmidii", "Kapłanka Myrmidii"], ["Rekrut Myrmidii", "Rekrutka Myrmidii"], ["Strażnik Myrmidii", "Strażniczka Myrmidii"], ["Mistrz Strażników", "Mistrzyni Strażników"], ["Ręka Myrmidii", "Ręka Myrmidii"]],
  "Kapłan Ranalda": [["Kapłan Ranalda", "Kapłanka Ranalda"], ["Wspólnik", "Wspólniczka"], ["Agent Ranalda", "Agentka Ranalda"], ["Brat Ranalda", "Siostra Ranalda"], ["Usta Ranalda", "Usta Ranalda"]],
  "Kapłanka Rhyi": [["Kapłan Rhyi", "Kapłanka Rhyi"], ["Syn Rhyi", "Córa Rhyi"], ["Ojciec", "Matka"], ["Patriarcha", "Matriarchini"], ["Strażnik Czuwania", "Strażniczka Czuwania"]],
  "Kapłanka Shallyi": [["Kapłan Shallyi", "Kapłanka Shallyi"], ["Uczeń Shallyi", "Uczennica Shallyi"], ["Opiekun", "Opiekunka"], ["Brat Shallyi", "Siostra Shallyi"], ["Arcyopiekun", "Arcyopiekunka"]],
  "Kapłan Sigmara": [["Kapłan Sigmara", "Kapłanka Sigmara"], ["Zaprzysiężony Sigmara", "Zaprzysiężona Sigmara"], ["Czempion Sigmara", "Czempionka Sigmara"], ["Mistrz Wiary", "Mistrzyni Wiary"], ["Wielki Mistrz Wiary", "Wielka Mistrzyni Wiary"]],
  "Kapłan Taala": [["Kapłan Taala", "Kapłanka Taala"], ["Owat", "Owatka"], ["Druid Taala", "Druidka Taala"], ["Arcydruid", "Arcydruidka"], ["Mistyk Taala", "Mistyczka Taala"]],
  "Kapłan Ulryka": [["Kapłan Ulryka", "Kapłanka Ulryka"], ["Krewniak", "Krewniaczka"], ["Klanowiec", "Klanówna"], ["Strażnik Klanu", "Strażniczka Klanu"], ["Patriarcha Ulryka", "Matriarchini Ulryka"]],
  "Kapłanka Vereny": [["Kapłan Vereny", "Kapłanka Vereny"], ["Neofita", "Neofitka"], ["Sędzia", "Sędzina"], ["Rozjemca", "Rozjemczyni"], ["Najwyższy Sędzia", "Najwyższa Sędzina"]],
  "Rogaty Łowca Taala": [["Rogaty Łowca Taala", "Rogata Łowczyni Taala"], ["Nowicjusz Łowów", "Nowicjuszka Łowów"], ["Rogaty Łowca", "Rogata Łowczyni"], ["Leśny Mentor", "Leśna Mentorka"], ["Czempion Dziczy", "Czempionka Dziczy"]],
  "Nocny Łotr Ranalda": [["Nocny Łotr Ranalda", "Nocna Łotrzyca Ranalda"], ["Nowicjusz Oszusta", "Nowicjuszka Oszusta"], ["Nocny Łotr", "Nocna Łotrzyca"], ["Dżentelmen Włamywacz", "Dama Włamywaczka"], ["Czarny Kot", "Czarna Kotka"]],
  "Szpitalnik Shallyi": [["Szpitalnik Shallyi", "Szpitalniczka Shallyi"], ["Nowicjusz Gołębicy", "Nowicjuszka Gołębicy"], ["Szpitalnik", "Szpitalniczka"], ["Sanitariusz", "Sanitariuszka"], ["Naczelny Chirurg", "Naczelna Chirurżka"]],
  "Strażnik Szali Vereny": [["Strażnik Szali Vereny", "Strażniczka Szali Vereny"], ["Nowicjusz Miecza i Szali", "Nowicjuszka Miecza i Szali"], ["Strażnik Szali", "Strażniczka Szali"], ["Arbiter", "Arbiterka"], ["Sędzia Vereny", "Sędzina Vereny"]],
  "Tarczowniczka Myrmidii": [["Tarczownik Myrmidii", "Tarczowniczka Myrmidii"], ["Pierwszy Orzeł", "Pierwsza Orlica"], ["Tarczownik", "Tarczowniczka"], ["Sierżant Świątynny", "Sierżant Świątynna"], ["Wysoki Orzeł", "Wysoka Orlica"]],
  "Siostra Sigmara": [["Brat Sigmara", "Siostra Sigmara"], ["Nowicjusz Bractwa", "Nowicjuszka Siostrzeństwa"], ["Brat Sigmara", "Siostra Sigmara"], ["Brat Przełożony", "Siostra Przełożona"], ["Patron Sigmaryjski", "Matrona Sigmaryjska"]],
  "Strażnik Burzy Manana": [["Strażnik Burzy Manana", "Strażniczka Burzy Manana"], ["Nowicjusz Burzy", "Nowicjuszka Burzy"], ["Strażnik Burzy", "Strażniczka Burzy"], ["Strażnik Czarnego Żelaza", "Strażniczka Czarnego Żelaza"], ["Święty Burzy", "Święta Burzy"]],
  "Kapłan Bitewny Morra": [["Kapłan Bitewny Morra", "Kapłanka Bitewna Morra"], ["Nowicjusz Kruka", "Nowicjuszka Kruka"], ["Kapłan Bitewny Morra", "Kapłanka Bitewna Morra"], ["Kapłan-Sierżant Morra", "Kapłanka-Sierżant Morra"], ["Kapłan-Kapitan Morra", "Kapłanka-Kapitan Morra"]],
  "Kapłan Bitewny Sigmara": [["Kapłan Bitewny Sigmara", "Kapłanka Bitewna Sigmara"], ["Nowicjusz Młota", "Nowicjuszka Młota"], ["Kapłan Bitewny Sigmara", "Kapłanka Bitewna Sigmara"], ["Kapłan-Sierżant Sigmara", "Kapłanka-Sierżant Sigmara"], ["Kapłan-Kapitan Sigmara", "Kapłanka-Kapitan Sigmara"]],
  "Kapłan Bitewny Ulryka": [["Kapłan Bitewny Ulryka", "Kapłanka Bitewna Ulryka"], ["Nowicjusz Wilka", "Nowicjuszka Wilka"], ["Kapłan Bitewny Ulryka", "Kapłanka Bitewna Ulryka"], ["Kapłan-Sierżant Ulryka", "Kapłanka-Sierżant Ulryka"], ["Kapłan-Kapitan Ulryka", "Kapłanka-Kapitan Ulryka"]],
  "Kapłan-Hazardzista": [["Kapłan-Hazardzista", "Kapłanka-Hazardzistka"], ["Inicjowany", "Inicjowana"], ["Kapłan-Hazardzista", "Kapłanka-Hazardzistka"], ["Arcykapłan", "Arcykapłanka"], ["Mistrz Losu", "Mistrzyni Losu"]],
  "Kapłan-Zwodziciel": [["Kapłan-Zwodziciel", "Kapłanka-Zwodzicielka"], ["Inicjowany", "Inicjowana"], ["Kapłan-Zwodziciel", "Kapłanka-Zwodzicielka"], ["Arcykapłan", "Arcykapłanka"], ["Książę Nierządu", "Księżna Nierządu"]],
  "Kapłan-Opiekun": [["Kapłan-Opiekun", "Kapłanka-Opiekunka"], ["Inicjowany", "Inicjowana"], ["Kapłan-Opiekun", "Kapłanka-Opiekunka"], ["Arcykapłan", "Arcykapłanka"], ["Obrońca Ludu", "Obrończyni Ludu"]],
  // Warriors of Chaos (profesje zla)
  "Berserker": [["Berserker", "Berserkerka"], ["Dzikus", "Dzikuska"], ["Berserker", "Berserkerka"], ["Mistrz Topora", "Mistrzyni Topora"], ["Wódz Wojenny", "Wodzini Wojenna"]],
  "Bestigor": [["Bestigor", "Bestigor"], ["Rozszarpywacz", "Rozszarpywaczka"], ["Bestigor", "Bestigor"], ["Wargor", "Wargor"], ["Władca Bestii", "Władczyni Bestii"]],
  "Szaman Stada": [["Szaman Stada", "Szamanka Stada"], ["Uczeń Szamana", "Uczennica Szamana"], ["Szaman Stada", "Szamanka Stada"], ["Mistrz Szamanów", "Mistrzyni Szamanów"], ["Wielki Szaman", "Wielka Szamanka"]],
  "Rycerz Chaosu": [["Rycerz Chaosu", "Rycerka Chaosu"], ["Giermek Zagłady", "Giermka Zagłady"], ["Rycerz Chaosu", "Rycerka Chaosu"], ["Rycerz Zagłady", "Rycerka Zagłady"], ["Miecz Chaosu", "Miecz Chaosu"]],
  "Maruder Chaosu": [["Maruder Chaosu", "Maruderka Chaosu"], ["Człowiek Północy", "Kobieta Północy"], ["Maruder Chaosu", "Maruderka Chaosu"], ["Czempion Maruderów", "Czempionka Maruderów"], ["Wódz Maruderów", "Wodzini Maruderów"]],
  "Czarownik Chaosu": [["Czarownik Chaosu", "Czarownica Chaosu"], ["Złorzeczący", "Złorzecząca"], ["Czarownik Chaosu", "Czarownica Chaosu"], ["Obdzieracz Dusz", "Obdzieraczka Dusz"], ["Władca Czarowników", "Władczyni Czarowników"]],
  "Kultysta Khorne'a": [["Kultysta Khorne'a", "Kultystka Khorne'a"], ["Akolita Khorne'a", "Akolitka Khorne'a"], ["Kultysta Khorne'a", "Kultystka Khorne'a"], ["Wybraniec Khorne'a", "Wybranka Khorne'a"], ["Mistrz Rzezi", "Mistrzyni Rzezi"]],
  "Magus Kultu Nurgle'a": [["Magus Kultu Nurgle'a", "Magini Kultu Nurgle'a"], ["Akolita Nurgle'a", "Akolitka Nurgle'a"], ["Magus Kultu Nurgle'a", "Magini Kultu Nurgle'a"], ["Wybraniec Nurgle'a", "Wybranka Nurgle'a"], ["Arcymagus Zarazy", "Arcymagini Zarazy"]],
  "Magus Kultu Slaanesha": [["Magus Kultu Slaanesha", "Magini Kultu Slaanesha"], ["Akolita Slaanesha", "Akolitka Slaanesha"], ["Magus Kultu Slaanesha", "Magini Kultu Slaanesha"], ["Wybraniec Slaanesha", "Wybranka Slaanesha"], ["Arcymagus Rozpusty", "Arcymagini Rozpusty"]],
  "Demonokowal": [["Demonokowal", "Demonokowalka"], ["Piekielny Robotnik", "Piekielna Robotnica"], ["Demonokowal", "Demonokowalka"], ["Arcykapłan Hashuta", "Arcykapłanka Hashuta"], ["Czarownik-Prorok Hashuta", "Czarownica-Prorokini Hashuta"]],
  "Wywyższony Bohater": [["Wywyższony Bohater", "Wywyższona Bohaterka"], ["Wywyższony Czempion", "Wywyższona Czempionka"], ["Wywyższony Bohater", "Wywyższona Bohaterka"], ["Herold Zagłady", "Heroldka Zagłady"], ["Władca Chaosu", "Władczyni Chaosu"]],
  "Wolny Człowiek Północy": [["Wolny Człowiek Północy", "Wolna Kobieta Północy"], ["Przysięgły", "Przysięgła"], ["Wolny Człowiek", "Wolna Kobieta"], ["Huskarl", "Huskarl"], ["Jarl", "Jarlini"]],
  "Piekielny Rycerz": [["Piekielny Rycerz", "Piekielna Rycerka"], ["Lubieżny Giermek", "Lubieżna Giermka"], ["Piekielny Rycerz", "Piekielna Rycerka"], ["Diabelski Rycerz", "Diabelska Rycerka"], ["Palatyn Slaanesha", "Palatynka Slaanesha"]],
  "Piekielna Straż": [["Piekielna Straż", "Piekielna Straż"], ["Zhańbiony", "Zhańbiona"], ["Piekielny Strażnik", "Piekielna Strażniczka"], ["Żelazoprzysięgły", "Żelazoprzysięgła"], ["Piekielny Kasztelan", "Piekielna Kasztelanka"]],
  "Rycerz Tzeentcha": [["Rycerz Tzeentcha", "Rycerka Tzeentcha"], ["Oświecony Giermek", "Oświecona Giermka"], ["Rycerz Tzeentcha", "Rycerka Tzeentcha"], ["Rycerz Runiczny", "Rycerka Runiczna"], ["Ostrze Przemiany", "Ostrze Przemiany"]],
  "Łupieżca Północy": [["Łupieżca Północy", "Łupieżczyni Północy"], ["Maruder Morski", "Maruderka Morska"], ["Łupieżca", "Łupieżczyni"], ["Łowca Niewolników", "Łowczyni Niewolników"], ["Wódz Wyprawy", "Wodzini Wyprawy"]],
  "Wieszcz Północy": [["Wieszcz Północy", "Wieszczka Północy"], ["Akolita Wieszcza", "Akolitka Wieszcza"], ["Wieszcz", "Wieszczka"], ["Vikti", "Vikti"], ["Tkacz Zagłady", "Tkaczka Zagłady"]],
  "Skald": [["Skald", "Skaldka"], ["Naznaczony Poeta", "Naznaczona Poetka"], ["Skald", "Skaldka"], ["Chorąży", "Chorąża"], ["Pieśniarz Wojny", "Pieśniarka Wojny"]],
  "Rycerz Zarazy": [["Rycerz Zarazy", "Rycerka Zarazy"], ["Zgniły Giermek", "Zgniła Giermka"], ["Rycerz Zarazy", "Rycerka Zarazy"], ["Zwiastun Śmierci", "Zwiastunka Śmierci"], ["Jeździec Apokalipsy", "Jeźdźczyni Apokalipsy"]],
  "Miażdżyciel Czaszek": [["Miażdżyciel Czaszek", "Miażdżycielka Czaszek"], ["Krwiożerczy Giermek", "Krwiożercza Giermka"], ["Miażdżyciel Czaszek", "Miażdżycielka Czaszek"], ["Łowca Czaszek", "Łowczyni Czaszek"], ["Pan Czaszek", "Pani Czaszek"]],
  "Nadzorca Niewolników": [["Nadzorca Niewolników", "Nadzorczyni Niewolników"], ["Osiłek", "Osiłka"], ["Nadzorca Niewolników", "Nadzorczyni Niewolników"], ["Władca Bicza", "Władczyni Bicza"], ["Piekielny Nadzorca", "Piekielna Nadzorczyni"]],
  "Najeźdźca Ungorów": [["Najeźdźca Ungorów", "Najeźdźczyni Ungorów"], ["Łowca Ludzi", "Łowczyni Ludzi"], ["Najeźdźca Ungorów", "Najeźdźczyni Ungorów"], ["Półrogi Najeźdźca", "Półroga Najeźdźczyni"], ["Wódz Półrogich", "Wodzini Półrogich"]],
  "Wojownik Chaosu": [["Wojownik Chaosu", "Wojowniczka Chaosu"], ["Wyznawca Chaosu", "Wyznawczyni Chaosu"], ["Wojownik Chaosu", "Wojowniczka Chaosu"], ["Aspirujący Czempion", "Aspirująca Czempionka"], ["Wybraniec Chaosu", "Wybranka Chaosu"]],
  "Wielorybnik Norski": [["Wielorybnik Norski", "Wielorybniczka Norska"], ["Członek Załogi", "Członkini Załogi"], ["Wielorybnik", "Wielorybniczka"], ["Łowca Lewiatanów", "Łowczyni Lewiatanów"], ["Kapitan Wielorybników", "Kapitan Wielorybników"]]
};

// Poprawki form zenskich z generatora (tam forma zenska = meska). Stopnie
// wojskowe (Kapitan, Sierżant...) celowo bez zmian.
const FIX_TITLES = {
  "Szczurołap|4": "Tępicielka",
  "Estetyk|1": "Zaopatrzeniowczyni",
  "Świecki Alchemik|1": "Majsterkowiczka",
  "Świecki Alchemik|4": "Transmutatorka",
  "Agitator|4": "Demagożka",
  "Poseł|1": "Heroldka",
  "Ochroniarz|1": "Stróżka",
  "Ochroniarz|3": "Gwardzistka",
  "Łowca Czarownic|1": "Oprawczyni",
  "Pirat Rzeczny|3": "Łupieżczyni",
  "Specjalista Oblężniczy|1": "Kuszniczka",
  "Gwardzista Elektorski|2": "Gwardzistka Elektorska"
};
const FIX_PROFESSIONS = { "Gwardzista Elektorski": "Gwardzistka Elektorska", "Szpieg": "Szpieg" };

const raw = fs.readFileSync(P, "utf8");
const data = JSON.parse(raw);
let n = 0;
for (const [prof, [name, ...levels]] of Object.entries(T)) {
  if (!data.professions[prof]) { data.professions[prof] = name; n++; }
  levels.forEach((pair, i) => {
    const key = `${prof}|${i + 1}`;
    if (!data.titles[key]) { data.titles[key] = pair; n++; }
  });
}
for (const [key, f] of Object.entries(FIX_TITLES)) {
  if (data.titles[key] && data.titles[key][1] !== f) { data.titles[key][1] = f; n++; }
}
for (const [key, f] of Object.entries(FIX_PROFESSIONS)) {
  if (data.professions[key] && data.professions[key][1] !== f) { data.professions[key][1] = f; n++; }
}
fs.writeFileSync(P, JSON.stringify(data, null, 2) + "\n");
console.log("dodano wpisow:", n);
