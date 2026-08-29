# Resequiz 16.4 – Admin Statistics Center

Ny skyddad adminsida `statistics.html` som samlar statistik från verklig spelhistorik, frågemätvärden, feedback och Question Health.

## Visar
- Totalt antal spelkvällar, unika spelare, deltaganden, svar, rättprocent, frågor och kategorier.
- Aktiva rum, anslutna spelare, genomsnittlig svarstid och feedback.
- Question Health: verifierade, spelbeprövade, review, anomalier och karantän.
- Kategorifördelning och faktisk träffsäkerhet per kategori.
- Användning per spelläge och aktivitet för de senaste 30 aktiva speldagarna.
- Spelartopplista: spel, vinster, vinstprocent, poäng, träffsäkerhet, streak och svarstid.
- Frågestatistik: mest spelade, svåraste, lättaste, bäst betyg och flaggade frågor.
- Systemstatus: uptime, minne och lagringsmotor.

Statistik-API:t är adminskyddat och finns på `/api/admin/statistics`.
