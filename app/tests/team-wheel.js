const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..','public');
const online=fs.readFileSync(path.join(root,'online.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const wheel=fs.readFileSync(path.join(root,'wheel.html'),'utf8');
const wheeljs=fs.readFileSync(path.join(root,'wheel.js'),'utf8');
const styles=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const checks=[
 ['lobby button',online.includes('id="teamWheel"')],
 ['modal function',online.includes('function openTeamWheel()')],
 ['apply teams',online.includes('function applyWheelTeams')&&online.includes("socket.emit('setTeam'" )],
 ['preserve wheel teams',online.includes("autoTeams:room.mode==='teams'?!wheelTeamsLocked:true")],
 ['standalone page',wheel.includes('standaloneCanvas')&&wheel.includes('wheel.js?v=1800')],
 ['standalone logic',wheeljs.includes('function spin(')&&wheeljs.includes('Math.random()')],
 ['home link',index.includes('href="wheel.html"')],
 ['wheel styles',styles.includes('.wheel-stage')&&styles.includes('.wheel-team-grid')]
];
let bad=0;for(const [n,ok] of checks){console.log(ok?'OK':'FAIL',n);if(!ok)bad++}if(bad)process.exit(1);
console.log('Team wheel integrity OK');
