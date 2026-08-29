const RQ={
  async json(url,options={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);return data},
  esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},
  toast(msg){let e=document.querySelector('.toast');if(!e){e=document.createElement('div');e.className='toast';document.body.appendChild(e)}e.textContent=msg;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>e.hidden=true,2400)},
  name(){return localStorage.getItem('rq-name')||''},setName(v){localStorage.setItem('rq-name',v)},
  nav(active){return `<nav class="mobile-nav" aria-label="Huvudnavigation"><a class="${active==='home'?'active':''}" href="/"><b>⌂</b><span>Hem</span></a><a class="${active==='play'?'active':''}" href="/play.html"><b>▶</b><span>Spela</span></a><a class="${active==='results'?'active':''}" href="/results.html"><b>♛</b><span>Resultat</span></a><a class="${active==='admin'?'active':''}" href="/admin.html"><b>•••</b><span>Meny</span></a></nav>`},
  pct(score,total){return total?Math.round(Number(score||0)/Number(total)*100):0}
};
