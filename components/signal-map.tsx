'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Lead } from '@/lib/types';
export default function SignalMap({leads, selected, onSelect}: {leads:Lead[]; selected:string; onSelect:(id:string)=>void}) {
  const host=useRef<HTMLDivElement>(null);
  const callback=useRef(onSelect); callback.current=onSelect;
  const [fallback,setFallback]=useState(false);
  useEffect(()=>{
    const el=host.current; if(!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer=new THREE.WebGLRenderer({alpha:true,antialias:true}); } catch {setFallback(true); return;}
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(42,1,.1,100); camera.position.set(0,0,11);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.domElement.setAttribute('aria-hidden','true'); el.appendChild(renderer.domElement);
    const group=new THREE.Group(); scene.add(group);
    const resources: (THREE.BufferGeometry|THREE.Material)[]=[];
    const ringMaterial=new THREE.LineBasicMaterial({color:0x4a7a58,transparent:true,opacity:.55}); resources.push(ringMaterial);
    [1.25,2.3,3.4].forEach(r=>{const geo=new THREE.BufferGeometry().setFromPoints(Array.from({length:129},(_,i)=>new THREE.Vector3(Math.cos(i/128*Math.PI*2)*r,Math.sin(i/128*Math.PI*2)*r,0)));resources.push(geo);group.add(new THREE.LineLoop(geo,ringMaterial));});
    const coreGeo=new THREE.IcosahedronGeometry(.24,1); const coreMat=new THREE.MeshBasicMaterial({color:0xd2ff86,wireframe:true});resources.push(coreGeo,coreMat);group.add(new THREE.Mesh(coreGeo,coreMat));
    const nodes:THREE.Mesh[]=[];
    leads.slice(0,90).forEach((lead,i)=>{
      const angle=i*2.399963;
      const radius=lead.disqualified?3.4:lead.scores.intent>=6?1.25:2.3;
      const p=new THREE.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,Math.sin(i*1.7)*.5);
      const color=lead.id===selected?0xffffff:lead.disqualified?0x765c50:lead.scores.intent>=6?0xd2ff86:0x6c9380;
      const geo=new THREE.SphereGeometry(lead.id===selected?.13:.075,12,12); const mat=new THREE.MeshBasicMaterial({color}); resources.push(geo,mat);
      const node=new THREE.Mesh(geo,mat);node.position.copy(p);node.userData.id=lead.id;group.add(node);nodes.push(node);
      if(lead.scores.intent>=6&&!lead.disqualified){const lineGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),p]);resources.push(lineGeo);group.add(new THREE.Line(lineGeo,ringMaterial));}
    });
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const raycaster=new THREE.Raycaster(); const pointer=new THREE.Vector2();
    const click=(event:MouseEvent)=>{const rect=el.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(nodes)[0];if(hit)callback.current(hit.object.userData.id);};
    el.addEventListener('click',click);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame=0;
    const animate=()=>{if(!reduced)group.rotation.z+=.0006;renderer.render(scene,camera);frame=requestAnimationFrame(animate);};animate();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();el.removeEventListener('click',click);resources.forEach(r=>r.dispose());renderer.dispose();renderer.domElement.remove();};
  },[leads,selected]);
  return <div className="map-canvas" ref={host} role="img" aria-label="Signal map: actionable leads near the center, rejected signals on the outer ring">{fallback&&<div className="map-fallback">{leads.length} public signals<br/><small>Explore them in the queue below</small></div>}</div>;
}
