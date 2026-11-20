import * as THREE from 'three';
import { LaunchOrigin } from '../../types/game';

export interface CoastalBaseBuildResult {
  group: THREE.Group;
  radars: THREE.Object3D[];
  launchPoints: Record<LaunchOrigin, THREE.Vector3>;
  telCanisters: { north: THREE.Object3D; south: THREE.Object3D };
  fastBoats: THREE.Object3D[];
  submarine: THREE.Object3D;
}

function createTELTruck(accentColor = 0x556b2f): { group: THREE.Group; canister: THREE.Object3D } {
  const truck = new THREE.Group();
  const camoMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.75, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e2420, roughness: 0.8 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });

  // Heavy 10x10 chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.8, 18), camoMat);
  chassis.position.set(0, 2.2, 0);
  truck.add(chassis);

  // Armored forward cab
  const cab = new THREE.Mesh(new THREE.BoxGeometry(5.0, 3.2, 4.4), camoMat);
  cab.position.set(0, 4.2, 6.8);
  truck.add(cab);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.3, 0.2), glassMat);
  windshield.position.set(0, 4.7, 9.05);
  truck.add(windshield);

  // 5 axles (10 giant off-road tires!)
  const wheelGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.9, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const z = -6.5 + i * 3.25;
    const leftW = new THREE.Mesh(wheelGeo, wheelMat);
    leftW.position.set(-2.7, 1.3, z);
    truck.add(leftW);
    const rightW = new THREE.Mesh(wheelGeo, wheelMat);
    rightW.position.set(2.7, 1.3, z);
    truck.add(rightW);
  }

  // Elevating missile canister pivot (hinged at aft)
  const canisterPivot = new THREE.Group();
  canisterPivot.position.set(0, 3.5, -6.5);

  const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.45, 15.5, 12), darkMat);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, 0.6, 7.2);
  canisterPivot.add(tube);

  // Missile nose peeking out
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 3.2, 10),
    new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.4 })
  );
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.6, 15.8);
  canisterPivot.add(tip);

  // Default elevated tactical readiness (~55 degrees up)
  canisterPivot.rotation.x = -0.92;
  truck.add(canisterPivot);

  return { group: truck, canister: canisterPivot };
}

function createBavar373Battery(): { group: THREE.Group; radar: THREE.Object3D } {
  const group = new THREE.Group();
  const sandMat = new THREE.MeshStandardMaterial({ color: 0x8a795d, roughness: 0.72, metalness: 0.15 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.65 });

  // Bavar-373 4-tube vertical SAM launcher truck
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.0, 14), sandMat);
  chassis.position.set(0, 2.2, 0);
  group.add(chassis);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.0, 3.8), sandMat);
  cab.position.set(0, 4.2, 5.2);
  group.add(cab);

  // 4 Vertical Sayyad-4 square canisters!
  for (let gx = -1; gx <= 1; gx += 2) {
    for (let gz = -1; gz <= 1; gz += 2) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.7, 11.5, 1.7), sandMat);
      box.position.set(gx * 1.15, 7.8, -3.2 + gz * 1.15);
      group.add(box);
    }
  }

  // Meraj-4 Phased Array Radar truck beside it
  const radarTruck = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.2, 11), sandMat);
  radarTruck.position.set(14, 2.2, -2);
  group.add(radarTruck);

  const radarPivot = new THREE.Group();
  radarPivot.position.set(14, 7.0, -4);
  const arrayFace = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 4.4, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.4, metalness: 0.3 })
  );
  arrayFace.rotation.x = -0.25;
  radarPivot.add(arrayFace);

  const glowLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x22c55e })
  );
  glowLed.position.set(0, 2.6, 0);
  radarPivot.add(glowLed);

  group.add(radarPivot);

  // Concrete berm
  const pad = new THREE.Mesh(new THREE.BoxGeometry(28, 0.8, 22), darkMat);
  pad.position.set(6, 0.4, -1);
  group.add(pad);

  return { group, radar: radarPivot };
}

function createFastAttackCraft(): THREE.Group {
  const boat = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.35 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.5 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.6, 15), hullMat);
  hull.position.y = 0.8;
  boat.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5.5, 4), hullMat);
  bow.rotation.y = Math.PI / 4;
  bow.rotation.x = Math.PI / 2;
  bow.scale.set(0.75, 0.45, 1);
  bow.position.set(0, 0.8, 9.8);
  boat.add(bow);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.0, 4.8), cabinMat);
  cabin.position.set(0, 2.4, 0.5);
  boat.add(cabin);

  // Dual angled anti-ship missile canisters
  for (const sx of [-1.2, 1.2]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4.4, 8), tubeMat);
    can.rotation.x = Math.PI / 2 - 0.35;
    can.position.set(sx, 2.2, -3.5);
    boat.add(can);
  }

  return boat;
}

function createGhadirSubmarine(): THREE.Group {
  const sub = new THREE.Group();
  const subMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.45 });
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(2.3, 18, 8, 14), subMat);
  hull.rotation.x = Math.PI / 2;
  hull.position.y = 0.2;
  sub.add(hull);

  // Conning tower (sail)
  const sail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.8, 4.8), subMat);
  sail.position.set(0, 2.6, 1.8);
  sub.add(sail);

  const periscope = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6), subMat);
  periscope.position.set(0, 5.5, 2.4);
  sub.add(periscope);

  // Dive planes
  const fin = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.25, 1.6), subMat);
  fin.position.set(0, 2.4, 2.0);
  sub.add(fin);

  return sub;
}

export function buildCoastalMilitaryBase(baseZ = 540): CoastalBaseBuildResult {
  const group = new THREE.Group();
  const radars: THREE.Object3D[] = [];
  const fastBoats: THREE.Object3D[] = [];

  // Base sits on Southern/Coastal shoreline around z = +540, facing -Z toward the Carrier Strike Group at z = -340
  const terrainGroup = new THREE.Group();
  terrainGroup.position.set(0, 0, baseZ);

  const desertMat = new THREE.MeshStandardMaterial({ color: 0x9c825f, roughness: 0.92, metalness: 0.05 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b5b47, roughness: 0.95 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.85 });

  // Main coastal plateau island
  const islandGeo = new THREE.CylinderGeometry(185, 240, 14, 18);
  const island = new THREE.Mesh(islandGeo, desertMat);
  island.scale.set(1.55, 1.0, 0.72);
  island.position.set(0, 5, 45);
  terrainGroup.add(island);

  // Rugged coastal mountains behind the base (dramatic Hormuz backdrop!)
  const peaks: [number, number, number, number, number][] = [
    [-160, 42, 125, 78, 86],
    [-60, 56, 155, 92, 114],
    [70, 48, 140, 84, 98],
    [185, 38, 115, 74, 78],
    [0, 32, 170, 62, 65],
  ];
  for (const [px, py, pz, r, h] of peaks) {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), rockMat);
    peak.position.set(px, py, pz);
    peak.rotation.y = px * 0.1;
    terrainGroup.add(peak);
  }

  // Reinforced concrete coastal tarmac & launch pads
  const tarmac = new THREE.Mesh(new THREE.BoxGeometry(260, 1.5, 90), concreteMat);
  tarmac.position.set(0, 12.2, 18);
  terrainGroup.add(tarmac);

  // Underground Heavy Silo (center)
  const siloRing = new THREE.Mesh(
    new THREE.CylinderGeometry(9.5, 11, 2.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7, metalness: 0.3 })
  );
  siloRing.position.set(0, 13.4, 22);
  terrainGroup.add(siloRing);

  const siloPit = new THREE.Mesh(
    new THREE.CylinderGeometry(6.8, 6.8, 2.6, 16),
    new THREE.MeshStandardMaterial({ color: 0x090d16 })
  );
  siloPit.position.set(0, 13.5, 22);
  terrainGroup.add(siloPit);

  // Warning beacon ring around silo
  const siloGlow = new THREE.Mesh(
    new THREE.RingGeometry(7.2, 8.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
  );
  siloGlow.rotation.x = -Math.PI / 2;
  siloGlow.position.set(0, 14.7, 22);
  terrainGroup.add(siloGlow);

  // TEL Launcher 1 (West / North-facing pad -> Fattah / Zolfaghar)
  const telNorth = createTELTruck(0x4d5d41);
  telNorth.group.position.set(-56, 13.0, 6);
  telNorth.group.rotation.y = Math.PI; // Faces -Z (toward carrier!)
  terrainGroup.add(telNorth.group);

  // TEL Launcher 2 (East pad -> Khalij Fars / Shahed-136)
  const telSouth = createTELTruck(0x6b6043);
  telSouth.group.position.set(56, 13.0, 6);
  telSouth.group.rotation.y = Math.PI;
  terrainGroup.add(telSouth.group);

  // Coastal Anti-Ship Cruise Battery (Noor/Qader/Abu Mahdi)
  const coastalBattery = new THREE.Group();
  coastalBattery.position.set(-108, 13.0, -8);
  for (let i = 0; i < 2; i++) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 2.8, 10.5),
      new THREE.MeshStandardMaterial({ color: 0x576148, roughness: 0.7 })
    );
    box.position.set(i * 6.5, 3.0, 0);
    box.rotation.x = 0.38;
    coastalBattery.add(box);
  }
  terrainGroup.add(coastalBattery);

  // Bavar-373 Air Defense Battery (East hill flank)
  const bavar = createBavar373Battery();
  bavar.group.position.set(102, 13.0, 16);
  bavar.group.rotation.y = Math.PI;
  terrainGroup.add(bavar.group);
  radars.push(bavar.radar);

  // Main Command Bunker + Tall Coastal Radar Tower
  const bunker = new THREE.Mesh(new THREE.BoxGeometry(28, 8, 18), concreteMat);
  bunker.position.set(-15, 16.5, 58);
  terrainGroup.add(bunker);

  const radarTower = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.8, 22, 8), concreteMat);
  radarTower.position.set(-15, 28, 58);
  terrainGroup.add(radarTower);

  const mainRadar = new THREE.Group();
  mainRadar.position.set(-15, 40, 58);
  const bigDish = new THREE.Mesh(
    new THREE.BoxGeometry(11, 4.2, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.35 })
  );
  mainRadar.add(bigDish);
  terrainGroup.add(mainRadar);
  radars.push(mainRadar);

  group.add(terrainGroup);

  // Ghadir-class Coastal Submarine in water ahead of the base (launches Hoot torpedoes!)
  const submarine = createGhadirSubmarine();
  submarine.position.set(78, 0.2, baseZ - 145);
  submarine.rotation.y = Math.PI + 0.12;
  group.add(submarine);

  // 2x IRGCN Fast Attack Craft patrolling coastal waters
  const boat1 = createFastAttackCraft();
  boat1.position.set(-110, 0.3, baseZ - 135);
  boat1.rotation.y = Math.PI - 0.15;
  group.add(boat1);
  fastBoats.push(boat1);

  const boat2 = createFastAttackCraft();
  boat2.position.set(-45, 0.3, baseZ - 165);
  boat2.rotation.y = Math.PI + 0.08;
  group.add(boat2);
  fastBoats.push(boat2);

  // World-space launch origins
  const launchPoints: Record<LaunchOrigin, THREE.Vector3> = {
    tel_north: new THREE.Vector3(-56, 22, baseZ + 6),
    tel_south: new THREE.Vector3(56, 22, baseZ + 6),
    silo: new THREE.Vector3(0, 15.5, baseZ + 22),
    coastal_battery: new THREE.Vector3(-105, 18.5, baseZ - 8),
    submarine: new THREE.Vector3(78, -2.0, baseZ - 155),
    fast_boat: new THREE.Vector3(-45, 3.5, baseZ - 165),
  };

  return {
    group,
    radars,
    launchPoints,
    telCanisters: { north: telNorth.canister, south: telSouth.canister },
    fastBoats,
    submarine,
  };
}
