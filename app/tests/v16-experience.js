const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const pkg=require(path.join(root,'package.json'));
const checks=[
 ['version',server.includes(`APP_VERSION = '${pkg.version}'`)],
 ['major version',Number(pkg.version.split('.')[0])>=16],
 ['onboarding',index.includes('welcome16')&&index.includes('Starta min första quizkväll')],
 ['effortless CTA',index.includes('STARTA QUIZKVÄLL')],
 ['adaptive health',server.includes('negative-discrimination')&&server.includes('suspicious-distractor')],
 ['backup restore',server.includes('/api/admin/backup')&&server.includes('/api/admin/restore')],
 ['autopilot',server.includes('autopilot-night')],
 ['team collaboration',server.includes('teamCollaborative')],
 ['estimate',server.includes("currentType==='estimate'")],
 ['ratings',server.includes('QUESTION_RATINGS_FILE')],
 ['recovery',server.includes('restoreActiveRooms')]
];
for(const [n,ok] of checks){console.log(ok?'OK ':'FAIL',n);if(!ok)process.exitCode=1}
if(!process.exitCode)console.log(`Resequiz ${pkg.version} experience checks passed.`);
