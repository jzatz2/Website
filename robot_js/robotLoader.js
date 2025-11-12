import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import {
  ROBOT_CONFIG, GRIPPER_CONFIG, LINK_ORDER, GRIPPER_ORDER,
  MESH_PATHS, GRIPPER_MESH_PATHS
} from './robotConfig.js';

function loadSTL(path, material) {
  const loader = new STLLoader();
  return new Promise((resolve, reject) => {
    loader.load(path, (geometry) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      resolve(mesh);
    }, undefined, reject);
  });
}

export async function buildRobot(rootGroup, materials) {
  const nodes = {};
  const gripperNodes = {};

  // --- Build arm frames/joints
  for (const name of LINK_ORDER) {
    const cfg = ROBOT_CONFIG[name];
    const frame = new THREE.Group();
    frame.position.fromArray(cfg.pos);
    frame.quaternion.set(cfg.quat[1], cfg.quat[2], cfg.quat[3], cfg.quat[0]);
    const joint = new THREE.Group();
    frame.add(joint);
    nodes[name] = { frame, joint };
  }
  for (const name of LINK_ORDER) {
    const parentName = ROBOT_CONFIG[name].parent;
    const parent = (parentName === 'ground') ? rootGroup : nodes[parentName].joint;
    parent.add(nodes[name].frame);
  }

  // --- Load arm meshes
  const meshPromises = {};
  for (const name of LINK_ORDER) meshPromises[name] = loadSTL(MESH_PATHS[name], materials.link);
  const meshes = {};
  for (const name of LINK_ORDER) meshes[name] = await meshPromises[name];
  for (const name of LINK_ORDER) { nodes[name].mesh = meshes[name]; nodes[name].joint.add(meshes[name]); }

  // --- Build gripper frames/joints
  for (const name of GRIPPER_ORDER) {
    const cfg = GRIPPER_CONFIG[name];
    const frame = new THREE.Group();
    frame.position.fromArray(cfg.pos);
    frame.quaternion.set(cfg.quat[1], cfg.quat[2], cfg.quat[3], cfg.quat[0]);
    const joint = new THREE.Group();
    frame.add(joint);
    gripperNodes[name] = { frame, joint };
  }
  for (const name of GRIPPER_ORDER) {
    const parentName = GRIPPER_CONFIG[name].parent;
    const parent = (parentName === 'link6') ? nodes.link6.joint : gripperNodes[parentName].joint;
    parent.add(gripperNodes[name].frame);
  }

  // --- Load gripper meshes
  const gMeshPromises = {};
  for (const name of GRIPPER_ORDER) gMeshPromises[name] = loadSTL(GRIPPER_MESH_PATHS[name], materials.gripper);
  const gMeshes = {};
  for (const name of GRIPPER_ORDER) gMeshes[name] = await gMeshPromises[name];
  for (const name of GRIPPER_ORDER) {
    gripperNodes[name].mesh = gMeshes[name];
    gripperNodes[name].joint.add(gMeshes[name]);
  }

  // Attachment site sphere (kept for math; hidden visually)
  const indicatorGeometry = new THREE.SphereGeometry(0.015, 16, 16);
  const indicatorMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0 });
  const attachmentSite = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
  attachmentSite.name = 'attachment_site';
  attachmentSite.castShadow = false;
  attachmentSite.visible = false; // <- make sure it's not rendered at all

  gripperNodes.base.joint.add(attachmentSite);

  const leftPadLocal = new THREE.Vector3();
  const rightPadLocal = new THREE.Vector3();
  {
    const lmesh = gripperNodes.left_finger.mesh;
    const rmesh = gripperNodes.right_finger.mesh;
    if (!lmesh.geometry.boundingBox) lmesh.geometry.computeBoundingBox();
    if (!rmesh.geometry.boundingBox) rmesh.geometry.computeBoundingBox();
    lmesh.geometry.boundingBox.getCenter(leftPadLocal);
    rmesh.geometry.boundingBox.getCenter(rightPadLocal);
  }

  const localOffset = new THREE.Vector3(0, 0, 0);

  // Initialize anchor immediately from current pose
  {
    const lw = gripperNodes.left_finger.mesh.localToWorld(leftPadLocal.clone());
    const rw = gripperNodes.right_finger.mesh.localToWorld(rightPadLocal.clone());
    const ll = gripperNodes.base.joint.worldToLocal(lw.clone());
    const rl = gripperNodes.base.joint.worldToLocal(rw.clone());
    const mid = ll.add(rl).multiplyScalar(0.5).add(localOffset);
    gripperNodes.base.joint.userData.attachmentAnchorLocal = mid.clone();
  }

  attachmentSite.userData.maxGap = 0;
  const GAP_EPS = 1e-5;

  attachmentSite.onBeforeRender = () => {
    const lw = gripperNodes.left_finger.mesh.localToWorld(leftPadLocal.clone());
    const rw = gripperNodes.right_finger.mesh.localToWorld(rightPadLocal.clone());
    const ll = gripperNodes.base.joint.worldToLocal(lw.clone());
    const rl = gripperNodes.base.joint.worldToLocal(rw.clone());
    const gap = ll.distanceTo(rl);
    const mid = ll.add(rl).multiplyScalar(0.5).add(localOffset);

    if (gap > (attachmentSite.userData.maxGap + GAP_EPS)) {
      attachmentSite.userData.maxGap = gap;
      gripperNodes.base.joint.userData.attachmentAnchorLocal = mid.clone();
    }

    const anchor = gripperNodes.base.joint.userData.attachmentAnchorLocal;
    attachmentSite.position.copy(anchor);
  };

  return { nodes, gripperNodes };
}
