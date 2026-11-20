import * as THREE from 'three';

export interface CarrierBuildResult {
  group: THREE.Group;
  radars: THREE.Object3D[];
  ciwsTurrets: THREE.Object3D[];
  deckJets: THREE.Object3D[];
  wakeMesh: THREE.Mesh;
}

export interface EscortBuildResult {
  group: THREE.Group;
  radars: THREE.Object3D[];
  vlsOrigin: THREE.Vector3; // local offset for VLS launches
  ciwsOrigin: THREE.Vector3;
  wakeMesh: THREE.Mesh;
}

function createCarrierDeckTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d')!;

  // Dark weathered non-skid flight deck surface
  ctx.fillStyle = '#2c333d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle tire marks & asphalt grit
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y, 3, 8);
  }

  // Deck perimeter white & yellow markings
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 8;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  // Angled landing strip (classic Nimitz 9-degree canted deck)
  ctx.save();
  ctx.translate(canvas.width * 0.44, canvas.height * 0.54);
  ctx.rotate(-0.15);

  // Dark rubber touchdown zone
  ctx.fillStyle = 'rgba(15, 18, 24, 0.55)';
  ctx.fillRect(-155, -520, 310, 1180);

  // White & red foul lines
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-150, -500);
  ctx.lineTo(-150, 650);
  ctx.moveTo(150, -500);
  ctx.lineTo(150, 650);
  ctx.stroke();

  // Yellow dashed centerline
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 8;
  ctx.setLineDash([42, 32]);
  ctx.beginPath();
  ctx.moveTo(0, -490);
  ctx.lineTo(0, 640);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arresting wires (4 steel cables across aft runway)
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 5;
  for (let w = 0; w < 4; w++) {
    const wy = 340 + w * 68;
    ctx.beginPath();
    ctx.moveTo(-140, wy);
    ctx.lineTo(140, wy);
    ctx.stroke();
  }
  ctx.restore();

  // Forward catapult tracks (Cats 1 & 2)
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.36, 90);
  ctx.lineTo(canvas.width * 0.4, 720);
  ctx.moveTo(canvas.width * 0.62, 90);
  ctx.lineTo(canvas.width * 0.58, 720);
  ctx.stroke();

  // Bold "72" USS Abraham Lincoln bow hull number
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 185px Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('72', canvas.width * 0.52, 235);
  ctx.restore();

  // Elevator safety outlines on starboard/port edges
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 6;
  ctx.strokeRect(canvas.width - 140, 560, 112, 190);
  ctx.strokeRect(canvas.width - 140, 1340, 112, 190);
  ctx.strokeRect(28, 1280, 112, 190);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createIslandNumberTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 132px Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('72', 128, 134);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWakeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, 'rgba(226, 244, 255, 0.72)');
  grad.addColorStop(0.25, 'rgba(200, 235, 255, 0.42)');
  grad.addColorStop(1, 'rgba(200, 235, 255, 0.0)');
  ctx.fillStyle = grad;

  // V-shaped foamy wake
  ctx.beginPath();
  ctx.moveTo(106, 0);
  ctx.lineTo(150, 0);
  ctx.lineTo(250, 512);
  ctx.lineTo(6, 512);
  ctx.closePath();
  ctx.fill();

  // Inner brighter foam streaks
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(116, 0);
  ctx.lineTo(54, 460);
  ctx.moveTo(140, 0);
  ctx.lineTo(202, 460);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

const sharedWakeTex = createWakeTexture();

export function createFA18Jet(scale = 1): THREE.Group {
  const jet = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7c8a99, roughness: 0.45, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.7 });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.2 });

  // Fuselage
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 6.4, 8), bodyMat);
  fuse.rotation.x = Math.PI / 2;
  jet.add(fuse);

  // Nosecone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 8), noseMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 4.3;
  jet.add(nose);

  // Canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 1.8), darkMat);
  canopy.position.set(0, 0.42, 1.6);
  jet.add(canopy);

  // Main wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.14, 1.75), bodyMat);
  wing.position.set(0, 0, -0.3);
  jet.add(wing);

  // Horizontal stabilizers
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 1.0), bodyMat);
  hStab.position.set(0, 0, -2.7);
  jet.add(hStab);

  // Twin canted vertical tails (F/A-18 signature!)
  const vTailGeo = new THREE.BoxGeometry(0.12, 1.35, 1.15);
  const vLeft = new THREE.Mesh(vTailGeo, bodyMat);
  vLeft.position.set(-0.75, 0.7, -2.4);
  vLeft.rotation.z = 0.28;
  jet.add(vLeft);

  const vRight = new THREE.Mesh(vTailGeo, bodyMat);
  vRight.position.set(0.75, 0.7, -2.4);
  vRight.rotation.z = -0.28;
  jet.add(vRight);

  jet.scale.setScalar(scale);
  return jet;
}

function createE2Hawkeye(scale = 0.9): THREE.Group {
  const plane = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x9aa7b5, roughness: 0.45, metalness: 0.3 });
  const domeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.15 });

  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.55, 6.5, 8), mat);
  fuse.rotation.x = Math.PI / 2;
  plane.add(fuse);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.16, 1.5), mat);
  wing.position.set(0, 0.35, 0.3);
  plane.add(wing);

  // Signature AWACS radar rotodome!
  const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.3, 6), mat);
  pylon.position.set(0, 1.0, -0.5);
  plane.add(pylon);

  const dome = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.28, 16), domeMat);
  dome.position.set(0, 1.75, -0.5);
  plane.add(dome);

  plane.scale.setScalar(scale);
  return plane;
}

function createPhalanxCIWS(): THREE.Group {
  const ciws = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 1.1, 10), darkMat);
  base.position.y = 0.55;
  ciws.add(base);

  // Iconic R2-D2 white radome!
  const radome = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.8, 12), whiteMat);
  radome.position.y = 2.0;
  ciws.add(radome);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 8), whiteMat);
  cap.position.y = 2.9;
  ciws.add(cap);

  // 20mm rotary Gatling barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.3, 8), darkMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.5, 1.25);
  ciws.add(barrel);

  return ciws;
}

export function buildAbrahamLincolnCVN72(): CarrierBuildResult {
  const group = new THREE.Group();
  const radars: THREE.Object3D[] = [];
  const ciwsTurrets: THREE.Object3D[] = [];
  const deckJets: THREE.Object3D[] = [];

  const hullMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.65, metalness: 0.35 });
  const redWaterlineMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.7, metalness: 0.2 });
  const superMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.55, metalness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 });

  // Note: +Z is Forward (Bow), -Z is Aft (Stern), +X is Starboard (Right)
  // Scale: ~135 units long, ~38 units flight deck width — massive heroic silhouette!

  // Lower hull (waterline red anti-fouling)
  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(22, 4.5, 118), redWaterlineMat);
  lowerHull.position.set(0, -1.2, 0);
  group.add(lowerHull);

  // Main armored grey hull
  const mainHull = new THREE.Mesh(new THREE.BoxGeometry(24, 9.5, 120), hullMat);
  mainHull.position.set(0, 4.8, 0);
  group.add(mainHull);

  // Tapered bow prow
  const bowGeo = new THREE.ConeGeometry(15.5, 22, 4);
  bowGeo.rotateY(Math.PI / 4);
  bowGeo.rotateX(Math.PI / 2);
  const bow = new THREE.Mesh(bowGeo, hullMat);
  bow.scale.set(0.85, 0.42, 1.0);
  bow.position.set(0, 4.2, 66);
  group.add(bow);

  // Hangar bay openings on sides
  const hangarOpening = new THREE.Mesh(new THREE.BoxGeometry(24.4, 4.4, 34), darkMat);
  hangarOpening.position.set(0, 5.2, -14);
  group.add(hangarOpening);

  // Overhanging angled Flight Deck (Custom Nimitz shape)
  const deckTex = createCarrierDeckTexture();
  const deckMat = new THREE.MeshStandardMaterial({
    map: deckTex,
    roughness: 0.78,
    metalness: 0.15,
  });

  // Main rectangular deck
  const flightDeck = new THREE.Mesh(new THREE.BoxGeometry(36, 1.6, 134), [
    hullMat,
    hullMat,
    deckMat,
    hullMat,
    hullMat,
    hullMat,
  ]);
  flightDeck.position.set(0, 10.2, 2);
  group.add(flightDeck);

  // Portside angled sponson overhang
  const portOverhang = new THREE.Mesh(new THREE.BoxGeometry(9, 1.4, 72), hullMat);
  portOverhang.position.set(-19, 10.1, -6);
  portOverhang.rotation.y = 0.14;
  group.add(portOverhang);

  // Under-deck structural support struts
  for (let z = -48; z <= 48; z += 24) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(32, 2.5, 2.5), darkMat);
    strut.position.set(0, 8.8, z);
    group.add(strut);
  }

  // ===== SUPERSTRUCTURE ISLAND (Starboard side, +X) =====
  const island = new THREE.Group();
  island.position.set(14.5, 11, -10);

  const islandBase = new THREE.Mesh(new THREE.BoxGeometry(6.8, 12.5, 22), superMat);
  islandBase.position.y = 6.25;
  island.add(islandBase);

  // "72" billboard on island side
  const numMat = new THREE.MeshStandardMaterial({ map: createIslandNumberTexture(), roughness: 0.5 });
  const numSign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), numMat);
  numSign.position.set(-3.45, 7.2, 3);
  numSign.rotation.y = -Math.PI / 2;
  island.add(numSign);

  // Bridge windows (Primary Flight Control + Navigation Bridge)
  const bridgeGlass = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x1e3a5f,
    emissiveIntensity: 0.6,
    roughness: 0.1,
    metalness: 0.9,
  });
  const navBridge = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.0, 10), bridgeGlass);
  navBridge.position.set(-0.2, 10.2, 4.5);
  island.add(navBridge);

  const priFly = new THREE.Mesh(new THREE.BoxGeometry(8.2, 2.2, 7.5), bridgeGlass);
  priFly.position.set(-0.6, 13.4, -2.5);
  island.add(priFly);

  // Upper island block
  const islandTop = new THREE.Mesh(new THREE.BoxGeometry(5.8, 4.5, 16), superMat);
  islandTop.position.set(0, 14.5, -1);
  island.add(islandTop);

  // Main Radar Mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.1, 15, 6), superMat);
  mast.position.set(0, 23, 2);
  island.add(mast);

  // Cross yardarm
  const yard = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.35, 0.45), superMat);
  yard.position.set(0, 25.5, 2);
  island.add(yard);

  // Rotating SPS-48E 3D Air Search Radar
  const radar1 = new THREE.Group();
  radar1.position.set(0, 30.8, 2);
  const dish1 = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.4, 0.5), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
  dish1.rotation.x = -0.22;
  radar1.add(dish1);
  island.add(radar1);
  radars.push(radar1);

  // Rotating SPS-49 Long Range Radar (aft mast)
  const mast2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 10, 6), superMat);
  mast2.position.set(0, 20.5, -6.5);
  island.add(mast2);

  const radar2 = new THREE.Group();
  radar2.position.set(0, 25.8, -6.5);
  const dish2 = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.9, 0.6), new THREE.MeshStandardMaterial({ color: 0xcbd5e1 }));
  radar2.add(dish2);
  island.add(radar2);
  radars.push(radar2);

  // White SATCOM radomes
  const domeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  const dome1 = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 10), domeMat);
  dome1.position.set(1.5, 17.5, 5.2);
  island.add(dome1);
  const dome2 = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 10), domeMat);
  dome2.position.set(-1.5, 17.5, -7.8);
  island.add(dome2);

  // Navigation beacon lights
  const redBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff3b30 })
  );
  redBeacon.position.set(0, 32.5, 2);
  island.add(redBeacon);

  group.add(island);

  // ===== 4x PHALANX CIWS TURRETS ON SPONSONS =====
  const ciwsPositions: [number, number, number][] = [
    [18.5, 9.6, 52],
    [-19.5, 9.6, 38],
    [-21.0, 9.6, -54],
    [18.0, 9.6, -54],
  ];
  for (const [cx, cy, cz] of ciwsPositions) {
    const turret = createPhalanxCIWS();
    turret.position.set(cx, cy, cz);
    group.add(turret);
    ciwsTurrets.push(turret);
  }

  // ===== PARKED AIR WING ON DECK (F/A-18 Super Hornets + E-2D Hawkeye) =====
  const jetConfigs: { pos: [number, number, number]; rotY: number; isAwacs?: boolean }[] = [
    { pos: [11.5, 11.6, 42], rotY: -0.55 },
    { pos: [12.0, 11.6, 26], rotY: -0.6 },
    { pos: [11.5, 11.6, 12], rotY: -0.5 },
    { pos: [-11.5, 11.6, 46], rotY: 0.45 },
    { pos: [-13.5, 11.6, 28], rotY: 0.5 },
    { pos: [11.0, 11.6, -34], rotY: -0.7 },
    { pos: [10.5, 11.6, -48], rotY: -0.8 },
    { pos: [-11.5, 11.6, -44], rotY: 0.65, isAwacs: true },
  ];
  for (const cfg of jetConfigs) {
    const craft = cfg.isAwacs ? createE2Hawkeye(1.0) : createFA18Jet(1.05);
    craft.position.set(...cfg.pos);
    craft.rotation.y = cfg.rotY;
    group.add(craft);
    deckJets.push(craft);
  }

  // Trailing water wake
  const wakeMat = new THREE.MeshBasicMaterial({
    map: sharedWakeTex,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const wakeMesh = new THREE.Mesh(new THREE.PlaneGeometry(46, 185), wakeMat);
  wakeMesh.rotation.x = -Math.PI / 2;
  wakeMesh.position.set(0, 0.35, -148);
  group.add(wakeMesh);

  return { group, radars, ciwsTurrets, deckJets, wakeMesh };
}

export function buildAegisDestroyer(isCruiser = false): EscortBuildResult {
  const group = new THREE.Group();
  const radars: THREE.Object3D[] = [];

  const scaleLen = isCruiser ? 1.15 : 1.0;
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x526071, roughness: 0.6, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x263140, roughness: 0.5, metalness: 0.4 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 });
  const radarPanelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.4 });

  // Main hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(10.5, 5.2, 62 * scaleLen), hullMat);
  hull.position.set(0, 2.2, 0);
  group.add(hull);

  // Sharp stealth bow
  const bowGeo = new THREE.ConeGeometry(7.4, 18, 4);
  bowGeo.rotateY(Math.PI / 4);
  bowGeo.rotateX(Math.PI / 2);
  const bow = new THREE.Mesh(bowGeo, hullMat);
  bow.scale.set(0.75, 0.46, 1.0);
  bow.position.set(0, 2.4, 34 * scaleLen);
  group.add(bow);

  // Forward Mk 45 5-inch Naval Gun
  const turret = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 2.8), hullMat);
  turret.position.set(0, 5.6, 23 * scaleLen);
  group.add(turret);
  const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 4.8, 6), darkMat);
  gunBarrel.rotation.x = Math.PI / 2 - 0.12;
  gunBarrel.position.set(0, 6.0, 26 * scaleLen);
  group.add(gunBarrel);

  // Forward Mk 41 VLS Vertical Launch System Cells
  const vls = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.6, 6.4), darkMat);
  vls.position.set(0, 5.0, 15 * scaleLen);
  group.add(vls);

  // Stealth angled Aegis Bridge Superstructure
  const superHeight = isCruiser ? 10.5 : 7.8;
  const deckhouse = new THREE.Mesh(new THREE.BoxGeometry(8.2, superHeight, 22), hullMat);
  deckhouse.position.set(0, 4.8 + superHeight / 2, 2);
  group.add(deckhouse);

  // Iconic SPY-1D octagonal Aegis phased-array radar panels
  const panelGeo = new THREE.BoxGeometry(2.8, 2.8, 0.3);
  const pFront = new THREE.Mesh(panelGeo, radarPanelMat);
  pFront.position.set(0, 4.8 + superHeight * 0.6, 13.15);
  group.add(pFront);
  const pLeft = new THREE.Mesh(panelGeo, radarPanelMat);
  pLeft.rotation.y = Math.PI / 2;
  pLeft.position.set(-4.15, 4.8 + superHeight * 0.6, 7);
  group.add(pLeft);
  const pRight = new THREE.Mesh(panelGeo, radarPanelMat);
  pRight.rotation.y = Math.PI / 2;
  pRight.position.set(4.15, 4.8 + superHeight * 0.6, 7);
  group.add(pRight);

  // Angled Mast & Rotating Search Radar
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.75, 11, 6), hullMat);
  mast.position.set(0, 4.8 + superHeight + 5, 3);
  mast.rotation.x = -0.15;
  group.add(mast);

  const radar = new THREE.Group();
  radar.position.set(0, 4.8 + superHeight + 10.6, 2.2);
  const dish = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 0.4), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
  radar.add(dish);
  group.add(radar);
  radars.push(radar);

  // Twin Funnels
  const funnel1 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.2, 4.6), darkMat);
  funnel1.position.set(0, 10.2, -5.5);
  group.add(funnel1);

  const funnel2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.8, 4.6), darkMat);
  funnel2.position.set(0, 9.8, -13);
  group.add(funnel2);

  // Aft Helipad with white H markings
  const helipad = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.4, 13), deckMat);
  helipad.position.set(0, 4.9, -24 * scaleLen);
  group.add(helipad);

  // CIWS aft
  const ciws = createPhalanxCIWS();
  ciws.scale.setScalar(0.68);
  ciws.position.set(0, 8.2, -16);
  group.add(ciws);

  // Wake
  const wakeMat = new THREE.MeshBasicMaterial({
    map: sharedWakeTex,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const wakeMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 110), wakeMat);
  wakeMesh.rotation.x = -Math.PI / 2;
  wakeMesh.position.set(0, 0.3, -84 * scaleLen);
  group.add(wakeMesh);

  return {
    group,
    radars,
    vlsOrigin: new THREE.Vector3(0, 6.2, 15 * scaleLen),
    ciwsOrigin: new THREE.Vector3(0, 9.5, -16),
    wakeMesh,
  };
}
