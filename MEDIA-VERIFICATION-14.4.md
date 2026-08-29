# Resequiz 14.4 – Media Verified

Version 14.4 fortsätter den konservativa verifieringsstrategin.

- Aktiva frågor: **8320**
- Återaktiverade efter reproducerbar media-/strukturkontroll: **548**
- Permanent pensionerade mekaniska utfyllnadsfrågor: **322**
- Kvar i karantän: **545**

## Återaktiverat

{
  "Resor": 100,
  "Allmänbildning": 60,
  "Bildrunda": 340,
  "Musikquiz": 48
}

Bild- och ljudfrågor återförs endast när den paketerade mediafilen finns och facit kan knytas till den interna mediamappningen. Reseflaggor kontrolleras mot land-/flaggmappningen. Detta är en annan verifieringstyp än extern faktagranskning och markeras därför separat i metadata.

## Permanent borttaget från spelbanken

{
  "Vetenskap & teknik": 22,
  "Mat & dryck": 100,
  "Sport": 100,
  "Sverige": 100
}

Dessa var huvudsakligen repetitiv huvudräkning eller enhetsomvandling maskerad som ämnesfrågor och sparas endast i `question-retired-low-quality-14.4.json` för spårbarhet.

## Kvar att källgranska

{
  "Musik": 120,
  "Film & TV": 120,
  "Onödigt vetande": 224,
  "Djur & natur": 70,
  "80/90/00-talet": 11
}
