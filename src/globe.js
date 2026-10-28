import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { buildGlobeModel, geographic } from './globe-model.js';

export function mountGlobe(stage, species, onSelect) {
  const host=stage.querySelector('.planet-canvas'), labelLayer=stage.querySelector('.planet-markers');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let disposed=false,frame=0,renderer,controls,observer,intersection,visible=true,inView=true,spinning=!reduced,model;
  const controller=new AbortController();const signal=controller.signal;
  const buttons=[];const vector=new THREE.Vector3();
  let targetCamera=null;
  function spinState(){const b=stage.querySelector('[data-world="spin"]');if(b){b.setAttribute('aria-pressed',String(!spinning));b.setAttribute('aria-label',spinning?'Pause globe rotation':'Resume globe rotation');b.innerHTML=`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="${spinning?'M9 5v14M15 5v14':'m8 4 12 8-12 8V4Z'}"/></svg>`;}}
  const api={dispose(){disposed=true;controller.abort();cancelAnimationFrame(frame);observer?.disconnect();intersection?.disconnect();controls?.dispose();renderer?.dispose();renderer?.forceContextLoss();if(model)model.globe.traverse(o=>{o.geometry?.dispose();if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});host.replaceChildren();labelLayer.replaceChildren();},focus(id){if(!model)return;const s=species.find(x=>x.id===id);if(!s)return;spinning=false;spinState();model.globe.rotation.y=0;targetCamera=geographic(+s.latitude,+s.longitude,7.7);onSelect(s);buttons.forEach(b=>b.classList.toggle('selected',b.dataset.species===id));},getSnapshot(){return {renderer:renderer?'WebGL':'unavailable',rotation:model?.globe.rotation.y,view:renderer?controls.object.position.toArray():null,visibleMarkers:buttons.filter(b=>!b.hidden).map(b=>b.dataset.species),meshes:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,spinning};}};
  (async()=>{
    try{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
      const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(35,1,.1,50);camera.position.copy(geographic(20,66,7.65));
      controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.065;controls.enablePan=false;controls.enableZoom=false;controls.minDistance=5.5;controls.maxDistance=10;controls.minPolarAngle=.2;controls.maxPolarAngle=Math.PI-.2;controls.rotateSpeed=.6;
      scene.add(new THREE.HemisphereLight('#fff3dc','#b0b0ad',2.45));
      scene.add(new THREE.AmbientLight('#f8e7d1',.22));
      const sun=new THREE.DirectionalLight('#ffe8c6',1.65);sun.position.set(-4,7,8);sun.castShadow=true;sun.shadow.mapSize.set(innerWidth<760?1024:2048,innerWidth<760?1024:2048);Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.5,far:20});sun.shadow.bias=-.0003;sun.shadow.normalBias=.012;sun.shadow.radius=4;sun.shadow.intensity=.30;scene.add(sun);
      const fill=new THREE.DirectionalLight('#d6e1df',1.35);fill.position.set(5,1,-3);scene.add(fill);
      const geo=await fetch('assets/land.geojson',{signal}).then(r=>{if(!r.ok)throw Error('Globe geometry could not load');return r.json();});
      if(disposed){renderer.dispose();return;}
      model=buildGlobeModel(geo,species);model.globe.traverse(o=>{if(o.isMesh){o.castShadow=o!==model.sea&&!['Raised_continents','Sculpted_coastlines'].includes(o.name);o.receiveShadow=true;}});scene.add(model.globe);
      host.replaceChildren(renderer.domElement);renderer.domElement.setAttribute('aria-label','Interactive 3D Earth. Drag to rotate. Use arrow keys to explore, plus and minus to zoom.');renderer.domElement.tabIndex=0;
      stage.dataset.renderer='webgl';stage.classList.add('world-ready');
      for(const s of species){if(!model.markers.has(s.id))continue;
        const b=document.createElement('button');b.className='planet-marker';b.dataset.species=s.id;b.setAttribute('aria-label',`Open ${s.name} diary`);b.innerHTML='<span class="marker-dot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.5 7-12a7 7 0 0 0-14 0c0 6.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/></svg></span><span class="marker-caption"></span>';b.querySelector('.marker-caption').textContent=s.name;b.addEventListener('click',()=>{location.hash='species/'+s.slug;},{signal});labelLayer.append(b);buttons.push(b);
      }
      const resize=()=>{if(disposed)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};observer=new ResizeObserver(resize);observer.observe(host);resize();intersection=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;});intersection.observe(stage);
      controls.addEventListener('start',()=>{spinning=false;targetCamera=null;spinState();});
      controls.addEventListener('end',()=>{spinning=!reduced;spinState();});
      const touchPointers=new Set();renderer.domElement.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){touchPointers.add(e.pointerId);controls.enableZoom=true;}},{signal});for(const eventName of ['pointerup','pointercancel'])renderer.domElement.addEventListener(eventName,e=>{touchPointers.delete(e.pointerId);controls.enableZoom=touchPointers.size>0;},{signal});
      renderer.domElement.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))return;e.preventDefault();spinning=false;spinState();const p=new THREE.Spherical().setFromVector3(camera.position);if(e.key==='ArrowLeft')p.theta-=.14;if(e.key==='ArrowRight')p.theta+=.14;if(e.key==='ArrowUp')p.phi=Math.max(.2,p.phi-.14);if(e.key==='ArrowDown')p.phi=Math.min(Math.PI-.2,p.phi+.14);if(e.key==='+'||e.key==='=')p.radius=Math.max(5.5,p.radius-.4);if(e.key==='-')p.radius=Math.min(10,p.radius+.4);camera.position.setFromSpherical(p);controls.update();},{signal});
      stage.querySelectorAll('[data-world]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.world;if(a==='spin'){spinning=!spinning;spinState();}if(a==='reset'){targetCamera=geographic(20,66,7.65);model.globe.rotation.y=0;spinning=!reduced;spinState();}if(a==='in'||a==='out'){targetCamera=null;camera.position.setLength(THREE.MathUtils.clamp(camera.position.length()+(a==='in'?-.6:.6),5.5,10));controls.update();}if(a==='expand'){stage.classList.toggle('expanded');b.setAttribute('aria-pressed',String(stage.classList.contains('expanded')));b.setAttribute('aria-label',stage.classList.contains('expanded')?'Close expanded globe':'Expand globe');requestAnimationFrame(resize);}},{signal}));
      document.addEventListener('keydown',e=>{if(e.key==='Escape'){stage.classList.remove('expanded');const b=stage.querySelector('[data-world="expand"]');b?.setAttribute('aria-pressed','false');b?.setAttribute('aria-label','Expand globe');}},{signal});
      document.addEventListener('visibilitychange',()=>visible=!document.hidden,{signal});
      let last=performance.now();
      function animate(now){if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;if(!visible||!inView)return;
        if(targetCamera){if(reduced)camera.position.copy(targetCamera);else {const radius=THREE.MathUtils.lerp(camera.position.length(),targetCamera.length(),.075);camera.position.normalize().lerp(targetCamera.clone().normalize(),.075).normalize().multiplyScalar(radius);}if(camera.position.distanceTo(targetCamera)<.003)targetCamera=null;}
        if(spinning)model.globe.rotation.y+=dt*.045;
        controls.update();model.globe.updateMatrixWorld(true);
        if(!reduced)model.markers.forEach((marker,id)=>{marker.animal.position.y=Math.sin(now*.0015+id.length)*.008;});
        if(!reduced)model.clouds.children.forEach((c,i)=>{c.position.copy(geographic([16,-24,48,-8,32,-40,65,5][i],[-30,62,-45,115,153,-125,60,-105][i]+Math.sin(now*.00007+i)*.7,2.24+Math.sin(now*.0005+i)*.009));});
        const w=host.clientWidth,h=host.clientHeight;
        buttons.forEach((b,i)=>{const s=species.find(x=>x.id===b.dataset.species);const marker=model.markers.get(s.id);vector.copy(marker.anchor).applyMatrix4(model.globe.matrixWorld);const front=vector.clone().normalize().dot(camera.position.clone().normalize())>.2;vector.project(camera);b.hidden=!front||Math.abs(vector.x)>1.1||Math.abs(vector.y)>1.1;b.style.transform=`translate(${(vector.x*.5+.5)*w}px,${(-vector.y*.5+.5)*h}px) translate(-50%,-50%)`;b.style.zIndex=Math.round(100-vector.z*20);marker.ring.scale.setScalar(1+(b.classList.contains('selected')?.08:0));});
        renderer.render(scene,camera);
      }
      spinState();frame=requestAnimationFrame(animate);stage.__world=api;
    }catch(error){if(disposed||error.name==='AbortError')return;stage.dataset.renderer='fallback';host.innerHTML='<div class="world-fallback"><strong>Explore the species journals</strong><p>This browser could not display the 3D globe.</p><a class="btn btn-primary" href="#species">Open Species Diaries</a></div>';console.error('Globe initialization:',error);}
  })();
  return api;
}
