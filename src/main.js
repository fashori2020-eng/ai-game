import * as THREE from 'three';
import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
<div id="game">
  <canvas id="scene"></canvas><div class="vignette"></div><div class="grain"></div>
  <header class="topbar">
    <div class="brand"><div class="brand-icon"><span>✦</span></div><div><strong>عملیات افق</strong><small>OPERATION HORIZON</small></div></div>
    <div class="header-center"><span class="live-dot"></span> سامانه دفاع ساحلی <i></i> <span class="mono">TACTICAL SIMULATION</span></div>
    <div class="header-right"><span class="coord mono">26° 34' N &nbsp; 56° 15' E</span><span class="divider"></span><span class="status"><b></b> سامانه آنلاین</span></div>
  </header>
  <main class="hud">
    <section class="left-column">
      <div class="eyebrow"><span class="small-square"></span> مرکز عملیات <span class="line"></span> <span class="mono">01 / 03</span></div>
      <div class="mission-title"><span class="overline">مأموریت ویژه</span><h1>شکار در<br/><em>افق آبی</em></h1><p>ناو دشمن در محدوده شناسایی شد.<br/>آماده درگیری با هدف باشید.</p></div>
      <div class="mission-card"><div class="card-top"><span>هدف اصلی</span><span class="target-id mono">TARGET 01</span></div><div class="ship-icon">⌁</div><h3>ناو آبراهام لینکلن</h3><p class="mono">USS ABRAHAM LINCOLN · CVN-72</p><div class="health-label"><span>وضعیت هدف</span><strong id="healthText">۱۰۰٪</strong></div><div class="health-track"><div id="healthBar"></div></div><div class="card-footer"><span><b class="red-dot"></b> هدف شناسایی شد</span><span class="mono">HOSTILE</span></div></div>
      <div class="left-bottom"><span class="tiny-label">وضعیت میدان نبرد</span><div class="weather"><span class="weather-icon">◌</span><div><strong>دریای آرام</strong><small>دید مناسب · باد ملایم</small></div><span class="weather-temp mono">27°</span></div></div>
    </section>
    <div class="center-ui"><div class="top-center"><span class="cross-small">✣</span> منطقه عملیاتی خلیج فارس <span class="cross-small">✣</span></div><div id="aim" class="reticle"><div class="reticle-ring"></div><div class="reticle-inner"></div><span class="r-top"></span><span class="r-bottom"></span><span class="r-left"></span><span class="r-right"></span><div class="reticle-label"><b>هدف قفل شد</b><small class="mono">TARGET LOCKED</small></div></div><div id="message" class="message">هدف را نشانه بگیرید</div><div class="range"><span class="mono">● &nbsp; LIVE FEED</span><span>تصویر زنده ماهواره‌ای</span></div></div>
    <section class="right-column"><div class="panel-head"><div><span class="overline">تجهیزات عملیاتی</span><h2>انتخاب موشک</h2></div><span class="panel-number mono">02</span></div><p class="panel-desc">موشک مورد نظر خود را انتخاب کنید · برای بیشتر اسکرول کنید</p><div id="missiles" class="missile-list"></div><div class="selection-info"><span>موشک انتخاب شده</span><strong id="selectedName">خلیج فارس</strong><small id="selectedEn" class="mono">KHALIJ FARS</small><div class="stats"><div><span>قدرت تخریب</span><b id="power">۸۵٪</b><div><i id="powerBar" style="width:85%"></i></div></div><div><span>سرعت</span><b id="speed">۷۵٪</b><div><i id="speedBar" style="width:75%"></i></div></div></div></div></section>
  </main>
  <footer class="bottom-bar"><div class="bottom-left"><div class="key">⌖</div><div><b>نشانه‌گیری</b><small>با حرکت نشانگر</small></div><div class="key space">SPACE</div><div><b>شلیک موشک</b><small>یا دکمه شلیک</small></div></div><div class="bottom-mid"><span class="mono">SYSTEM READY</span><span class="signal">▂▄▆█</span></div><button id="fire" class="fire-button"><span class="fire-icon">✦</span><span><b>شلیک موشک</b><small>LAUNCH MISSILE</small></span><span class="arrow">←</span></button></footer>
  <div class="mobile-hint">برای نشانه‌گیری روی تصویر لمس کنید</div>
  <div id="result" class="result hidden"><div class="result-box"><div class="result-mark">✦</div><span class="overline">MISSION COMPLETE</span><h2>هدف منهدم شد!</h2><p>مأموریت با موفقیت به پایان رسید.</p><button id="restart">شروع دوباره <span>↻</span></button></div></div>
</div>`;

const missiles = [
 {name:'خلیج فارس',en:'KHALIJ FARS',type:'بالستیک ضد کشتی',power:85,speed:75,damage:35, color:'#e6b15d'},
 {name:'نور',en:'NOOR',type:'کروز ضد کشتی',power:65,speed:68,damage:25, color:'#b4c5b8'},
 {name:'قادر',en:'GHADER',type:'کروز دریایی',power:75,speed:72,damage:30, color:'#a6b7ab'},
 {name:'فتاح',en:'FATTAH',type:'موشک هایپرسونیک',power:95,speed:95,damage:50, color:'#c3c9b4'},
 {name:'ذوالفقار',en:'ZOLFAGHAR',type:'بالستیک',power:80,speed:80,damage:32, color:'#aab9a6'},
 {name:'قیام',en:'QIAM',type:'بالستیک',power:78,speed:70,damage:30, color:'#c3c9b4'},
 {name:'عماد',en:'EMAD',type:'بالستیک',power:88,speed:78,damage:38, color:'#bdc8b6'},
 {name:'سجیل',en:'SEJJIL',type:'بالستیک',power:92,speed:85,damage:43, color:'#b0beb1'},
 {name:'خرمشهر',en:'KHORRAMSHAHR',type:'بالستیک',power:96,speed:82,damage:45, color:'#a7b7a8'},
 {name:'شهاب ۳',en:'SHAHAB 3',type:'بالستیک',power:82,speed:76,damage:34, color:'#bbc5b6'},
];
let selected = 0, health = 100, firing = false, gameOver = false;
const persian = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const list = document.querySelector('#missiles');
function missileIcon(i){return `<svg viewBox="0 0 120 28" aria-hidden="true"><path d="M8 14 L25 10 L78 10 L103 12 L114 14 L103 16 L78 18 L25 18 Z" fill="${missiles[i].color}"/><path d="M30 10 L22 4 L41 10 M30 18 L22 24 L41 18 M75 10 L69 6 L83 10 M75 18 L69 22 L83 18" fill="#7c8b82"/><path d="M46 10 V18 M50 10 V18" stroke="#53625b" stroke-width="1"/></svg>`}
function renderMissiles(){list.innerHTML=missiles.map((m,i)=>`<button class="missile ${i===selected?'active':''}" data-index="${i}"><div class="missile-copy"><strong>${m.name}</strong><small>${m.type}</small></div><div class="missile-art">${missileIcon(i)}<span class="mono">${m.en}</span></div><span class="select-dot"></span></button>`).join(''); list.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{selected=+btn.dataset.index; updateSelection();}));}
function updateSelection(){let m=missiles[selected];renderMissiles();document.querySelector('#selectedName').textContent=m.name;document.querySelector('#selectedEn').textContent=m.en;document.querySelector('#power').textContent=persian(m.power)+'٪';document.querySelector('#speed').textContent=persian(m.speed)+'٪';document.querySelector('#powerBar').style.width=m.power+'%';document.querySelector('#speedBar').style.width=m.speed+'%';}
updateSelection();

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false}); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.setSize(innerWidth,innerHeight); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0x9da9a4,0.0024);
const camera=new THREE.PerspectiveCamera(39,innerWidth/innerHeight,1,1800); camera.position.set(123,83,150); camera.lookAt(0,1,0);
const hemi=new THREE.HemisphereLight(0xd9e4d9,0x31494b,2.1); scene.add(hemi); const sun=new THREE.DirectionalLight(0xffe7ba,2.8); sun.position.set(-100,150,-100); scene.add(sun);
// Atmospheric sky, painted procedurally to keep the scene self-contained.
const skyCanvas=document.createElement('canvas'); skyCanvas.width=8;skyCanvas.height=512;const sx=skyCanvas.getContext('2d');const grad=sx.createLinearGradient(0,0,0,512);grad.addColorStop(0,'#536c70');grad.addColorStop(.38,'#899b98');grad.addColorStop(.7,'#d3c7aa');grad.addColorStop(1,'#8c9d97');sx.fillStyle=grad;sx.fillRect(0,0,8,512);const skyTex=new THREE.CanvasTexture(skyCanvas);skyTex.colorSpace=THREE.SRGBColorSpace;scene.background=skyTex;
// Sea
const waterGeo=new THREE.PlaneGeometry(1800,1800,130,130); waterGeo.rotateX(-Math.PI/2); const waterMat=new THREE.MeshStandardMaterial({color:0x315558,roughness:.62,metalness:.28,flatShading:true});const water=new THREE.Mesh(waterGeo,waterMat);water.position.y=-3;scene.add(water);const waterBase=waterGeo.attributes.position.array.slice();
// distant low mountainous coastline
const landMat=new THREE.MeshStandardMaterial({color:0x7f8a7c,roughness:1}); for(let i=0;i<20;i++){let mountain=new THREE.Mesh(new THREE.ConeGeometry(30+Math.random()*45,10+Math.random()*15,5),landMat); mountain.position.set(-500+i*55,-1,-260-Math.random()*70);mountain.scale.z=.45;scene.add(mountain)}
const ship=new THREE.Group();scene.add(ship);
const hullMat=new THREE.MeshStandardMaterial({color:0x586665,roughness:.85,metalness:.18});const deckMat=new THREE.MeshStandardMaterial({color:0x59625f,roughness:.92});const darkMat=new THREE.MeshStandardMaterial({color:0x394746,roughness:.9});const lightMat=new THREE.MeshStandardMaterial({color:0xa8b1a5,roughness:.8});
function box(w,h,d,mat,x,y,z,parent=ship){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh}
// carrier hull, angled bow and stern
const hullShape=new THREE.Shape();hullShape.moveTo(-52,-10);hullShape.lineTo(-47,-14);hullShape.lineTo(34,-14);hullShape.lineTo(53,-6);hullShape.lineTo(58,0);hullShape.lineTo(53,6);hullShape.lineTo(34,14);hullShape.lineTo(-47,14);hullShape.lineTo(-52,10);hullShape.closePath();
function horizontal(shape,depth,mat,y){const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});geo.rotateX(Math.PI/2);const mesh=new THREE.Mesh(geo,mat);mesh.position.y=y;ship.add(mesh);return mesh}
horizontal(hullShape,8,hullMat,6);
const deckShape=new THREE.Shape();deckShape.moveTo(-56,-15);deckShape.lineTo(-48,-18);deckShape.lineTo(38,-18);deckShape.lineTo(57,-8);deckShape.lineTo(61,0);deckShape.lineTo(56,8);deckShape.lineTo(38,15);deckShape.lineTo(-45,15);deckShape.lineTo(-56,11);deckShape.closePath();horizontal(deckShape,1.2,deckMat,7.2);
// hull side accents
box(75,.35,.25,darkMat,-5,2,14.05);box(75,.35,.25,darkMat,-5,2,-14.05);
for(let x=-43;x<42;x+=9){box(4,1.2,.3,darkMat,x,3.8,14.08);box(4,1.2,.3,darkMat,x,3.8,-14.08)}
// deck markings, lines and landing area
const white=new THREE.MeshBasicMaterial({color:0xc7c6ae}); const yellow=new THREE.MeshBasicMaterial({color:0xd9ba6e});
function stripe(x,z,length,width,mat=white,angle=0){const m=new THREE.Mesh(new THREE.PlaneGeometry(length,width),mat);m.rotation.x=-Math.PI/2;m.rotation.z=angle;m.position.set(x,7.24,z);ship.add(m)}
stripe(0,-9,96,.18);stripe(0,9,90,.18);stripe(-7,3,72,.24,white,-.055);stripe(-7,5,72,.15,white,-.055);
for(let x=-43;x<42;x+=9){stripe(x,-2,4,.24);stripe(x,-11,2,.12,yellow)}
for(let z=-9;z<8;z+=3)stripe(39,z,8,.13,yellow);
// island superstructure
box(24,4,6,hullMat,-4,9,11);box(17,5,5,hullMat,-2,13,11);box(13,4,4.8,lightMat,-1,17.5,11);box(15,.8,6,darkMat,-1,20,11);box(9,3,3.5,hullMat,-1,22,11);box(11,.6,4,darkMat,-1,23.8,11);
// bridge windows
for(let x=-6;x<5;x+=2.1)box(1.5,1.1,.12,darkMat,x,18,8.55);
box(1,10,1,darkMat,0,28,11);box(8,.35,.35,darkMat,0,32,11);box(.3,.3,6,darkMat,0,30,11);const radar=new THREE.Mesh(new THREE.SphereGeometry(1.5,12,8),lightMat);radar.position.set(-6,24.5,11);ship.add(radar);
// deck aircraft
function aircraft(x,z,rotation=0,scale=1){const g=new THREE.Group();g.position.set(x,7.5,z);g.rotation.y=rotation;g.scale.setScalar(scale);ship.add(g);box(7,.35,1,darkMat,0,.4,0,g);const nose=new THREE.Mesh(new THREE.ConeGeometry(.5,2.8,4),lightMat);nose.rotation.z=-Math.PI/2;nose.position.set(4.7,.4,0);g.add(nose);const wings=new THREE.Shape();wings.moveTo(-1,-.4);wings.lineTo(-3,-4);wings.lineTo(-.5,-3.5);wings.lineTo(2,-.4);wings.lineTo(2,.4);wings.lineTo(-.5,3.5);wings.lineTo(-3,4);wings.lineTo(-1,.4);const wg=new THREE.ShapeGeometry(wings);wg.rotateX(-Math.PI/2);const wm=new THREE.Mesh(wg,lightMat);wm.position.y=.45;g.add(wm);box(2,.8,.25,darkMat,-2.6,.9,0,g);const cockpit=new THREE.Mesh(new THREE.SphereGeometry(.55,10,6),darkMat);cockpit.scale.set(1.5,.5,.7);cockpit.position.set(1,.7,0);g.add(cockpit)}
[[-42,-11],[-29,-11],[-16,-11],[1,-12],[17,-12],[-39,8],[-26,8]].forEach(([x,z],i)=>aircraft(x,z,i<5?0:Math.PI,.65));
// escort vessels
function escort(x,z,scale){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);scene.add(g);box(28,4,5,hullMat,0,0,0,g);box(12,3,4,deckMat,-3,3,0,g);box(5,4,3,hullMat,-4,6,0,g);box(.5,7,.5,darkMat,-4,11,0,g);const bow=new THREE.Mesh(new THREE.ConeGeometry(2.5,7,4),hullMat);bow.rotation.z=-Math.PI/2;bow.rotation.y=Math.PI/4;bow.position.set(17,0,0);g.add(bow)}escort(-115,-55,.65);escort(110,-95,.5);
// wakes
const wakeMat=new THREE.MeshBasicMaterial({color:0x9bb7af,transparent:true,opacity:.24,side:THREE.DoubleSide});for(let i=0;i<9;i++){const wake=new THREE.Mesh(new THREE.PlaneGeometry(2+Math.random()*20,.22),wakeMat);wake.rotation.x=-Math.PI/2;wake.position.set(-60-Math.random()*50,-2.85,(Math.random()-.5)*30);scene.add(wake)}
let clock=new THREE.Clock(), projectiles=[], explosions=[];
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2(0,0);let targetPoint=new THREE.Vector3(0,7,0);
function setAim(clientX,clientY){const x=Math.max(innerWidth*.3,Math.min(innerWidth*.7,clientX)); const y=Math.max(innerHeight*.25,Math.min(innerHeight*.76,clientY));pointer.set(x/innerWidth*2-1,-(y/innerHeight)*2+1);raycaster.setFromCamera(pointer,camera);const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-7);raycaster.ray.intersectPlane(plane,targetPoint);const aim=document.querySelector('#aim');aim.style.left=x+'px';aim.style.top=y+'px';}
function showMessage(text){const el=document.querySelector('#message');el.textContent=text;el.classList.add('show');clearTimeout(showMessage.timer);showMessage.timer=setTimeout(()=>el.classList.remove('show'),2000)}
function fire(){if(firing||gameOver)return;firing=true;document.querySelector('#fire').classList.add('busy');showMessage('موشک شلیک شد');const start=new THREE.Vector3(110,-5,150), end=targetPoint.clone();const body=new THREE.Group();const missile=new THREE.Mesh(new THREE.CylinderGeometry(.45,.65,7,12),lightMat);missile.rotation.x=Math.PI/2;body.add(missile);const nose=new THREE.Mesh(new THREE.ConeGeometry(.45,2,12),lightMat);nose.rotation.x=Math.PI/2;nose.position.z=-4.4;body.add(nose);const flame=new THREE.Mesh(new THREE.ConeGeometry(1,5,10),new THREE.MeshBasicMaterial({color:0xffac36}));flame.rotation.x=-Math.PI/2;flame.position.z=5;body.add(flame);scene.add(body);projectiles.push({body,start,end,t:0,trail:[],damage:missiles[selected].damage});}
function explode(pos,damage){for(let i=0;i<24;i++){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.6+Math.random()*1.2,8,6),new THREE.MeshBasicMaterial({color:i%3===0?0xffe0a0:i%3===1?0xff8c28:0x52504a,transparent:true}));mesh.position.copy(pos);scene.add(mesh);explosions.push({mesh,velocity:new THREE.Vector3((Math.random()-.5)*15,Math.random()*16,(Math.random()-.5)*15),life:1+Math.random()});}const hit=Math.abs(pos.x)<60&&Math.abs(pos.z)<19;if(hit){health=Math.max(0,health-damage);document.querySelector('#healthText').textContent=persian(health)+'٪';document.querySelector('#healthBar').style.width=health+'%';showMessage(health?'برخورد موفق به هدف!':'هدف منهدم شد!');if(!health){gameOver=true;setTimeout(()=>document.querySelector('#result').classList.remove('hidden'),1100)}}else showMessage('موشک به دریا برخورد کرد. دوباره هدف بگیرید');}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;const positions=waterGeo.attributes.position;for(let i=0;i<positions.count;i++){const x=waterBase[i*3],z=waterBase[i*3+2];positions.array[i*3+1]=Math.sin(x*.035+t*.7)*.5+Math.cos(z*.05+t*.8)*.4;}positions.needsUpdate=true;waterGeo.computeVertexNormals();ship.position.y=Math.sin(t*.5)*.22;ship.rotation.z=Math.sin(t*.35)*.004;
for(let i=projectiles.length-1;i>=0;i--){let p=projectiles[i];p.t+=dt*.55;const tt=Math.min(p.t,1);const previous=p.body.position.clone();p.body.position.lerpVectors(p.start,p.end,tt);p.body.position.y+=Math.sin(tt*Math.PI)*48;if(tt>.01)p.body.lookAt(p.body.position.clone().add(p.body.position.clone().sub(previous)));if(Math.random()<.65){const smoke=new THREE.Mesh(new THREE.SphereGeometry(.6+Math.random(),7,5),new THREE.MeshBasicMaterial({color:0xd7d0bd,transparent:true,opacity:.5}));smoke.position.copy(p.body.position);scene.add(smoke);p.trail.push(smoke)}p.trail.forEach(s=>{s.material.opacity-=dt*.23;s.scale.multiplyScalar(1+dt*.35)});if(tt>=1){explode(p.end,p.damage);scene.remove(p.body);p.trail.forEach(s=>{scene.remove(s);s.geometry.dispose();s.material.dispose()});projectiles.splice(i,1);firing=false;document.querySelector('#fire').classList.remove('busy')}}
for(let i=explosions.length-1;i>=0;i--){let e=explosions[i];e.life-=dt;e.mesh.position.addScaledVector(e.velocity,dt);e.velocity.y-=dt*5;e.mesh.scale.multiplyScalar(1+dt);e.mesh.material.opacity=Math.max(0,e.life);if(e.life<=0){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();explosions.splice(i,1)}}renderer.render(scene,camera)}animate();
function resize(){camera.aspect=innerWidth/innerHeight;const scale=innerWidth<600?1.7:1;camera.position.set(123*scale,83*scale,150*scale);camera.lookAt(0,1,0);camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)} window.addEventListener('resize',resize);resize();
canvas.addEventListener('pointermove',e=>setAim(e.clientX,e.clientY));canvas.addEventListener('pointerdown',e=>setAim(e.clientX,e.clientY));document.querySelector('#fire').addEventListener('click',fire);window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();fire()}});document.querySelector('#restart').addEventListener('click',()=>{health=100;gameOver=false;document.querySelector('#healthText').textContent='۱۰۰٪';document.querySelector('#healthBar').style.width='100%';document.querySelector('#result').classList.add('hidden');showMessage('مأموریت جدید آغاز شد')});
