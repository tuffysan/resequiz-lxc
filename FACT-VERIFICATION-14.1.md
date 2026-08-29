# Resequiz 14.1 – Verified Core

14.1 fokuserar på faktisk kontroll av frågebanken i stället för fler funktioner.

## Verifiering

- Hjärngympa räknas om deterministiskt från frågetexten och jämförs med facit.
- Strukturerade Världen-frågor korsjämförs med `CountryInfo`, `pycountry` och Babel/CLDR för huvudstäder, ISO-koder, valuta, telefonlandskod, toppdomän, världsdel, språk och landgränser.
- Flaggfrågor kontrolleras mot ISO alpha-2 och motsvarande Unicode regional-indicator-filnamn.
- 42 nya ersättningsfrågor i Historia och Fotboll har kuraterats mot FN, NASA, US National Archives, IFAB och FIFA.
- Alla övriga frågor märks **Needs review** tills de faktiskt har verifierats.

## Kvalitetsrensning

1 469 lågkvalitativa mallfrågor har tagits bort: huvudräkning som låg i Allmänbildning, matematik maskerad som Historia/Fotboll/Vetenskap, decenniemallar samt frågor om hur många tidszonsrader den interna datakällan råkar lista.

48 gamla svar med det tvetydiga `Amerika` har ändrats till `Nordamerika` eller `Sydamerika`.

## Resultat

- 9 187 frågor i aktiv bank.
- 7 234 verifierade genom reproducerbar eller källbaserad kontroll.
- 1 953 explicit märkta Needs review.
- 0 verifieringsmismatchar i den verifierade kärnan.
- Historia återinförd med 17 källkontrollerade frågor.
- Fotboll återinförd med 25 källkontrollerade frågor.

`app/data/fact-verification-report.json` innehåller hela maskinrapporten och listan över borttagna mallfrågor.
