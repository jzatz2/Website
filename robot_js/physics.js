import * as CANNON from 'cannon-es';
import * as THREE from 'three';

// Shrink link colliders so contact matches visuals (less "hover")
const COLLIDER_SHRINK = { x: 0.6, y: 0.5, z: 0.6 };

function makeLocalBoxForObject(obj){
  obj.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  const centerWorld = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(centerWorld);
  if (!isFinite(size.x) || size.length() === 0) return null;

  size.x = Math.max(1e-4, size.x * COLLIDER_SHRINK.x);
  size.y = Math.max(1e-4, size.y * COLLIDER_SHRINK.y);
  size.z = Math.max(1e-4, size.z * COLLIDER_SHRINK.z);

  const p = new THREE.Vector3(); obj.getWorldPosition(p);
  const q = new THREE.Quaternion(); obj.getWorldQuaternion(q);
  const offsetWorld = centerWorld.clone().sub(p);
  const qInv = q.clone().invert();
  const offsetLocal = offsetWorld.applyQuaternion(qInv);

  return {
    halfExtents: new CANNON.Vec3(size.x/2, size.y/2, size.z/2),
    localOffset: new CANNON.Vec3(offsetLocal.x, offsetLocal.y, offsetLocal.z)
  };
}

function setBodyFromObject(body, obj){
  obj.updateWorldMatrix(true, true);
  const wpos = new THREE.Vector3();
  const wquat = new THREE.Quaternion();
  obj.getWorldPosition(wpos);
  obj.getWorldQuaternion(wquat);
  body.position.set(wpos.x, wpos.y, wpos.z);
  body.quaternion.set(wquat.x, wquat.y, wquat.z, wquat.w);
  body.aabbNeedsUpdate = true;
}

export class PhysicsWorld {
  constructor(){
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.81, 0),
      allowSleep: false
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // Stiff contacts (less squish), more iterations, fine substeps
    this.world.solver.iterations = 40;
    this.world.solver.tolerance  = 3e-4;

    this.world.defaultContactMaterial.restitution = 0.05;
    this.world.defaultContactMaterial.friction    = 0.9;
    this.world.defaultContactMaterial.contactEquationStiffness  = 1e8;
    this.world.defaultContactMaterial.contactEquationRelaxation = 3;
    this.world.defaultContactMaterial.frictionEquationStiffness = 1e8;
    this.world.defaultContactMaterial.frictionEquationRelaxation= 3;

    const armMat  = new CANNON.Material('arm');
    const ballMat = new CANNON.Material('ball');
    this.armMaterial  = armMat;
    this.ballMaterial = ballMat;

    this.world.addContactMaterial(new CANNON.ContactMaterial(armMat, ballMat, {
      restitution: 0.04,
      friction: 0.95,
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3,
      frictionEquationStiffness: 1e8,
      frictionEquationRelaxation: 3
    }));

    this.fixedTimeStep = 1/360;
    this.maxSubSteps   = 16;

    this.kinematics = []; // { body, obj }
  }

  addGround(groundY = 0){
    const shape = new CANNON.Plane();
    const body  = new CANNON.Body({ mass: 0, material: this.armMaterial });
    body.addShape(shape);
    body.position.set(0, groundY, 0);
    body.quaternion.setFromEuler(-Math.PI/2, 0, 0);
    body.collisionFilterGroup = 2;  // static/arm group
    body.collisionFilterMask  = 1 | 2;
    this.world.addBody(body);
    return body;
  }

  addDynamicSphere({ radius=0.016, position=[0,0,0], restitution=0.05, mass=0.06 }){
    const shape = new CANNON.Sphere(radius);
    const body  = new CANNON.Body({ mass, shape, material: this.ballMaterial });
    body.position.set(position[0], position[1], position[2]);
    body.linearDamping  = 0.05;
    body.angularDamping = 0.06;
    body.allowSleep = false;
    body.collisionFilterGroup = 1;        // dynamic group
    body.collisionFilterMask  = 1 | 2;    // collide with static/arm
    this.world.addBody(body);
    return body;
  }

  addKinematicAnchorFor(obj, radius=0.004){
    const shape = new CANNON.Sphere(radius);
    const body  = new CANNON.Body({ mass: 0, material: this.armMaterial });
    body.type = CANNON.Body.KINEMATIC;
    body.addShape(shape);
    setBodyFromObject(body, obj);
    body.collisionFilterGroup = 2;
    body.collisionFilterMask  = 0; // no collisions; constraint-only
    this.world.addBody(body);
    this.kinematics.push({ body, obj });
    return body;
  }

  addKinematicBoxFor(obj){
    const spec = makeLocalBoxForObject(obj);
    if (!spec) return null;
    const shape = new CANNON.Box(spec.halfExtents);
    const body  = new CANNON.Body({ mass: 0, material: this.armMaterial });
    body.type = CANNON.Body.KINEMATIC;
    body.addShape(shape, spec.localOffset);
    body.collisionFilterGroup = 2;
    body.collisionFilterMask  = 1 | 2;
    setBodyFromObject(body, obj);
    this.world.addBody(body);
    this.kinematics.push({ body, obj });
    return body;
  }

  addBoundsSquare({
    cx, cy, planeZ=0, groundY=0,
    halfWidth=0.8, halfHeight=0.8,
    wallThickness=0.06,
    wallDepth=0.35
  }){
    const topY = groundY + 2*halfHeight;
    const z0   = planeZ;

    const addStaticBox = (x,y,z,hx,hy,hz) => {
      const shape = new CANNON.Box(new CANNON.Vec3(hx,hy,hz));
      const body  = new CANNON.Body({ mass: 0, material: this.armMaterial });
      body.addShape(shape);
      body.position.set(x,y,z);
      body.collisionFilterGroup = 2;
      body.collisionFilterMask  = 1 | 2;
      this.world.addBody(body);
      return body;
    };

    // Left & Right walls
    addStaticBox(cx - halfWidth, groundY + halfHeight, z0, wallThickness, halfHeight, wallDepth);
    addStaticBox(cx + halfWidth, groundY + halfHeight, z0, wallThickness, halfHeight, wallDepth);
    // Ceiling
    addStaticBox(cx, topY, z0, halfWidth, wallThickness, wallDepth);
    // Bottom lip
    addStaticBox(cx, groundY + wallThickness, z0, halfWidth, wallThickness, wallDepth);
  }

  createP2P(bodyA, bodyB, pivotA=new CANNON.Vec3(), pivotB=new CANNON.Vec3()){
    const c = new CANNON.PointToPointConstraint(bodyA, pivotA, bodyB, pivotB, 1e10);
    this.world.addConstraint(c);
    return c;
  }
  createLock(bodyA, bodyB, maxForce=1e12){
    const c = new CANNON.LockConstraint(bodyA, bodyB, { maxForce });
    this.world.addConstraint(c);
    return c;
  }
  removeConstraint(c){
    if (!c) return;
    this.world.removeConstraint(c);
  }

  step(dt){
    for (const k of this.kinematics){
      setBodyFromObject(k.body, k.obj);
      k.body.velocity.set(0,0,0);
      k.body.angularVelocity.set(0,0,0);
    }
    this.world.step(this.fixedTimeStep, dt, this.maxSubSteps);
  }
}
