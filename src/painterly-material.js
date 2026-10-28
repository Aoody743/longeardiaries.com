// Pigment variation is evaluated in model coordinates, so the brush texture
// travels with the rotating world instead of swimming over the screen.
export function pigmentNoise(x, y, z) {
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  let fx=x-ix,fy=y-iy,fz=z-iz;
  fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
  const hash=(a,b,c)=>{const n=Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453;return n-Math.floor(n);};
  const lerp=(a,b,t)=>a+(b-a)*t;
  return lerp(lerp(lerp(hash(ix,iy,iz),hash(ix+1,iy,iz),fx),lerp(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),fx),fy),lerp(lerp(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),fx),lerp(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),fx),fy),fz);
}

export function paintedMaterial(material, strength=.08) {
  material.roughness=1;
  material.metalness=0;
  material.flatShading=false;
  material.userData.finish='Watercolor pigment on warm paper';
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vLongearPaintPosition;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvLongearPaintPosition = position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vLongearPaintPosition;
float longearHash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float longearPigment(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(longearHash(i),longearHash(i+vec3(1,0,0)),f.x),mix(longearHash(i+vec3(0,1,0)),longearHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(longearHash(i+vec3(0,0,1)),longearHash(i+vec3(1,0,1)),f.x),mix(longearHash(i+vec3(0,1,1)),longearHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
float paperPixel=max(max(fwidth(vLongearPaintPosition.x),fwidth(vLongearPaintPosition.y)),fwidth(vLongearPaintPosition.z));
float paperDetail=1.0-smoothstep(0.005,0.018,paperPixel);
float pigment=(longearPigment(vLongearPaintPosition*38.0)-0.5)*0.65;
pigment+=(longearPigment(vLongearPaintPosition*128.0+vec3(12.4,3.8,7.1))-0.5)*paperDetail*0.35;
diffuseColor.rgb*=1.0+pigment*${strength.toFixed(3)};
`);
  };
  material.customProgramCacheKey=()=>`longear-paper-v1-${strength}`;
  return material;
}
