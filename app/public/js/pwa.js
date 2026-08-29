if('serviceWorker' in navigator){
 window.addEventListener('load',async()=>{
  try{
   const reg=await navigator.serviceWorker.register('/sw.js');
   const offer=worker=>{if(!worker)return;const bar=document.createElement('div');bar.className='update-banner';bar.innerHTML='<b>Ny Quiz-version är redo</b><button type="button">Uppdatera</button>';bar.querySelector('button').onclick=()=>{worker.postMessage({type:'SKIP_WAITING'});location.reload()};document.body.appendChild(bar)};
   if(reg.waiting)offer(reg.waiting);
   reg.addEventListener('updatefound',()=>{const w=reg.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)offer(w)})});
   navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());
  }catch{}
 });
}
