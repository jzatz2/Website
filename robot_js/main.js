import * as THREE from 'three';
import { createScene, createCamera, createRenderer, createMaterials } from './sceneSetup.js';
import { buildRobot } from './robotLoader.js';
import { JointController } from './jointController.js';
import { IKSolver } from './inverseKinematics.js';
import { PhysicsWorld } from './physics.js';

const canvas   = document.getElementById('canvas');
const loader   = document.getElementById('loader');
const renderer = createRenderer(canvas);
renderer.setClearColor(0xffffff); // White background
const scene    = createScene();

function getAspect(){
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  return w / Math.max(1, h);
}
let camera = createCamera(getAspect());
scene.add(camera);

// lights
{
  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(2,3,4);
  dir.castShadow = true;
  scene.add(amb, dir);
}

// robot root (lock to 2D plane as you had)
const robotRoot = new THREE.Group();
scene.add(robotRoot);
robotRoot.rotation.x = -Math.PI/2;
robotRoot.rotation.z = -Math.PI/6;

function fitCamera(cam, obj, viewDir=new THREE.Vector3(0,0,1), pad=1.8){
  obj.updateWorldMatrix(true,true);
  const box = new THREE.Box3().setFromObject(obj);
  const sph = new THREE.Sphere(); box.getBoundingSphere(sph);
  if (!isFinite(sph.radius) || sph.radius === 0) return;
  const d = (sph.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov)*0.5))*pad;
  cam.position.copy(sph.center).add(viewDir.clone().multiplyScalar(d));
  cam.up.set(0,1,0);
  cam.near = Math.max(0.01, d/25); cam.far = d*25; cam.updateProjectionMatrix();
  cam.lookAt(sph.center);
}

// mouse → IK plane through site
const raycaster = new THREE.Raycaster();
const mouseNDC  = new THREE.Vector2();
const camPlane  = new THREE.Plane();
window.addEventListener('pointermove', (e)=>{
  const r = canvas.getBoundingClientRect();
  mouseNDC.x = ((e.clientX - r.left)/r.width)*2 - 1;
  mouseNDC.y = -((e.clientY - r.top)/r.height)*2 + 1;
}, { passive:true });

// globals
let nodes=null, gripper=null, jc=null, phys=null;
let ballMesh=null, ballBody=null;
let groundY=0, planeZ=0;
let gripped=false;       // ball is gripped
let ballInWorld=true;    // physics body active
let boundsRect=null;     // {cx, cy, halfWidth, halfHeight}


const BALL = { mass: 0.06, radius: 0.016 };
const CAPTURE_MARGIN = 0.025; // "near" gate for gripping (XY distance)

const BOUNDS = {
  halfWidth: 0.8,
  halfHeight: 0.8,
  wallThickness: 0.06,
  wallDepth: 0.35,
  outlineDepthOffset: 0.001,
  outlineColor: 0x111111
};

// ============================
// Attachment-site helpers
// ============================
// Read the attachment anchor from gripper base joint's userData
function getAttachmentSiteWorld(outPos=new THREE.Vector3(), outQuat=new THREE.Quaternion()){
  const base = gripper?.base?.joint;
  if (!base) return null;
  const anchorLocal = base.userData?.attachmentAnchorLocal;
  if (!anchorLocal) return null;
  
  // Update matrices to get current world transform
  robotRoot.updateWorldMatrix(true, true);
  base.updateWorldMatrix(true, true);
  
  // Convert local anchor to world position
  const worldPos = base.localToWorld(anchorLocal.clone());
  base.getWorldQuaternion(outQuat);
  
  outPos.copy(worldPos);
  return { pos: outPos, quat: outQuat };
}

function getBallWorld(){
  if (ballInWorld && ballBody) {
    return new THREE.Vector3(ballBody.position.x, ballBody.position.y, ballBody.position.z);
  }
  const w = new THREE.Vector3(); 
  ballMesh.getWorldPosition(w); 
  return w;
}

function isNearAttachmentSite(){
  const site = getAttachmentSiteWorld();
  if (!site) return false;
  
  const ballPos = getBallWorld();
  const dx = site.pos.x - ballPos.x;
  const dy = site.pos.y - ballPos.y;
  const dist2D = Math.sqrt(dx*dx + dy*dy);
  
  return dist2D <= (BALL.radius + CAPTURE_MARGIN);
}

// ============================
// Grip / Release
// ============================
function removeBallFromPhysics(){
  if (!ballInWorld) return;
  phys.world.removeBody(ballBody);
  ballInWorld = false;
}

function addBallToPhysics(){
  if (ballInWorld) return;
  phys.world.addBody(ballBody);
  ballInWorld = true;
}

function gripBall(){
  if (gripped) return;
  
  const site = getAttachmentSiteWorld();
  if (!site) return;
  
  // Remove from physics
  removeBallFromPhysics();
  gripped = true;
  
  // Set ball to exact attachment site pose
  ballMesh.position.copy(site.pos);
  ballMesh.quaternion.copy(site.quat);
  
  // Ensure visibility even if inside gripper jaws
  ballMesh.material.depthTest = false;
  ballMesh.material.depthWrite = false;
  ballMesh.renderOrder = 9999;
  
  console.log('[GRIP] Ball gripped at', site.pos);
}

function releaseBall(){
  if (!gripped) return;
  
  // Get current world pose before releasing
  const site = getAttachmentSiteWorld();
  if (site){
    ballMesh.position.copy(site.pos);
    ballMesh.quaternion.copy(site.quat);
  }
  
  // Add back to physics
  addBallToPhysics();
  
  // Sync physics body with mesh
  ballBody.position.set(ballMesh.position.x, ballMesh.position.y, planeZ);
  ballBody.quaternion.set(
    ballMesh.quaternion.x, 
    ballMesh.quaternion.y, 
    ballMesh.quaternion.z, 
    ballMesh.quaternion.w
  );
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  
  // Restore normal rendering
  ballMesh.material.depthTest = true;
  ballMesh.material.depthWrite = true;
  ballMesh.renderOrder = 1;
  
  gripped = false;
  
  console.log('[RELEASE] Ball released at', ballMesh.position);
}

// ============================
// Bounds & helpers
// ============================
function isOutsideBounds(pos, cx){
  const hw = BOUNDS.halfWidth, hh = BOUNDS.halfHeight;
  const minX = cx - hw, maxX = cx + hw;
  const minY = groundY, maxY = groundY + 2*hh;
  return (pos.x < minX - 1e-3) || (pos.x > maxX + 1e-3) ||
         (pos.y < minY - 1e-3) || (pos.y > maxY + 1e-3) ||
         !isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z);
}

function respawnBall(cx){
  if (!ballInWorld || gripped) return;
  const safeY = groundY + Math.min(0.35, 2*BOUNDS.halfHeight - 0.05);
  const safeX = THREE.MathUtils.clamp(
    cx + 0.20, 
    cx - (BOUNDS.halfWidth - 0.05), 
    cx + (BOUNDS.halfWidth - 0.05)
  );
  ballBody.position.set(safeX, safeY, planeZ);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
}

// ============================
// Init
// ============================
async function init(){
  loader.style.display='block';
  try{
    loader.style.pointerEvents='none';

    const built = await buildRobot(robotRoot, createMaterials());
    nodes   = built.nodes;
    gripper = built.gripperNodes;

    const ik = new IKSolver(nodes, gripper);
    jc = new JointController(nodes, gripper, ik);
    jc.setMouseMode(true);

    robotRoot.updateWorldMatrix(true, true);
    const rbBox = new THREE.Box3().setFromObject(robotRoot);
    groundY = (isFinite(rbBox.min.y) ? rbBox.min.y : 0) - 0.07;  // Lowered by 15cm
    planeZ  = rbBox.getCenter(new THREE.Vector3()).z;

    fitCamera(camera, robotRoot, new THREE.Vector3(0, 0, 1), 1.8);

    // physics
    phys = new PhysicsWorld();
    phys.addGround(groundY);

    // kinematic colliders for robot links
    const owners = [];
    Object.keys(nodes||{}).forEach(k=>{ 
      if (nodes[k]?.joint) owners.push(nodes[k].joint); 
    });
    Object.keys(gripper||{}).forEach(k=>{ 
      if (gripper[k]?.joint) owners.push(gripper[k].joint); 
    });
    owners.forEach(o => phys.addKinematicBoxFor(o));

    const cx = rbBox.getCenter(new THREE.Vector3()).x;
    boundsRect = {
      cx,
      cy: groundY + BOUNDS.halfHeight,
      halfWidth: BOUNDS.halfWidth,
      halfHeight: BOUNDS.halfHeight
    };
    phys.addBoundsSquare({
      cx,
      cy: boundsRect.cy,
      planeZ,
      groundY,
      halfWidth: boundsRect.halfWidth,
      halfHeight: boundsRect.halfHeight,
      wallThickness: BOUNDS.wallThickness,
      wallDepth: BOUNDS.wallDepth
    });

    // Create ball mesh
    ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL.radius, 24, 24),
      new THREE.MeshStandardMaterial({ 
        color: 0x000000, 
        metalness: 0.3, 
        roughness: 0.4 
      })
    );
    scene.add(ballMesh);

    // Spawn ball at ground level (same as robot base)
    const spawn = new THREE.Vector3(cx + 0.28, groundY + BALL.radius, planeZ);
    ballBody = phys.addDynamicSphere({
      radius: BALL.radius,
      position: [spawn.x, spawn.y, spawn.z],
      restitution: 0.05,
      mass: BALL.mass
    });
    ballBody.linearFactor.set(1, 1, 0);
    ballBody.angularFactor.set(0, 0, 1);
    ballBody.position.z = planeZ;
    ballInWorld = true;

    // Left-click: toggle gripper and handle grip/release
    canvas.addEventListener('pointerdown', (e)=>{
      if (e.button !== 0) return;
      
      const wasOpen = jc.gripperOpen;
      jc.toggleGripper();
      const isOpen = jc.gripperOpen;
      
      console.log(`[CLICK] Gripper ${isOpen ? 'OPENED' : 'CLOSED'}`);
      
      if (isOpen) {
        // Gripper just opened - check if we should grip
        if (isNearAttachmentSite() && !gripped) {
          console.log('[CLICK] Near ball, attempting grip...');
          gripBall();
        }
      } else {
        // Gripper just closed - release if gripped
        if (gripped) {
          console.log('[CLICK] Releasing ball...');
          releaseBall();
        }
      }
    }, { capture: true, passive: false });

  } catch(err){
    console.error('[main] init error:', err);
  } finally{
    loader.style.display='none';
  }
  animate();
}

// ============================
// Loop
// ============================
let lastT = performance.now();
function animate(){
  requestAnimationFrame(animate);
  try{
    // Mouse-driven IK target on plane through the attachment site
    if (jc?.mouseMode){
      const site = getAttachmentSiteWorld();
      if (site){
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        camPlane.setFromNormalAndCoplanarPoint(camDir.clone().negate(), site.pos);
        raycaster.setFromCamera(mouseNDC, camera);
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(camPlane, hit)){
          hit.z = planeZ;

          if (!boundsRect) {
            jc.setIKTarget(hit);
          } else {
            const dx = Math.abs(hit.x - boundsRect.cx);
            const dy = Math.abs(hit.y - boundsRect.cy);
            if (dx <= boundsRect.halfWidth && dy <= boundsRect.halfHeight) {
              jc.setIKTarget(hit); // inside: track
            }
            // outside: do nothing (arm holds last target)
          }
        }
      }
    }

    // Update joint controller (IK + gripper)
    jc?.update();

    // Physics step
    const now = performance.now();
    const dt  = Math.min(0.04, (now - lastT) / 1000);
    lastT = now;

    if (ballInWorld){
      ballBody.position.z = planeZ;
      ballBody.velocity.z = 0;
    }
    phys?.step?.(ballInWorld ? dt : 0);

    // Update ball position
    if (gripped){
      // Ball is gripped - track attachment site exactly
      const site = getAttachmentSiteWorld();
      if (site){
        ballMesh.position.copy(site.pos);
        ballMesh.quaternion.copy(site.quat);
      }
    } else if (ballInWorld){
      // Ball is in physics simulation
      const rbBox = new THREE.Box3().setFromObject(robotRoot);
      const rbCenter = rbBox.getCenter(new THREE.Vector3());
      
      // Respawn if out of bounds
      if (isOutsideBounds(ballBody.position, rbCenter.x)){
        respawnBall(rbCenter.x);
      } else {
        // Clamp to bounds
        const hw = BOUNDS.halfWidth, hh = BOUNDS.halfHeight;
        ballBody.position.x = THREE.MathUtils.clamp(
          ballBody.position.x, 
          rbCenter.x - hw, 
          rbCenter.x + hw
        );
        ballBody.position.y = THREE.MathUtils.clamp(
          ballBody.position.y, 
          groundY, 
          groundY + 2*hh
        );
      }
      
      // Sync mesh with physics body
      ballMesh.position.set(
        ballBody.position.x, 
        ballBody.position.y, 
        ballBody.position.z
      );
      ballMesh.quaternion.set(
        ballBody.quaternion.x, 
        ballBody.quaternion.y, 
        ballBody.quaternion.z, 
        ballBody.quaternion.w
      );
    }

    renderer.render(scene, camera);
  } catch(err){
    console.error('[main] frame error:', err);
  }
}

// Resize handler
function onResize(){
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

init();
