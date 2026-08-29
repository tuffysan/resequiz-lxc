# Resequiz 17.5 – Unique Fact Integrity

Den här versionen löser kvalitetsproblemet i 17.3/17.4: 1 000 frågeformuleringar får inte längre beskrivas som 1 000 unika fakta.

## Ändringar
- Adminstatistik visar frågor, unika fakta, mål 1 000 och återstående gap per kategori.
- Nytt test `npm run test:unique-facts`.
- `factKey` är den kanoniska identiteten för ett faktum; varianter räknas inte som nya fakta.
- Smart no-repeat använder fortsatt factKey så samma faktum inte återkommer via annan formulering.
- Världen och Hjärngympa är undantagna från 1 000-målet.

## Faktisk status
- 80/90/00-talet: 1000 frågor, 59 unika fakta
- Allmänbildning: 1000 frågor, 136 unika fakta
- Bildrunda: 1000 frågor, 166 unika fakta
- Djur & natur: 1000 frågor, 120 unika fakta
- Film & TV: 1000 frågor, 84 unika fakta
- Fotboll: 1000 frågor, 88 unika fakta
- Historia: 1000 frågor, 82 unika fakta
- Mat & dryck: 1000 frågor, 77 unika fakta
- Musik: 1000 frågor, 77 unika fakta
- Musikquiz: 1000 frågor, 66 unika fakta
- Onödigt vetande: 1000 frågor, 67 unika fakta
- Resor: 1000 frågor, 308 unika fakta
- Sport: 1000 frågor, 75 unika fakta
- Sverige: 1000 frågor, 93 unika fakta
- Vetenskap & teknik: 1000 frågor, 161 unika fakta

Målet är 1 000 verkligt olika, verifierade fakta per kategori. Version 17.5 påstår inte att detta är uppnått där det inte är det.
