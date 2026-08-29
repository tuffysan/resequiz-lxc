const fs=require('fs'),path=require('path');
const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
const admin=fs.readFileSync(path.join(__dirname,'..','public','admin.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','public','admin.html'),'utf8');
function ok(x,msg){if(!x){console.error('FAIL',msg);process.exit(1)}}
ok(server.includes('CATEGORY_DISCOVERY_SEEDS'),'category seed map');
ok(server.includes('categoryQuestionDiscovery'),'category discovery engine');
ok(server.includes('/api/admin/question-discovery'),'admin discovery endpoint');
ok(server.includes("rateLimit('question-discovery'"),'rate limiting');
ok(admin.includes('runCategoryDiscovery'),'admin discovery UI handler');
ok(admin.includes('discoveryCategory'),'category picker');
ok(admin.includes('data-discovery-use'),'candidate-to-draft flow');
ok(html.includes('18.0.1'),'version');
console.log('OK category discovery markers');
