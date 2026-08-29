const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const admin=fs.readFileSync(path.join(root,'public','admin.js'),'utf8');
const studio=fs.readFileSync(path.join(root,'public','studio.js'),'utf8');
const stats=fs.readFileSync(path.join(root,'public','statistics.js'),'utf8');
const leagues=fs.readFileSync(path.join(root,'public','leagues.js'),'utf8');
const checks=[
 ['auth file',server.includes("ADMIN_AUTH_FILE=path.join(DATA_DIR,'admin-auth.json')")],
 ['scrypt',server.includes('crypto.scrypt(')||server.includes('crypto.scryptSync')],
 ['setup endpoint',server.includes("app.post('/api/admin/setup'")],
 ['password login',server.includes("app.post('/api/admin/login'")&&server.includes('validPassword(password,auth)')],
 ['recovery endpoint',server.includes("app.post('/api/admin/recover'")],
 ['change password',server.includes("app.post('/api/admin/change-password'")],
 ['HttpOnly cookie',server.includes('HttpOnly; SameSite=Strict')],
 ['admin setup UI',admin.includes('Skapa administratörskonto')],
 ['admin password UI',admin.includes('Logga in')&&admin.includes('changePassword')],
 ['no admin key localStorage',![admin,studio,stats,leagues].some(s=>s.includes('rq-admin-key'))],
 ['no admin key URL',![studio,stats,leagues].some(s=>s.includes("'key='+encodeURIComponent"))]
];
for(const [name,ok] of checks){if(!ok){console.error('FAIL',name);process.exitCode=1}else console.log('OK',name)}
if(!process.exitCode)console.log('Admin account authentication integrity OK');
