import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { paintedMaterial, pigmentNoise } from './painterly-material.js';

export const WORLD_RADIUS = 2;
const Y = new THREE.Vector3(0, 1, 0);
export function geographic(lat, lon, radius = WORLD_RADIUS) {
  const p = THREE.MathUtils.degToRad(lat), t = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(radius * Math.cos(p) * Math.sin(t), radius * Math.sin(p), radius * Math.cos(p) * Math.cos(t));
}
const materialCache = new Map();
function material(color) {
  const key = color;
  if (!materialCache.has(key)) materialCache.set(key, paintedMaterial(new THREE.MeshStandardMaterial({color, roughness: 1, metalness: 0})));
  return materialCache.get(key);
}
function ellipsoid(parent, color, position, scale, detail = 16) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, detail, Math.max(8, detail / 2)), material(color));
  m.position.set(...position); m.scale.set(...scale); parent.add(m); return m;
}
function tube(parent, points, color, thickness = .012) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, thickness, 5, false), material(color)); parent.add(m); return m;
}
export function makeAnimal(id) {
  const a = new THREE.Group(); a.name = `Animal_${id}`;
  const eye = (x,y,z,s=.013) => ellipsoid(a, '#27353a', [x,y,z], [s,s,s]);
  if (id === 'jerboa') {
    ellipsoid(a,'#ddb77c',[0,.12,0],[.09,.14,.075]);
    ellipsoid(a,'#f3d6a0',[0,.27,.025],[.105,.09,.085]);
    ellipsoid(a,'#f8ebcb',[0,.23,.09],[.06,.04,.025]);
    for(const x of [-.055,.055]) {const e=ellipsoid(a,'#e6c692',[x,.43,.015],[.035,.16,.029]);e.rotation.z=-x*2; const p=ellipsoid(a,'#db9b92',[x,.435,.04],[.019,.12,.009]);p.rotation.z=-x*2;eye(x,.28,.097);ellipsoid(a,'#f5d9a9',[x,.015,.065],[.03,.018,.085]);}
    ellipsoid(a,'#db8c80',[0,.245,.12],[.014,.009,.009]);
    tube(a,[[0,.08,-.04],[.05,.02,-.18],[.17,.03,-.25],[.21,.09,-.22]],'#d4aa71',.008);
    ellipsoid(a,'#574b41',[.21,.09,-.22],[.02,.03,.025]);
  } else if (id === 'saiga') {
    ellipsoid(a,'#d8b978',[0,.2,0],[.18,.09,.07]);
    for(const x of [-.11,.11])for(const z of [-.04,.04]){ellipsoid(a,'#cba966',[x,.09,z],[.017,.095,.018]);ellipsoid(a,'#64594b',[x,.009,z],[.023,.015,.025]);}
    ellipsoid(a,'#e9cf99',[.14,.29,.015],[.063,.1,.055]);
    ellipsoid(a,'#c7a36c',[.19,.28,.035],[.065,.067,.045]);
    for(const z of [-.035,.06]){ellipsoid(a,'#dbc395',[.11,.36,z],[.06,.019,.025]);tube(a,[[.11,.35,z],[.10,.43,z],[.12,.49,z]],'#7e7155',.011);eye(.184,.32,z);}
  } else if (id === 'kakapo') {
    ellipsoid(a,'#719657',[0,.13,0],[.12,.15,.1]);
    ellipsoid(a,'#a5ba67',[0,.27,.028],[.105,.095,.087]);
    for(const x of [-.08,.08]){ellipsoid(a,'#d2cf84',[x*.7,.27,.09],[.04,.05,.018]);eye(x*.7,.29,.107);const w=ellipsoid(a,'#446d49',[x,.12,-.005],[.045,.115,.08]);w.rotation.z=x*2;ellipsoid(a,'#8d7953',[x*.6,.012,.06],[.025,.017,.05]);}
    ellipsoid(a,'#dfc399',[0,.24,.12],[.028,.036,.029]);
    for(let i=0;i<12;i++){const x=Math.sin(i*4)*.07,y=.1+Math.cos(i*3)*.07;ellipsoid(a,'#d7cf87',[x,y,.085],[.008,.014,.004]);}
  } else if (id === 'leopard') {
    ellipsoid(a,'#dcaf66',[0,.14,0],[.19,.075,.08]);
    ellipsoid(a,'#edc88c',[.17,.23,.015],[.084,.072,.071]);
    for(const x of [-.11,.1])for(const z of [-.05,.05])ellipsoid(a,'#d9ab63',[x,.06,z],[.028,.07,.026]);
    for(const z of [-.042,.06]){ellipsoid(a,'#b58a53',[.17,.29,z],[.026,.035,.026]);eye(.23,.24,z);}
    ellipsoid(a,'#f8e7be',[.236,.21,.013],[.025,.027,.05]);
    for(let i=0;i<32;i++){const x=-.16+(i%8)*.043,y=.15+Math.sin(i*1.8)*.055,z=Math.cos(i*2.2)*.07;ellipsoid(a,'#594d3c',[x,y,z],[.013,.011,.009]);}
    tube(a,[[-.16,.16,0],[-.3,.14,0],[-.35,.22,.01],[-.33,.27,.03]],'#d9ab63',.017);
  } else if (id === 'gorilla') {
    ellipsoid(a,'#53636b',[0,.16,0],[.14,.18,.09]);
    ellipsoid(a,'#83908e',[0,.19,-.025],[.12,.12,.08]);
    ellipsoid(a,'#4e5a61',[0,.33,.015],[.095,.105,.08]);
    ellipsoid(a,'#333f46',[0,.32,.078],[.073,.058,.027]);
    for(const x of [-.135,.135]){ellipsoid(a,'#4a5962',[x,.1,.035],[.055,.13,.055]);ellipsoid(a,'#39494e',[x,.015,.06],[.055,.03,.055]);eye(x*.25,.347,.104,.009);ellipsoid(a,'#41515a',[x*.5,.025,.02],[.05,.03,.075]);}
    ellipsoid(a,'#5d696c',[0,.31,.1],[.042,.022,.025]);
  } else {
    ellipsoid(a,'#e9bb72',[0,.15,0],[.11,.15,.09]);ellipsoid(a,'#f4dbac',[0,.27,.03],[.1,.09,.08]);eye(-.04,.28,.1);eye(.04,.28,.1);
  }
  return a;
}
function inside(point, ring) {
  let yes=false;const [x,y]=point;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {const a=ring[i],b=ring[j]; if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))yes=!yes;}
  return yes;
}
function terrainColor(lon,lat){
  const p=geographic(lat,lon,1);
  const wash=pigmentNoise(p.x*6.5+4,p.y*6.5,p.z*6.5);
  const fine=pigmentNoise(p.x*22,p.y*22+7,p.z*22);
  const ellipse=(x,y,rx,ry)=>Math.exp(-(((lon-x)/rx)**2+((lat-y)/ry)**2)*1.5);
  const color=new THREE.Color('#abb983').lerp(new THREE.Color('#c1c891'),wash*.6);
  const desert=Math.max(ellipse(16,24,39,12),ellipse(52,24,25,13),ellipse(103,42,22,10)*.7,ellipse(134,-26,23,15));
  color.lerp(new THREE.Color('#ddc397'),desert*.95);
  color.lerp(new THREE.Color('#b6bea0'),THREE.MathUtils.smoothstep(Math.abs(lat),43,67)*.65);
  color.lerp(new THREE.Color('#eee7cf'),THREE.MathUtils.smoothstep(Math.abs(lat),59,76));
  color.multiplyScalar(.97+(fine-.5)*.065);
  return color;
}
function buildLand(geo) {
  const positions=[],colors=[],walls=[],wallColors=[];
  const polygons=geo.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);
  function triangle(a,b,c,depth=0){
    const max=Math.max(Math.hypot(a.x-b.x,a.y-b.y),Math.hypot(b.x-c.x,b.y-c.y),Math.hypot(c.x-a.x,c.y-a.y));
    if(max>6&&depth<7){const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);return;}
    for(const v of [a,b,c]){const p=geographic(v.y,v.x,2.022);positions.push(p.x,p.y,p.z);const color=terrainColor(v.x,v.y);colors.push(color.r,color.g,color.b);}
  }
  for(const rings of polygons){
    const contour=rings[0].map(p=>new THREE.Vector2(p[0],p[1]));
    const holes=rings.slice(1).map(r=>r.map(p=>new THREE.Vector2(p[0],p[1])));
    const faces=THREE.ShapeUtils.triangulateShape(contour,holes);
    const flat=contour.concat(...holes);
    for(const f of faces)triangle(flat[f[0]],flat[f[1]],flat[f[2]]);
    for(const [ringIndex,ring] of rings.entries()){
      const count=ring.length-1;
      const area=ring.reduce((sum,p,i)=>i<count?sum+p[0]*ring[i+1][1]-ring[i+1][0]*p[1]:sum,0);
      const direction=(area>0?1:-1)*(ringIndex===0?1:-1);
      const normals=ring.slice(0,count).map((p,i)=>{
        const before=ring[(i+count-1)%count],after=ring[(i+1)%count],cos=Math.max(.15,Math.cos(p[1]*Math.PI/180));
        const dx=(after[0]-before[0])*cos,dy=after[1]-before[1],length=Math.hypot(dx,dy)||1;
        return [dy/length/cos*direction,-dx/length*direction];
      });
      for(let i=0;i<count;i++){
        const a=ring[i],b=ring[i+1],na=normals[i],nb=normals[(i+1)%count];
        const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
        for(let j=0;j<steps;j++){
          const interpolate=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
          const p=interpolate(j/steps),q=interpolate((j+1)/steps);
          const normal=t=>[na[0]+(nb[0]-na[0])*t,na[1]+(nb[1]-na[1])*t];
          const np=normal(j/steps),nq=normal((j+1)/steps);
          const layers=[[.22,2.001,new THREE.Color('#a1bdb5')],[.10,2.013,new THREE.Color('#d4d3a8')],[0,2.022,terrainColor(p[0],p[1])]];
          for(let layer=0;layer<2;layer++){
            const [offset,radius,color]=layers[layer],[nextOffset,nextRadius,nextColor]=layers[layer+1];
            const vs=[geographic(p[1]+np[1]*offset,p[0]+np[0]*offset,radius),geographic(q[1]+nq[1]*offset,q[0]+nq[0]*offset,radius),geographic(q[1]+nq[1]*nextOffset,q[0]+nq[0]*nextOffset,nextRadius),geographic(p[1]+np[1]*nextOffset,p[0]+np[0]*nextOffset,nextRadius)];
            for(const k of [0,1,2,0,2,3]){walls.push(...vs[k].toArray());const c=k<2?color:nextColor;wallColors.push(c.r,c.g,c.b);}
          }
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(positions.map((v,i)=>v/Math.hypot(...positions.slice(Math.floor(i/3)*3,Math.floor(i/3)*3+3))),3));
  const top=new THREE.Mesh(geometry,paintedMaterial(new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}),.10));top.name='Raised_continents';
  const wallGeometry=new THREE.BufferGeometry();wallGeometry.setAttribute('position',new THREE.Float32BufferAttribute(walls,3));wallGeometry.computeVertexNormals();
  wallGeometry.setAttribute('color',new THREE.Float32BufferAttribute(wallColors,3));
  wallGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(walls.map((v,i)=>v/Math.hypot(...walls.slice(Math.floor(i/3)*3,Math.floor(i/3)*3+3))),3));
  const coast=new THREE.Mesh(wallGeometry,paintedMaterial(new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide})));coast.name='Sculpted_coastlines';
  return {top,coast,polygons};
}
function surfaceGroup(parent,lat,lon,r){const g=new THREE.Group();g.position.copy(geographic(lat,lon,r));g.quaternion.setFromUnitVectors(Y,g.position.clone().normalize());parent.add(g);return g;}
function roundedProfile(points,segments=18){
  const curve=new THREE.CatmullRomCurve3(points.map(([r,y])=>new THREE.Vector3(r,y,0)));
  return new THREE.LatheGeometry(curve.getPoints(14).map(p=>new THREE.Vector2(Math.max(.0001,p.x),p.y)),segments);
}
function tree(parent,lat,lon,seed){
  const g=surfaceGroup(parent,lat,lon,2.024);const s=.72+seed*.5;g.scale.setScalar(s);g.rotation.y=seed*Math.PI*2;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.010,.015,.082,9),material('#a18e66'));trunk.position.y=.04;g.add(trunk);
  if(lat>45){
    const pine=new THREE.Mesh(roundedProfile([[.001,.055],[.048,.052],[.067,.068],[.060,.095],[.042,.115],[.049,.122],[.037,.154],[.020,.180],[.001,.198]],16),material(seed>.5?'#799276':'#6a876e'));
    pine.rotation.z=(seed-.5)*.13;g.add(pine);
  }
  else {
    ellipsoid(g,'#839b70',[-.02,.105,0],[.067,.083,.061],16);
    ellipsoid(g,'#a4b480',[.031,.131,.008],[.056,.064,.054],16);
    ellipsoid(g,'#91a777',[-.03,.147,-.009],[.047,.050,.050],16);
  }
}

function mergeStatic(group){
  group.updateMatrixWorld(true);
  const inverse=new THREE.Matrix4().copy(group.matrixWorld).invert(),batches=new Map();
  group.traverse(o=>{if(!o.isMesh)return;const key=o.material.uuid;if(!batches.has(key))batches.set(key,{material:o.material,geometries:[]});batches.get(key).geometries.push(o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));});
  group.clear();
  for(const batch of batches.values()){const geometry=mergeGeometries(batch.geometries);if(geometry)group.add(new THREE.Mesh(geometry,batch.material));batch.geometries.forEach(g=>g.dispose());}
}

export function buildGlobeModel(geo,species=[]){
  const globe=new THREE.Group();globe.name='LongEar_Living_Earth';
  const oceanGeometry=new THREE.SphereGeometry(2,112,80),oceanColors=[];
  const oceanPosition=oceanGeometry.getAttribute('position');
  for(let i=0;i<oceanPosition.count;i++){
    const x=oceanPosition.getX(i),y=oceanPosition.getY(i),z=oceanPosition.getZ(i);
    const wash=pigmentNoise(x*2.4+8,y*3.2,z*2.4),brush=pigmentNoise(x*10,y*21+2,z*10);
    const c=new THREE.Color('#88b4b6').lerp(new THREE.Color('#b4ceca'),wash*.65).multiplyScalar(.98+(brush-.5)*.07);
    oceanColors.push(c.r,c.g,c.b);
  }
  oceanGeometry.setAttribute('color',new THREE.Float32BufferAttribute(oceanColors,3));
  const sea=new THREE.Mesh(oceanGeometry,paintedMaterial(new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0}),.13));sea.name='Ocean';globe.add(sea);
  const land=buildLand(geo);globe.add(land.top,land.coast);
  const globeLines=new THREE.Group();globeLines.name='Ocean_cartography';
  const lineMat=new THREE.LineBasicMaterial({color:'#d1ded0',transparent:true,opacity:.09});
  for(let lat=-60;lat<=60;lat+=30){const pts=[];for(let lon=-180;lon<=180;lon+=3)pts.push(geographic(lat,lon,2.009));globeLines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lineMat));}
  for(let lon=0;lon<360;lon+=30){const pts=[];for(let lat=-90;lat<=90;lat+=3)pts.push(geographic(lat,lon,2.009));globeLines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lineMat));}
  globe.add(globeLines);
  const vegetation=new THREE.Group();vegetation.name='Miniature_forests';globe.add(vegetation);
  let n=741;const random=()=>{n=(n*16807)%2147483647;return(n-1)/2147483646;};
  for(let i=0,count=0;i<2500&&count<105;i++){
    const lon=random()*360-180,lat=random()*125-55;
    if(lat>12&&lat<34&&lon> -18&&lon<80)continue;
    if(lat< -18&&lon>115&&lon<140)continue;
    if(land.polygons.some(p=>inside([lon,lat],p[0])&&!p.slice(1).some(h=>inside([lon,lat],h)))){tree(vegetation,lat,lon,random());count++;}
  }
  const mountains=new THREE.Group();mountains.name='Mountain_ranges';globe.add(mountains);
  const mountainMaterial=paintedMaterial(new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
  for(const [lat,lon]of [[29,82],[31,87],[34,93],[28,76],[37,72],[45,7],[-13,-72],[-20,-69],[-28,-70],[48,-118],[53,-126]]){
    const g=surfaceGroup(mountains,lat,lon,2.024),h=.10+random()*.10,r=h*.7,phase=random()*Math.PI*2;
    const shape=roundedProfile([[.001,0],[r*.55,0],[r,.1*h],[r*.91,.3*h],[r*.61,.65*h],[r*.25,.9*h],[r*.07,.985*h],[.001,h]],20),positions=shape.getAttribute('position'),colors=[];
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),angle=Math.atan2(x,z);
      const ridge=1+Math.sin(angle*3+phase)*.085*Math.sin(Math.PI*y/h);
      positions.setXYZ(i,x*ridge+Math.sin(y/h*2+phase)*r*.08,y,z*ridge);
      const c=new THREE.Color('#b9b39a').lerp(new THREE.Color('#eee5ce'),THREE.MathUtils.smoothstep(y/h,.56,.95));colors.push(c.r,c.g,c.b);
    }
    shape.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));shape.computeVertexNormals();
    const mountain=new THREE.Mesh(shape,mountainMaterial);mountain.rotation.y=phase;g.add(mountain);
  }
  const clouds=new THREE.Group();clouds.name='Clouds';globe.add(clouds);
  for(const [lat,lon]of [[16,-30],[-24,62],[48, -45],[-8,115],[32,153],[-40,-125],[65,60],[5,-105]]){
    const g=surfaceGroup(clouds,lat,lon,2.24);const s=.7+random()*.5;g.scale.setScalar(s);
    ellipsoid(g,'#fff8e7',[-.065,0,0],[.11,.045,.055]);ellipsoid(g,'#fff8e7',[.025,.025,0],[.1,.065,.06]);ellipsoid(g,'#fff8e7',[.11,0,0],[.08,.04,.05]);
  }
  const whales=new THREE.Group();whales.name='Ocean_life';globe.add(whales);
  for(const [lat,lon]of [[-15,76],[33,-38],[-26,-128]]){
    const g=surfaceGroup(whales,lat,lon,2.018);ellipsoid(g,'#438894',[0,.035,0],[.115,.04,.045]);tube(g,[[-.08,.025,0],[-.16,.065,0],[-.18,.09,.025]],'#438894',.015);ellipsoid(g,'#4f929c',[-.18,.09,.025],[.035,.01,.065]);
    tube(g,[[.04,.05,0],[.04,.15,0],[.01,.18,0]],'#e1eeea',.005);
  }
  const markers=new Map();
  for(const s of species){
    if(!Number.isFinite(+s.latitude)||!Number.isFinite(+s.longitude))continue;
    const g=surfaceGroup(globe,+s.latitude,+s.longitude,2.035);g.name=`Habitat_${s.id}`;
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.14,.17,.035,32),material('#eadbb1'));base.position.y=.008;g.add(base);
    const animal=makeAnimal(s.id);mergeStatic(animal);animal.scale.setScalar(.9);animal.rotation.y=.4;g.add(animal);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.16,.009,6,40),material('#d5785e'));ring.rotation.x=Math.PI/2;ring.position.y=.025;g.add(ring);
    markers.set(s.id,{group:g,animal,ring,anchor:geographic(+s.latitude,+s.longitude,2.5)});
  }
  mergeStatic(vegetation);mergeStatic(mountains);mergeStatic(whales);
  return {globe,markers,clouds,sea};
}
