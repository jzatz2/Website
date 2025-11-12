import * as THREE from 'three';

// ===== Utilities (ES5-safe) =====
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function rotation(angle, axis) {
  var c = Math.cos(angle), s = Math.sin(angle);
  if (axis === 0) return new THREE.Matrix3().set(1,0,0, 0,c,-s, 0,s,c);
  if (axis === 1) return new THREE.Matrix3().set(c,0,s, 0,1,0, -s,0,c);
  return new THREE.Matrix3().set(c,-s,0, s,c,0, 0,0,1);
}
function from3(a){ return new THREE.Vector3(a[0], a[1], a[2]); }
function qFromArr(q){ return new THREE.Quaternion(q[1], q[2], q[3], q[0]); }

// Segment–segment distance in XY
function segDist2D(ax,ay,bx,by, cx,cy,dx,dy){
  var EPS=1e-12;
  function proj(px,py, qx,qy, rx,ry){
    var vx=rx-qx, vy=ry-qy, vv=vx*vx+vy*vy; if(vv===0) vv=EPS;
    var t=((px-qx)*vx+(py-qy)*vy)/vv; if(t<0)t=0; if(t>1)t=1;
    return [qx+t*vx, qy+t*vy];
  }
  var p1=proj(ax,ay, cx,cy, dx,dy);
  var p2=proj(bx,by, cx,cy, dx,dy);
  var p3=proj(cx,cy, ax,ay, bx,by);
  var p4=proj(dx,dy, ax,ay, bx,by);
  var d1=Math.hypot(ax-p1[0], ay-p1[1]);
  var d2=Math.hypot(bx-p2[0], by-p2[1]);
  var d3=Math.hypot(cx-p3[0], cy-p3[1]);
  var d4=Math.hypot(dx-p4[0], dy-p4[1]);
  return Math.min(d1,d2,d3,d4);
}

// ===== IK with limits + collision =====
export class IKSolver {
  constructor(nodes, gripperNodes) {
    this.nodes = nodes;
    this.gripperNodes = gripperNodes;

    // Defensive checks
    if (!nodes || !nodes.base || !nodes.link1 || !nodes.link2 || !nodes.link3 || !nodes.link4 || !nodes.link5 || !nodes.link6) {
      console.error("[IKSolver] nodes missing required links (1..6).", nodes);
    }
    if (!nodes || !nodes.base || !nodes.base.frame || !nodes.base.frame.parent) {
      console.error("[IKSolver] base.frame.parent missing; defaulting to identity.");
      // create a dummy group so matrixWorld exists
      var dummy = new THREE.Group();
      dummy.updateMatrixWorld(true);
      this.rootGroup = dummy;
    } else {
      this.rootGroup = nodes.base.frame.parent;
    }

    // URDF baked frames (DON'T touch your scene graph)
    this.robotConfig = [
      { pos: [0, 0, 0.267], quat: [1, 0, 0, 0], axis: 2 },
      { pos: [0, 0, 0], quat: [0.7071, -0.7071, 0, 0], axis: 2 },
      { pos: [0.0535, -0.2845, 0], quat: [1, 0, 0, 0], axis: 2 },
      { pos: [0.0775, 0.3425, 0], quat: [0.7071, -0.7071, 0, 0], axis: 2 },
      { pos: [0, 0, 0], quat: [0.7071, 0.7071, 0, 0], axis: 2 },
      { pos: [0.076, 0.097, 0], quat: [0.7071, -0.7071, 0, 0], axis: 2 }
    ];

    // l6->gripper base is identity (this removed the old offset)
    this.H_l6_gb = new THREE.Matrix4().identity();

    // Limits: read from userData if present; accept radians or degrees.
    this.limits = {
      q2: this._readLimit(safeGet(nodes,'link2','joint','userData','limit'), -Math.PI*0.9, Math.PI*0.9),
      q3: this._readLimit(safeGet(nodes,'link3','joint','userData','limit'), -Math.PI*0.9, Math.PI*0.9),
      q5: this._readLimit(safeGet(nodes,'link5','joint','userData','limit'), -Math.PI, Math.PI)
    };

    // Collision capsule radii (meters)
    this.radii = { link1: 0.055, link2: 0.055, link3: 0.055, base: 0.10 };

    // Penalties
    this.wCollide = 120.0;
    this.alphaCollide = 0.12;

    this.targetWorld = new THREE.Vector3(0.6, 0.0, 0.6);

    function safeGet(obj){
      for (var i=1;i<arguments.length;i++){
        if (!obj) return undefined;
        obj = obj[arguments[i]];
      }
      return obj;
    }
  }

  _readLimit(limitObj, dmin, dmax){
    if (!limitObj) return {min:dmin, max:dmax};
    var mn = dmin, mx = dmax;
    var hasDeg = (typeof limitObj.min_deg === 'number') || (typeof limitObj.max_deg === 'number');
    if (hasDeg){
      var a = ((typeof limitObj.min_deg === 'number') ? limitObj.min_deg : (dmin*180/Math.PI)) * Math.PI/180.0;
      var b = ((typeof limitObj.max_deg === 'number') ? limitObj.max_deg : (dmax*180/Math.PI)) * Math.PI/180.0;
      mn = a; mx = b;
    } else if (typeof limitObj.min === 'number' && typeof limitObj.max === 'number') {
      if (Math.abs(limitObj.min) > 2*Math.PI || Math.abs(limitObj.max) > 2*Math.PI) {
        mn = limitObj.min * Math.PI/180.0;
        mx = limitObj.max * Math.PI/180.0;
      } else { mn = limitObj.min; mx = limitObj.max; }
    }
    if (mn > mx){ var t=mn; mn=mx; mx=t; }
    return {min: mn, max: mx};
  }

  setTarget(worldVec3) { if (worldVec3) this.targetWorld.copy(worldVec3); }

  // ===== FK to TCP (red sphere attachment) =====
  forwardKinematics(q) {
    try {
      var n = this.nodes;
      if (!n || !n.link1 || !n.link2 || !n.link3 || !n.link4 || !n.link5 || !n.link6) {
        return new THREE.Vector3(0,0,0);
      }
      var qScene = {
        j1: n.link1.joint.rotation.z,
        j2: q[0], j3: q[1],
        j4: n.link4.joint.rotation.z,
        j5: q[2],
        j6: n.link6.joint.rotation.z
      };

      var H = new THREE.Matrix4().identity();
      var order = [
        { cfg: this.robotConfig[0], angle: qScene.j1 },
        { cfg: this.robotConfig[1], angle: qScene.j2 },
        { cfg: this.robotConfig[2], angle: qScene.j3 },
        { cfg: this.robotConfig[3], angle: qScene.j4 },
        { cfg: this.robotConfig[4], angle: qScene.j5 },
        { cfg: this.robotConfig[5], angle: qScene.j6 }
      ];
      for (var i=0;i<order.length;i++) {
        var seg = order[i];
        var p = from3(seg.cfg.pos);
        var qn = qFromArr(seg.cfg.quat);
        var Rf = new THREE.Matrix4().makeRotationFromQuaternion(qn);
        var Tf = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
        var Rj3 = rotation(seg.angle, seg.cfg.axis);
        var e = Rj3.elements;
        var Rj = new THREE.Matrix4();
        Rj.set(e[0],e[3],e[6],0, e[1],e[4],e[7],0, e[2],e[5],e[8],0, 0,0,0,1);
        H.multiply(Tf).multiply(Rf).multiply(Rj);
      }
      var H_root_gb = new THREE.Matrix4().multiplyMatrices(H, this.H_l6_gb);
      var anchorLocal = new THREE.Vector3(0,0,0);
      var gn = this.gripperNodes && this.gripperNodes.base && this.gripperNodes.base.joint;
      if (gn && gn.userData && gn.userData.attachmentAnchorLocal) anchorLocal.copy(gn.userData.attachmentAnchorLocal);

      var tcpRoot = anchorLocal.clone().applyMatrix4(H_root_gb);
      var tcpWorld = tcpRoot.clone().applyMatrix4(this.rootGroup.matrixWorld);
      return tcpWorld;
    } catch (e) {
      console.error("[IKSolver.forwardKinematics] error:", e);
      return new THREE.Vector3(0,0,0);
    }
  }

  // World XY points for collision segments
  fkJointPositions(q){
    var H = new THREE.Matrix4().identity();
    var n = this.nodes;
    var baseWorld = new THREE.Vector3(0,0,0).applyMatrix4(this.rootGroup.matrixWorld);

    function step(Hm, cfg, angle){
      var p = from3(cfg.pos);
      var qn = qFromArr(cfg.quat);
      var Rf = new THREE.Matrix4().makeRotationFromQuaternion(qn);
      var Tf = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
      var Rj3 = rotation(angle, cfg.axis);
      var e = Rj3.elements;
      var Rj = new THREE.Matrix4();
      Rj.set(e[0],e[3],e[6],0, e[1],e[4],e[7],0, e[2],e[5],e[8],0, 0,0,0,1);
      Hm.multiply(Tf).multiply(Rf).multiply(Rj);
    }

    var qScene = {
      j1: n.link1.joint.rotation.z,
      j2: q[0], j3: q[1],
      j4: n.link4.joint.rotation.z,
      j5: q[2], j6: n.link6.joint.rotation.z
    };

    step(H, this.robotConfig[0], qScene.j1);
    step(H, this.robotConfig[1], qScene.j2);
    var p2 = new THREE.Vector3(0,0,0).applyMatrix4(H).applyMatrix4(this.rootGroup.matrixWorld);

    step(H, this.robotConfig[2], qScene.j3);
    var p3 = new THREE.Vector3(0,0,0).applyMatrix4(H).applyMatrix4(this.rootGroup.matrixWorld);

    step(H, this.robotConfig[3], qScene.j4);
    step(H, this.robotConfig[4], qScene.j5);
    step(H, this.robotConfig[5], qScene.j6);
    var p6 = new THREE.Vector3(0,0,0).applyMatrix4(H).applyMatrix4(this.rootGroup.matrixWorld);

    return {
      base: new THREE.Vector2(baseWorld.x, baseWorld.y),
      j2: new THREE.Vector2(p2.x, p2.y),
      j3: new THREE.Vector2(p3.x, p3.y),
      j6: new THREE.Vector2(p6.x, p6.y)
    };
  }

  // Collision energy
  collisionPenalty(q){
    var P = this.fkJointPositions(q), r = this.radii;
    var seg = {
      l1: {a:P.base, b:P.j2, r:r.link1},
      l2: {a:P.j2,   b:P.j3, r:r.link2},
      l3: {a:P.j3,   b:P.j6, r:r.link3}
    };
    var E = 0;
    var pairs = [['l1','l2'],['l2','l3'],['l1','l3']];
    for (var i=0;i<pairs.length;i++){
      var sA=seg[pairs[i][0]], sB=seg[pairs[i][1]];
      var d = segDist2D(sA.a.x,sA.a.y,sA.b.x,sA.b.y, sB.a.x,sB.a.y,sB.b.x,sB.b.y);
      var pen = (sA.r+sB.r) - d;
      if (pen > 0) E += pen*pen;
    }
    var d2 = segDist2D(P.base.x,P.base.y,P.base.x,P.base.y, seg.l2.a.x,seg.l2.a.y,seg.l2.b.x,seg.l2.b.y);
    var pen2 = (r.base + r.link2) - d2;
    if (pen2 > 0) E += 1.5*pen2*pen2;
    var d3 = segDist2D(P.base.x,P.base.y,P.base.x,P.base.y, seg.l3.a.x,seg.l3.a.y,seg.l3.b.x,seg.l3.b.y);
    var pen3 = (r.base + r.link3) - d3;
    if (pen3 > 0) E += 1.5*pen3*pen3;
    return E;
  }

  collisionGrad(q){
    var h = 1e-4, E0 = this.collisionPenalty(q);
    var g = [0,0,0];
    for (var i=0;i<3;i++){
      var qp = q.slice(); qp[i]+=h;
      var Ep = this.collisionPenalty(qp);
      g[i] = (Ep - E0)/h;
    }
    return g;
  }

  computeJacobian(q) {
    var eps = 1e-5;
    var p0 = this.forwardKinematics(q);
    var J = [[0,0,0],[0,0,0]];
    for (var j=0;j<3;j++){
      var qh = q.slice(); qh[j]+=eps;
      var p1 = this.forwardKinematics(qh);
      J[0][j] = (p1.x - p0.x)/eps;
      J[1][j] = (p1.y - p0.y)/eps;
    }
    return J;
  }

  clampQ(q){
    return [
      clamp(q[0], this.limits.q2.min, this.limits.q2.max),
      clamp(q[1], this.limits.q3.min, this.limits.q3.max),
      clamp(q[2], this.limits.q5.min, this.limits.q5.max)
    ];
  }

  // DLS (JJ^T + λI)^-1 J e with collision projection
  solveIK(targetXY, q0, stepSize, iterations, damping) {
    if (stepSize === undefined) stepSize = 0.33;
    if (iterations === undefined) iterations = 180;
    if (damping === undefined) damping = 0.02;

    var q = this.clampQ(q0.slice());
    var maxDelta = 0.12;

    for (var k=0;k<iterations;k++){
      var tcp = this.forwardKinematics(q);
      var ex = targetXY.x - tcp.x;
      var ey = targetXY.y - tcp.y;
      var Ecol = this.collisionPenalty(q);
      if ((ex*ex + ey*ey) < 1e-8 && Ecol < 1e-10) break;

      var J = this.computeJacobian(q);
      var JT = [[J[0][0],J[1][0]],[J[0][1],J[1][1]],[J[0][2],J[1][2]]];

      // A = J J^T + λI (2x2)
      var a11 = J[0][0]*J[0][0] + J[0][1]*J[0][1] + J[0][2]*J[0][2] + damping;
      var a12 = J[0][0]*J[1][0] + J[0][1]*J[1][1] + J[0][2]*J[1][2];
      var a22 = J[1][0]*J[1][0] + J[1][1]*J[1][1] + J[1][2]*J[1][2] + damping;
      var det = a11*a22 - a12*a12;
      var inv00 = 0, inv01 = 0, inv10 = 0, inv11 = 0;
      if (Math.abs(det) > 1e-14){
        inv00 =  a22/det; inv01 = -a12/det;
        inv10 = -a12/det; inv11 =  a11/det;
      }

      // y = A^{-1} e
      var y0 = inv00*ex + inv01*ey;
      var y1 = inv10*ex + inv11*ey;

      // dq = J^T y
      var dq0 = stepSize * (JT[0][0]*y0 + JT[0][1]*y1);
      var dq1 = stepSize * (JT[1][0]*y0 + JT[1][1]*y1);
      var dq2 = stepSize * (JT[2][0]*y0 + JT[2][1]*y1);

      dq0 = clamp(dq0, -maxDelta, maxDelta);
      dq1 = clamp(dq1, -maxDelta, maxDelta);
      dq2 = clamp(dq2, -maxDelta, maxDelta);

      var qNext = [ q[0]+dq0, q[1]+dq1, q[2]+dq2 ];
      qNext = this.clampQ(qNext);

      // collision resolve (few inner steps)
      var E = this.collisionPenalty(qNext);
      var tries = 0;
      while (E > 0 && tries < 6){
        var g = this.collisionGrad(qNext);
        qNext[0] -= this.alphaCollide * this.wCollide * g[0];
        qNext[1] -= this.alphaCollide * this.wCollide * g[1];
        qNext[2] -= this.alphaCollide * this.wCollide * g[2];
        qNext = this.clampQ(qNext);
        var E2 = this.collisionPenalty(qNext);
        if (E2 <= E) { E = E2; } else { break; }
        tries++;
      }

      q = qNext;
    }
    return this.clampQ(q);
  }
}
