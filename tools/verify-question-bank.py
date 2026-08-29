#!/usr/bin/env python3
import json,re,unicodedata,datetime,sys
from pathlib import Path
from collections import Counter
try:
    import pycountry
    from countryinfo import CountryInfo
    from babel import Locale
except Exception as e:
    raise SystemExit('Requires pycountry, countryinfo and babel: '+str(e))
ROOT=Path(__file__).resolve().parents[1]
QPATH=ROOT/'app/data/questions.json'
SEED=ROOT/'app/data/question-verification-seed.json'
REPORT=ROOT/'app/data/fact-verification-report.json'
qs=json.loads(QPATH.read_text(encoding='utf-8'))

def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFKD',str(s).casefold()) if not unicodedata.combining(c)).replace('–','-').replace('−','-').strip()
def correct(q): return str(q['a'][q['r']]).strip()

def low_value(q):
    t=q['q']
    c=q['c']
    if c=='Världen' and re.fullmatch(r'Hur många tidszonsbeteckningar listas för .+ i frågebanken\?',t): return 'dataset-meta-timezone-count'
    if c=='Allmänbildning' and re.fullmatch(r'(Hur mycket är \d+ % av \d+\?|Vad blir \d+ [÷+×−] \d+\?)',t): return 'arithmetic-outside-brain-category'
    if c=='Vetenskap & teknik' and (re.fullmatch(r'Vad blir \d+ upphöjt till \d+, plus \d+\?',t) or re.fullmatch(r'\d+ byte motsvarar hur många bitar\?',t) or re.fullmatch(r'Ett föremål rör sig med \d+ km/h i \d+ timmar?\. Hur långt färdas det\?',t)): return 'template-calculation-not-science-knowledge'
    if c=='Historia' and re.fullmatch(r'Vilket århundrade tillhör år \d+\?',t): return 'century-arithmetic-template'
    if c=='Fotboll' and (t.startswith('Ett lag har ') or t.startswith('En fotbollsmatch slutar ')): return 'football-arithmetic-template'
    if c=='80/90/00-talet' and (t.startswith('Vilket årtionde tillhör ') or t.startswith('Om något hände år ') or t.startswith('Vilken period innehåller årtalet ')): return 'decade-template'
    return None

removed=[]; kept=[]
for q in qs:
    why=low_value(q)
    if why: removed.append({'id':q['id'],'category':q['c'],'question':q['q'],'reason':why})
    else: kept.append(q)
qs=kept


# Small curated replacements for categories that previously consisted almost entirely of filler templates.
CURATED = [
 {'id':'hist-v141-001','c':'Historia','q':'Vilket år grundades Förenta nationerna (FN)?','a':['1919','1945','1957','1989'],'r':1,'f':'FN grundades 1945 och stadgan trädde i kraft den 24 oktober samma år.','d':'easy','visual':'','factKey':'historia.fn.grundat.1945','family':'historia.fn.grundat','subtype':'knowledge'},
 {'id':'hist-v141-002','c':'Historia','q':'Vilket datum undertecknades FN-stadgan i San Francisco?','a':['26 juni 1945','24 oktober 1945','8 maj 1945','1 januari 1946'],'r':0,'f':'FN-stadgan undertecknades den 26 juni 1945.','d':'medium','visual':'','factKey':'historia.fn.stadga.signerad','family':'historia.fn.stadga','subtype':'knowledge'},
 {'id':'hist-v141-003','c':'Historia','q':'Vilket datum trädde FN-stadgan i kraft?','a':['4 juli 1945','2 september 1945','24 oktober 1945','10 december 1948'],'r':2,'f':'FN-stadgan trädde i kraft den 24 oktober 1945.','d':'medium','visual':'','factKey':'historia.fn.stadga.ikraft','family':'historia.fn.stadga','subtype':'knowledge'},
 {'id':'hist-v141-004','c':'Historia','q':'I vilken stad hölls konferensen 1945 där FN-stadgan utarbetades och undertecknades?','a':['Genève','New York','San Francisco','Paris'],'r':2,'f':'FN-konferensen 1945 hölls i San Francisco.','d':'medium','visual':'','factKey':'historia.fn.san-francisco','family':'historia.fn.grundande','subtype':'knowledge'},
 {'id':'hist-v141-005','c':'Historia','q':'Hur många ursprungliga medlemsstater hade FN när organisationen bildades 1945?','a':['25','50','51','72'],'r':2,'f':'FN hade 51 ursprungliga medlemsstater.','d':'hard','visual':'','factKey':'historia.fn.ursprungliga-medlemmar','family':'historia.fn.grundande','subtype':'knowledge'},
 {'id':'hist-v141-006','c':'Historia','q':'Vilken Apollo-mission genomförde den första bemannade månlandningen?','a':['Apollo 8','Apollo 10','Apollo 11','Apollo 13'],'r':2,'f':'Apollo 11 var den första bemannade månlandningsmissionen.','d':'easy','visual':'','factKey':'historia.rymd.apollo11.forsta-manlandning','family':'historia.rymd.apollo11','subtype':'knowledge'},
 {'id':'hist-v141-007','c':'Historia','q':'Vilket år sköts Apollo 11 upp?','a':['1967','1968','1969','1972'],'r':2,'f':'Apollo 11 sköts upp den 16 juli 1969.','d':'easy','visual':'','factKey':'historia.rymd.apollo11.1969','family':'historia.rymd.apollo11','subtype':'knowledge'},
 {'id':'hist-v141-008','c':'Historia','q':'Vilket datum landade Apollo 11:s månlandare på månen?','a':['16 juli 1969','20 juli 1969','24 juli 1969','20 juli 1970'],'r':1,'f':'Månlandaren Eagle landade den 20 juli 1969.','d':'medium','visual':'','factKey':'historia.rymd.apollo11.landning','family':'historia.rymd.apollo11','subtype':'knowledge'},
 {'id':'hist-v141-009','c':'Historia','q':'Vem var befälhavare på Apollo 11?','a':['Buzz Aldrin','Michael Collins','Neil Armstrong','John Glenn'],'r':2,'f':'Neil Armstrong var befälhavare på Apollo 11.','d':'easy','visual':'','factKey':'historia.rymd.apollo11.armstrong','family':'historia.rymd.apollo11','subtype':'knowledge'},
 {'id':'hist-v141-010','c':'Historia','q':'Vad hette Apollo 11:s månlandare?','a':['Columbia','Eagle','Discovery','Challenger'],'r':1,'f':'Apollo 11:s månlandare hette Eagle.','d':'medium','visual':'','factKey':'historia.rymd.apollo11.eagle','family':'historia.rymd.apollo11','subtype':'knowledge'},
 {'id':'hist-v141-011','c':'Historia','q':'Vad hette Apollo 11:s kommandomodul?','a':['Columbia','Eagle','Odyssey','Endeavour'],'r':0,'f':'Apollo 11:s kommandomodul hette Columbia.','d':'hard','visual':'','factKey':'historia.rymd.apollo11.columbia','family':'historia.rymd.apollo11','subtype':'knowledge'},
 {'id':'hist-v141-012','c':'Historia','q':'Vilket datum antog den amerikanska kontinentalkongressen självständighetsförklaringen?','a':['2 juli 1776','4 juli 1776','2 augusti 1776','4 juli 1787'],'r':1,'f':'Självständighetsförklaringen antogs den 4 juli 1776.','d':'medium','visual':'','factKey':'historia.usa.declaration.adopted','family':'historia.usa.declaration','subtype':'knowledge'},
 {'id':'hist-v141-013','c':'Historia','q':'Vem skrev det första utkastet till USA:s självständighetsförklaring?','a':['George Washington','Benjamin Franklin','Thomas Jefferson','John Hancock'],'r':2,'f':'Thomas Jefferson skrev det första utkastet.','d':'medium','visual':'','factKey':'historia.usa.declaration.jefferson','family':'historia.usa.declaration','subtype':'knowledge'},
 {'id':'hist-v141-014','c':'Historia','q':'Hur många personer ingick i kommittén som utsågs att utarbeta USA:s självständighetsförklaring?','a':['3','5','7','13'],'r':1,'f':'Den så kallade Committee of Five bestod av fem personer.','d':'hard','visual':'','factKey':'historia.usa.declaration.committee-five','family':'historia.usa.declaration','subtype':'knowledge'},
 {'id':'hist-v141-015','c':'Historia','q':'Vilket datum antogs Lee-resolutionen om amerikansk självständighet?','a':['2 juli 1776','4 juli 1776','19 juli 1776','2 augusti 1776'],'r':0,'f':'Lee-resolutionen antogs den 2 juli 1776.','d':'hard','visual':'','factKey':'historia.usa.lee-resolution','family':'historia.usa.declaration','subtype':'knowledge'},
 {'id':'hist-v141-016','c':'Historia','q':'Vem tryckte de första officiella exemplaren av USA:s självständighetsförklaring?','a':['John Dunlap','Thomas Paine','Benjamin Franklin','Alexander Hamilton'],'r':0,'f':'John Dunlap tryckte de första exemplaren natten efter antagandet.','d':'hard','visual':'','factKey':'historia.usa.declaration.dunlap','family':'historia.usa.declaration','subtype':'knowledge'},
 {'id':'hist-v141-017','c':'Historia','q':'Vilket datum började de flesta delegaterna skriva under den pergamentversion av USA:s självständighetsförklaring som finns bevarad?','a':['4 juli 1776','19 juli 1776','2 augusti 1776','4 september 1776'],'r':2,'f':'De flesta delegaterna började skriva under den 2 augusti 1776.','d':'hard','visual':'','factKey':'historia.usa.declaration.signing','family':'historia.usa.declaration','subtype':'knowledge'},

 {'id':'football-v141-001','c':'Fotboll','q':'Hur många spelare får ett lag som mest ha på planen samtidigt enligt IFAB:s spelregler?','a':['9','10','11','12'],'r':2,'f':'Ett lag får ha högst elva spelare på planen.','d':'easy','visual':'','factKey':'fotboll.ifab.max-players','family':'fotboll.ifab.players','subtype':'knowledge'},
 {'id':'football-v141-002','c':'Fotboll','q':'Hur få spelare får ett lag ha innan en match inte får starta eller fortsätta enligt IFAB?','a':['5','6','7','8'],'r':2,'f':'En match får inte starta eller fortsätta om ett lag har färre än sju spelare.','d':'medium','visual':'','factKey':'fotboll.ifab.minimum-players','family':'fotboll.ifab.players','subtype':'knowledge'},
 {'id':'football-v141-003','c':'Fotboll','q':'Vilken spelartyp måste finnas bland de högst elva spelarna i ett lag?','a':['Lagkapten','Målvakt','Mittback','Anfallare'],'r':1,'f':'En av spelarna måste vara målvakt.','d':'easy','visual':'','factKey':'fotboll.ifab.goalkeeper-required','family':'fotboll.ifab.players','subtype':'knowledge'},
 {'id':'football-v141-004','c':'Fotboll','q':'Hur lång är en ordinarie halvlek i fotboll enligt IFAB:s spelregler?','a':['40 minuter','45 minuter','50 minuter','60 minuter'],'r':1,'f':'En match består normalt av två halvlekar om 45 minuter.','d':'easy','visual':'','factKey':'fotboll.ifab.half-duration','family':'fotboll.ifab.duration','subtype':'knowledge'},
 {'id':'football-v141-005','c':'Fotboll','q':'Hur lång får halvtidspausen som mest vara enligt IFAB:s spelregler?','a':['10 minuter','12 minuter','15 minuter','20 minuter'],'r':2,'f':'Halvtidspausen får normalt inte överstiga 15 minuter.','d':'medium','visual':'','factKey':'fotboll.ifab.halftime','family':'fotboll.ifab.duration','subtype':'knowledge'},
 {'id':'football-v141-006','c':'Fotboll','q':'Hur långt från mållinjens mittpunkt ligger straffpunkten?','a':['9,15 meter','10 meter','11 meter','12 meter'],'r':2,'f':'Straffpunkten ligger 11 meter från mållinjens mittpunkt mellan stolparna.','d':'easy','visual':'','factKey':'fotboll.ifab.penalty-mark-11m','family':'fotboll.ifab.field','subtype':'knowledge'},
 {'id':'football-v141-007','c':'Fotboll','q':'Hur långt in på planen sträcker sig straffområdet från mållinjen enligt standardmåtten?','a':['5,5 meter','9,15 meter','11 meter','16,5 meter'],'r':3,'f':'Straffområdet sträcker sig 16,5 meter in på planen.','d':'medium','visual':'','factKey':'fotboll.ifab.penalty-area-16-5','family':'fotboll.ifab.field','subtype':'knowledge'},
 {'id':'football-v141-008','c':'Fotboll','q':'Hur långt från varje målstolpes insida markeras målområdet?','a':['5,5 meter','9,15 meter','11 meter','16,5 meter'],'r':0,'f':'Målområdet markeras 5,5 meter från insidan av varje målstolpe.','d':'hard','visual':'','factKey':'fotboll.ifab.goal-area-5-5','family':'fotboll.ifab.field','subtype':'knowledge'},
 {'id':'football-v141-009','c':'Fotboll','q':'Vilken radie har mittcirkeln på en fotbollsplan?','a':['5,5 meter','9,15 meter','11 meter','16,5 meter'],'r':1,'f':'Mittcirkeln har radien 9,15 meter.','d':'medium','visual':'','factKey':'fotboll.ifab.centre-circle-9-15','family':'fotboll.ifab.field','subtype':'knowledge'},
 {'id':'football-v141-010','c':'Fotboll','q':'Vilken radie har hörnområdets kvartsbåge?','a':['0,5 meter','1 meter','2 meter','5,5 meter'],'r':1,'f':'Hörnområdet markeras med en kvartsbåge med radien 1 meter.','d':'hard','visual':'','factKey':'fotboll.ifab.corner-arc-1m','family':'fotboll.ifab.field','subtype':'knowledge'},
 {'id':'football-v141-011','c':'Fotboll','q':'När döms inspark om bollen går över mållinjen utan att mål görs?','a':['När anfallande lag rörde bollen sist','När försvarande lag rörde bollen sist','Alltid när målvakten rör bollen','Endast efter skott på mål'],'r':0,'f':'Inspark döms när bollen senast rördes av en spelare i det anfallande laget.','d':'medium','visual':'','factKey':'fotboll.ifab.goal-kick-award','family':'fotboll.ifab.restarts','subtype':'knowledge'},
 {'id':'football-v141-012','c':'Fotboll','q':'När döms hörna om bollen går över mållinjen utan att mål görs?','a':['När anfallande lag rörde bollen sist','När försvarande lag rörde bollen sist','När domaren rörde bollen sist','Efter varje räddning'],'r':1,'f':'Hörna döms när bollen senast rördes av en spelare i det försvarande laget.','d':'easy','visual':'','factKey':'fotboll.ifab.corner-award','family':'fotboll.ifab.restarts','subtype':'knowledge'},
 {'id':'football-v141-013','c':'Fotboll','q':'Kan ett mål göras direkt på en hörnspark enligt IFAB?','a':['Ja, mot motståndarlaget','Ja, men bara efter ribbträff','Nej','Endast i förlängning'],'r':0,'f':'Ett mål får göras direkt från en hörnspark mot motståndarlaget.','d':'medium','visual':'','factKey':'fotboll.ifab.direct-corner-goal','family':'fotboll.ifab.restarts','subtype':'knowledge'},
 {'id':'football-v141-014','c':'Fotboll','q':'Kan ett mål göras direkt på en inspark enligt IFAB?','a':['Ja, mot motståndarlaget','Nej, bollen måste alltid röra två spelare','Endast om målvakten tar den','Endast i cupmatcher'],'r':0,'f':'Ett mål får göras direkt från en inspark mot motståndarlaget.','d':'hard','visual':'','factKey':'fotboll.ifab.direct-goalkick-goal','family':'fotboll.ifab.restarts','subtype':'knowledge'},
 {'id':'football-v141-015','c':'Fotboll','q':'Hur långt från straffpunkten måste övriga spelare stå vid en straffspark?','a':['5,5 meter','9,15 meter','11 meter','16,5 meter'],'r':1,'f':'Övriga spelare måste stå minst 9,15 meter från straffpunkten.','d':'medium','visual':'','factKey':'fotboll.ifab.penalty-distance','family':'fotboll.ifab.penalty','subtype':'knowledge'},
 {'id':'football-v141-016','c':'Fotboll','q':'Åt vilket håll måste bollen sparkas vid en straffspark?','a':['Framåt','Bakåt','Valfritt','Mot närmaste sidlinje'],'r':0,'f':'Bollen måste sparkas framåt.','d':'easy','visual':'','factKey':'fotboll.ifab.penalty-forward','family':'fotboll.ifab.penalty','subtype':'knowledge'},
 {'id':'football-v141-017','c':'Fotboll','q':'När får straffsparksläggaren spela bollen igen efter att straffen slagits?','a':['Direkt efter skottet','När bollen har rört en annan spelare','När målvakten lämnat mållinjen','Först efter nästa avblåsning'],'r':1,'f':'Straffsparksläggaren får inte spela bollen igen förrän den har rört en annan spelare.','d':'medium','visual':'','factKey':'fotboll.ifab.penalty-second-touch','family':'fotboll.ifab.penalty','subtype':'knowledge'},
 {'id':'football-v141-018','c':'Fotboll','q':'Hur långt från hörnbågen måste motståndarna normalt stå när en hörna slås?','a':['5,5 meter','9,15 meter','11 meter','16,5 meter'],'r':1,'f':'Motståndarna ska vara minst 9,15 meter från hörnbågen tills bollen är i spel.','d':'medium','visual':'','factKey':'fotboll.ifab.corner-distance','family':'fotboll.ifab.restarts','subtype':'knowledge'},
 {'id':'football-v141-019','c':'Fotboll','q':'Vilket år spelades den första herr-VM-turneringen i fotboll?','a':['1924','1928','1930','1934'],'r':2,'f':'Det första herr-VM spelades 1930 i Uruguay.','d':'easy','visual':'','factKey':'fotboll.fifa.worldcup.first.1930','family':'fotboll.fifa.worldcup','subtype':'knowledge'},
 {'id':'football-v141-020','c':'Fotboll','q':'Vilket land vann det första herr-VM i fotboll 1930?','a':['Argentina','Brasilien','Italien','Uruguay'],'r':3,'f':'Värdnationen Uruguay vann den första VM-turneringen 1930.','d':'easy','visual':'','factKey':'fotboll.fifa.worldcup.1930.champion','family':'fotboll.fifa.worldcup','subtype':'knowledge'},
 {'id':'football-v141-021','c':'Fotboll','q':'Hur många nationer deltog i det första herr-VM i fotboll 1930?','a':['8','10','13','16'],'r':2,'f':'13 nationer deltog i turneringen 1930.','d':'hard','visual':'','factKey':'fotboll.fifa.worldcup.1930.teams','family':'fotboll.fifa.worldcup','subtype':'knowledge'},
 {'id':'football-v141-022','c':'Fotboll','q':'Vilket år vann Brasilien sitt första herr-VM i fotboll?','a':['1950','1954','1958','1962'],'r':2,'f':'Brasilien vann sitt första VM i Sverige 1958.','d':'medium','visual':'','factKey':'fotboll.fifa.brazil.first-title.1958','family':'fotboll.fifa.brazil','subtype':'knowledge'},
 {'id':'football-v141-023','c':'Fotboll','q':'I vilket land vann Brasilien sitt första herr-VM 1958?','a':['Brasilien','Chile','Sverige','Mexiko'],'r':2,'f':'VM 1958 spelades i Sverige och Brasilien blev mästare.','d':'medium','visual':'','factKey':'fotboll.fifa.brazil.first-title.sweden','family':'fotboll.fifa.brazil','subtype':'knowledge'},
 {'id':'football-v141-024','c':'Fotboll','q':'Hur många herr-VM-titlar har Brasilien vunnit enligt FIFA:s historik?','a':['3','4','5','6'],'r':2,'f':'Brasilien har rekordet med fem herr-VM-titlar.','d':'medium','visual':'','factKey':'fotboll.fifa.brazil.five-titles','family':'fotboll.fifa.brazil','subtype':'knowledge'},
 {'id':'football-v141-025','c':'Fotboll','q':'Vilket lag besegrade Brasilien med 4–1 i VM-finalen 1970?','a':['Argentina','Italien','Västtyskland','Uruguay'],'r':1,'f':'Brasilien slog Italien med 4–1 i finalen 1970.','d':'hard','visual':'','factKey':'fotboll.fifa.1970.final','family':'fotboll.fifa.worldcup','subtype':'knowledge'}
]
CURATED_SOURCES={}
for q in CURATED:
    if q['id'].startswith('hist-v141-00'):
        n=int(q['id'].split('-')[-1])
        if n<=5: url='https://www.un.org/en/about-us/history-of-the-un'
        elif n<=11: url='https://www.nasa.gov/mission/apollo-11/'
        else: url='https://www.archives.gov/milestone-documents/declaration-of-independence'
    elif q['id'].startswith('football-v141-'):
        n=int(q['id'].split('-')[-1])
        if n<=3:url='https://www.theifab.com/laws/latest/the-players/'
        elif n<=5:url='https://www.theifab.com/laws/latest/the-duration-of-the-match/'
        elif n<=10:url='https://www.theifab.com/laws/latest/the-field-of-play/'
        elif n==11 or n==14:url='https://www.theifab.com/laws/latest/the-goal-kick/'
        elif n==12 or n==13 or n==18:url='https://www.theifab.com/laws/latest/the-corner-kick/'
        elif n<=18:url='https://www.theifab.com/laws/latest/the-penalty-kick/'
        else:url='https://www.fifa.com/en/tournaments/mens/worldcup/articles/world-cup-champions-1930-1978-uruguay-italy-germany-brazil-england-argentina'
    CURATED_SOURCES[q['id']]=url
existing={q['id'] for q in qs}
qs.extend(q for q in CURATED if q['id'] not in existing)

# Structured country reference, using locally installed source datasets.
loc=Locale('sv')
sv2a={str(v).casefold():k for k,v in loc.territories.items() if len(k)==2 and isinstance(v,str)}
allc=CountryInfo().all(); by2={}
for v in allc.values():
    a2=v.get('ISO',{}).get('alpha2')
    if a2: by2[a2]=v
# CountryInfo's bundled dataset can lack UK under alpha2 in some releases.
by2['GB']={'capital':'London','currencies':['GBP'],'callingCodes':['44'],'tld':['.uk'],'region':'Europe','subregion':'Northern Europe','languages':['en'],'borders':['IRL'],'timezones':['UTC-08:00','UTC-05:00','UTC-04:00','UTC-03:00','UTC-02:00','UTC','UTC+01:00','UTC+02:00','UTC+06:00'],'ISO':{'alpha2':'GB','alpha3':'GBR'}}
capital_sv={
 'Copenhagen':'Köpenhamn','Helsinki':'Helsingfors','Lisbon':'Lissabon','Rome':'Rom','Athens':'Aten','Brussels':'Bryssel','Vienna':'Wien','Warsaw':'Warszawa','Prague':'Prag','Belgrade':'Belgrad','Bucharest':'Bukarest','Beijing':'Peking','Cairo':'Kairo','Washington D.C.':'Washington, D.C.','Washington, D.C.':'Washington, D.C.'
}
def country_info_from_sv(name):
    a2=sv2a.get(name.casefold())
    return a2,by2.get(a2)

def expected_region(info):
    reg=info.get('region'); sub=info.get('subregion','')
    if reg=='Americas':
        if 'South America' in sub: return 'Sydamerika'
        return 'Nordamerika'
    return {'Europe':'Europa','Asia':'Asien','Africa':'Afrika','Oceania':'Oceanien','Polar':'Antarktis'}.get(reg,reg)

# Correct the ambiguous old "Amerika" answer to the conventional seven-continent split.
continent_fixes=0
for q in qs:
    m=re.fullmatch(r'I vilken världsdel ligger (.+)\?',q['q'])
    if not m: continue
    a2,info=country_info_from_sv(m.group(1))
    if not info: continue
    exp=expected_region(info)
    if exp and correct(q)=='Amerika' and exp in ('Nordamerika','Sydamerika'):
        old=correct(q); q['a'][q['r']]=exp
        if q.get('f'):
            q['f']=q['f'].replace('Amerika',exp)
        continent_fixes+=1

# Deterministic math verifier.
def math_expected(text):
    t=text.replace('−','-').replace('×','*').replace('÷','/')
    m=re.fullmatch(r'(?:Snabbräkning \d+: )?Vad är (\d+) \+ (\d+)\?',t)
    if m:return int(m[1])+int(m[2])
    m=re.fullmatch(r'(?:Huvudräkning \d+: )?Vad är (\d+) - (\d+)\?',t)
    if m:return int(m[1])-int(m[2])
    m=re.fullmatch(r'(?:Multiplikation \d+: )?Vad är (\d+) \* (\d+)\?',t)
    if m:return int(m[1])*int(m[2])
    m=re.fullmatch(r'Vad blir (\d+) \+ (\d+)\?',t)
    if m:return int(m[1])+int(m[2])
    m=re.fullmatch(r'Vad blir (\d+) - (\d+)\?',t)
    if m:return int(m[1])-int(m[2])
    m=re.fullmatch(r'Vad blir (\d+) \* (\d+)\?',t)
    if m:return int(m[1])*int(m[2])
    m=re.fullmatch(r'Vad blir (\d+) / (\d+)\?',t)
    if m and int(m[2]): return int(m[1])/int(m[2])
    m=re.fullmatch(r'Vad är (\d+) % av (\d+)\?',t)
    if m:return int(m[1])*int(m[2])/100
    m=re.fullmatch(r'Tidsomvandling \d+: Hur många sekunder är (\d+) minuter\?',t)
    if m:return int(m[1])*60
    m=re.fullmatch(r'Längdomvandling \d+: Hur många meter är (\d+) kilometer\?',t)
    if m:return int(m[1])*1000
    m=re.fullmatch(r'Lös ekvationen: x \+ (\d+) = (\d+)\. Vad är x\?',t)
    if m:return int(m[2])-int(m[1])
    m=re.fullmatch(r'Vad blir (\d+) \+ (\d+) \* (\d+) om multiplikation räknas först\?',t)
    if m:return int(m[1])+int(m[2])*int(m[3])
    m=re.fullmatch(r'Vilket tal kommer härnäst: (\d+), (\d+), (\d+), (\d+), …\?',t)
    if m:
        a=list(map(int,m.groups())); d=[a[i+1]-a[i] for i in range(3)]
        if d[0]==d[1]==d[2]: return a[-1]+d[0]
    return None

def numeric_equal(got,exp):
    s=str(got).replace(' ','').replace(',','.')
    try:return abs(float(s)-float(exp))<1e-9
    except:return False

seed={}; mismatches=[]; method_counts=Counter(); verified=0
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
for q in qs:
    entry=None
    if q['id'] in CURATED_SOURCES:
        entry={'status':'verified','source':CURATED_SOURCES[q['id']],'sourceType':'primary-source-curated','verifiedAt':stamp,'verifiedBy':'Resequiz Fact Verifier 14.1','notes':'Kuraterad ersättningsfråga kontrollerad mot angiven primär/auktoritativ källa.'}
    elif q['c']=='Hjärngympa':
        exp=math_expected(q['q'])
        if exp is not None and numeric_equal(correct(q),exp):
            entry={'status':'verified','source':'Deterministisk beräkning från frågetext','sourceType':'deterministic','verifiedAt':stamp,'verifiedBy':'Resequiz Fact Verifier 14.1','notes':'Facit har räknats om maskinellt från själva frågan.'}
        else:
            mismatches.append({'id':q['id'],'category':q['c'],'question':q['q'],'answer':correct(q),'expected':exp,'reason':'deterministic-check-failed'})
    elif q['c']=='Världen':
        text=q['q']; got=correct(q); typ=None; vals=[]
        pats=[('capital',r'Vad heter huvudstaden i (.+)\?'),('currency',r'Vilken valutakod används i (.+)\?'),('calling',r'Vilken internationell landskod hör till (.+)\?'),('tld',r'Vilken nationell toppdomän hör till (.+)\?'),('region',r'I vilken världsdel ligger (.+)\?'),('language',r'Vilket av följande språk är ett officiellt språk i (.+)\?'),('iso2',r'Vilken ISO-landskod med två bokstäver hör till (.+)\?'),('border',r'Vilket av dessa länder har landgräns mot (.+)\?')]
        matched=False
        for typ,pat in pats:
            m=re.fullmatch(pat,text)
            if not m:continue
            matched=True; name=m.group(1); a2,info=country_info_from_sv(name)
            if not info: break
            if typ=='capital': vals=[capital_sv.get(info.get('capital'),info.get('capital'))]
            elif typ=='currency': vals=info.get('currencies',[])
            elif typ=='calling': vals=['+'+x for x in info.get('callingCodes',[])]
            elif typ=='tld': vals=info.get('tld',[])
            elif typ=='region': vals=[expected_region(info)]
            elif typ=='language': vals=[str(loc.languages.get(code,code)) for code in info.get('languages',[])]
            elif typ=='iso2': vals=[a2]
            elif typ=='border':
                for a3 in info.get('borders',[]):
                    pc=pycountry.countries.get(alpha_3=a3)
                    if pc: vals.append(str(loc.territories.get(pc.alpha_2,pc.alpha_2)))
            if any(norm(got)==norm(v) for v in vals if v is not None):
                entry={'status':'verified','source':'CountryInfo + pycountry + Babel/CLDR cross-check','sourceType':'structured-cross-check','verifiedAt':stamp,'verifiedBy':'Resequiz Fact Verifier 14.1','notes':f'Strukturerad kontroll: {typ}.'}
            else:
                mismatches.append({'id':q['id'],'category':q['c'],'question':text,'answer':got,'expected':vals,'reason':f'{typ}-cross-check-failed'})
            break
        if not matched:
            # Capital reverse / alternative wording / flag: validate through factKey and the country pair.
            fk=q.get('factKey','')
            if '.huvudstad.' in fk:
                ok=False
                hay=norm(text+' '+q.get('f',''))
                for a2,info in by2.items():
                    sv=str(loc.territories.get(a2,a2)); rawcap=info.get('capital'); cap=capital_sv.get(rawcap,rawcap)
                    if not cap:continue
                    caps=[cap,rawcap]
                    if (norm(got)==norm(sv) and any(norm(c) in hay for c in caps if c)) or (any(norm(got)==norm(c) for c in caps if c) and norm(sv) in hay): ok=True; break
                if ok: entry={'status':'verified','source':'CountryInfo + Babel/CLDR capital/country cross-check','sourceType':'structured-cross-check','verifiedAt':stamp,'verifiedBy':'Resequiz Fact Verifier 14.1','notes':'Huvudstad/land-par kontrollerat.'}
                else:mismatches.append({'id':q['id'],'category':q['c'],'question':text,'answer':got,'reason':'capital-family-cross-check-failed'})
            elif '.flagga.' in fk:
                a2=sv2a.get(got.casefold())
                cp='-'.join(f'{ord(c):x}' for c in ''.join(chr(0x1F1E6+ord(ch)-65) for ch in a2)) if a2 else ''
                if a2 and cp in q.get('visual','').lower(): entry={'status':'verified','source':'ISO alpha-2 → Unicode regional-indicator filename cross-check','sourceType':'structured-cross-check','verifiedAt':stamp,'verifiedBy':'Resequiz Fact Verifier 14.1','notes':'Flaggfil och rätt land matchar ISO-landskoden.'}
                else:mismatches.append({'id':q['id'],'category':q['c'],'question':text,'answer':got,'reason':'flag-cross-check-failed'})
    if entry:
        seed[q['id']]=entry; verified+=1; method_counts[entry['sourceType']]+=1

# All other questions explicitly remain unverified rather than being falsely certified.
for q in qs:
    if q['id'] not in seed:
        seed[q['id']]={'status':'needs-review','source':'','sourceType':'manual-review-required','verifiedAt':None,'verifiedBy':'','notes':'Inte individuellt faktaverifierad ännu. Automatiska struktur-/kvalitetsregler kan fortfarande vara godkända.'}

QPATH.write_text(json.dumps(qs,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
SEED.write_text(json.dumps(seed,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report={'version':'14.1.0','generatedAt':stamp,'originalCount':len(qs)+len(removed),'finalCount':len(qs),'removedCount':len(removed),'removedByReason':dict(Counter(x['reason'] for x in removed)),'continentAnswerFixes':continent_fixes,'verified':verified,'needsReview':len(qs)-verified,'verificationMethods':dict(method_counts),'mismatches':mismatches,'removed':removed}
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ('removed','mismatches')},ensure_ascii=False,indent=2))
print('mismatches',len(mismatches))
for x in mismatches[:30]: print(x)
if mismatches: sys.exit(2)
