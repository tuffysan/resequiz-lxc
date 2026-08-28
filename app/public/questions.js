/* Resequiz Deluxe question bank. All questions are generated locally for offline use. */
const QUIZ_QUESTIONS=[];
let _qid=0;
function Q(c,q,a,r,f,d='medium',visual=''){QUIZ_QUESTIONS.push({id:`q${++_qid}`,c,q,a,r,f,d,visual});}
function pickDistractors(pool,answer,n=3){const arr=[...new Set(pool.filter(x=>x!==answer))];let out=[];for(let i=0;i<arr.length&&out.length<n;i++){const idx=(answer.length*7+i*11+_qid*3)%arr.length;const v=arr[idx];if(!out.includes(v))out.push(v);}for(const v of arr)if(out.length<n&&!out.includes(v))out.push(v);return out.slice(0,n)}
function shuffledOptions(correct,distractors){const a=[correct,...distractors];const shift=_qid%4;const rotated=a.slice(shift).concat(a.slice(0,shift));return {a:rotated,r:rotated.indexOf(correct)}}
function MQ(c,q,correct,pool,f,d='medium',visual=''){const {a,r}=shuffledOptions(correct,pickDistractors(pool,correct));Q(c,q,a,r,f,d,visual)}

const countries=[
['Sverige','Stockholm','🇸🇪'],['Norge','Oslo','🇳🇴'],['Danmark','Köpenhamn','🇩🇰'],['Finland','Helsingfors','🇫🇮'],['Island','Reykjavík','🇮🇸'],
['Tyskland','Berlin','🇩🇪'],['Frankrike','Paris','🇫🇷'],['Spanien','Madrid','🇪🇸'],['Portugal','Lissabon','🇵🇹'],['Italien','Rom','🇮🇹'],
['Grekland','Aten','🇬🇷'],['Irland','Dublin','🇮🇪'],['Storbritannien','London','🇬🇧'],['Nederländerna','Amsterdam','🇳🇱'],['Belgien','Bryssel','🇧🇪'],
['Österrike','Wien','🇦🇹'],['Schweiz','Bern','🇨🇭'],['Polen','Warszawa','🇵🇱'],['Tjeckien','Prag','🇨🇿'],['Ungern','Budapest','🇭🇺'],
['Kroatien','Zagreb','🇭🇷'],['Slovenien','Ljubljana','🇸🇮'],['Serbien','Belgrad','🇷🇸'],['Rumänien','Bukarest','🇷🇴'],['Bulgarien','Sofia','🇧🇬'],
['Estland','Tallinn','🇪🇪'],['Lettland','Riga','🇱🇻'],['Litauen','Vilnius','🇱🇹'],['Kanada','Ottawa','🇨🇦'],['USA','Washington, D.C.','🇺🇸'],
['Mexiko','Mexico City','🇲🇽'],['Brasilien','Brasília','🇧🇷'],['Argentina','Buenos Aires','🇦🇷'],['Chile','Santiago','🇨🇱'],['Peru','Lima','🇵🇪'],
['Japan','Tokyo','🇯🇵'],['Sydkorea','Seoul','🇰🇷'],['Kina','Peking','🇨🇳'],['Indien','New Delhi','🇮🇳'],['Thailand','Bangkok','🇹🇭'],
['Vietnam','Hanoi','🇻🇳'],['Australien','Canberra','🇦🇺'],['Nya Zeeland','Wellington','🇳🇿'],['Egypten','Kairo','🇪🇬'],['Kenya','Nairobi','🇰🇪'],
['Marocko','Rabat','🇲🇦'],['Turkiet','Ankara','🇹🇷'],['Saudiarabien','Riyadh','🇸🇦'],['Förenade Arabemiraten','Abu Dhabi','🇦🇪'],['Sydafrika','Pretoria','🇿🇦']
];
const cn=countries.map(x=>x[0]), caps=countries.map(x=>x[1]);
for(const [country,capital,flag] of countries){
  MQ('Världen',`Vad heter huvudstaden i ${country}?`,capital,caps,`${capital} är huvudstad i ${country}.`,'easy');
  MQ('Världen',`${capital} är huvudstad i vilket land?`,country,cn,`${capital} är huvudstad i ${country}.`,'medium');
  MQ('Världen','Vilket land har den här flaggan?',country,cn,`Flaggan tillhör ${country}.`,'easy',flag);
}

const elements=[
['Väte','H'],['Helium','He'],['Litium','Li'],['Kol','C'],['Kväve','N'],['Syre','O'],['Natrium','Na'],['Magnesium','Mg'],['Aluminium','Al'],['Kisel','Si'],
['Fosfor','P'],['Svavel','S'],['Klor','Cl'],['Kalium','K'],['Kalcium','Ca'],['Järn','Fe'],['Koppar','Cu'],['Zink','Zn'],['Silver','Ag'],['Tenn','Sn'],
['Jod','I'],['Guld','Au'],['Kvicksilver','Hg'],['Bly','Pb'],['Neon','Ne'],['Argon','Ar'],['Nickel','Ni'],['Kobolt','Co'],['Platina','Pt'],['Uran','U']
];
const en=elements.map(x=>x[0]), es=elements.map(x=>x[1]);
for(const [name,sym] of elements){
  MQ('Allmänbildning',`Vilket grundämne har beteckningen ${sym}?`,name,en,`${sym} är den kemiska beteckningen för ${name}.`,'medium');
  MQ('Allmänbildning',`Vilken kemisk beteckning har ${name}?`,sym,es,`${name} har den kemiska beteckningen ${sym}.`,'hard');
}

const sweden=[
['Sveriges huvudstad','Stockholm'],['Sveriges näst största stad','Göteborg'],['Sveriges tredje största stad','Malmö'],['Sveriges största sjö','Vänern'],['Sveriges näst största sjö','Vättern'],
['staden där Turning Torso ligger','Malmö'],['staden där Liseberg ligger','Göteborg'],['staden där Uppsala universitet ligger','Uppsala'],['staden där Örebro slott ligger','Örebro'],['staden där Domkyrkan i Lund ligger','Lund'],
['landskapet där Visby ligger','Gotland'],['landskapet där Mora ligger','Dalarna'],['landskapet där Kalmar ligger','Småland'],['landskapet där Ystad ligger','Skåne'],['landskapet där Karlstad ligger','Värmland'],
['bron mellan Malmö och Danmark','Öresundsbron'],['Sveriges högsta berg','Kebnekaise'],['ön där Visby ligger','Gotland'],['ön som nås via Ölandsbron','Öland'],['svenska högtiden med majstång','Midsommar']
];
const swAns=[...new Set(sweden.map(x=>x[1]))];
for(const [clue,answer] of sweden) MQ('Sverige',`Vad är ${clue}?`,answer,swAns,`${answer} är rätt svar på frågan om ${clue}.`,'easy');

const sportFacts=[
['Hur många spelare har ett fotbollslag normalt på planen?','11',['9','10','12'],'Elva spelare inklusive målvakten.'],
['Vilken sport förknippas med Wimbledon?','Tennis',['Golf','Cricket','Rugby'],'Wimbledon är en Grand Slam-turnering i tennis.'],
['Hur långt är ett maraton?','42,195 km',['21,097 km','40 km','50 km'],'Den officiella maratondistansen är 42,195 km.'],
['Vilken färg har totalledarens tröja i Tour de France?','Gul',['Grön','Röd','Blå'],'Totalledaren bär den gula tröjan.'],
['Hur många ringar finns i den olympiska symbolen?','5',['4','6','7'],'Den olympiska symbolen har fem ringar.'],
['I vilken sport används birdie och eagle?','Golf',['Tennis','Baseboll','Ishockey'],'Birdie och eagle är golfresultat i förhållande till par.'],
['Hur många poäng är en touchdown värd före extrapoäng?','6',['3','5','7'],'En touchdown ger sex poäng.'],
['Vilken sport spelas i NHL?','Ishockey',['Basket','Baseboll','Amerikansk fotboll'],'NHL är en professionell ishockeyliga.'],
['Vad heter spelaren som försvarar målet i fotboll?','Målvakt',['Libero','Center','Setter'],'Målvakten försvarar målet.'],
['Vilka grenar hör till alpin skidåkning?','Slalom och störtlopp',['Sprint och jaktstart','Halfpipe och slopestyle','Fristil och grekisk-romersk'],'Slalom och störtlopp är alpina skidgrenar.'],
['Hur många set krävs för seger i bäst av fem?','3',['2','4','5'],'Först till tre set vinner bäst av fem.'],
['I vilken sport används en puck?','Ishockey',['Handboll','Volleyboll','Tennis'],'En puck används i ishockey.'],
['Hur många hål har en standardrunda golf?','18',['9','12','21'],'En standardrunda består av 18 hål.'],
['Vilket redskap används för en slam dunk?','Basketboll',['Tennisboll','Golfboll','Puck'],'En slam dunk görs i basket.'],
['Hur många perioder spelas normalt i ishockey?','3',['2','4','5'],'En ishockeymatch spelas normalt i tre perioder.'],
['Vilken sport har positionen quarterback?','Amerikansk fotboll',['Rugby union','Baseboll','Basket'],'Quarterback är en nyckelposition i amerikansk fotboll.'],
['Vad heter noll poäng i tennis?','Love',['Nil','Blank','Zero'],'I tennis kallas noll poäng love.'],
['Vilken sport använder en pommel horse?','Gymnastik',['Ridsport','Fäktning','Brottning'],'Pommel horse är bygelhäst i artistisk gymnastik.'],
['Vilken sport har en velodrom?','Bancykling',['Simning','Rodd','Skidskytte'],'En velodrom är en bana för bancykling.'],
['Vad kallas tre mål av samma spelare i en match?','Hattrick',['Grand slam','Triple-double','Ace'],'Tre mål av samma spelare kallas hattrick.']
];
for(const [q,correct,wrong,f] of sportFacts)Q('Sport',q,[correct,...wrong],0,f,'medium');

const foodFacts=[
['Vad är huvudingrediensen i guacamole?','Avokado',['Tomat','Gurka','Ärta']],['Vad är tofu främst gjort av?','Sojabönor',['Ris','Potatis','Havre']],['Vad är hummus huvudsakligen gjort av?','Kikärtor',['Linser','Majs','Potatis']],
['Vilken ost används klassiskt på pizza Margherita?','Mozzarella',['Cheddar','Brie','Gouda']],['Vilken frukt torkas till russin?','Druvor',['Plommon','Fikon','Aprikoser']],['Vilken krydda ger ofta curry gul färg?','Gurkmeja',['Kanel','Oregano','Muskot']],
['Vad heter den italienska desserten med kaffe och mascarpone?','Tiramisu',['Cannoli','Gelato','Semifreddo']],['Vilken nöt används traditionellt i pesto genovese?','Pinjenöt',['Jordnöt','Pekannöt','Macadamianöt']],['Från vilket land förknippas sushi främst?','Japan',['Thailand','Kina','Vietnam']],
['Vilken dryck görs av rostade kaffebönor?','Kaffe',['Te','Cider','Kakao']],['Vilken grönsak används i surkål?','Vitkål',['Morot','Rödbeta','Selleri']],['Vad är polenta huvudsakligen gjort av?','Majs',['Ris','Vete','Havre']],
['Vilket land förknippas paella med?','Spanien',['Italien','Portugal','Grekland']],['Vilket land förknippas tacos starkast med?','Mexiko',['Peru','Brasilien','Chile']],['Vad är feta traditionellt för typ av livsmedel?','Ost',['Bröd','Korv','Dessert']],
['Vilken citrusfrukt är gul?','Citron',['Lime','Blodapelsin','Pomelo']],['Vad består maräng främst av?','Äggvita och socker',['Mjöl och smör','Mjölk och kakao','Potatis och salt']],['Vad är gnocchi ofta gjort av?','Potatis',['Majs','Kikärtor','Råg']],
['Vilken böna används till traditionell falafel ofta tillsammans med eller istället för kikärtor?','Bondböna',['Kakaoböna','Vaniljböna','Kaffeböna']],['Vilken dryck är espresso?','Koncentrerat kaffe',['Kolsyrat vatten','Svart te','Varm choklad']]
];
for(const [q,c,w] of foodFacts)Q('Mat & dryck',q,[c,...w],0,`${c} är rätt svar.`,'easy');

const musicFacts=[
['Hur många strängar har en vanlig gitarr?','6',['4','5','8']],['Vilket instrument har svarta och vita tangenter?','Piano',['Fiol','Trumpet','Trummor']],['Vad kallas personen som leder en orkester?','Dirigent',['Producent','Solist','Tekniker']],
['Vilken instrumentfamilj tillhör trumpet?','Bleckblås',['Träblås','Stråk','Slagverk']],['Vilken instrumentfamilj tillhör fiol?','Stråkinstrument',['Bleckblås','Träblås','Slagverk']],['Vilket tecken höjer en ton ett halvt tonsteg?','Korsförtecken',['B-förtecken','Paus','Fermat']],
['Hur många tangenter har ett standardpiano normalt?','88',['61','76','96']],['Vad kallas en sång utan instrumentalt ackompanjemang?','A cappella',['Crescendo','Legato','Rubato']],['Vilket instrument förknippas starkt med Louis Armstrong?','Trumpet',['Fiol','Harpa','Oboe']],
['Vilken grupp bestod av John, Paul, George och Ringo?','The Beatles',['Queen','ABBA','U2']],['Vilken svensk grupp vann Eurovision 1974 med Waterloo?','ABBA',['Roxette','Ace of Base','Europe']],['Vilket instrument har pedaler, strängar och ofta en triangulär ram?','Harpa',['Cello','Tuba','Klarinett']],
['Vad betyder forte i musik?','Starkt',['Svagt','Snabbt','Långsamt']],['Vad betyder piano som dynamisk beteckning?','Svagt',['Starkt','Mycket snabbt','Hackigt']],['Vad kallas musikens hastighet?','Tempo',['Tonart','Klang','Stämma']],
['Vilken klav används ofta för högre toner?','Diskantklav',['Basklav','Altklav','Neutral klav']],['Vilket instrument använder ett munstycke med ett enkelt rörblad?','Klarinett',['Trumpet','Trombon','Valthorn']],['Vilken typ av ensemble består typiskt av två violiner, viola och cello?','Stråkkvartett',['Brassband','Pianotrio','Storband']],
['Vad kallas upprepning av en musikdel?','Repris',['Kadens','Intervall','Arpeggio']],['Vilket instrument har vanligtvis 47 strängar i konsertversion?','Harpa',['Gitarr','Mandolin','Banjo']]
];
for(const [q,c,w] of musicFacts)Q('Musik',q,[c,...w],0,`${c} är rätt svar.`,'medium');

const filmFacts=[
['Vilken filmserie har figuren Darth Vader?','Star Wars',['Star Trek','Alien','Matrix']],['Vilken figur säger ofta "To infinity and beyond" i Toy Story?','Buzz Lightyear',['Woody','Rex','Slinky']],['Vilken film handlar om en haj utanför Amity Island?','Hajen',['Titanic','King Kong','Twister']],
['Vilken färg har Shrek?','Grön',['Blå','Lila','Orange']],['Vilket djur är Simba i Lejonkungen?','Lejon',['Tiger','Gepard','Varg']],['Vilket yrke har Indiana Jones?','Arkeolog',['Pilot','Läkare','Advokat']],
['Vilken trollkarlsskola går Harry Potter på?','Hogwarts',['Narnia','Nevermore','Camelot']],['Vad heter snögubben i Frost?','Olof',['Sven','Kristoffer','Hans']],['Vilken superhjälte är Bruce Wayne?','Batman',['Superman','Iron Man','Spider-Man']],
['Vilken superhjälte är Clark Kent?','Superman',['Batman','Thor','Hulk']],['Vilken filmserie följer agenten James Bond?','007',['Mission: Impossible','Bourne','Jack Reacher']],['Vad heter cowboydockan i Toy Story?','Woody',['Buzz','Andy','Rex']],
['Vilket skepp sjunker i filmen Titanic?','Titanic',['Britannic','Bismarck','Endeavour']],['Vilken färg har Minions oftast?','Gul',['Grön','Röd','Blå']],['Vilken filmfigur är en arkeolog med fedora och piska?','Indiana Jones',['Rocky Balboa','John McClane','Marty McFly']],
['Vad heter hobiten som bär ringen till Mordor?','Frodo',['Gandalf','Aragorn','Legolas']],['Vilken stad skyddas av Batman?','Gotham City',['Metropolis','Springfield','Hill Valley']],['Vilket århundrade utspelar sig inte Star Wars uttryckligen på jorden?','Det anges inte',['1900-talet','2000-talet','2100-talet']],
['Vilken genre tillhör filmen Jurassic Park främst?','Science fiction/äventyr',['Romantisk komedi','Musikal','Western']],['Vilken filmfigur är en ogre?','Shrek',['Nemo','Wall-E','Bambi']]
];
for(const [q,c,w] of filmFacts)Q('Film & TV',q,[c,...w],0,`${c} är rätt svar.`,'easy');

const oddFacts=[
['Hur många hjärtan har en bläckfisk?','3',['1','2','4']],['Vilken färg har isbjörnens hud under pälsen?','Svart',['Vit','Rosa','Grå']],['Vad kallas riktningen rakt ned från en observatör?','Nadir',['Zenit','Horisont','Ekvator']],
['Vilket finger har normalt två falanger?','Tummen',['Pekfingret','Långfingret','Lillfingret']],['Vilket djur har fingeravtryck som kan likna människans?','Koala',['Zebra','Kamel','Delfin']],['Vilken planet har ett dygn längre än sitt år?','Venus',['Mars','Jupiter','Neptunus']],
['Vilken bokstav används inte i någon nuvarande grundämnessymbol?','J',['K','V','Y']],['Hur många nollor har en miljard?','9',['6','12','15']],['Vad kallas rädsla för spindlar?','Araknofobi',['Akrofobi','Klaustrofobi','Agorafobi']],
['Vilket stort landdjur kan inte hoppa på vanligt sätt?','Elefant',['Tiger','Känguru','Get']],['Vilket djur kan vila stående tack vare en särskild benmekanik?','Häst',['Katt','Kanin','Utter']],['Vilket är det största nu levande djuret?','Blåval',['Afrikansk elefant','Valhaj','Kaskelot']],
['Vilket är det största nu levande landdjuret?','Afrikansk elefant',['Blåval','Flodhäst','Giraff']],['Vilket däggdjur kan verkligen flyga?','Fladdermus',['Flygekorre','Pingvin','Struts']],['Vilket djur är känt för att kunna ändra hudfärg för kamouflage och signalering?','Kameleont',['Koala','Bäver','Mullvad']],
['Hur många ben har en spindel?','8',['6','10','12']],['Hur många armar har en vanlig bläckfisk?','8',['6','10','12']],['Vilket djur bygger bäverdammar?','Bäver',['Utter','Grävling','Mård']],['Vad är en axolotl?','En salamander',['En fågel','En fisk','En insekt']],
['Vilket djur har den längsta halsen bland nu levande landdjur?','Giraff',['Kamel','Struts','Lama']]
];
for(const [q,c,w] of oddFacts)Q('Onödigt vetande',q,[c,...w],0,`${c} är rätt svar.`,'medium');

const generalFacts=[
['Vilken planet är närmast solen?','Merkurius',['Venus','Jorden','Mars']],['Vilken planet är störst i solsystemet?','Jupiter',['Saturnus','Jorden','Neptunus']],['Hur många kontinenter brukar man räkna med?','7',['5','6','8']],
['Hur många sidor har en hexagon?','6',['5','7','8']],['Hur många grader är en rät vinkel?','90',['45','120','180']],['Vad är H₂O?','Vatten',['Syre','Salt','Väte']],
['Vilket organ pumpar blodet runt kroppen?','Hjärtat',['Lungan','Levern','Njuren']],['Vilket språk talas främst i Brasilien?','Portugisiska',['Spanska','Franska','Italienska']],['Vilken gas behöver människor för cellandningen?','Syre',['Kväve','Helium','Neon']],
['Vad kallas jordens naturliga satellit?','Månen',['Solen','Mars','Venus']],['Vilken är den största oceanen?','Stilla havet',['Atlanten','Indiska oceanen','Norra ishavet']],['Hur många minuter är en timme?','60',['50','90','100']],
['Hur många sekunder är en minut?','60',['30','100','120']],['Vilket tal kommer efter 999?','1000',['990','1001','9999']],['Vilken färg får man normalt av blått och gult i subtraktiv färgblandning?','Grön',['Lila','Orange','Röd']],
['Vad heter processen där växter använder ljus för att bilda kemisk energi?','Fotosyntes',['Fermentation','Destillation','Erosion']],['Vilken metall är flytande nära rumstemperatur?','Kvicksilver',['Järn','Aluminium','Koppar']],['Vilken del av växten tar främst upp vatten från marken?','Rötterna',['Blommorna','Frukten','Fröna']],
['Vilken stjärna ligger närmast jorden?','Solen',['Polstjärnan','Sirius','Vega']],['Vad mäts i grader Celsius?','Temperatur',['Hastighet','Massa','Längd']]
];
for(const [q,c,w] of generalFacts)Q('Allmänbildning',q,[c,...w],0,`${c} är rätt svar.`,'easy');

/* 180 arithmetic/reasoning questions: deterministic and all unique. */
for(let i=1;i<=60;i++){
  const a=7+i,b=3+(i%17),ans=a+b;Q('Allmänbildning',`Vad blir ${a} + ${b}?`,[String(ans),String(ans+1),String(ans-2),String(ans+5)],0,`${a} + ${b} = ${ans}.`,i<20?'easy':'medium');
}
for(let i=1;i<=60;i++){
  const a=40+i,b=2+(i%19),ans=a-b;Q('Allmänbildning',`Vad blir ${a} − ${b}?`,[String(ans),String(ans+2),String(ans-1),String(ans+6)],0,`${a} − ${b} = ${ans}.`,i<20?'easy':'medium');
}
for(let i=1;i<=60;i++){
  const a=2+i,b=2+((i*3)%11),ans=a*b;Q('Allmänbildning',`Vad blir ${a} × ${b}?`,[String(ans),String(ans+a),String(ans-b),String(ans+2)],0,`${a} × ${b} = ${ans}.`,i<20?'easy':'medium');
}



/* ===== Resequiz v2 expansion =====
   Deterministic question generators keep the extended bank large, offline-capable
   and objectively verifiable. Every generated question gets a unique id. */
function V2Q(c,q,correct,wrong,f,d='medium',visual=''){Q(c,q,[String(correct),...wrong.map(String)],0,f,d,visual)}

/* Extra general knowledge: percentages and exact division. */
for(let i=1;i<=150;i++){
  const base=20+i*20, pct=[10,20,25,50][i%4], ans=base*pct/100;
  V2Q('Allmänbildning',`Hur mycket är ${pct} % av ${base}?`,ans,[ans+5,Math.max(0,ans-5),base-pct],`${pct} % av ${base} = ${ans}.`,i<45?'easy':'medium');
}
for(let i=1;i<=150;i++){
  const d=2+(i%11), ans=3+i, n=d*ans;
  V2Q('Allmänbildning',`Vad blir ${n} ÷ ${d}?`,ans,[ans+1,ans-1,ans+d],`${n} ÷ ${d} = ${ans}.`,i<50?'easy':'medium');
}

/* Extra 'Onödigt vetande': exact time conversions. */
for(let i=1;i<=100;i++){
  const minutes=i+1, seconds=minutes*60;
  V2Q('Onödigt vetande',`Hur många sekunder går det på ${minutes} minuter?`,`${seconds} sekunder`,[`${seconds+60} sekunder`,`${Math.max(60,seconds-60)} sekunder`,`${minutes*100} sekunder`],`${minutes} × 60 = ${seconds} sekunder.`,'easy');
}

/* Science & technology: binary, powers and simple physics calculations. */
for(let i=1;i<=100;i++){
  const n=2+(i%9), add=i, ans=2**n+add;
  V2Q('Vetenskap & teknik',`Vad blir 2 upphöjt till ${n}, plus ${add}?`,ans,[ans+2,ans-1,ans+4],`2^${n} + ${add} = ${ans}.`,n<=5?'easy':'medium');
}
for(let i=1;i<=100;i++){
  const speed=20+i, hours=1+(i%5), ans=speed*hours;
  V2Q('Vetenskap & teknik',`Ett föremål rör sig med ${speed} km/h i ${hours} timmar. Hur långt färdas det?`,`${ans} km`,[`${ans+speed} km`,`${Math.max(speed,ans-speed)} km`,`${speed+hours} km`],`Sträcka = hastighet × tid = ${speed} × ${hours} = ${ans} km.`,'medium');
}
for(let i=1;i<=100;i++){
  const bytes=32+i*8, bits=bytes*8;
  V2Q('Vetenskap & teknik',`${bytes} byte motsvarar hur många bitar?`,`${bits} bitar`,[`${bytes} bitar`,`${bits/2} bitar`,`${bits*2} bitar`],`En byte är 8 bitar, alltså ${bytes} × 8 = ${bits} bitar.`,'medium');
}

/* History: determine century from a concrete year. */
for(let i=0;i<300;i++){
  const year=1001+i*3, century=Math.floor((year-1)/100)+1;
  V2Q('Historia',`Vilket århundrade tillhör år ${year}?`,`${century}:e århundradet`,[`${century-1}:e århundradet`,`${century+1}:e århundradet`,`${century+2}:e århundradet`],`År ${year} ligger i ${century}:e århundradet.`,'medium');
}

/* 80/90/00-talet: identify the decade, with only exact calendar facts. */
for(let year=1980;year<=2009;year++){
  const dec=year<1990?'80-talet':year<2000?'90-talet':'00-talet';
  const others=['70-talet','80-talet','90-talet','00-talet','10-talet'].filter(x=>x!==dec).slice(0,3);
  V2Q('80/90/00-talet',`Vilket årtionde tillhör ${year}?`,dec,others,`${year} tillhör ${dec}.`,'easy');
  V2Q('80/90/00-talet',`Om något hände år ${year}, under vilket decennium hände det?`,dec,others,`Årtalet ${year} ligger under ${dec}.`,'easy');
  V2Q('80/90/00-talet',`Vilken period innehåller årtalet ${year}?`,dec,others,`${year} ingår i ${dec}.`,'easy');
}

/* Film & TV: frame-rate calculations. */
for(let i=1;i<=100;i++){
  const fps=[24,25,30,50][i%4], sec=2+i, frames=fps*sec;
  V2Q('Film & TV',`En video spelas in med ${fps} bilder per sekund. Hur många bildrutor blir det på ${sec} sekunder?`,frames,[frames+fps,frames-fps,fps+sec],`${fps} × ${sec} = ${frames} bildrutor.`,'medium');
}

/* Music: beats-per-minute calculations. */
for(let i=1;i<=100;i++){
  const bpm=50+i, mins=1+(i%5), beats=bpm*mins;
  V2Q('Musik',`En låt går i ${bpm} BPM. Hur många pulsslag går på ${mins} minuter?`,beats,[beats+bpm,Math.max(bpm,beats-bpm),bpm+mins],`${bpm} slag/minut × ${mins} minuter = ${beats} slag.`,'medium');
}

/* Food & drink: Swedish kitchen unit conversions. */
for(let i=1;i<=100;i++){
  const dl=i, ml=dl*100;
  V2Q('Mat & dryck',`${dl} dl motsvarar hur många milliliter?`,`${ml} ml`,[`${dl*10} ml`,`${ml+100} ml`,`${Math.max(100,ml-100)} ml`],`1 dl = 100 ml, alltså ${dl} dl = ${ml} ml.`,'easy');
}

/* Sport: deterministic scoring arithmetic. */
for(let i=1;i<=100;i++){
  const two=i, three=1+((i*3)%7), score=two*2+three*3;
  V2Q('Sport',`Ett basketlag gör ${two} tvåpoängare och ${three} trepoängare. Hur många poäng blir det?`,score,[score+2,score-2,two+three],`${two} × 2 + ${three} × 3 = ${score} poäng.`,'medium');
}

/* Football: match score and league-point calculations. */
for(let i=1;i<=75;i++){
  const wins=i, draws=i%5, points=wins*3+draws;
  V2Q('Fotboll',`Ett lag har ${wins} segrar och ${draws} oavgjorda matcher. Hur många poäng ger det med 3 poäng för seger och 1 för oavgjort?`,`${points} poäng`,[`${points+2} poäng`,`${Math.max(0,points-2)} poäng`,`${wins+draws} poäng`],`${wins} × 3 + ${draws} × 1 = ${points} poäng.`,'medium');
}
for(let i=1;i<=75;i++){
  const home=(i-1)%15, away=Math.floor((i-1)/15), total=home+away;
  V2Q('Fotboll',`En fotbollsmatch slutar ${home}–${away}. Hur många mål gjordes totalt?`,`${total} mål`,[`${Math.abs(home-away)} mål`,`${total+1} mål`,`${Math.max(0,total-1)} mål`],`${home} + ${away} = ${total} mål.`,'easy');
}

/* Animals & nature: stable biological classes. */
const animalGroups={
  'Däggdjur':['Hund','Katt','Häst','Ko','Elefant','Blåval','Delfin','Fladdermus','Igelkott','Älg','Ren','Lejon','Tiger','Giraff','Zebra','Kanin','Ekorre','Isbjörn','Säl','Utter'],
  'Fåglar':['Örn','Uggla','Pingvin','Struts','Svan','Korp','Skata','Falk','Flamingo','Pelikan','Stork','Mås','Talgoxe','Domherre','Påfågel','Kalkon','Höna','And','Gås','Albatross'],
  'Reptiler':['Krokodil','Alligator','Kobra','Huggorm','Boaorm','Leguan','Kameleont','Gecko','Sköldpadda','Varan'],
  'Fiskar':['Lax','Torsk','Sill','Gädda','Abborre','Tonfisk','Makrill','Karp','Haj','Ål'],
  'Insekter':['Myra','Bi','Geting','Fjäril','Myrslända','Gräshoppa','Nyckelpiga','Skalbagge','Trollslända','Mygga']
};
const groupNames=Object.keys(animalGroups);
for(const [group,animals] of Object.entries(animalGroups)){
  for(const animal of animals){
    const wrong=groupNames.filter(x=>x!==group).slice(0,3);
    V2Q('Djur & natur',`Vilken djurgrupp tillhör ${animal}?`,group,wrong,`${animal} tillhör gruppen ${group.toLowerCase()}.`,'easy');
  }
}

/* Travel: reuse the verified country/capital dataset in new travel-specific wording. */
for(const [country,capital,flag] of countries){
  MQ('Resor',`Du landar i ${capital}. Vilket land har du rest till?`,country,cn,`${capital} ligger i ${country}.`,'easy',flag);
  MQ('Resor',`Vilken huvudstad ska du resa till om resmålet är ${country}?`,capital,caps,`${capital} är huvudstad i ${country}.`,'easy');
}

/* Sweden: exact currency arithmetic, useful on a Swedish travel quiz. */
for(let i=1;i<=100;i++){
  const notes=[20,50,100,200,500][i%5], count=i+1, total=notes*count;
  V2Q('Sverige',`Du har ${count} stycken ${notes}-kronorsbelopp. Hur många kronor är det totalt?`,`${total} kr`,[`${total+notes} kr`,`${Math.max(notes,total-notes)} kr`,`${notes+count} kr`],`${count} × ${notes} = ${total} kronor.`,'easy');
}


/* Ensure every question has four distinct options, including legacy questions. */
for(const q of QUIZ_QUESTIONS){
  const used=new Set();
  for(let i=0;i<q.a.length;i++){
    let label=String(q.a[i]);
    if(!used.has(label)){used.add(label);continue;}
    const m=String(q.a[q.r]).match(/^(-?\d+(?:[.,]\d+)?)\s*(.*)$/);
    if(m){
      const base=Number(m[1].replace(',','.')), suffix=m[2]; let step=1;
      do{label=String(base+step)+(suffix?` ${suffix}`:'');step++;}while(used.has(label));
    }else{
      const fallbacks=['Inget av de övriga','Ett annat alternativ','Ingen av dessa'];
      label=fallbacks.find(x=>!used.has(x))||`Alternativ ${i+1}`;
    }
    q.a[i]=label;used.add(label);
  }
}


/* v2.2 extra visual + useless knowledge */
const visualTrivia=[['🦥','Sengångare',['Utter','Bäver','Tvättbjörn']],['🦦','Utter',['Sengångare','Bäver','Mullvad']],['🦔','Igelkott',['Piggsvin','Bäver','Mullvad']],['🦩','Flamingo',['Stork','Trana','Pelikan']],['🦚','Påfågel',['Fasan','Kalkon','Struts']],['🦡','Grävling',['Mård','Bäver','Tvättbjörn']],['🦨','Skunk',['Grävling','Mård','Utter']],['🦙','Lama',['Alpacka','Kamel','Get']],['🦘','Känguru',['Wallaby','Koala','Vombat']],['🦛','Flodhäst',['Noshörning','Tapir','Vildsvin']],['🥝','Kiwi',['Lime','Avokado','Fikon']],['🍍','Ananas',['Mango','Papaya','Granatäpple']],['🥨','Pretzel',['Croissant','Bagel','Våffla']],['🥟','Dumpling',['Taco','Sushi','Falafel']],['🪃','Bumerang',['Frisbee','Slangbella','Paddel']],['🪗','Dragspel',['Piano','Munspel','Orgel']],['🪕','Banjo',['Gitarr','Mandolin','Ukulele']],['🪀','Jojo',['Snurra','Kula','Diabolo']],['🛺','Autorickshaw',['Taxi','Moped','Spårvagn']],['🚠','Kabinvagn',['Spårvagn','Monorail','Bergbana']]];
for(const [visual,correct,wrong] of visualTrivia)V2Q('Onödigt vetande','Vad föreställer bilden?',correct,wrong,`Bilden föreställer ${correct.toLowerCase()}.`,'easy',visual);
for(const [country,capital,flag] of countries){MQ('Onödigt vetande','Vilket land har den här flaggan?',country,cn,`Flaggan tillhör ${country}.`,'medium',flag);MQ('Resor','Vilken huvudstad hör till landet vars flagga visas?',capital,caps,`${capital} är huvudstad i ${country}.`,'medium',flag);}
const uselessFacts=[['Hur många hjärtan har en bläckfisk?','3',['1','2','4'],'En bläckfisk har tre hjärtan.'],['Vilket däggdjur kan verkligen flyga med aktiv vingflykt?','Fladdermus',['Flygekorre','Kaguang','Sockerflygare'],'Fladdermöss är de enda däggdjuren med verklig aktiv flykt.'],['Vilken färg har en isbjörns hud under pälsen?','Svart',['Vit','Rosa','Grå'],'Isbjörnens hud är svart.'],['Vilket djur har fingeravtryck som kan likna människans?','Koala',['Känguru','Panda','Sengångare'],'Koalor har mycket människolika fingeravtryck.'],['Vilken fågel kan flyga baklänges?','Kolibri',['Svala','Falk','Albatross'],'Kolibrier kan aktivt flyga baklänges.'],['Vilken planet har ett dygn som är längre än sitt år?','Venus',['Mars','Jupiter','Merkurius'],'Venus roterar långsammare än den kretsar runt solen.'],['Vilken planet har vulkanen Olympus Mons?','Mars',['Venus','Jorden','Merkurius'],'Olympus Mons ligger på Mars.'],['Vilket djur kan inte hoppa?','Elefant',['Giraff','Känguru','Get'],'Elefanter kan inte hoppa med alla fyra fötter från marken samtidigt.'],['Vilket land förknippas med de första papperspengarna?','Kina',['Italien','Egypten','Grekland'],'Papperspengar utvecklades tidigt i Kina.'],['Vilken bokstav används inte i någon nuvarande kemisk grundämnessymbol?','J',['Q','X','Z'],'J används inte i någon nuvarande grundämnessymbol.'],['Hur många prickar finns totalt på en vanlig sexsidig tärning?','21',['18','24','36'],'1+2+3+4+5+6 = 21.'],['Hur många minuter är exakt en vecka?','10 080',['9 600','10 800','11 200'],'7 × 24 × 60 = 10 080 minuter.'],['Hur många sekunder är exakt ett dygn?','86 400',['84 600','86 000','88 400'],'24 × 60 × 60 = 86 400 sekunder.'],['Hur många små rutor finns på ett schackbräde?','64',['48','72','81'],'8 × 8 = 64.'],['Hur många kort finns i en standardkortlek utan jokrar?','52',['48','54','56'],'En standardkortlek har 52 kort.'],['Hur många tangenter har ett standardpiano normalt?','88',['76','84','92'],'Ett standardpiano har normalt 88 tangenter.'],['Hur många sidor har en dodekagon?','12',['10','11','14'],'En dodekagon är en tolvhörning.'],['Vilket av dessa är botaniskt ett bär?','Banan',['Jordgubbe','Hallon','Körsbär'],'Botaniskt klassas bananen som ett bär.'],['Vad är en jordnöt botaniskt?','Baljväxt',['Trädnöt','Bär','Rotfrukt'],'Jordnöten tillhör baljväxterna.'],['Vilken metall är flytande vid vanlig rumstemperatur?','Kvicksilver',['Järn','Aluminium','Koppar'],'Kvicksilver är flytande vid vanlig rumstemperatur.'],['Vilket grundämne är vanligast i universum?','Väte',['Syre','Helium','Kol'],'Väte är det vanligaste grundämnet.'],['Vilken gas utgör störst andel av jordens atmosfär?','Kväve',['Syre','Koldioxid','Argon'],'Kväve utgör ungefär 78 procent.'],['Hur många ben har en spindel?','8',['6','10','12'],'Spindeldjur har åtta ben.'],['Vilken del av kroppen har människans minsta ben?','Örat',['Handen','Foten','Näsan'],'Hörselbenen finns i mellanörat.'],['Vad heter människans minsta ben?','Stigbygeln',['Hammaren','Armbågsbenet','Nyckelbenet'],'Stigbygeln är människans minsta ben.'],['Vilket är människans största organ?','Huden',['Levern','Lungan','Hjärnan'],'Huden är kroppens största organ.'],['Vilken del av ögat saknar normalt blodkärl?','Hornhinnan',['Näthinnan','Iris','Linsen'],'Hornhinnan är normalt blodkärlsfri.'],['Vilken färg har flamingoungar när de kläcks?','Gråvita',['Rosa','Blå','Svarta'],'Flamingoungar är gråvita och blir rosa senare.']];for(const [q,correct,wrong,f] of uselessFacts)V2Q('Onödigt vetande',q,correct,wrong,f,'medium');

const partyPrompts=[
'Vem i gruppen skulle mest sannolikt glömma sitt pass hemma?',
'Vem skulle klara sig bäst en vecka utan mobil?',
'Vem skulle först börja sjunga högt i bilen?',
'Vem skulle mest sannolikt boka fel datum på hotellet?',
'Vem skulle vinna en tävling i att hitta bästa restaurangen?',
'Vem skulle kunna somna först på ett nattåg?',
'Vem skulle prata med en främling först?',
'Vem skulle packa mest onödiga saker?',
'Vem skulle hitta tillbaka utan GPS?',
'Vem skulle köpa den konstigaste souveniren?',
'Vem skulle mest sannolikt missa avfarten?',
'Vem skulle börja planera nästa resa redan under den här?',
'Vem skulle vara bäst reseledare?',
'Vem skulle våga prova den märkligaste maträtten?',
'Vem skulle ta flest bilder under resan?',
'Vem skulle vara mest morgonpigg på semestern?',
'Vem skulle kunna pruta bäst på en marknad?',
'Vem skulle glömma var bilen parkerades?',
'Vem skulle vinna en spontan karaoketävling?',
'Vem skulle vara bäst på att hålla gruppens budget?'
];


/* v2.7.2 extra visual questions: reuse the local image assets so all images remain fully offline. */
for(const [country,capital,flag] of countries){
  MQ('Världen','Vilken huvudstad hör till landet på bilden?',capital,caps,`${capital} är huvudstad i ${country}.`,'medium',flag);
  MQ('Resor',`Du ser den här flaggan på resan. Vilket land är du i?`,country,cn,`Flaggan tillhör ${country}.`,'easy',flag);
}
for(const [visual,correct,wrong] of visualTrivia){
  V2Q('Allmänbildning','Vad ser du på bilden?',correct,wrong,`Motivet är ${correct.toLowerCase()}.`,'easy',visual);
  V2Q('Onödigt vetande','Vilket av alternativen matchar bilden?',correct,wrong,`Rätt svar är ${correct}.`,'medium',visual);
}


/* v2.7.5 expanded unique question bank.
   These are generated from the existing verified country/element/visual datasets
   plus deterministic calculation/unit questions. Every generated question text is unique. */

const countryQuestionTemplates=[
  (country,capital)=>[`Vilket land har ${capital} som huvudstad?`,country,cn,`${capital} är huvudstad i ${country}.`],
  (country,capital)=>[`Vilken huvudstad hör till ${country}?`,capital,caps,`${capital} är huvudstad i ${country}.`],
  (country,capital)=>[`Du ska resa till ${country}. Vilken huvudstad ska du leta efter på kartan?`,capital,caps,`${capital} är huvudstad i ${country}.`],
  (country,capital)=>[`På en biljett står destinationen ${capital}. Vilket land reser du till?`,country,cn,`${capital} ligger i ${country}.`],
  (country,capital)=>[`Vilket av följande länder förknippas med huvudstaden ${capital}?`,country,cn,`${capital} är huvudstad i ${country}.`],
  (country,capital)=>[`Vilken kombination är rätt för ${country}?`,`${country} – ${capital}`,countries.map(x=>`${x[0]} – ${x[1]}`),`${country} har huvudstaden ${capital}.`]
];
for(const [country,capital] of countries){
  for(let ti=0;ti<countryQuestionTemplates.length;ti++){
    const [question,correct,pool,explanation]=countryQuestionTemplates[ti](country,capital);
    MQ(ti%2===0?'Världen':'Resor',question,correct,pool,explanation,ti<2?'easy':'medium');
  }
}

const elementQuestionTemplates=[
  (name,sym)=>[`Vilket grundämne skrivs ${sym} i periodiska systemet?`,name,en,`${sym} är beteckningen för ${name}.`],
  (name,sym)=>[`Vad betyder den kemiska symbolen ${sym}?`,name,en,`${sym} står för ${name}.`],
  (name,sym)=>[`Vilken symbol ska användas för grundämnet ${name}?`,sym,es,`${name} har symbolen ${sym}.`],
  (name,sym)=>[`I ett kemiskt uttryck ser du ${sym}. Vilket grundämne avses?`,name,en,`${sym} är ${name}.`],
  (name,sym)=>[`Vilket par grundämne–symbol är korrekt för ${name}?`,`${name} – ${sym}`,elements.map(x=>`${x[0]} – ${x[1]}`),`${name} har symbolen ${sym}.`]
];
for(const [name,sym] of elements){
  for(let ti=0;ti<elementQuestionTemplates.length;ti++){
    const [question,correct,pool,explanation]=elementQuestionTemplates[ti](name,sym);
    MQ('Vetenskap & teknik',question,correct,pool,explanation,ti<2?'medium':'hard');
  }
}

const visualQuestionTemplates=[
  (correct)=>`Vilket motiv visas på bilden: ${correct.toLowerCase()} eller något annat?`,
  (correct)=>`Vad föreställer den här bilden? Ledtråd: välj det exakta namnet.`,
  (correct)=>`Identifiera motivet på bilden.`,
  (correct)=>`Vilket av alternativen beskriver bilden bäst?`
];
for(const [visual,correct,wrong] of visualTrivia){
  visualQuestionTemplates.forEach((makeQ,i)=>{
    V2Q(i%2?'Allmänbildning':'Onödigt vetande',makeQ(correct),correct,wrong,`Bilden föreställer ${correct.toLowerCase()}.`,i<2?'easy':'medium',visual);
  });
}

/* 600 unique mental-math questions with deterministic operands.
   They broaden the bank without external dependencies and are useful in mixed/general quizzes. */
for(let i=1;i<=200;i++){
  const a=10+(i*7)%89,b=2+(i*11)%37,ans=a+b;
  V2Q('Allmänbildning',`Snabbräkning ${i}: Vad är ${a} + ${b}?`,ans,[ans+1,ans-1,ans+5],`Rätt svar är ${ans}.`,i<80?'easy':'medium');
}
for(let i=1;i<=200;i++){
  const a=40+(i*13)%160,b=2+(i*5)%35,ans=a-b;
  V2Q('Allmänbildning',`Huvudräkning ${i}: Vad är ${a} − ${b}?`,ans,[ans+1,ans-1,ans+10],`Rätt svar är ${ans}.`,i<80?'easy':'medium');
}
for(let i=1;i<=200;i++){
  const a=2+(i*3)%11,b=2+(i*7)%11,ans=a*b;
  V2Q('Vetenskap & teknik',`Multiplikation ${i}: Vad är ${a} × ${b}?`,ans,[ans+a,ans-b,ans+1],`Rätt svar är ${ans}.`,i<80?'easy':'medium');
}

/* Unit/time questions: deterministic and exact. */
for(let i=1;i<=100;i++){
  const mins=2+(i*3)%59,ans=mins*60;
  V2Q('Vetenskap & teknik',`Tidsomvandling ${i}: Hur många sekunder är ${mins} minuter?`,ans,[ans+60,ans-60,mins*100],`${mins} minuter × 60 = ${ans} sekunder.`,'medium');
}
for(let i=1;i<=100;i++){
  const km=1+(i*7)%50,ans=km*1000;
  V2Q('Vetenskap & teknik',`Längdomvandling ${i}: Hur många meter är ${km} kilometer?`,ans,[ans+1000,ans-1000,km*100],`${km} kilometer = ${ans} meter.`,'easy');
}


/* v3.1 curated local image and public-domain melody packs. */
const CURATED_MEDIA_QUESTIONS=[{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Lejon","Flamingo","Koala","Noshörning"],"r":0,"f":"Bilden föreställer lejon.","d":"easy","visual":"media-packs/images/djur-01.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Tiger","Kamel","Zebra","Känguru"],"r":0,"f":"Bilden föreställer tiger.","d":"easy","visual":"media-packs/images/djur-02.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Panda","Pingvin","Papegoja","Utter"],"r":0,"f":"Bilden föreställer panda.","d":"easy","visual":"media-packs/images/djur-03.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Koala","Sengångare","Örn","Fladdermus"],"r":0,"f":"Bilden föreställer koala.","d":"easy","visual":"media-packs/images/djur-04.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Elefant","Noshörning","Zebra","Känguru"],"r":0,"f":"Bilden föreställer elefant.","d":"easy","visual":"media-packs/images/djur-05.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Giraff","Elefant","Sengångare","Noshörning"],"r":0,"f":"Bilden föreställer giraff.","d":"easy","visual":"media-packs/images/djur-06.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Zebra","Giraff","Pingvin","Utter"],"r":0,"f":"Bilden föreställer zebra.","d":"easy","visual":"media-packs/images/djur-07.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Noshörning","Pingvin","Igelkott","Koala"],"r":0,"f":"Bilden föreställer noshörning.","d":"easy","visual":"media-packs/images/djur-08.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Gorilla","Pingvin","Känguru","Utter"],"r":0,"f":"Bilden föreställer gorilla.","d":"easy","visual":"media-packs/images/djur-09.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Kamel","Känguru","Örn","Panda"],"r":0,"f":"Bilden föreställer kamel.","d":"easy","visual":"media-packs/images/djur-10.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Känguru","Kamel","Tiger","Fladdermus"],"r":0,"f":"Bilden föreställer känguru.","d":"easy","visual":"media-packs/images/djur-11.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Sengångare","Panda","Uggla","Örn"],"r":0,"f":"Bilden föreställer sengångare.","d":"easy","visual":"media-packs/images/djur-12.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Utter","Känguru","Sengångare","Fladdermus"],"r":0,"f":"Bilden föreställer utter.","d":"easy","visual":"media-packs/images/djur-13.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Igelkott","Elefant","Fladdermus","Gorilla"],"r":0,"f":"Bilden föreställer igelkott.","d":"easy","visual":"media-packs/images/djur-14.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Fladdermus","Örn","Panda","Pingvin"],"r":0,"f":"Bilden föreställer fladdermus.","d":"easy","visual":"media-packs/images/djur-15.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Uggla","Lejon","Fladdermus","Elefant"],"r":0,"f":"Bilden föreställer uggla.","d":"easy","visual":"media-packs/images/djur-16.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Örn","Panda","Utter","Sengångare"],"r":0,"f":"Bilden föreställer örn.","d":"easy","visual":"media-packs/images/djur-17.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Papegoja","Giraff","Elefant","Flamingo"],"r":0,"f":"Bilden föreställer papegoja.","d":"easy","visual":"media-packs/images/djur-18.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Flamingo","Lejon","Giraff","Uggla"],"r":0,"f":"Bilden föreställer flamingo.","d":"easy","visual":"media-packs/images/djur-19.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Pingvin","Örn","Koala","Fladdermus"],"r":0,"f":"Bilden föreställer pingvin.","d":"easy","visual":"media-packs/images/djur-20.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Äpple","Sushi","Pizza","Mango"],"r":0,"f":"Bilden föreställer äpple.","d":"easy","visual":"media-packs/images/mat-01.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Päron","Ananas","Körsbär","Apelsin"],"r":0,"f":"Bilden föreställer päron.","d":"easy","visual":"media-packs/images/mat-02.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Apelsin","Päron","Ananas","Jordgubbe"],"r":0,"f":"Bilden föreställer apelsin.","d":"easy","visual":"media-packs/images/mat-03.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Citron","Pretzel","Hamburgare","Apelsin"],"r":0,"f":"Bilden föreställer citron.","d":"easy","visual":"media-packs/images/mat-04.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Banan","Pretzel","Persika","Ananas"],"r":0,"f":"Bilden föreställer banan.","d":"easy","visual":"media-packs/images/mat-05.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Vattenmelon","Ananas","Päron","Jordgubbe"],"r":0,"f":"Bilden föreställer vattenmelon.","d":"easy","visual":"media-packs/images/mat-06.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Vindruvor","Kiwi","Citron","Jordgubbe"],"r":0,"f":"Bilden föreställer vindruvor.","d":"easy","visual":"media-packs/images/mat-07.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Jordgubbe","Citron","Mango","Sushi"],"r":0,"f":"Bilden föreställer jordgubbe.","d":"easy","visual":"media-packs/images/mat-08.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Blåbär","Pizza","Päron","Vindruvor"],"r":0,"f":"Bilden föreställer blåbär.","d":"easy","visual":"media-packs/images/mat-09.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Körsbär","Vindruvor","Taco","Päron"],"r":0,"f":"Bilden föreställer körsbär.","d":"easy","visual":"media-packs/images/mat-10.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Persika","Pizza","Päron","Sushi"],"r":0,"f":"Bilden föreställer persika.","d":"easy","visual":"media-packs/images/mat-11.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Mango","Äpple","Apelsin","Taco"],"r":0,"f":"Bilden föreställer mango.","d":"easy","visual":"media-packs/images/mat-12.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Ananas","Kiwi","Äpple","Jordgubbe"],"r":0,"f":"Bilden föreställer ananas.","d":"easy","visual":"media-packs/images/mat-13.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Kiwi","Pizza","Pretzel","Avokado"],"r":0,"f":"Bilden föreställer kiwi.","d":"easy","visual":"media-packs/images/mat-14.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Avokado","Kiwi","Mango","Körsbär"],"r":0,"f":"Bilden föreställer avokado.","d":"easy","visual":"media-packs/images/mat-15.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Pizza","Päron","Ananas","Vattenmelon"],"r":0,"f":"Bilden föreställer pizza.","d":"easy","visual":"media-packs/images/mat-16.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Hamburgare","Avokado","Banan","Blåbär"],"r":0,"f":"Bilden föreställer hamburgare.","d":"easy","visual":"media-packs/images/mat-17.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Taco","Blåbär","Hamburgare","Kiwi"],"r":0,"f":"Bilden föreställer taco.","d":"easy","visual":"media-packs/images/mat-18.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Sushi","Avokado","Hamburgare","Kiwi"],"r":0,"f":"Bilden föreställer sushi.","d":"easy","visual":"media-packs/images/mat-19.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Pretzel","Banan","Vindruvor","Citron"],"r":0,"f":"Bilden föreställer pretzel.","d":"easy","visual":"media-packs/images/mat-20.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Bil","Ånglok","Helikopter","Traktor"],"r":0,"f":"Bilden föreställer bil.","d":"easy","visual":"media-packs/images/transport-01.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Taxi","Ånglok","Trådbuss","Motorcykel"],"r":0,"f":"Bilden föreställer taxi.","d":"easy","visual":"media-packs/images/transport-02.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Buss","Racerbil","Skoter","Taxi"],"r":0,"f":"Bilden föreställer buss.","d":"easy","visual":"media-packs/images/transport-03.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Trådbuss","Flygplan","Lastbil","Segelbåt"],"r":0,"f":"Bilden föreställer trådbuss.","d":"easy","visual":"media-packs/images/transport-04.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Racerbil","Motorcykel","Polisbil","Bil"],"r":0,"f":"Bilden föreställer racerbil.","d":"easy","visual":"media-packs/images/transport-05.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Polisbil","Racerbil","Buss","Cykel"],"r":0,"f":"Bilden föreställer polisbil.","d":"easy","visual":"media-packs/images/transport-06.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Ambulans","Racerbil","Trådbuss","Segelbåt"],"r":0,"f":"Bilden föreställer ambulans.","d":"easy","visual":"media-packs/images/transport-07.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Brandbil","Fartyg","Raket","Polisbil"],"r":0,"f":"Bilden föreställer brandbil.","d":"easy","visual":"media-packs/images/transport-08.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Lastbil","Bil","Traktor","Polisbil"],"r":0,"f":"Bilden föreställer lastbil.","d":"easy","visual":"media-packs/images/transport-09.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Traktor","Ambulans","Ånglok","Segelbåt"],"r":0,"f":"Bilden föreställer traktor.","d":"easy","visual":"media-packs/images/transport-10.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Motorcykel","Trådbuss","Cykel","Bil"],"r":0,"f":"Bilden föreställer motorcykel.","d":"easy","visual":"media-packs/images/transport-11.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Skoter","Bil","Lastbil","Segelbåt"],"r":0,"f":"Bilden föreställer skoter.","d":"easy","visual":"media-packs/images/transport-12.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Cykel","Brandbil","Bil","Motorcykel"],"r":0,"f":"Bilden föreställer cykel.","d":"easy","visual":"media-packs/images/transport-13.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Flygplan","Taxi","Buss","Racerbil"],"r":0,"f":"Bilden föreställer flygplan.","d":"easy","visual":"media-packs/images/transport-14.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Helikopter","Buss","Motorcykel","Segelbåt"],"r":0,"f":"Bilden föreställer helikopter.","d":"easy","visual":"media-packs/images/transport-15.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Raket","Bil","Motorcykel","Ånglok"],"r":0,"f":"Bilden föreställer raket.","d":"easy","visual":"media-packs/images/transport-16.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Kanot","Lastbil","Racerbil","Bil"],"r":0,"f":"Bilden föreställer kanot.","d":"easy","visual":"media-packs/images/transport-17.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Segelbåt","Brandbil","Fartyg","Motorcykel"],"r":0,"f":"Bilden föreställer segelbåt.","d":"easy","visual":"media-packs/images/transport-18.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Fartyg","Cykel","Brandbil","Helikopter"],"r":0,"f":"Bilden föreställer fartyg.","d":"easy","visual":"media-packs/images/transport-19.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Ånglok","Trådbuss","Taxi","Kanot"],"r":0,"f":"Bilden föreställer ånglok.","d":"easy","visual":"media-packs/images/transport-20.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Armbandsur","Glödlampa","Kamera","Ficklampa"],"r":0,"f":"Bilden föreställer armbandsur.","d":"easy","visual":"media-packs/images/föremål-01.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Mobiltelefon","Väckarklocka","Radio","Laptop"],"r":0,"f":"Bilden föreställer mobiltelefon.","d":"easy","visual":"media-packs/images/föremål-02.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Laptop","Datorskärm","TV","Hänglås"],"r":0,"f":"Bilden föreställer laptop.","d":"easy","visual":"media-packs/images/föremål-03.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Tangentbord","Mobiltelefon","Hänglås","Kamera"],"r":0,"f":"Bilden föreställer tangentbord.","d":"easy","visual":"media-packs/images/föremål-04.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Datorskärm","Glödlampa","Ficklampa","Radio"],"r":0,"f":"Bilden föreställer datorskärm.","d":"easy","visual":"media-packs/images/föremål-05.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Skrivare","TV","Kompass","Väckarklocka"],"r":0,"f":"Bilden föreställer skrivare.","d":"easy","visual":"media-packs/images/föremål-06.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Kamera","TV","Brandsläckare","Väckarklocka"],"r":0,"f":"Bilden föreställer kamera.","d":"easy","visual":"media-packs/images/föremål-07.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Filmkamera","TV","Tangentbord","Laptop"],"r":0,"f":"Bilden föreställer filmkamera.","d":"easy","visual":"media-packs/images/föremål-08.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["TV","Kamera","Tangentbord","Magnet"],"r":0,"f":"Bilden föreställer tv.","d":"easy","visual":"media-packs/images/föremål-09.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Radio","Mikroskop","Brandsläckare","Kamera"],"r":0,"f":"Bilden föreställer radio.","d":"easy","visual":"media-packs/images/föremål-10.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Glödlampa","Mikroskop","Nyckel","Kamera"],"r":0,"f":"Bilden föreställer glödlampa.","d":"easy","visual":"media-packs/images/föremål-11.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Ficklampa","Kamera","Filmkamera","Skrivare"],"r":0,"f":"Bilden föreställer ficklampa.","d":"easy","visual":"media-packs/images/föremål-12.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Nyckel","Armbandsur","Mobiltelefon","Ficklampa"],"r":0,"f":"Bilden föreställer nyckel.","d":"easy","visual":"media-packs/images/föremål-13.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Hänglås","Glödlampa","Tangentbord","Kompass"],"r":0,"f":"Bilden föreställer hänglås.","d":"easy","visual":"media-packs/images/föremål-14.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Kompass","Magnet","Armbandsur","Nyckel"],"r":0,"f":"Bilden föreställer kompass.","d":"easy","visual":"media-packs/images/föremål-15.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Väckarklocka","Armbandsur","Filmkamera","Laptop"],"r":0,"f":"Bilden föreställer väckarklocka.","d":"easy","visual":"media-packs/images/föremål-16.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Magnet","Armbandsur","Radio","Datorskärm"],"r":0,"f":"Bilden föreställer magnet.","d":"easy","visual":"media-packs/images/föremål-17.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Mikroskop","Laptop","Ficklampa","Mobiltelefon"],"r":0,"f":"Bilden föreställer mikroskop.","d":"easy","visual":"media-packs/images/föremål-18.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Teleskop","Radio","Mobiltelefon","Tangentbord"],"r":0,"f":"Bilden föreställer teleskop.","d":"easy","visual":"media-packs/images/föremål-19.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Brandsläckare","Datorskärm","Magnet","Teleskop"],"r":0,"f":"Bilden föreställer brandsläckare.","d":"easy","visual":"media-packs/images/föremål-20.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Sol","Palm","Trästock","Snöflinga"],"r":0,"f":"Bilden föreställer sol.","d":"easy","visual":"media-packs/images/natur-01.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Måne","Gran","Blixt","Stjärna"],"r":0,"f":"Bilden föreställer måne.","d":"easy","visual":"media-packs/images/natur-02.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Stjärna","Berg","Måne","Solros"],"r":0,"f":"Bilden föreställer stjärna.","d":"easy","visual":"media-packs/images/natur-03.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Regnbåge","Kaktus","Våg","Måne"],"r":0,"f":"Bilden föreställer regnbåge.","d":"easy","visual":"media-packs/images/natur-04.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Moln","Öken","Snöflinga","Solros"],"r":0,"f":"Bilden föreställer moln.","d":"easy","visual":"media-packs/images/natur-05.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Blixt","Ros","Berg","Trästock"],"r":0,"f":"Bilden föreställer blixt.","d":"easy","visual":"media-packs/images/natur-06.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Snöflinga","Moln","Svamp","Sol"],"r":0,"f":"Bilden föreställer snöflinga.","d":"easy","visual":"media-packs/images/natur-07.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Vulkan","Stjärna","Öken","Sten"],"r":0,"f":"Bilden föreställer vulkan.","d":"easy","visual":"media-packs/images/natur-08.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Berg","Ö","Måne","Moln"],"r":0,"f":"Bilden föreställer berg.","d":"easy","visual":"media-packs/images/natur-09.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Ö","Solros","Öken","Våg"],"r":0,"f":"Bilden föreställer ö.","d":"easy","visual":"media-packs/images/natur-10.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Öken","Sol","Gran","Blixt"],"r":0,"f":"Bilden föreställer öken.","d":"easy","visual":"media-packs/images/natur-11.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Våg","Gran","Sol","Ros"],"r":0,"f":"Bilden föreställer våg.","d":"easy","visual":"media-packs/images/natur-12.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Gran","Solros","Trästock","Stjärna"],"r":0,"f":"Bilden föreställer gran.","d":"easy","visual":"media-packs/images/natur-13.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Palm","Moln","Sten","Snöflinga"],"r":0,"f":"Bilden föreställer palm.","d":"easy","visual":"media-packs/images/natur-14.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Kaktus","Moln","Sten","Gran"],"r":0,"f":"Bilden föreställer kaktus.","d":"easy","visual":"media-packs/images/natur-15.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Solros","Snöflinga","Stjärna","Våg"],"r":0,"f":"Bilden föreställer solros.","d":"easy","visual":"media-packs/images/natur-16.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Ros","Stjärna","Trästock","Palm"],"r":0,"f":"Bilden föreställer ros.","d":"easy","visual":"media-packs/images/natur-17.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Svamp","Sol","Trästock","Sten"],"r":0,"f":"Bilden föreställer svamp.","d":"easy","visual":"media-packs/images/natur-18.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Sten","Sol","Palm","Berg"],"r":0,"f":"Bilden föreställer sten.","d":"easy","visual":"media-packs/images/natur-19.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Trästock","Sten","Ö","Stjärna"],"r":0,"f":"Bilden föreställer trästock.","d":"easy","visual":"media-packs/images/natur-20.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Fotboll","Golf","Bordtennis","Fiol"],"r":0,"f":"Bilden föreställer fotboll.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-01.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Basketboll","Gitarr","Teatermasker","Trumpet"],"r":0,"f":"Bilden föreställer basketboll.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-02.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Amerikansk fotboll","Filmklappa","Trumpet","Baseboll"],"r":0,"f":"Bilden föreställer amerikansk fotboll.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-03.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Baseboll","Volleyboll","Teatermasker","Trumma"],"r":0,"f":"Bilden föreställer baseboll.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-04.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Tennis","Piano","Filmklappa","Boxning"],"r":0,"f":"Bilden föreställer tennis.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-05.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Volleyboll","Fotboll","Tennis","Amerikansk fotboll"],"r":0,"f":"Bilden föreställer volleyboll.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-06.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Bordtennis","Filmklappa","Gitarr","Trumma"],"r":0,"f":"Bilden föreställer bordtennis.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-07.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Badminton","Amerikansk fotboll","Saxofon","Golf"],"r":0,"f":"Bilden föreställer badminton.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-08.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Boxning","Filmklappa","Målarpalett","Piano"],"r":0,"f":"Bilden föreställer boxning.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-09.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Golf","Mikrofon","Tennis","Volleyboll"],"r":0,"f":"Bilden föreställer golf.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-10.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Gitarr","Badminton","Golf","Filmklappa"],"r":0,"f":"Bilden föreställer gitarr.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-11.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Piano","Boxning","Golf","Fotboll"],"r":0,"f":"Bilden föreställer piano.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-12.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Trumpet","Bordtennis","Piano","Boxning"],"r":0,"f":"Bilden föreställer trumpet.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-13.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Fiol","Baseboll","Fotboll","Trumpet"],"r":0,"f":"Bilden föreställer fiol.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-14.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Trumma","Amerikansk fotboll","Bordtennis","Fiol"],"r":0,"f":"Bilden föreställer trumma.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-15.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Saxofon","Amerikansk fotboll","Fiol","Piano"],"r":0,"f":"Bilden föreställer saxofon.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-16.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Målarpalett","Baseboll","Amerikansk fotboll","Trumma"],"r":0,"f":"Bilden föreställer målarpalett.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-17.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Teatermasker","Golf","Saxofon","Målarpalett"],"r":0,"f":"Bilden föreställer teatermasker.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-18.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Filmklappa","Volleyboll","Boxning","Målarpalett"],"r":0,"f":"Bilden föreställer filmklappa.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-19.png"},{"c":"Bildrunda","q":"Vad föreställer bilden?","a":["Mikrofon","Badminton","Golf","Trumma"],"r":0,"f":"Bilden föreställer mikrofon.","d":"easy","visual":"media-packs/images/kultur-och-aktivitet-20.png"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Ode till glädjen","Old MacDonald","Broder Jakob","Bröllopsmarschen (Mendelssohn)"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Ode till glädjen.","d":"medium","audio":"media-packs/audio/melody-01.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Für Elise","Can-Can","Stilla natt","Old MacDonald"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Für Elise.","d":"medium","audio":"media-packs/audio/melody-02.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Blinka lilla stjärna","Morgonstämning","Für Elise","Bröllopsmarschen (Mendelssohn)"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Blinka lilla stjärna.","d":"medium","audio":"media-packs/audio/melody-03.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Broder Jakob","Row Row Row Your Boat","When the Saints Go Marching In","Amazing Grace"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Broder Jakob.","d":"medium","audio":"media-packs/audio/melody-04.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Jingle Bells","Yankee Doodle","Broder Jakob","Stilla natt"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Jingle Bells.","d":"medium","audio":"media-packs/audio/melody-05.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Stilla natt","Greensleeves","Old MacDonald","When the Saints Go Marching In"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Stilla natt.","d":"medium","audio":"media-packs/audio/melody-06.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["London Bridge","Yankee Doodle","Blinka lilla stjärna","Den blå Donau"],"r":0,"f":"Klippet är en egen syntetisk inspelning av London Bridge.","d":"medium","audio":"media-packs/audio/melody-07.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Mary Had a Little Lamb","Row Row Row Your Boat","Greensleeves","Old MacDonald"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Mary Had a Little Lamb.","d":"medium","audio":"media-packs/audio/melody-08.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Row Row Row Your Boat","Auld Lang Syne","Yankee Doodle","Brudkören (Wagner)"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Row Row Row Your Boat.","d":"medium","audio":"media-packs/audio/melody-09.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Old MacDonald","Brudkören (Wagner)","Für Elise","Row Row Row Your Boat"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Old MacDonald.","d":"medium","audio":"media-packs/audio/melody-10.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Yankee Doodle","Broder Jakob","Ode till glädjen","Morgonstämning"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Yankee Doodle.","d":"medium","audio":"media-packs/audio/melody-11.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Amazing Grace","Den blå Donau","When the Saints Go Marching In","Broder Jakob"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Amazing Grace.","d":"medium","audio":"media-packs/audio/melody-12.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Auld Lang Syne","Brudkören (Wagner)","London Bridge","Jingle Bells"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Auld Lang Syne.","d":"medium","audio":"media-packs/audio/melody-13.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Brahms vaggvisa","Für Elise","When the Saints Go Marching In","Brudkören (Wagner)"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Brahms vaggvisa.","d":"medium","audio":"media-packs/audio/melody-14.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Bröllopsmarschen (Mendelssohn)","Old MacDonald","Greensleeves","Ode till glädjen"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Bröllopsmarschen (Mendelssohn).","d":"medium","audio":"media-packs/audio/melody-15.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Brudkören (Wagner)","London Bridge","Blinka lilla stjärna","Für Elise"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Brudkören (Wagner).","d":"medium","audio":"media-packs/audio/melody-16.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Can-Can","Den blå Donau","London Bridge","When the Saints Go Marching In"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Can-Can.","d":"medium","audio":"media-packs/audio/melody-17.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["I bergakungens sal","Camptown Races","Can-Can","Brudkören (Wagner)"],"r":0,"f":"Klippet är en egen syntetisk inspelning av I bergakungens sal.","d":"medium","audio":"media-packs/audio/melody-18.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Morgonstämning","Oh! Susanna","Greensleeves","Für Elise"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Morgonstämning.","d":"medium","audio":"media-packs/audio/melody-19.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Den blå Donau","Old MacDonald","Broder Jakob","Yankee Doodle"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Den blå Donau.","d":"medium","audio":"media-packs/audio/melody-20.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Greensleeves","Can-Can","Ode till glädjen","I bergakungens sal"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Greensleeves.","d":"medium","audio":"media-packs/audio/melody-21.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Oh! Susanna","Amazing Grace","Brudkören (Wagner)","Old MacDonald"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Oh! Susanna.","d":"medium","audio":"media-packs/audio/melody-22.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["Camptown Races","Jingle Bells","Morgonstämning","London Bridge"],"r":0,"f":"Klippet är en egen syntetisk inspelning av Camptown Races.","d":"medium","audio":"media-packs/audio/melody-23.ogg"},{"c":"Musikquiz","q":"Vilken melodi hör du?","a":["When the Saints Go Marching In","Broder Jakob","Den blå Donau","Can-Can"],"r":0,"f":"Klippet är en egen syntetisk inspelning av When the Saints Go Marching In.","d":"medium","audio":"media-packs/audio/melody-24.ogg"}];
for(const q of CURATED_MEDIA_QUESTIONS)QUIZ_QUESTIONS.push({id:`q${QUIZ_QUESTIONS.length+1}`,...q});

/* v2.7.5 exact duplicate guard.
   A visual question with the same wording but a different image remains a different question.
   Only truly identical content is removed. */
{
  const seenContent=new Set();
  for(let i=QUIZ_QUESTIONS.length-1;i>=0;i--){
    const q=QUIZ_QUESTIONS[i];
    const key=JSON.stringify([
      String(q.q||'').trim().toLocaleLowerCase('sv-SE'),
      String(q.visual||''),
      String(q.audio||''),
      [...q.a].map(x=>String(x).trim().toLocaleLowerCase('sv-SE')).sort()
    ]);
    if(seenContent.has(key))QUIZ_QUESTIONS.splice(i,1);
    else seenContent.add(key);
  }
  QUIZ_QUESTIONS.forEach((q,i)=>q.id=`q${i+1}`);
}

for(const q of QUIZ_QUESTIONS){if(/^(Snabbräkning|Huvudräkning|Multiplikation|Tidsomvandling|Längdomvandling)\s+\d+:/i.test(q.q))q.c='Hjärngympa';}
const VISUAL_ASSET_MAP={"🇸🇪":"visuals/1f1f8-1f1ea.png","🇳🇴":"visuals/1f1f3-1f1f4.png","🇩🇰":"visuals/1f1e9-1f1f0.png","🇫🇮":"visuals/1f1eb-1f1ee.png","🇮🇸":"visuals/1f1ee-1f1f8.png","🇩🇪":"visuals/1f1e9-1f1ea.png","🇫🇷":"visuals/1f1eb-1f1f7.png","🇪🇸":"visuals/1f1ea-1f1f8.png","🇵🇹":"visuals/1f1f5-1f1f9.png","🇮🇹":"visuals/1f1ee-1f1f9.png","🇬🇷":"visuals/1f1ec-1f1f7.png","🇮🇪":"visuals/1f1ee-1f1ea.png","🇬🇧":"visuals/1f1ec-1f1e7.png","🇳🇱":"visuals/1f1f3-1f1f1.png","🇧🇪":"visuals/1f1e7-1f1ea.png","🇦🇹":"visuals/1f1e6-1f1f9.png","🇨🇭":"visuals/1f1e8-1f1ed.png","🇵🇱":"visuals/1f1f5-1f1f1.png","🇨🇿":"visuals/1f1e8-1f1ff.png","🇭🇺":"visuals/1f1ed-1f1fa.png","🇭🇷":"visuals/1f1ed-1f1f7.png","🇸🇮":"visuals/1f1f8-1f1ee.png","🇷🇸":"visuals/1f1f7-1f1f8.png","🇷🇴":"visuals/1f1f7-1f1f4.png","🇧🇬":"visuals/1f1e7-1f1ec.png","🇪🇪":"visuals/1f1ea-1f1ea.png","🇱🇻":"visuals/1f1f1-1f1fb.png","🇱🇹":"visuals/1f1f1-1f1f9.png","🇨🇦":"visuals/1f1e8-1f1e6.png","🇺🇸":"visuals/1f1fa-1f1f8.png","🇲🇽":"visuals/1f1f2-1f1fd.png","🇧🇷":"visuals/1f1e7-1f1f7.png","🇦🇷":"visuals/1f1e6-1f1f7.png","🇨🇱":"visuals/1f1e8-1f1f1.png","🇵🇪":"visuals/1f1f5-1f1ea.png","🇯🇵":"visuals/1f1ef-1f1f5.png","🇰🇷":"visuals/1f1f0-1f1f7.png","🇨🇳":"visuals/1f1e8-1f1f3.png","🇮🇳":"visuals/1f1ee-1f1f3.png","🇹🇭":"visuals/1f1f9-1f1ed.png","🇻🇳":"visuals/1f1fb-1f1f3.png","🇦🇺":"visuals/1f1e6-1f1fa.png","🇳🇿":"visuals/1f1f3-1f1ff.png","🇪🇬":"visuals/1f1ea-1f1ec.png","🇰🇪":"visuals/1f1f0-1f1ea.png","🇲🇦":"visuals/1f1f2-1f1e6.png","🇹🇷":"visuals/1f1f9-1f1f7.png","🇸🇦":"visuals/1f1f8-1f1e6.png","🇦🇪":"visuals/1f1e6-1f1ea.png","🇿🇦":"visuals/1f1ff-1f1e6.png","🦥":"visuals/1f9a5.png","🦦":"visuals/1f9a6.png","🦔":"visuals/1f994.png","🦩":"visuals/1f9a9.png","🦚":"visuals/1f99a.png","🦡":"visuals/1f9a1.png","🦨":"visuals/1f9a8.png","🦙":"visuals/1f999.png","🦘":"visuals/1f998.png","🦛":"visuals/1f99b.png","🥝":"visuals/1f95d.png","🍍":"visuals/1f34d.png","🥨":"visuals/1f968.png","🥟":"visuals/1f95f.png","🪃":"visuals/1fa83.png","🪗":"visuals/1fa97.png","🪕":"visuals/1fa95.png","🪀":"visuals/1fa80.png","🛺":"visuals/1f6fa.png","🚠":"visuals/1f6a0.png"};
for(const q of QUIZ_QUESTIONS){if(q.visual&&VISUAL_ASSET_MAP[q.visual])q.visual=VISUAL_ASSET_MAP[q.visual];}
window.QUIZ_QUESTIONS=QUIZ_QUESTIONS;
window.PARTY_PROMPTS=partyPrompts;
