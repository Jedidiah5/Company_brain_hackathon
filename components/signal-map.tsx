'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Lead } from '@/lib/types';

type NodeData = {
  id: string;
  disqualified: boolean;
  hot: boolean;
};

function paintNode(node: THREE.Mesh, selected: string) {
  const data = node.userData as NodeData;
  const active = data.id === selected;
  const color = active
    ? 0xffffff
    : data.disqualified
      ? 0x765c50
      : data.hot
        ? 0xd2ff86
        : 0x6c9380;
  const mat = node.material as THREE.MeshBasicMaterial;
  mat.color.setHex(color);
  node.scale.setScalar(active ? 1.7 : 1);
}

export default function SignalMap({
  leads,
  selected,
  onSelect,
}: {
  leads: Lead[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onSelect);
  callback.current = onSelect;
  const nodesRef = useRef<THREE.Mesh[]>([]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [fallback, setFallback] = useState(false);

  // Rebuild the scene only when the lead set changes — not on every selection.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      setFallback(true);
      return;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 11);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    el.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);
    const resources: (THREE.BufferGeometry | THREE.Material)[] = [];
    const ringMaterial = new THREE.LineBasicMaterial({
      color: 0x4a7a58,
      transparent: true,
      opacity: 0.55,
    });
    resources.push(ringMaterial);
    [1.25, 2.3, 3.4].forEach((r) => {
      const geo = new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 129 }, (_, i) => {
          const a = (i / 128) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0);
        }),
      );
      resources.push(geo);
      group.add(new THREE.LineLoop(geo, ringMaterial));
    });

    const coreGeo = new THREE.IcosahedronGeometry(0.24, 1);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xd2ff86, wireframe: true });
    resources.push(coreGeo, coreMat);
    group.add(new THREE.Mesh(coreGeo, coreMat));

    const nodes: THREE.Mesh[] = [];
    leads.slice(0, 90).forEach((lead, i) => {
      const angle = i * 2.399963;
      const hot = lead.scores.intent >= 6 && !lead.disqualified;
      const radius = lead.disqualified ? 3.4 : hot ? 1.25 : 2.3;
      const p = new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        Math.sin(i * 1.7) * 0.5,
      );
      const geo = new THREE.SphereGeometry(0.075, 10, 10);
      const mat = new THREE.MeshBasicMaterial({ color: 0x6c9380 });
      resources.push(geo, mat);
      const node = new THREE.Mesh(geo, mat);
      node.position.copy(p);
      node.userData = {
        id: lead.id,
        disqualified: lead.disqualified,
        hot,
      } satisfies NodeData;
      paintNode(node, selectedRef.current);
      group.add(node);
      nodes.push(node);
      if (hot) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), p]);
        resources.push(lineGeo);
        group.add(new THREE.Line(lineGeo, ringMaterial));
      }
    });
    nodesRef.current = nodes;

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const click = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(nodes)[0];
      if (hit) callback.current((hit.object.userData as NodeData).id);
    };
    el.addEventListener('click', click);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const animate = () => {
      if (!reduced) group.rotation.z += 0.0006;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener('click', click);
      nodesRef.current = [];
      resources.forEach((r) => r.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [leads]);

  useEffect(() => {
    for (const node of nodesRef.current) paintNode(node, selected);
  }, [selected]);

  return (
    <div
      className="map-canvas"
      ref={host}
      role="img"
      aria-label="Signal map: actionable leads near the center, rejected signals on the outer ring"
    >
      {fallback && (
        <div className="map-fallback">
          {leads.length} public signals
          <br />
          <small>Explore them in the queue below</small>
        </div>
      )}
    </div>
  );
}
