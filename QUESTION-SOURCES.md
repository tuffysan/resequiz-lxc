# Question sources – Resequiz 7.1

Resequiz 7.1 contains the original Resequiz question bank plus locally generated questions.

## Structured geography
Additional geography questions are generated from ISO/country metadata exposed by the Python `countryinfo`, `pycountry`/CLDR/Babel datasets. Questions are rendered into Swedish and stored locally; no online API is required during play.

## Hjärngympa
Additional arithmetic, percentages, equations, order-of-operations and number-series questions are generated deterministically by the Resequiz build process.

## Open sources evaluated
Open Trivia DB was evaluated as a future import source. Its question data is CC BY-SA 4.0. It is not bulk-copied into this 7.0 bank, avoiding a mixed-language dump and preserving Swedish UX. Wikidata/CC0 is also suitable for future structured expansion.


## 7.1 balansmotor
Kategoriobalansen i råbanken kompenseras i spelmotorn med kategori-rättvis round-robin. Detta undviker att skapa lågkvalitativa utfyllnadsfrågor bara för att nå identiska råa kategoristorlekar.
