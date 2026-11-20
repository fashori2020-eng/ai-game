import * as THREE from 'three';
import { MissileId } from '../../types/game';

export interface MissileMeshParts {
  group: THREE.Group;
  flame?: THREE.Mesh;
  plasmaCone?: THREE.Mesh;
  propeller?: THREE.Object3D;
  boosterStage?: THREE.Object3D;
}

function addCruciformFins(
  parent: THREE.Object3D,
  zPos: number,
  span: number,
  chord: number,
  mat: THREE.Material,
  thickness = 0.08
) {
  const finH = new THREE.Mesh(new THREE.BoxGeometry(span, thickness, chord), mat);
  finH.position.set(0, 0, zPos);
  parent.add(finH);

  const finV = new THREE.Mesh(new THREE.BoxGeometry(thickness, span, chord), mat);
  finV.position.set(0, 0, zPos);
  parent.add(finV);
}

function addEngineFlame(parent: THREE.Object3D, zPos: number, radius: number, length: number, color = 0xff9d2e): THREE.Mesh {
  const geo = new THREE.ConeGeometry(radius, length, 8);
  geo.rotateX(-Math.PI / 2); // Point toward -Z
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
  });
  const flame = new THREE.Mesh(geo, mat);
  flame.position.set(0, 0, zPos - length / 2);
  parent.add(flame);
  return flame;
}

export function buildMissileMesh(id: MissileId, isSubmunition = false): MissileMeshParts {
  const group = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.25 });
  const oliveMat = new THREE.MeshStandardMaterial({ color: 0x4d5d41, roughness: 0.55, metalness: 0.25 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.7 });
  const redAccent = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.2 });
  const goldAccent = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.5 });

  let flame: THREE.Mesh | undefined;
  let plasmaCone: THREE.Mesh | undefined;
  let propeller: THREE.Object3D | undefined;
  let boosterStage: THREE.Object3D | undefined;

  if (isSubmunition) {
    // MIRV Reentry Vehicle (sleek glowing conical warhead!)
    const rv = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.6, 10), darkMat);
    rv.rotation.x = Math.PI / 2;
    group.add(rv);

    const glowGeo = new THREE.ConeGeometry(0.95, 4.4, 12, 1, true);
    glowGeo.rotateX(Math.PI / 2);
    plasmaCone = new THREE.Mesh(
      glowGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff6a00,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
      })
    );
    plasmaCone.position.z = 0.2;
    group.add(plasmaCone);
    flame = addEngineFlame(group, -1.8, 0.42, 3.2, 0xffaa33);
    return { group, flame, plasmaCone };
  }

  switch (id) {
    case 'fattah': {
      // Fattah-2 Hypersonic Glide Vehicle (Sleek futuristic matte-black wedge + bright plasma sheath)
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.72, 6.2, 8), darkMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);

      // Wedge hypersonic glider nose
      const glider = new THREE.Mesh(new THREE.ConeGeometry(0.75, 4.2, 4), darkMat);
      glider.rotation.x = Math.PI / 2;
      glider.rotation.z = Math.PI / 4;
      glider.scale.set(1.25, 0.58, 1.0);
      glider.position.z = 4.6;
      group.add(glider);

      // Swept glider chines
      const chine = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 3.4), darkMat);
      chine.position.set(0, 0, 1.5);
      group.add(chine);

      addCruciformFins(group, -2.5, 2.2, 1.5, goldAccent, 0.1);

      // Cyan-orange hypersonic plasma shockwave cone!
      const pGeo = new THREE.ConeGeometry(1.75, 7.2, 14, 1, true);
      pGeo.rotateX(Math.PI / 2);
      plasmaCone = new THREE.Mesh(
        pGeo,
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.34,
          side: THREE.DoubleSide,
        })
      );
      plasmaCone.position.z = 3.2;
      group.add(plasmaCone);

      flame = addEngineFlame(group, -3.1, 0.65, 5.2, 0x7dd3fc);
      break;
    }

    case 'khalij_fars': {
      // Khalij Fars ASBM (Fateh-110 family: iconic olive/white body, 4 delta rear fins, 4 small canards, glass optical nose)
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.58, 7.6, 10), whiteMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);

      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.57, 1.1, 10), redAccent);
      stripe.rotation.x = Math.PI / 2;
      stripe.position.z = 1.6;
      group.add(stripe);

      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 10), darkMat);
      nose.rotation.x = Math.PI / 2;
      nose.position.z = 4.9;
      group.add(nose);

      // Optical seeker dome
      const seeker = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      seeker.position.z = 5.95;
      group.add(seeker);

      addCruciformFins(group, -3.0, 2.4, 1.8, oliveMat);
      addCruciformFins(group, 2.8, 1.4, 0.8, darkMat);
      flame = addEngineFlame(group, -3.8, 0.55, 4.4, 0xffa62b);
      break;
    }

    case 'khorramshahr4': {
      // Heavy wide-body MRBM with MIRV fairing
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 9.6, 12), oliveMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);

      const fairing = new THREE.Mesh(new THREE.ConeGeometry(1.05, 3.8, 12), whiteMat);
      fairing.rotation.x = Math.PI / 2;
      fairing.position.z = 6.7;
      group.add(fairing);

      const band = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.9, 12), redAccent);
      band.rotation.x = Math.PI / 2;
      band.position.z = 3.8;
      group.add(band);

      addCruciformFins(group, -4.1, 3.3, 1.8, darkMat, 0.14);
      flame = addEngineFlame(group, -4.9, 1.05, 7.2, 0xff7b1a);
      break;
    }

    case 'sejjil': {
      // Sejjil-2 Two-Stage Solid Rocket (Upper stage + detachable lower booster!)
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.82, 5.2, 12), whiteMat);
      upper.rotation.x = Math.PI / 2;
      upper.position.z = 2.6;
      group.add(upper);

      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.75, 3.0, 12), darkMat);
      nose.rotation.x = Math.PI / 2;
      nose.position.z = 6.7;
      group.add(nose);

      addCruciformFins(group, 0.6, 2.1, 1.2, redAccent);

      // Detachable Stage 1 Booster
      const stage1 = new THREE.Group();
      const s1Body = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.92, 6.2, 12), oliveMat);
      s1Body.rotation.x = Math.PI / 2;
      s1Body.position.z = -3.1;
      stage1.add(s1Body);
      addCruciformFins(stage1, -5.4, 3.1, 2.0, darkMat, 0.12);
      group.add(stage1);
      boosterStage = stage1;

      flame = addEngineFlame(group, -6.2, 0.95, 6.8, 0xff922b);
      break;
    }

    case 'noor_qader':
    case 'abu_mahdi': {
      // Sea-skimming Anti-Ship Cruise Missile (mid-body wings + ventral turbojet intake)
      const isStealth = id === 'abu_mahdi';
      const bodyMat = isStealth ? darkMat : whiteMat;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 6.2, 10), bodyMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);

      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.6, 10), isStealth ? darkMat : redAccent);
      nose.rotation.x = Math.PI / 2;
      nose.position.z = 3.9;
      group.add(nose);

      // Swept cruise wings
      const wing = new THREE.Mesh(new THREE.BoxGeometry(isStealth ? 4.4 : 3.4, 0.1, 1.15), bodyMat);
      wing.position.set(0, 0, 0.4);
      group.add(wing);

      // Ventral turbojet air intake
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 1.6), darkMat);
      intake.position.set(0, -0.46, -0.8);
      group.add(intake);

      addCruciformFins(group, -2.6, 1.6, 0.85, darkMat);
      flame = addEngineFlame(group, -3.15, 0.32, 2.5, isStealth ? 0x2dd4bf : 0xffaa33);
      break;
    }

    case 'shahed136': {
      // Iconic Cropped Delta-Wing Shahed-136 Loitering Munition with spinning pusher propeller!
      const shahedMat = new THREE.MeshStandardMaterial({ color: 0xd6d3cb, roughness: 0.65 });

      // Delta wing triangle extruded via flattened cone/prism
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 2.8);
      wingShape.lineTo(2.1, -1.6);
      wingShape.lineTo(-2.1, -1.6);
      wingShape.closePath();

      const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.16, bevelEnabled: false });
      wingGeo.rotateX(Math.PI / 2);
      const wingMesh = new THREE.Mesh(wingGeo, shahedMat);
      wingMesh.position.y = 0.08;
      group.add(wingMesh);

      // Blended central fuselage
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 4.4, 8), shahedMat);
      fuse.rotation.x = Math.PI / 2;
      fuse.position.z = 0.5;
      group.add(fuse);

      // Signature wingtip vertical stabilizers
      for (const sx of [-2.05, 2.05]) {
        const tipFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 1.1), darkMat);
        tipFin.position.set(sx, 0.1, -1.1);
        group.add(tipFin);
      }

      // Rear pusher propeller
      const propGroup = new THREE.Group();
      propGroup.position.set(0, 0, -1.85);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 0.06), darkMat);
      propGroup.add(blade);
      group.add(propGroup);
      propeller = propGroup;
      break;
    }

    case 'zolfaghar_basir': {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 8.2, 10), oliveMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);

      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.58, 2.6, 10), darkMat);
      nose.rotation.x = Math.PI / 2;
      nose.position.z = 5.4;
      group.add(nose);

      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.6, 10), goldAccent);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = 3.2;
      group.add(ring);

      addCruciformFins(group, -3.3, 2.5, 1.7, darkMat);
      addCruciformFins(group, 2.9, 1.3, 0.7, goldAccent);
      flame = addEngineFlame(group, -4.1, 0.58, 4.8, 0xc084fc);
      break;
    }

    case 'emad': {
      // Emad / Ghadr with distinctive biconic MaRV nosecone!
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.88, 8.8, 12), whiteMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);

      // Baby-bottle biconic MaRV warhead
      const marvBase = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 1.8, 12), darkMat);
      marvBase.rotation.x = Math.PI / 2;
      marvBase.position.z = 5.3;
      group.add(marvBase);

      const marvTip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 12), redAccent);
      marvTip.rotation.x = Math.PI / 2;
      marvTip.position.z = 7.3;
      group.add(marvTip);

      addCruciformFins(group, -3.7, 2.8, 1.7, darkMat);
      addCruciformFins(group, 4.6, 1.35, 0.6, goldAccent);
      flame = addEngineFlame(group, -4.4, 0.82, 5.8, 0xff6b4a);
      break;
    }

    case 'hoot': {
      // Hoot Supercavitating Underwater Rocket Torpedo (flat cavitator nose disk + bubble cone!)
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 7.0, 12), darkMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);

      // Flat circular cavitator disk at nose
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.45, 12), goldAccent);
      disk.rotation.x = Math.PI / 2;
      disk.position.z = 3.7;
      group.add(disk);

      // Translucent white supercavitation vapor envelope around the torpedo
      const bubbleGeo = new THREE.ConeGeometry(1.1, 9.0, 12, 1, true);
      bubbleGeo.rotateX(Math.PI / 2);
      plasmaCone = new THREE.Mesh(
        bubbleGeo,
        new THREE.MeshBasicMaterial({
          color: 0xbae6fd,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
        })
      );
      plasmaCone.position.z = -0.3;
      group.add(plasmaCone);

      flame = addEngineFlame(group, -3.6, 0.4, 3.2, 0x38bdf8);
      break;
    }
  }

  return { group, flame, plasmaCone, propeller, boosterStage };
}

export function buildInterceptorMesh(): THREE.Group {
  const group = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x334155 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 4.6, 8), whiteMat);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.2, 8), darkMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 2.9;
  group.add(nose);

  addCruciformFins(group, -1.8, 1.2, 0.8, darkMat, 0.05);
  addEngineFlame(group, -2.3, 0.28, 2.8, 0xff5252);
  return group;
}
